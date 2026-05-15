#!/bin/bash
# Start script for Roomivo Development Environment

echo "🚀 Starting Roomivo Development Environment..."

# Kill any existing processes on ports 3000 and 8000
echo "🧹 Cleaning up existing ports..."
npx kill-port 3000 8000 2>/dev/null || true

# Start Backend
echo "🐍 Starting Backend on port 8000..."
cd backend
./.venv/bin/python -m uvicorn app.main:fastapi_app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Start Frontend & Run Tests
echo "⚛️ Starting Frontend & Running Tests (this may take up to 5 mins for Turbopack compilation)..."
cd frontend
npx playwright test e2e/landing.spec.ts

# Keep running if tests pass, or kill background processes on exit
trap "kill $BACKEND_PID" EXIT
