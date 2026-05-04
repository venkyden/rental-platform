#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status
set -x # Print commands and their arguments as they are executed

echo "🚀 Starting Roomivo Backend Initialization..."

# Pre-flight check: Wait for Database
if [ -n "$DATABASE_URL" ]; then
    echo "🔍 Checking database connectivity..."
    # Simple python check to see if we can connect
    python3 -c "
import sqlalchemy
import os
import sys
url = os.getenv('DATABASE_URL').replace('postgres://', 'postgresql://', 1)
engine = sqlalchemy.create_engine(url)
try:
    with engine.connect() as conn:
        print('✅ Database connection successful')
except Exception as e:
    print(f'❌ Database connection failed: {e}')
    sys.exit(1)
" || (echo "⚠️ Database not ready. Waiting 5s..." && sleep 5)
fi

echo "🏗️ Running database migrations..."
alembic upgrade head

echo "🔥 Starting FastAPI application with Uvicorn..."
# Using exec so uvicorn becomes PID 1 and receives signals correctly
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --log-level debug --proxy-headers --forwarded-allow-ips='*'
