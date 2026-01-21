import psycopg2
try:
    conn = psycopg2.connect("postgresql://venkat@localhost:5432/rental_platform")
    conn.autocommit = True
    cur = conn.cursor()
    print("Dropping tables/types for clean 003 migration...")
    cur.execute("DROP TABLE IF EXISTS leases CASCADE;")
    cur.execute("DROP TABLE IF EXISTS visit_slots CASCADE;")
    cur.execute("DROP TYPE IF EXISTS lease_type_enum CASCADE;")
    print("Done.")
    conn.close()
except Exception as e:
    print(e)
