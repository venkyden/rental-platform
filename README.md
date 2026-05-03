# Rental Platform

AI-powered rental platform serving 6 market segments with intelligent verification, matching, and lease generation.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and API keys

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

Backend will be available at http://localhost:8000
API docs at http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with API URL

# Start development server
npm run dev
```

Frontend will be available at http://localhost:3000

## 📁 Project Structure

```
rental-platform/
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── core/         # Config, database, security
│   │   ├── models/       # SQLAlchemy models & schemas
│   │   ├── routers/      # API endpoints
│   │   └── services/     # Business logic & external APIs
│   ├── alembic/          # Database migrations
│   └── tests/            # Backend tests
│
├── frontend/             # Next.js frontend
│   ├── app/              # App router pages
│   ├── components/       # React components
│   └── lib/              # Utilities & API client
│
└── README.md
```

## 🔑 Features

### Phase 1: Foundation (Current)
- ✅ User authentication (register, login, JWT)
- ✅ Password reset flow
- ✅ Database schema with migrations
- 🚧 Identity verification (eIDV)
- 🚧 Employment verification
- 🚧 Dynamic lease generation

### Phase 2: Trust & Matching
- ⏳ Real-time risk scoring
- ⏳ Tenant-property matching algorithm

### Phase 3: Landlord Intelligence
- ⏳ Market comps intelligence
- ⏳ Churn prediction

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Axios

**Backend:**
- FastAPI
- SQLAlchemy + AsyncPG
- PostgreSQL
- Anthropic Claude AI
- JWT Authentication

**Infrastructure:**
- Vercel (Frontend)
- Railway (Backend + Database)
- DocuSign (Lease signing)
- Fourthline (Identity verification)

## 📚 API Documentation

Start the backend server and visit http://localhost:8000/docs for interactive API documentation.

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 🚢 Deployment

### Platform (Render)
1. The platform is deployed as a monorepo on Render.
2. The `render.yaml` blueprint manages the Backend and PostgreSQL database.
3. The Frontend is deployed as a separate Web Service on Render.
4. All services are configured for **Auto-deploy on Push** to the `master` branch.

## 📝 License

MIT

## 👥 Contacts

For questions or support, contact the development team.
