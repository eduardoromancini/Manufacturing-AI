import sqlite3, os

db_path = os.path.join(os.path.dirname(__file__), "manufacturing.db")
if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
conn.execute("PRAGMA foreign_keys = ON")
conn.executescript(open("database.sql").read())

# Sales Status
statuses = [
    ("draft", "Order created but not yet submitted"),
    ("pending", "Awaiting internal approval"),
    ("approved", "Approved and ready for production"),
    ("in_production", "Materials being manufactured"),
    ("shipped", "Order dispatched to customer"),
    ("delivered", "Customer confirmed receipt"),
    ("invoiced", "Invoice sent to customer"),
    ("closed", "Payment received, order complete"),
    ("cancelled", "Order cancelled"),
]
conn.executemany("INSERT INTO sales_status (name, description) VALUES (?, ?)", statuses)

# Resource Groups: 1=Calandras, 2=Montadoras, 3=Prensas
resource_groups = [
    ("Calandras",),
    ("Montadoras",),
    ("Prensas",),
]
conn.executemany("INSERT INTO resource_groups (name) VALUES (?)", resource_groups)

# Resources: code, description, short_desc, group_id (FK), capacity, location, status
resources = [
    ("CAL-01", "Calandra 4 Rolos 2200mm - Revestimento de Lonas", "Calandra 01", 1, "2200mm largura / 15 t/h", "Galpao A - Calandragem", "active"),
    ("CAL-02", "Calandra 4 Rolos 1800mm - Friccao de Borracha", "Calandra 02", 1, "1800mm largura / 12 t/h", "Galpao A - Calandragem", "active"),
    ("CAL-03", "Calandra 3 Rolos 1600mm - Cobertura Superior/Inferior", "Calandra 03", 1, "1600mm largura / 10 t/h", "Galpao A - Calandragem", "maintenance"),
    ("PRS-01", "Prensa Vulcanizadora Plana 12m x 2.2m", "Prensa 01", 3, "12m comprimento / 200 ton", "Galpao B - Vulcanizacao", "active"),
    ("PRS-02", "Prensa Vulcanizadora Plana 8m x 1.8m", "Prensa 02", 3, "8m comprimento / 150 ton", "Galpao B - Vulcanizacao", "active"),
    ("PRS-03", "Prensa Vulcanizadora Rotativa Continua", "Prensa 03", 3, "Continua / 180 ton", "Galpao B - Vulcanizacao", "active"),
    ("PRS-04", "Prensa de Emenda a Quente Portatil", "Prensa 04", 3, "2.4m largura / 80 ton", "Galpao B - Vulcanizacao", "active"),
    ("MNT-01", "Montadora de Correias Cabo de Aco - Linha 1", "Montadora 01", 2, "3200mm largura / ST ate 5000 N/mm", "Galpao C - Montagem", "active"),
    ("MNT-02", "Montadora de Correias Cabo de Aco - Linha 2", "Montadora 02", 2, "2400mm largura / ST ate 3150 N/mm", "Galpao C - Montagem", "active"),
    ("MNT-03", "Montadora de Correias de Lona PN/NN", "Montadora 03", 2, "2200mm largura / ate 5 lonas", "Galpao C - Montagem", "active"),
    ("MNT-04", "Montadora de Correias Tubulares", "Montadora 04", 2, "1200mm diametro max", "Galpao C - Montagem", "inactive"),
]
conn.executemany(
    "INSERT INTO resources (code, description, short_desc, group_id, capacity, location, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    resources,
)

# Customers
customers = [
    ("Vale S.A.", "compras@vale.com", "+55 21 3485-3000"),
    ("Gerdau", "suprimentos@gerdau.com.br", "+55 51 3323-2000"),
    ("CSN - Companhia Siderurgica Nacional", "procurement@csn.com.br", "+55 24 3383-1000"),
    ("Votorantim Cimentos", "compras@vcimentos.com.br", "+55 11 3593-8000"),
    ("Usiminas", "materiais@usiminas.com", "+55 31 3499-8000"),
    ("Mosaic Fertilizantes", "purchasing@mosaicco.com", "+55 11 3527-6000"),
    ("Anglo American Brasil", "supply@angloamerican.com", "+55 31 3516-7000"),
    ("Samarco Mineracao", "compras@samarco.com", "+55 31 3749-3000"),
    ("Intercement Brasil", "suprimentos@intercement.com", "+55 11 2122-3000"),
    ("MRN - Mineracao Rio do Norte", "compras@mrn.com.br", "+55 21 2555-5000"),
]
conn.executemany("INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)", customers)

