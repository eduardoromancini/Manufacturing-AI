import json
import sqlite3
import os
import http.server

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE_DIR, "manufacturing.db")

def query(sql, params=()):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(sql, params).fetchall()
    result = [dict(r) for r in rows]
    conn.close()
    return result

ROUTES = {
    "/api/customers": "SELECT * FROM customers ORDER BY id",
    "/api/material_groups": "SELECT * FROM material_groups ORDER BY id",
    "/api/materials": """
        SELECT m.*, mg.name as group_name
        FROM materials m
        JOIN material_groups mg ON mg.id = m.group_id
        ORDER BY m.id
    """,
    "/api/resources": "SELECT * FROM resources ORDER BY type, code",
    "/api/statuses": "SELECT * FROM sales_status ORDER BY id",
    "/api/sales": """
        SELECT sh.id, sh.customer_id, c.name as customer_name,
               sh.status_id, ss.name as status, ss.description as status_desc,
               sh.total_price
        FROM sales_header sh
        JOIN customers c ON c.id = sh.customer_id
        JOIN sales_status ss ON ss.id = sh.status_id
        ORDER BY sh.id
    """,
    "/api/items": """
        SELECT si.id, si.sales_header_id, si.material_id, m.description as material,
               si.quantity, si.unit_price, si.total_price, si.due_date
        FROM sales_items si
        JOIN materials m ON m.id = si.material_id
        ORDER BY si.sales_header_id, si.id
    """,
}

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json",
    ".ico": "image/x-icon",
}

STATIC_FILES = ("index.html", "styles.css", "app.js")

# ── WSGI app for gunicorn ──

def app(environ, start_response):
    path = environ.get("PATH_INFO", "/").split("?")[0]

    if path in ROUTES:
        data = json.dumps(query(ROUTES[path])).encode()
        start_response("200 OK", [
            ("Content-Type", "application/json"),
            ("Cache-Control", "no-cache"),
            ("Content-Length", str(len(data))),
        ])
        return [data]

    if path == "/":
        path = "/index.html"

    filename = path.lstrip("/")
    if filename in STATIC_FILES:
        file_path = os.path.join(BASE_DIR, filename)
        if os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1]
            with open(file_path, "rb") as f:
                body = f.read()
            start_response("200 OK", [
                ("Content-Type", MIME.get(ext, "application/octet-stream")),
                ("Content-Length", str(len(body))),
            ])
            return [body]

    start_response("404 Not Found", [("Content-Type", "text/plain")])
    return [b"Not Found"]

# ── Standalone dev server ──

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]

        if path in ROUTES:
            data = query(ROUTES[path])
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
            return

        if path == "/":
            path = "/index.html"

        filename = path.lstrip("/")
        if filename in STATIC_FILES:
            file_path = os.path.join(BASE_DIR, filename)
            if os.path.isfile(file_path):
                ext = os.path.splitext(file_path)[1]
                self.send_response(200)
                self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
                return

        self.send_response(404)
        self.end_headers()

    def log_message(self, fmt, *args):
        pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    server = http.server.HTTPServer(("0.0.0.0", port), Handler)
    print(f"Server running on http://localhost:{port}")
    server.serve_forever()
