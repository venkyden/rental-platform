import os
import sys

def check_connection():
    url = os.getenv('DATABASE_URL')
    if not url:
        print("DATABASE_URL is not set.")
        sys.exit(1)
        
    try:
        import sqlalchemy
        from app.core.db_url import to_sync_url
        url = to_sync_url(url)
        engine = sqlalchemy.create_engine(url, connect_args={'connect_timeout': 5})
        with engine.connect() as conn:
            sys.exit(0)
    except Exception as e:
        print(f"Database connection check failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    check_connection()
