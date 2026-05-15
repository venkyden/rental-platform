#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status
set -x # Print commands and their arguments as they are executed

echo "🚀 Starting Roomivo Backend Initialization..."

# Pre-flight check: Wait for Database
if [ -n "$DATABASE_URL" ]; then
    echo "🔍 Checking database connectivity..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    until python3 -c "
import sqlalchemy
import os
import sys
url = os.getenv('DATABASE_URL').replace('postgres://', 'postgresql://', 1)
if '+asyncpg' in url:
    url = url.replace('+asyncpg', '')
engine = sqlalchemy.create_engine(url, connect_args={'connect_timeout': 5})
try:
    with engine.connect() as conn:
        sys.exit(0)
except Exception:
    sys.exit(1)
" || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
        echo "⚠️ Database not ready ($RETRY_COUNT/$MAX_RETRIES). Waiting 2s..."
        sleep 2
        RETRY_COUNT=$((RETRY_COUNT + 1))
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "❌ Database connection timed out after $MAX_RETRIES retries. Exiting."
        exit 1
    fi
    echo "✅ Database connection successful"
fi

echo "🏗️ Running database migrations..."
alembic upgrade head

echo "🔥 Starting FastAPI application with Uvicorn..."
# Using exec so uvicorn becomes PID 1 and receives signals correctly
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --log-level debug --proxy-headers --forwarded-allow-ips='*'
