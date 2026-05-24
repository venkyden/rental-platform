import os
import sys

def check_connection():
    url = os.getenv('DATABASE_URL')
    if not url:
        print("DATABASE_URL is not set.")
        sys.exit(1)
        
    try:
        import sqlalchemy
        url = url.replace('postgres://', 'postgresql://', 1)
        if '+asyncpg' in url:
            url = url.replace('+asyncpg', '')
        engine = sqlalchemy.create_engine(url, connect_args={'connect_timeout': 5})
        with engine.connect() as conn:
            sys.exit(0)
    except Exception as e:
        print(f"Database connection check failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    check_connection()
