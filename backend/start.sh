#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status
set -x # Print commands and their arguments as they are executed

echo "Starting database migrations..."
alembic upgrade head

echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --log-level debug