# Material Groups
material_groups = [
    ("Cabo Leve", "Correias de cabo de aco ate 1250 N/mm"),
    ("Cabo Pesada", "Correias de cabo de aco acima de 1250 N/mm"),
    ("Textil Leve", "Correias de lona, laminadas e tubulares leves"),
    ("Textil Pesada", "Correias de lona pesada, aramida e tubulares pesadas"),
]
conn.executemany("INSERT INTO material_groups (name, description) VALUES (?, ?)", material_groups)

# Materials: description, unit, group_id (FK)
materials = [
    ("Correia Transportadora Cabo de Aco Mercurio ST 800 N/mm", "M", 1),
    ("Correia Transportadora Cabo de Aco Mercurio ST 1250 N/mm", "M", 1),
    ("Correia Transportadora Cabo de Aco Mercurio ST 2000 N/mm", "M", 2),
    ("Correia Transportadora Cabo de Aco Mercurio ST 3150 N/mm", "M", 2),
    ("Correia Transportadora Lona PN 300/3 Poliester/Nylon 3 lonas", "M", 3),
    ("Correia Transportadora Lona PN 500/4 Poliester/Nylon 4 lonas", "M", 3),
    ("Correia Transportadora Lona PN 800/5 Poliester/Nylon 5 lonas", "M", 4),
    ("Correia Transportadora Lona NN 300/3 Nylon/Nylon 3 lonas", "M", 3),
    ("Correia Transportadora Lona NN 500/4 Nylon/Nylon 4 lonas", "M", 3),
    ("Correia Transportadora Lona NN 630/4 Nylon/Nylon 4 lonas", "M", 4),
    ("Correia Transportadora Aramida 1000 N/mm", "M", 4),
    ("Correia Transportadora Aramida 1600 N/mm", "M", 4),
    ("Correia Laminada 3 lonas texteis", "M", 3),
    ("Correia Laminada 5 lonas texteis", "M", 4),
    ("Correia Transportadora Tubular 800mm diametro", "M", 3),
    ("Correia Transportadora Tubular 1200mm diametro", "M", 4),
    ("Kit Emenda a Quente para Correia Cabo de Aco", "UN", 2),
    ("Kit Emenda a Frio para Correia de Lona", "UN", 3),
    ("Raspador Primario Mercurio linha pesada", "UN", 2),
    ("Raspador Secundario Mercurio", "UN", 1),
    ("Sistema de Monitoramento HX 170", "UN", 1),
    ("Sistema de Monitoramento HX 270 avancado", "UN", 2),
]
conn.executemany("INSERT INTO materials (description, unit, group_id) VALUES (?, ?, ?)", materials)

# Routing: material_group_id, resource_id, time_per_unit, time_unit
routing = [
    (1, 1, 20, "min"), (1, 2, 25, "min"), (1, 4, 45, "min"),
    (1, 5, 50, "min"), (1, 8, 60, "min"), (1, 9, 65, "min"),
    (2, 1, 35, "min"), (2, 4, 90, "min"), (2, 6, 70, "min"), (2, 8, 120, "min"),
    (3, 1, 12, "min"), (3, 2, 15, "min"), (3, 5, 30, "min"),
    (3, 6, 25, "min"), (3, 7, 20, "min"), (3, 10, 40, "min"),
    (4, 1, 18, "min"), (4, 2, 22, "min"), (4, 4, 55, "min"),
    (4, 5, 60, "min"), (4, 8, 80, "min"), (4, 9, 85, "min"), (4, 10, 50, "min"),
]
conn.executemany("INSERT INTO routing (material_group_id, resource_id, time_per_unit, time_unit) VALUES (?, ?, ?, ?)", routing)

# Sales headers: customer_id, status_id (no total_price — derived from items)
sales = [
    (1, 8),   (2, 8),   (3, 7),   (4, 4),   (5, 3),
    (6, 8),   (7, 2),   (8, 4),   (9, 1),   (10, 5),
]
conn.executemany("INSERT INTO sales_header (customer_id, status_id) VALUES (?, ?)", sales)

