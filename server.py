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

def compute_production_orders():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    rows = conn.execute("""
        SELECT si.id as sales_item_id, si.sales_header_id, si.quantity, si.due_date,
               m.group_id as material_group_id
        FROM sales_items si
        JOIN materials m ON m.id = si.material_id
        JOIN sales_header sh ON sh.id = si.sales_header_id
        JOIN sales_status ss ON ss.id = sh.status_id
        WHERE si.due_date IS NOT NULL
        ORDER BY si.due_date, si.id
    """).fetchall()

    routing_rows = conn.execute("""
        SELECT r.id as routing_id, r.material_group_id, r.resource_id,
               r.time_per_unit, r.time_unit,
               mg.name as material_group,
               res.code as resource_code, res.short_desc as resource_name
        FROM routing r
        JOIN material_groups mg ON mg.id = r.material_group_id
        JOIN resources res ON res.id = r.resource_id
    """).fetchall()

    items_display = {r["sales_item_id"]: r for r in conn.execute("""
        SELECT si.id as sales_item_id, si.sales_header_id,
               m.description as material,
               c.name as customer,
               ss.name as status
        FROM sales_items si
        JOIN materials m ON m.id = si.material_id
        JOIN sales_header sh ON sh.id = si.sales_header_id
        JOIN customers c ON c.id = sh.customer_id
        JOIN sales_status ss ON ss.id = sh.status_id
    """).fetchall()}
    conn.close()

    routing_map = {}
    routing_lookup = {}
    for r in routing_rows:
        rd = dict(r)
        key = r["material_group_id"]
        if key not in routing_map:
            routing_map[key] = []
        routing_map[key].append(rd)
        routing_lookup[r["routing_id"]] = rd

    orders = []
    po_id = 0
    for item in rows:
        routes = routing_map.get(item["material_group_id"], [])
        disp = items_display.get(item["sales_item_id"], {})
        for rt in routes:
            po_id += 1
            total_time = rt["time_per_unit"] * item["quantity"]
            orders.append({
                "po_id": po_id,
                "routing_id": rt["routing_id"],
                "sales_header_id": item["sales_header_id"],
                "sales_item_id": item["sales_item_id"],
                "quantity": item["quantity"],
                "total_time": round(total_time, 1),
                "total_hours": round(total_time / 60, 2),
                "due_date": item["due_date"],
                "customer": disp.get("customer", ""),
                "status": disp.get("status", ""),
                "material": disp.get("material", ""),
                "material_group": rt["material_group"],
                "resource_code": rt["resource_code"],
                "resource_name": rt["resource_name"],
                "time_per_unit": rt["time_per_unit"],
                "time_unit": rt["time_unit"],
            })
    return orders

def compute_load():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    rows = conn.execute("""
        SELECT si.id, si.quantity, si.due_date,
               m.group_id as material_group_id
        FROM sales_items si
        JOIN materials m ON m.id = si.material_id
        JOIN sales_header sh ON sh.id = si.sales_header_id
        JOIN sales_status ss ON ss.id = sh.status_id
        WHERE si.due_date IS NOT NULL
          AND ss.name NOT IN ('closed', 'cancelled', 'delivered')
    """).fetchall()

    routing_rows = conn.execute("""
        SELECT material_group_id, resource_id, time_per_unit, time_unit
        FROM routing
    """).fetchall()
    conn.close()

    routing_map = {}
    for r in routing_rows:
        key = r["material_group_id"]
        if key not in routing_map:
            routing_map[key] = []
        routing_map[key].append(dict(r))

    load = {}
    for item in rows:
        due = item["due_date"]
        mg = item["material_group_id"]
        qty = item["quantity"]
        routes = routing_map.get(mg, [])
        for rt in routes:
            rid = rt["resource_id"]
            minutes = rt["time_per_unit"] * qty
            hours = minutes / 60.0
            k = f"{due}_{rid}"
            if k not in load:
                load[k] = {"date": due, "resource_id": rid, "hours": 0}
            load[k]["hours"] += hours

    return list(load.values())

# ── WSGI app for gunicorn ──

def handle_special(path):
    if path == "/api/load":
        return compute_load()
    if path == "/api/production_orders":
        return compute_production_orders()
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
