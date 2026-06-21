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
        SELECT m.id, m.description, m.unit, m.group_id, mg.name as group_name
        FROM materials m
        JOIN material_groups mg ON mg.id = m.group_id
        ORDER BY m.id
    """,
    "/api/resource_groups": "SELECT * FROM resource_groups ORDER BY id",
    "/api/resources": """
        SELECT res.id, res.code, res.description, res.short_desc,
               res.group_id, rg.name as group_name,
               res.capacity, res.location, res.status
        FROM resources res
        JOIN resource_groups rg ON rg.id = res.group_id
        ORDER BY rg.name, res.code
    """,
    "/api/routing": """
        SELECT r.id, r.material_group_id, mg.name as group_name,
               r.resource_id, res.code as resource_code, res.short_desc as resource_name,
               r.time_per_unit, r.time_unit
        FROM routing r
        JOIN material_groups mg ON mg.id = r.material_group_id
        JOIN resources res ON res.id = r.resource_id
        ORDER BY r.material_group_id, r.resource_id
    """,
    "/api/statuses": "SELECT * FROM sales_status ORDER BY id",
    "/api/sales": """
        SELECT sh.id, sh.customer_id, c.name as customer_name,
               sh.status_id, ss.name as status,
               COALESCE((SELECT SUM(total_price) FROM sales_items WHERE sales_header_id = sh.id), 0) as total_price
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
    "/api/production_orders": """
        SELECT po.id, po.routing_id, po.sales_header_id, po.sales_item_id,
               po.quantity, po.due_date,
               r.time_per_unit, r.time_unit,
               ROUND(r.time_per_unit * po.quantity, 1) as total_time,
               ROUND(r.time_per_unit * po.quantity / 60.0, 2) as total_hours,
               res.code as resource_code, res.short_desc as resource_name,
               mg.name as material_group,
               m.description as material,
               c.name as customer,
               ss.name as status
        FROM production_orders po
        JOIN routing r ON r.id = po.routing_id
        JOIN resources res ON res.id = r.resource_id
        JOIN material_groups mg ON mg.id = r.material_group_id
        JOIN sales_items si ON si.id = po.sales_item_id
        JOIN materials m ON m.id = si.material_id
        JOIN sales_header sh ON sh.id = po.sales_header_id
        JOIN customers c ON c.id = sh.customer_id
        JOIN sales_status ss ON ss.id = sh.status_id
        ORDER BY po.due_date, po.id
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

def compute_load():
    rows = query("""
        SELECT po.due_date, r.resource_id,
               SUM(r.time_per_unit * po.quantity / 60.0) as hours
        FROM production_orders po
        JOIN routing r ON r.id = po.routing_id
        JOIN sales_header sh ON sh.id = po.sales_header_id
        JOIN sales_status ss ON ss.id = sh.status_id
        WHERE po.due_date IS NOT NULL
          AND ss.name NOT IN ('closed', 'cancelled', 'delivered')
        GROUP BY po.due_date, r.resource_id
    """)
    return rows

# ── WSGI app for gunicorn ──

def handle_special(path):
    if path == "/api/load":
        return compute_load()
    return None

def app(environ, start_response):
    path = environ.get("PATH_INFO", "/").split("?")[0]

    special = handle_special(path)
    if special is not None:
        data = json.dumps(special).encode()
        start_response("200 OK", [
            ("Content-Type", "application/json"),
            ("Cache-Control", "no-cache"),
            ("Content-Length", str(len(data))),
        ])
        return [data]

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

        special = handle_special(path)
        if special is not None:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(json.dumps(special).encode())
            return

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
