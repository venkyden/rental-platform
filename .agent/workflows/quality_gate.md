---
description: Enforce A-Z Quality Audit Standards before verifying a task
---

# A-Z Quality Gate Workflow

Before running the final verification or notifying the user of completion, run these checks:

1.  **Run Comprehensive Tests**
    *   Command: `cd backend && python tests/comprehensive_test.py`
    *   Expectation: All checks PASS.

2.  **Check Architecture Standards**
    *   **Navigation**: Does the new frontend page use `Navbar`? (Grep for `import Navbar`)
    *   **Monitoring**: Is Sentry initialized? (Check `app/main.py`)
    *   **Versioning**: Are new endpoints in `/api/v1`?

3.  **Check User Experience (UX)**
    *   **Empty States**: If a list is empty, is there a "Premium" empty state card?
    *   **Vibe**: Are gradients/glassmorphism used?

4.  **Security Scan**
    *   **Inputs**: Are Pydantic models used for all request bodies?
    *   **Auth**: Is `Depends(get_current_user)` used on protected routes?

If any of these fail, **DO NOT PROCEED**. Fix the issue first.
