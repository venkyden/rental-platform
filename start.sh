#!/bin/bash
# Start script for Rental Platform

echo "🚀 Starting Rental Platform..."
echo ""

# Check if setup has been run
if [ ! -f "backend/.env" ] || [ ! -f "frontend/.env.local" ]; then
    echo "❌ Setup not complete. Please run: ./setup.sh"
    exit 1
fi

# Start backend
echo "🔧 Starting backend..."
cd backend
source venv/bin/activate

# Start backend in background
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "✅ Backend running at http://localhost:8000 (PID: $BACKEND_PID)"
echo "📚 API Docs at http://localhost:8000/docs"
echo ""

# Start frontend
echo "🎨 Starting frontend..."
cd ../frontend

npm run dev &
FRONTEND_PID=$!

echo "✅ Frontend running at http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""

# Save PIDs for stop script
cd ..
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo "🎉 All services started!"
echo ""
echo "📝 Access:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "To stop: ./stop.sh or Ctrl+C"
echo ""

# Wait for user interrupt
wait
