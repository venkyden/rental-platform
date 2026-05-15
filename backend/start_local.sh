#!/bin/bash
set -e
set -x

VENV_PATH="./.venv"
PYTHON="$VENV_PATH/bin/python"
ALEMBIC="$VENV_PATH/bin/alembic"
UVICORN="$VENV_PATH/bin/uvicorn"

echo "🚀 Starting Roomivo Backend (Local Venv)..."

# Load .env without comments
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set default PORT if not set
export PORT=${PORT:-8000}

echo "🏗️ Running database migrations..."
$ALEMBIC upgrade head

echo "🔥 Starting FastAPI application..."
exec $UVICORN app.main:app --host 127.0.0.1 --port $PORT --log-level debug
