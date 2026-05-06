import sqlite3
import os

db_path = "/Users/venkat/rental-platform/backend/app.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM users WHERE preferences IS NOT NULL;")
    count = cursor.fetchone()[0]
    print(f"Users with preferences: {count}")
    conn.close()
