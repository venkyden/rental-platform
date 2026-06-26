#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status
# set -x intentionally disabled in production — leaks env vars to logs

echo "🚀 Starting Roomivo Backend Initialization..."

# Locate and activate virtualenv
if [ -d ".venv" ]; then
    echo "🟢 Activating local .venv..."
    source .venv/bin/activate
elif [ -d "../.venv" ]; then
    echo "🟢 Activating parent .venv..."
    source ../.venv/bin/activate
elif [ -d "/opt/render/project/src/.venv" ]; then
    echo "🟢 Activating Render project root .venv..."
    source /opt/render/project/src/.venv/bin/activate
elif [ -d "/opt/render/project/src/backend/.venv" ]; then
    echo "🟢 Activating Render backend .venv..."
    source /opt/render/project/src/backend/.venv/bin/activate
else
    echo "⚠️ No virtual environment folder found. Running in system global environment."
fi

# Print diagnostics
echo "🔍 Environment Diagnostics:"
echo "   Python path: $(which python || echo 'not found')"
echo "   Python version: $(python --version 2>&1 || echo 'N/A')"
echo "   Alembic path: $(which alembic || echo 'not found')"
echo "   Uvicorn path: $(which uvicorn || echo 'not found')"

# Pre-flight check: Wait for Database
if [ -n "$DATABASE_URL" ]; then
    MASKED_DB_URL=$(echo "$DATABASE_URL" | sed 's/\/\/.*@/\/\/xxx:xxx@/')
    echo "🔍 Checking database connectivity: $MASKED_DB_URL"
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    # We execute check_db_conn.py to perform pre-flight
    until python check_db_conn.py || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
        echo "⚠️ Database not ready ($RETRY_COUNT/$MAX_RETRIES). Waiting 2s..."
        sleep 2
        RETRY_COUNT=$((RETRY_COUNT + 1))
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "❌ Database connection timed out after $MAX_RETRIES retries. Exiting."
        exit 1
    fi
    echo "✅ Database connection successful"
    
    echo "🔍 Inspecting current database schema before migration..."
    python inspect_db.py
else
    echo "⚠️ DATABASE_URL is not set. Skipping pre-flight checks."
fi

echo "🏗️ Running database migrations..."
alembic upgrade head

echo "🔥 Starting FastAPI application with Uvicorn..."
# Production settings:
#   --workers 2          : Handle concurrent requests (fits Render Starter 512MB)
#   --log-level info     : No debug noise (override via LOG_LEVEL env var)
#   --timeout-keep-alive : Above Render's 60s proxy timeout to prevent 502s
LOG_LEVEL="${LOG_LEVEL:-info}"
WORKERS="${WEB_CONCURRENCY:-2}"
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --log-level "$LOG_LEVEL" --workers "$WORKERS" --timeout-keep-alive 75 --proxy-headers --forwarded-allow-ips='*'
