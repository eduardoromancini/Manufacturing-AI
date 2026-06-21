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

# Resources (code, description, type, capacity, location, status)
# Resources: code, description, short_desc, resource_group, type, capacity, location, status
resources = [
    ("CAL-01", "Calandra 4 Rolos 2200mm - Revestimento de Lonas", "Calandra 01", "Calandras", "calandra", "2200mm largura / 15 t/h", "Galpao A - Calandragem", "active"),
    ("CAL-02", "Calandra 4 Rolos 1800mm - Friccao de Borracha", "Calandra 02", "Calandras", "calandra", "1800mm largura / 12 t/h", "Galpao A - Calandragem", "active"),
    ("CAL-03", "Calandra 3 Rolos 1600mm - Cobertura Superior/Inferior", "Calandra 03", "Calandras", "calandra", "1600mm largura / 10 t/h", "Galpao A - Calandragem", "maintenance"),
    ("PRS-01", "Prensa Vulcanizadora Plana 12m x 2.2m", "Prensa 01", "Prensas", "prensa", "12m comprimento / 200 ton", "Galpao B - Vulcanizacao", "active"),
    ("PRS-02", "Prensa Vulcanizadora Plana 8m x 1.8m", "Prensa 02", "Prensas", "prensa", "8m comprimento / 150 ton", "Galpao B - Vulcanizacao", "active"),
    ("PRS-03", "Prensa Vulcanizadora Rotativa Continua", "Prensa 03", "Prensas", "prensa", "Continua / 180 ton", "Galpao B - Vulcanizacao", "active"),
    ("PRS-04", "Prensa de Emenda a Quente Portatil", "Prensa 04", "Prensas", "prensa", "2.4m largura / 80 ton", "Galpao B - Vulcanizacao", "active"),
    ("MNT-01", "Montadora de Correias Cabo de Aco - Linha 1", "Montadora 01", "Montadoras", "montadora", "3200mm largura / ST ate 5000 N/mm", "Galpao C - Montagem", "active"),
    ("MNT-02", "Montadora de Correias Cabo de Aco - Linha 2", "Montadora 02", "Montadoras", "montadora", "2400mm largura / ST ate 3150 N/mm", "Galpao C - Montagem", "active"),
    ("MNT-03", "Montadora de Correias de Lona PN/NN", "Montadora 03", "Montadoras", "montadora", "2200mm largura / ate 5 lonas", "Galpao C - Montagem", "active"),
    ("MNT-04", "Montadora de Correias Tubulares", "Montadora 04", "Montadoras", "montadora", "1200mm diametro max", "Galpao C - Montagem", "inactive"),
]
conn.executemany(
    "INSERT INTO resources (code, description, short_desc, resource_group, type, capacity, location, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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
# 1=Cabo Leve, 2=Cabo Pesada, 3=Textil Leve, 4=Textil Pesada
material_groups = [
    ("Cabo Leve", "Correias de cabo de aco ate 1250 N/mm"),
    ("Cabo Pesada", "Correias de cabo de aco acima de 1250 N/mm"),
    ("Textil Leve", "Correias de lona, laminadas e tubulares leves"),
    ("Textil Pesada", "Correias de lona pesada, aramida e tubulares pesadas"),
]
conn.executemany("INSERT INTO material_groups (name, description) VALUES (?, ?)", material_groups)

# Materials (description, unit, group_id)
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

# Routing: material_group_id, resource_id, time_per_unit (min)
# Groups: 1=Cabo Leve, 2=Cabo Pesada, 3=Textil Leve, 4=Textil Pesada
# Resources: 1=CAL-01, 2=CAL-02, 3=CAL-03, 4=PRS-01, 5=PRS-02, 6=PRS-03, 7=PRS-04, 8=MNT-01, 9=MNT-02, 10=MNT-03, 11=MNT-04
routing = [
    # Cabo Leve
    (1, 1, 20, "min"),   # CAL-01: 20 min/un
    (1, 2, 25, "min"),   # CAL-02: 25 min/un
    (1, 4, 45, "min"),   # PRS-01: 45 min/un
    (1, 5, 50, "min"),   # PRS-02: 50 min/un
    (1, 8, 60, "min"),   # MNT-01: 60 min/un
    (1, 9, 65, "min"),   # MNT-02: 65 min/un

    # Cabo Pesada
    (2, 1, 35, "min"),   # CAL-01: 35 min/un
    (2, 4, 90, "min"),   # PRS-01: 90 min/un
    (2, 6, 70, "min"),   # PRS-03: 70 min/un
    (2, 8, 120, "min"),  # MNT-01: 120 min/un

    # Textil Leve
    (3, 1, 12, "min"),   # CAL-01: 12 min/un
    (3, 2, 15, "min"),   # CAL-02: 15 min/un
    (3, 5, 30, "min"),   # PRS-02: 30 min/un
    (3, 6, 25, "min"),   # PRS-03: 25 min/un
    (3, 7, 20, "min"),   # PRS-04: 20 min/un
    (3, 10, 40, "min"),  # MNT-03: 40 min/un

    # Textil Pesada
    (4, 1, 18, "min"),   # CAL-01: 18 min/un
    (4, 2, 22, "min"),   # CAL-02: 22 min/un
    (4, 4, 55, "min"),   # PRS-01: 55 min/un
    (4, 5, 60, "min"),   # PRS-02: 60 min/un
    (4, 8, 80, "min"),   # MNT-01: 80 min/un
    (4, 9, 85, "min"),   # MNT-02: 85 min/un
    (4, 10, 50, "min"),  # MNT-03: 50 min/un
]
conn.executemany("INSERT INTO routing (material_group_id, resource_id, time_per_unit, time_unit) VALUES (?, ?, ?, ?)", routing)

# Sales headers (status_id: 1=draft,2=pending,3=approved,4=in_production,5=shipped,6=delivered,7=invoiced,8=closed,9=cancelled)
sales = [
    (1, 8, 0),   # Vale - closed
    (2, 8, 0),   # Gerdau - closed
    (3, 7, 0),   # CSN - invoiced
    (4, 4, 0),   # Votorantim - in_production
    (5, 3, 0),   # Usiminas - approved
    (6, 8, 0),   # Mosaic - closed
    (7, 2, 0),   # Anglo American - pending
    (8, 4, 0),   # Samarco - in_production
    (9, 1, 0),   # Intercement - draft
    (10, 5, 0),  # MRN - shipped
]
conn.executemany("INSERT INTO sales_header (customer_id, status_id, total_price) VALUES (?, ?, ?)", sales)

# Sales items
items = [
    (1, 4, 1200, 5980.00, "2026-03-15"),
    (1, 3, 800, 4120.00, "2026-03-15"),
    (1, 17, 4, 8500.00, "2026-02-28"),
    (1, 22, 2, 58000.00, "2026-04-01"),
    (2, 6, 500, 680.00, "2026-04-10"),
    (2, 7, 300, 1050.00, "2026-04-10"),
    (2, 19, 6, 4600.00, "2026-03-20"),
    (2, 20, 6, 2800.00, "2026-03-20"),
    (3, 2, 600, 2740.00, "2026-05-01"),
    (3, 15, 400, 2200.00, "2026-05-15"),
    (3, 18, 3, 3200.00, "2026-04-20"),
    (3, 21, 1, 32000.00, "2026-06-01"),
    (4, 8, 350, 390.00, "2026-07-10"),
    (4, 10, 250, 780.00, "2026-07-10"),
    (4, 18, 2, 3200.00, "2026-06-25"),
    (5, 11, 200, 3200.00, "2026-07-20"),
    (5, 16, 300, 3400.00, "2026-08-01"),
    (5, 17, 2, 8500.00, "2026-07-15"),
    (6, 5, 800, 420.00, "2026-06-15"),
    (6, 6, 600, 680.00, "2026-06-15"),
    (6, 13, 400, 310.00, "2026-06-01"),
    (6, 20, 4, 2800.00, "2026-05-20"),
    (7, 4, 2000, 5980.00, "2026-08-15"),
    (7, 12, 500, 4850.00, "2026-09-01"),
    (7, 22, 3, 58000.00, "2026-09-15"),
    (7, 19, 8, 4600.00, "2026-08-01"),
    (8, 1, 1500, 1850.00, "2026-08-20"),
    (8, 2, 1000, 2740.00, "2026-09-01"),
    (8, 17, 6, 8500.00, "2026-08-10"),
    (8, 19, 10, 4600.00, "2026-08-15"),
    (9, 13, 600, 310.00, "2026-07-30"),
    (9, 14, 300, 490.00, "2026-07-30"),
    (9, 9, 400, 640.00, "2026-08-10"),
    (10, 15, 800, 2200.00, "2026-09-10"),
    (10, 16, 500, 3400.00, "2026-09-20"),
    (10, 22, 1, 58000.00, "2026-10-01"),
    (10, 21, 2, 32000.00, "2026-09-15"),
]
conn.executemany(
    "INSERT INTO sales_items (sales_header_id, material_id, quantity, unit_price, due_date) VALUES (?, ?, ?, ?, ?)",
    items,
)

conn.execute("""
    UPDATE sales_header SET total_price = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM sales_items
        WHERE sales_items.sales_header_id = sales_header.id
    )
""")

conn.commit()

# Summary
print("=== SALES STATUS ===")
for r in conn.execute("SELECT id, name, description FROM sales_status"):
    print(f"  {r[0]}. {r[1]:15s} — {r[2]}")

print(f"\n=== SALES ===")
for r in conn.execute("""
    SELECT sh.id, c.name, ss.name, sh.total_price
    FROM sales_header sh
    JOIN customers c ON c.id = sh.customer_id
    JOIN sales_status ss ON ss.id = sh.status_id
    ORDER BY sh.id
"""):
    print(f"  #{r[0]:2d}  {r[2]:15s}  R$ {r[3]:>14,.2f}  {r[1]}")

conn.close()
