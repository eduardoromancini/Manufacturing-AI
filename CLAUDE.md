# CLAUDE.md — Project Instructions

## Architecture Rules

- **SQLite is the single source of truth.** All data must be persisted in the SQLite database before being served via API.
- **No computed-only endpoints.** If data is served via API, it must exist as a table in `database.sql` with proper PK/FK constraints.
- **Always update `database.sql` first**, then `seed_db.py`, then `server.py`, then `app.js`.
- **Always run `python seed_db.py`** after schema changes to rebuild the database before pushing.

## Database Modeling — Best Practices

### Normalization (mandatory: up to 3NF)

- **1NF — Atomic values**: Every column holds a single value. No arrays, comma-separated lists, JSON blobs, or repeating groups. If you need multiple values, create a child table with FK.
- **2NF — Full functional dependency**: Every non-key column must depend on the ENTIRE primary key, not just part of it. If a table has a composite key, no column should depend on only one of the key columns. If it does, extract it into its own table.
- **3NF — No transitive dependencies**: No non-key column should depend on another non-key column. If column B determines column C, then C should be in B's own table, not duplicated here. If a value can be obtained via a JOIN, it must NOT be stored.

### Checklist before adding a column

1. **Is it atomic?** If it contains a list or structure → create a child table (1NF).
2. **Does it depend on the full PK?** If it depends on only part of a composite key → extract to its own table (2NF).
3. **Can it be derived from a JOIN?** If yes → don't add it, use the FK relationship (3NF).
4. **Can it be computed from other columns in the same row?** If yes → use `GENERATED ALWAYS AS ... STORED` (acceptable, same-row derivation).
5. **Is it a free-text category that repeats?** If the same string appears in multiple rows (e.g., "Calandras", "active") → create a lookup table with FK instead of storing the string.

### Checklist before adding a table

1. **Does it represent a distinct entity or relationship?** Every table must represent exactly one thing.
2. **Does it have a clear PK?** Use `id INTEGER PRIMARY KEY AUTOINCREMENT`.
3. **Are FKs explicit?** Every reference to another table must be declared with `FOREIGN KEY ... REFERENCES`.
4. **Is there a UNIQUE constraint where needed?** Prevent duplicate relationships (e.g., `UNIQUE(material_group_id, resource_id)` on routing).

### Common anti-patterns to avoid

| Anti-pattern | Example | Fix |
|---|---|---|
| **Storing derived totals** | `sales_header.total_price` when it's SUM of items | Remove column, compute via `SUM()` in SQL query |
| **Denormalized category text** | `resources.type = "calandra"` when a group table exists | Replace with `group_id FK → resource_groups` |
| **Redundant descriptive columns** | Storing `customer_name` in `production_orders` | Only store `customer_id` FK, JOIN for display |
| **God tables** | One table with 30 columns mixing concerns | Split into entity + detail tables with FK |
| **Repeating groups** | `phone1`, `phone2`, `phone3` columns | Create `customer_phones` child table |
| **Computed-only endpoints** | API returns data not persisted in any table | Create the table in SQLite, populate in seed |

### Naming conventions

- Tables: `snake_case`, plural for entities (`customers`), singular for relationships (`routing`).
- Columns: `snake_case`.
- FK columns: `<referenced_table_singular>_id` (e.g., `customer_id`, `group_id`).
- PK: always `id`.
- Junction/relationship tables: name describes the relationship (`routing`, `production_orders`).

### SQL conventions

- Always declare `FOREIGN KEY ... REFERENCES` explicitly.
- Use `UNIQUE` constraints to prevent logical duplicates.
- Use `NOT NULL` on FKs and required fields.
- Use `DEFAULT` for sensible defaults (`datetime('now')`, `'active'`, etc.).
- Keep DDL in `database.sql` — never create tables in Python code.

## Frontend Conventions

- Use the `DataTable()` component for all tabular data — includes filters, column reorder, and autocomplete.
- Use `safeIcons()` instead of `lucide.createIcons()` directly.
- Always bump the cache version in `index.html` (`?v=N`) before pushing.
- API responses are cached in the `cache` object — call `invalidateCache()` if data changes.

## Deploy Conventions

- Always `git push` after changes — Render auto-deploys from GitHub.
- The `.db` file is included in the repo and rebuilt on deploy via `python seed_db.py`.
- Static files are whitelisted in `STATIC_FILES` in `server.py`.

## File Responsibilities

| File | Role |
|------|------|
| `database.sql` | DDL schema — all tables defined here |
| `seed_db.py` | Creates DB from scratch, inserts all seed data |
| `server.py` | API routes (ROUTES dict + special handlers) + static file serving |
| `app.js` | Frontend: navigation, DataTable component, all tab renderers |
| `styles.css` | All styles, design tokens in `:root` |
| `index.html` | HTML shell, sidebar nav, script/CSS imports |
