CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS material_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    unit TEXT DEFAULT 'UN',
    group_id INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (group_id) REFERENCES material_groups(id)
);

CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    short_desc TEXT NOT NULL,
    resource_group TEXT NOT NULL,
    type TEXT NOT NULL,
    capacity TEXT,
    location TEXT,
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS routing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_group_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL,
    time_per_unit REAL NOT NULL,
    time_unit TEXT DEFAULT 'min',
    FOREIGN KEY (material_group_id) REFERENCES material_groups(id),
    FOREIGN KEY (resource_id) REFERENCES resources(id),
    UNIQUE(material_group_id, resource_id)
);

CREATE TABLE IF NOT EXISTS sales_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS sales_header (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL DEFAULT 1,
    total_price REAL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (status_id) REFERENCES sales_status(id)
);

CREATE TABLE IF NOT EXISTS sales_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_header_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL GENERATED ALWAYS AS (quantity * unit_price) STORED,
    due_date TEXT,
    FOREIGN KEY (sales_header_id) REFERENCES sales_header(id),
    FOREIGN KEY (material_id) REFERENCES materials(id)
);