# Sales items: sales_header_id, material_id, quantity, unit_price, due_date
items = [
    (1, 4, 1200, 5980.00, "2026-03-15"), (1, 3, 800, 4120.00, "2026-03-15"),
    (1, 17, 4, 8500.00, "2026-02-28"),   (1, 22, 2, 58000.00, "2026-04-01"),
    (2, 6, 500, 680.00, "2026-04-10"),   (2, 7, 300, 1050.00, "2026-04-10"),
    (2, 19, 6, 4600.00, "2026-03-20"),   (2, 20, 6, 2800.00, "2026-03-20"),
    (3, 2, 600, 2740.00, "2026-05-01"),  (3, 15, 400, 2200.00, "2026-05-15"),
    (3, 18, 3, 3200.00, "2026-04-20"),   (3, 21, 1, 32000.00, "2026-06-01"),
    (4, 8, 350, 390.00, "2026-07-10"),   (4, 10, 250, 780.00, "2026-07-10"),
    (4, 18, 2, 3200.00, "2026-06-25"),
    (5, 11, 200, 3200.00, "2026-07-20"), (5, 16, 300, 3400.00, "2026-08-01"),
    (5, 17, 2, 8500.00, "2026-07-15"),
    (6, 5, 800, 420.00, "2026-06-15"),   (6, 6, 600, 680.00, "2026-06-15"),
    (6, 13, 400, 310.00, "2026-06-01"),  (6, 20, 4, 2800.00, "2026-05-20"),
    (7, 4, 2000, 5980.00, "2026-08-15"), (7, 12, 500, 4850.00, "2026-09-01"),
    (7, 22, 3, 58000.00, "2026-09-15"),  (7, 19, 8, 4600.00, "2026-08-01"),
    (8, 1, 1500, 1850.00, "2026-08-20"), (8, 2, 1000, 2740.00, "2026-09-01"),
    (8, 17, 6, 8500.00, "2026-08-10"),   (8, 19, 10, 4600.00, "2026-08-15"),
    (9, 13, 600, 310.00, "2026-07-30"),  (9, 14, 300, 490.00, "2026-07-30"),
    (9, 9, 400, 640.00, "2026-08-10"),
    (10, 15, 800, 2200.00, "2026-09-10"), (10, 16, 500, 3400.00, "2026-09-20"),
    (10, 22, 1, 58000.00, "2026-10-01"),  (10, 21, 2, 32000.00, "2026-09-15"),
]
conn.executemany(
    "INSERT INTO sales_items (sales_header_id, material_id, quantity, unit_price, due_date) VALUES (?, ?, ?, ?, ?)",
    items,
)

# Generate production orders from sales_items x routing
conn.execute("""
    INSERT INTO production_orders (routing_id, sales_header_id, sales_item_id, quantity, due_date)
    SELECT r.id, si.sales_header_id, si.id, si.quantity, si.due_date
    FROM sales_items si
    JOIN materials m ON m.id = si.material_id
    JOIN routing r ON r.material_group_id = m.group_id
    WHERE si.due_date IS NOT NULL
    ORDER BY si.due_date, si.id, r.id
""")

conn.commit()

# Summary
print("=== TABLES ===")
for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name"):
    count = conn.execute(f"SELECT COUNT(*) FROM [{r[0]}]").fetchone()[0]
    print(f"  {r[0]:25s} {count:>5d} rows")

print(f"\n=== SALES (total_price derived via SUM) ===")
for r in conn.execute("""
    SELECT sh.id, c.name, ss.name,
           COALESCE((SELECT SUM(total_price) FROM sales_items WHERE sales_header_id = sh.id), 0) as total
    FROM sales_header sh
    JOIN customers c ON c.id = sh.customer_id
    JOIN sales_status ss ON ss.id = sh.status_id
    ORDER BY sh.id
"""):
    print(f"  #{r[0]:2d}  {r[2]:15s}  R$ {r[3]:>14,.2f}  {r[1]}")

print(f"\n=== PRODUCTION ORDERS (sample) ===")
for r in conn.execute("""
    SELECT po.id, po.routing_id, po.sales_header_id, po.sales_item_id, po.quantity, po.due_date,
           res.code, r.time_per_unit
    FROM production_orders po
    JOIN routing r ON r.id = po.routing_id
    JOIN resources res ON res.id = r.resource_id
    ORDER BY po.id
    LIMIT 10
"""):
    print(f"  PO#{r[0]:3d}  routing={r[1]:2d}  SO={r[2]:2d}  item={r[3]:2d}  qty={r[4]:>6.0f}  {r[6]}  {r[7]}min/un  due={r[5]}")

conn.close()
