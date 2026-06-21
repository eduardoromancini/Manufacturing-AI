# CLAUDE.md — Project Instructions

## Architecture Rules

- **SQLite is the single source of truth.** All data must be persisted in the SQLite database before being served via API.
- **No computed-only endpoints.** If data is served via API, it must exist as a table in `database.sql` with proper PK/FK constraints.
- **Always update `database.sql` first**, then `seed_db.py`, then `server.py`, then `app.js`.
- **Always run `python seed_db.py`** after schema changes to rebuild the database before pushing.

## Database Conventions

- **Third Normal Form (3NF) is mandatory.** Every table must satisfy:
  - **1NF**: All columns are atomic (no lists, no repeating groups).
  - **2NF**: Every non-key column depends on the entire primary key (no partial dependencies).
  - **3NF**: No non-key column depends on another non-key column (no transitive dependencies). If a column can be derived from a JOIN, it must NOT be stored redundantly.
- All tables use `id INTEGER PRIMARY KEY AUTOINCREMENT`.
- Foreign keys are explicitly declared with `FOREIGN KEY ... REFERENCES`.
- Computed columns use `GENERATED ALWAYS AS ... STORED` only for values derived from columns in the SAME row (e.g., `quantity * unit_price`). Never store values derivable from JOINs.
- Table and column names use `snake_case`.
- Before adding any column, ask: "Can this be obtained via a JOIN?" If yes, don't add it — use the FK instead.

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
