# Quick Start Guide - Run Locally

## 🚀 Getting Started (5 minutes)

Follow these steps to run the application locally and test it.

---

## Prerequisites

You need:
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (or use Docker)

---

## Step 1: Database Setup

### Option A: Using Docker (Easiest)
```bash
# Start PostgreSQL in Docker
docker run --name rental-db \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=rental_platform \
  -p 5432:5432 \
  -d postgres:14

# Database is now running at: postgresql://postgres:mysecretpassword@localhost:5432/rental_platform
```

### Option B: Using Homebrew (Mac)
```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL
brew services start postgresql@14

# Create database
createdb rental_platform
```

---

## Step 2: Backend Setup

```bash
cd /Users/venkat/.gemini/antigravity/scratch/rental-platform/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

**Edit `.env` file:**
```bash
DATABASE_URL=postgresql+asyncpg://postgres:mysecretpassword@localhost:5432/rental_platform
SECRET_KEY=your-super-secret-key-min-32-characters-long-123456
ANTHROPIC_API_KEY=sk-ant-your-key-here
FRONTEND_URL=http://localhost:3000
```

**Run migrations:**
```bash
alembic upgrade head
```

**Start backend:**
```bash
uvicorn app.main:app --reload --port 8000
```

✅ Backend running at: http://localhost:8000
📚 API Docs at: http://localhost:8000/docs

---

## Step 3: Frontend Setup

**Open new terminal:**
```bash
cd /Users/venkat/.gemini/antigravity/scratch/rental-platform/frontend

# Install dependencies
npm install

# Create .env.local file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start frontend
npm run dev
```

✅ Frontend running at: http://localhost:3000

---

## 🧪 Test the Application

### 1. Open Browser
Go to: http://localhost:3000

### 2. Register a New User
- Click "Get Started" or "Create account"
- Fill in details:
  - Email: test@example.com
  - Password: password123
  - Full Name: Test User
  - Role: Tenant, Landlord, or Property Manager
- Click "Create account"

### 3. Test Login
- Should auto-login after registration
- You'll see the Dashboard

### 4. Test Forgot Password
- Logout
- Click "Forgot password"
- Enter email
- Check backend terminal for reset token (we're not sending emails yet)

### 5. Test API Directly
Open http://localhost:8000/docs to see interactive API documentation

Try endpoints:
- `GET /health` - Should return `{"status": "healthy"}`
- `POST /auth/register` - Create user
- `POST /auth/login` - Get JWT token

---

## 🐛 Troubleshooting

**Database connection error:**
```
Make sure PostgreSQL is running:
docker ps  # Should show rental-db container
# OR
brew services list  # Should show postgresql@14 started
```

**Alembic migration error:**
```bash
# Reset database
alembic downgrade base
alembic upgrade head
```

**Frontend can't connect to backend:**
```
Check .env.local has: NEXT_PUBLIC_API_URL=http://localhost:8000
Restart frontend: npm run dev
```

**CORS error in browser:**
```
Backend .env must have: FRONTEND_URL=http://localhost:3000
Restart backend
```

---

## 📝 What You Can Test Now

✅ User registration (all 3 roles)
✅ Login/logout
✅ Forgot password
✅ Dashboard view
✅ JWT authentication
✅ Protected routes

🔄 Coming Next:
- Interactive onboarding questionnaire
- Identity verification
- Property listing
- Search & matching

---

## 🛑 Stop All Services

**Backend:**
```
Ctrl+C in backend terminal
```

**Frontend:**
```
Ctrl+C in frontend terminal
```

**Database (Docker):**
```bash
docker stop rental-db
# To remove: docker rm rental-db
```

---

## 📊 Monitoring

**Backend logs:**
Watch the backend terminal for API requests and errors

**Frontend logs:**
Watch the frontend terminal for build errors

**Database:**
```bash
# Connect to database
docker exec -it rental-db psql -U postgres -d rental_platform

# List tables
\dt

# View users
SELECT id, email, role, created_at FROM users;

# Exit
\q
```

---

Ready to test! 🚀
