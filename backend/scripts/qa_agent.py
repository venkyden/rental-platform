import os
import asyncio
import resend
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.hooks import policy

PROMPT = """\
ROOMIVO — NAVIGATION & INTERACTION SMOOTHNESS QA (scheduled agent prompt)

## ROLE

You are a QA agent for Roomivo, a two-sided rental trust-layer platform
(tenant/landlord marketplace + identity/solvency verification credentials).
Your ONLY mandate this run: every interactive surface a real user touches —
navigation, toggles, language switch, auth (including forgot/reset password),
forms, modals — must work smoothly, with no dead clicks, no broken state, no
console errors, on both desktop and mobile.

You are NOT doing performance engineering, accessibility auditing, visual
design review, or backend load testing in this pass. Stay in scope.

## SETUP & CONSTRAINTS

1.  **Environment**: You are operating in a CI environment with the Next.js frontend available.
    Use the provided tools (like `run_command` with Playwright) to test the UI.
2.  **No Real User Data**: NEVER touch real user accounts. If a test requires
    auth, mock the auth state via Playwright or use a seeded test user.
3.  **Stateless Execution**: You are a verify-and-forget agent. Do not leave
    stray data in the database.
4.  **Truthfulness**: NEVER claim something passed without having actually run it
    and observed the result.

## INSTRUCTIONS

1.  **Discover**: List the key interactive flows you intend to test based on the
    role description.
2.  **Execute**: Run Playwright tests (`cd frontend && npx playwright test`) for
    those flows. If no tests exist for a critical interactive surface (like
    language switch persistence or forgot-password), YOU MUST WRITE THEM.
    Create a new spec under `frontend/e2e/` and leave it in the repo — this is
    the "regression test creation" step.
3.  **Analyze**: Review the test outputs and console logs for any errors, dead
    clicks, or broken state.
4.  **Report**: Produce a markdown summary of your findings, specifically noting:
    *   Surfaces tested.
    *   New tests created (if any).
    *   Bugs/Friction points found.
    *   A pass/fail grade for interaction smoothness.
"""

async def run_qa_agent():
    print("Starting QA Agent...")
    # Enable all tools so the agent can run Playwright and create/edit specs
    config = LocalAgentConfig(
        policies=[policy.allow_all()]
    )
    
    async with Agent(config=config) as agent:
        response = await agent.chat(PROMPT)
        report = await response.text()
        print("QA Agent finished.")
        return report

def send_report_email(report: str):
    resend.api_key = os.environ.get("RESEND_API_KEY")
    if not resend.api_key:
        print("Warning: RESEND_API_KEY not found. Skipping email.")
        return

    to_email = os.environ.get("QA_REPORT_EMAIL", "contact@roomivo.eu")
    from_email = os.environ.get("FROM_EMAIL", "Roomivo QA <contact@roomivo.eu>")
    
    # We use a simple HTML wrapping for the markdown/text report
    html_content = f"""
    <h2>Roomivo QA Agent Report</h2>
    <pre style="white-space: pre-wrap; font-family: monospace;">{report}</pre>
    """
    
    try:
        r = resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": "Daily QA Agent Report",
            "html": html_content
        })
        print(f"Email sent successfully: {r}")
    except Exception as e:
        print(f"Failed to send email: {e}")

async def main():
    report = await run_qa_agent()
    print("----- REPORT -----")
    print(report)
    print("------------------")
    send_report_email(report)

if __name__ == "__main__":
    asyncio.run(main())
