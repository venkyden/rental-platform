# 📘 Rental Platform Engineering Standards

**Version 1.0** | **Philosophy**: "Vibe-Coded, Robust, Zero-Cost"

This document serves as the **Standard Operating Procedure (SOP)** for all engineering work on the Rental Platform.

---

## 🏗️ 1. Architecture Philosophy

### The "Vibe-Coded" Standard
*   **Backend**: robust, type-safe (Python/FastAPI), and monitored.
*   **Frontend**: "Premium" feel. No generic UI. Use Glassmorphism, gradients, and micro-interactions.
*   **Safety**: "Kill Switches" first. If a feature can fail, it must be wrappable in a Feature Flag.

### Tech Stack
| Component | Technology | Key Decision |
| :--- | :--- | :--- |
| **Backend** | Python 3.12 + FastAPI | Async performance, Pydantic validation. |
| **Database** | PostgreSQL + SQLAlchemy (Async) | Strict schema, Alembic migrations. |
| **Frontend** | Next.js 16 + Tailwind v4 | App Router for architecture, Tailwind for speed & design system. |
| **Monitoring** | Sentry | Mandatory. No silent failures. |
| **Infra** | Docker + GitHub Actions | Portable, automated testing. |

---

## 🛡️ 2. The "A-Z Audit" Framework

All new features **MUST** pass the following Quality Gates before merging:

*   **C - CI/CD**: Does it pass the pipeline?
*   **H - Human UX**: Are empty states delightful? Are error messages helpful?
*   **K - Kill Switches**: Can we turn it off instantly via `FeatureFlagService`?
*   **M - Monitoring**: Is `Sentry` catching exceptions? Are logs clear?
*   **N - Navigation**: Does it use the Global `Navbar.tsx`? (No ad-hoc headers!)
*   **V - Versioning**: Is the API under `/api/v1`?
*   **Z - Zero Trust**: Is every input validated?

---

## 🧪 3. Testing Strategies

### The Comprehensive Suite
Run the full suite before pushing:
```bash
# CWD: backend/
python tests/comprehensive_test.py
```
*   **Target**: 100% Pass Rate.
*   **Scope**: Smoke Tests, Mock Verifications, Security Scans, Load Tests.

### Frontend Testing
*   **Visual Check**: Verify "Vibe" elements (glass effects, mobile alignment).
*   **Empty States**: Verify zero-data screens look premium.

---

## 🔧 4. Infrastructure & Debugging

### Configuration
*   **Source of Truth**: `backend/app/core/config.py`
*   **Secrets**: `.env` (Never commit this!).
*   **Mandatory**: `SENTRY_DSN` must be set in Production.

### Common Debugging Scenarios
| Issue | Solution |
| :--- | :--- |
| **"Circuit Breaker Open"** | External service (e.g., Stripe) failed too often. Reset via Admin or wait for timeout. |
| **Missing API Key** | Check `config.py` defaults. Most are `Optional` for dev, but required for prod. |
| **Frontend Nav Broken** | Ensure the page uses `import Navbar from '@/components/Navbar'`. |
| **Migration Error** | Run `alembic upgrade head`. Check `alembic/env.py` imports if new models aren't detected. |

---

## 📝 5. Development Workflow

1.  **Branch**: Create `feature/name`.
2.  **Code**: Implement using **Service Layer Pattern** (keep logic out of Routers).
3.  **Flag**: Add a Feature Flag if experimental.
4.  **Test**: Run `comprehensive_test.py`.
5.  **Audit**: Self-check against "A-Z Framework".
6.  **Merge**: CI/CD handles the rest.
