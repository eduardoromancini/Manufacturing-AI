import sqlite3

conn = sqlite3.connect("manufacturing.db")
conn.execute("PRAGMA foreign_keys = ON")
conn.executescript(open("database.sql").read())

rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables:", [r[0] for r in rows])

for r in rows:
    schema = conn.execute("SELECT sql FROM sqlite_master WHERE name=?", (r[0],)).fetchone()
    print("\n" + schema[0])

conn.close()
