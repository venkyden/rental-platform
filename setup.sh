#!/bin/bash
# Setup script for Rental Platform

set -e  # Exit on error

echo "🚀 Rental Platform - Quick Setup"
echo "================================"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11+"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. You'll need to install PostgreSQL manually."
fi

echo "✅ Prerequisites check passed"

# Setup database
echo ""
echo "🗄️  Setting up database..."
if command -v docker &> /dev/null; then
    if docker ps -a | grep -q rental-db; then
        echo "Database container already exists. Starting..."
        docker start rental-db
    else
        echo "Creating database container..."
        docker run --name rental-db \
          -e POSTGRES_PASSWORD=mysecretpassword \
          -e POSTGRES_DB=rental_platform \
          -p 5432:5432 \
          -d postgres:14
        
        echo "Waiting for database to start..."
        sleep 3
    fi
    echo "✅ Database running"
else
    echo "⚠️  Please ensure PostgreSQL is running manually"
fi

# Backend setup
echo ""
echo "🔧 Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing Python dependencies..."
pip install -q -r requirements.txt

if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:mysecretpassword@localhost:5432/rental_platform
SECRET_KEY=development-secret-key-min-32-chars-long-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
ANTHROPIC_API_KEY=sk-ant-your-key-here
FOURTHLINE_API_KEY=your-key-here
SENDGRID_API_KEY=your-key-here
FRONTEND_URL=http://localhost:3000
EOF
    echo "⚠️  Please edit backend/.env and add your API keys"
fi

echo "Running database migrations..."
alembic upgrade head

echo "✅ Backend setup complete"

# Frontend setup
echo ""
echo "🎨 Setting up frontend..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
fi

if [ ! -f ".env.local" ]; then
    echo "Creating .env.local file..."
    echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
fi

echo "✅ Frontend setup complete"

# Done
echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit backend/.env with your API keys (optional for basic testing)"
echo "2. Run: ./start.sh"
echo "3. Open http://localhost:3000"
echo ""
