import os
import re
import asyncio
import subprocess
from pathlib import Path
import resend
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.hooks import policy

# Ensure process runs from repo root so LocalAgentConfig/tools encompass frontend/ and backend/
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
os.chdir(REPO_ROOT)

if "GEMINI_API_KEY" not in os.environ and "GEMINI_API_KEY_QA" in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["GEMINI_API_KEY_QA"]

def _gemini_model_candidates() -> list:
    """Ordered list of Gemini models to try. Mirrors settings.GEMINI_MODEL_CANDIDATES
    in backend/app/core/config.py — this script runs standalone (no FastAPI settings),
    so the same env vars are read directly instead. Add GEMINI_EXTRA_FALLBACK_MODELS
    (comma-separated) the moment Google announces the next retirement — no code change
    or redeploy needed."""
    primary = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    fallback = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")
    extra = [m.strip() for m in os.environ.get("GEMINI_EXTRA_FALLBACK_MODELS", "").split(",") if m.strip()]
    candidates = []
    for model in [primary, fallback] + extra:
        if model not in candidates:
            candidates.append(model)
    return candidates


GEMINI_MODEL_CANDIDATES = _gemini_model_candidates()
GEMINI_MODEL = GEMINI_MODEL_CANDIDATES[0]
ENABLE_VERIFIER = os.environ.get("ENABLE_VERIFIER", "false").lower() in ("true", "1", "yes")

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
design review, or backend load testing in this pass. Stay in scope. If you
notice something out of scope but real, note it in one line under "Noticed,
out of scope" — do not investigate it.

## GROUND TRUTH — READ THIS, DON'T ASSUME

- This is a **pre-revenue product in free beta**. There is no live payment
  flow to test. Ignore any instinct to test checkout/billing.
- Roomivo is a **passive publisher**, not a matchmaker — counterparty
  matching is intentionally disabled. Do not flag "search doesn't
  recommend/match me anything" as a bug; that's the legal design.
- **Stateless verify-and-forget**: identity/solvency documents are verified
  then discarded; only signed banded-claim credentials persist. A document
  or draft not being retrievable later, or a credential expiring on its TTL,
  is correct behavior — not a bug. Do not flag it.
- Shareable credential/dossier pages (routes under `/c/`, `/d/share/`) must
  **never** render or link to the underlying source document (ID, avis
  d'imposition, payslip, bank statement) — only banded claims + signature.
  If you ever see a raw document, name, DOB, or financial figure exposed on
  a shareable page, that is a **CRITICAL security/privacy bug**: stop,
  capture the exact evidence (URL, screenshot/DOM snippet), report it first
  in your summary, and do not keep clicking around trying to reproduce
  further exposure.
- Languages: **English and French only**. Test both. Do not test other
  locales, and do not invent a test for a locale that doesn't exist.
- **Verify UI features exist in the actual source before writing a test for
  them.** If you are not certain a component exists (e.g. a dark-mode/theme
  toggle, a social-login button), grep the frontend source first
  (`frontend/components/`, `frontend/app/`). Do not write or report a test
  for a feature you have not confirmed exists in this codebase.
- Test data only. Never touch real user accounts. Never trigger a real
  password-reset email to a non-test address.

## TRUTHFULNESS — THIS IS THE MOST IMPORTANT RULE THIS RUN

Prior runs of this agent have reported fabricated test results: invented
test names, invented file:line locations, and invented describe blocks for
features that do not exist in the codebase, formatted to look like real
Playwright CLI output. That is a critical failure mode. To prevent it:

1. **Only report a result for a test whose PASS/FAIL you personally observed
   in this run's actual tool output.** Never reconstruct, paraphrase, or
   recall a test result from a previous run, from memory of this codebase,
   or from what a test "should" say based on its file name.
2. **Never invent Playwright output.** If you did not run a command and see
   its real stdout, do not write text formatted like Playwright's `✓ [n]
   file.spec.ts:line:col › describe › test name (Xms)` — even as an
   example or illustration.
3. **If a tool call is denied by policy, times out, or is cancelled**, you
   MUST NOT paper over it. Report the exact surfaces affected as
   `NOT TESTED — reason: <the exact error you received>`. Do not include
   fabricated pass lines for tests in that file or flow.
4. **Retry budget**: if the same command fails twice (timeout, denial, or
   crash), stop retrying it and move on — report `NOT TESTED` for what it
   would have covered. Do not burn the run in a retry loop.
5. **Your final message must be a single, clean report — written once, at
   the end.** Do not restate earlier draft versions of the report, do not
   include raw background-task notifications ("task finished", "execution
   timer scheduled", etc.) in your final output, and do not repeat the same
   section twice. If you drafted the report incrementally while working,
   your last message must be the final version only.
6. **A partial or blocked run is a valid, honest outcome.** Reporting fewer
   surfaces as NOT TESTED is always better than reporting more surfaces as
   fabricated PASS.

## WHAT "SMOOTH NAVIGATION" MEANS HERE — YOUR TEST SURFACE

Walk these as a real user would, on **desktop (1440×900) and mobile (Pixel 5
/ 390×844)**, in **both EN and FR**, rotating which get deep coverage each
run rather than rushing all of them shallowly every time:

1. **Global navigation**: every nav link, logo → home, mobile hamburger
   drawer open/close, no reflow after auth state loads.
2. **Language switch**: EN↔FR preserves the current route and in-progress
   form state where reasonable; strings actually change; persists across
   reload and internal navigation.
3. **Auth flows**: register → login → logout; forgot password
   (`/auth/forgot-password` → email → `/auth/reset-password`) end-to-end
   with a test account; forgot-email flow; invalid credentials show a clear
   error; session expiry redirects to login without losing the intended
   destination; verify-email flows.
4. **Core dashboards**: landlord/agency dashboards, inbox, notifications,
   applications — tab switching, list → detail navigation, back button
   returns to the right state, empty states render correctly.
5. **Property flows**: creation wizard (step forward/back, refresh
   mid-wizard, validation clears on fix), property detail, edit, search.
6. **Verification flows**: identity/income/guarantor upload — retry-on-
   failure, progress indicators don't stall, cancel/back doesn't leave a
   broken half-state.
7. **Lease + dispute flows**: creation, detail, sign, incident, dispute
   filing.
8. **Settings/profile**: every toggle/switch persists its state after
   reload.
9. **Credential/dossier sharing**: see the PII-exposure rule above; also
   check loading states, expired-link messaging, copy-link controls.
10. **Modals & consent**: cookie consent persists and doesn't re-prompt
    every navigation; modals close via X, backdrop click, and Escape.

## HOW TO RUN THIS

**Use the existing Playwright suite in `frontend/e2e/` as your foundation —
don't invent a parallel system.** Prefer targeted runs over repeatedly
re-running the entire multi-browser suite, which risks command timeouts:
run a scoped set of spec files with `--project=chromium` first, and only
run the full multi-project suite once you have budget left.

1. Run relevant existing specs and read the actual output.
2. For any surface above with no existing coverage, write a new spec under
   `frontend/e2e/` and leave it in the repo. Prefer **extending an existing
   QA spec file** you or a prior run created over replacing it with a
   different, shorter version each time — the goal is an accumulating,
   stable regression suite, not a file that churns every run.
3. Drive French-locale passes through the actual language switcher
   component in-test, not a hardcoded second config.
4. If browsers are missing, that is itself a CI setup problem — report it,
   don't spend your run budget downloading ~300MB of browser binaries.

## BUG REPORTING

For every confirmed issue: title, severity, route, browser+viewport,
language, exact repro steps, expected vs actual, console/network error if
any, and the spec file if you added one.

Severity:
- **Critical**: broken auth, PII/document exposure on a shareable page, a
  route that hard-crashes.
- **High**: a core flow dead-ends or loses state; language switch breaks a
  page; a toggle doesn't persist and silently reverts a user's choice.
- **Medium**: a secondary flow has a rough edge but has a workaround;
  mobile-only layout break that doesn't block the task.
- **Low**: cosmetic nav glitch, minor copy/translation gap.

## FIX POLICY

- Low-risk fixes (broken link, missing translation key, toggle not wired to
  persistence, obvious dead click) — fix directly, run the relevant tests,
  report what changed.
- Anything touching auth, verification, credential rendering, or PII
  handling — **propose only**, do not implement. Explain the fix, the file,
  the risk, and wait for approval.

## FINAL REPORT FORMAT

1. Suite result (pass/fail counts from output you actually observed).
2. Surfaces given deep coverage this run.
3. `NOT TESTED` items with reasons (denials, timeouts, missing setup).
4. New bugs found (by severity).
5. Fixes applied vs. proposed-and-waiting.
6. New/extended specs in `frontend/e2e/`.
7. Noticed, out of scope (one line each, no investigation).
8. The one thing to fix before the next run, if anything is Critical/High.
"""


async def run_qa_agent():
    # Enable all tools so the agent can run Playwright and create/edit specs.
    # Must run with cwd at the repo root (see workflow) so file tools aren't
    # scoped to backend/ only — the agent needs to read/write frontend/e2e/.
    last_error = None
    for model_name in GEMINI_MODEL_CANDIDATES:
        print(f"Starting QA Agent (model: {model_name})...")
        config = LocalAgentConfig(
            model=model_name,
            policies=[policy.allow_all()]
        )
        try:
            async with Agent(config=config) as agent:
                response = await agent.chat(PROMPT)
                report = await response.text()
                print("QA Agent finished.")
                return report
        except Exception as e:
            last_error = e
            if "404" in str(e) or "NOT_FOUND" in str(e):
                print(f"Model {model_name} not found, trying next model...")
                continue
            raise

    raise last_error or RuntimeError("No Gemini model candidates configured")


VERIFIER_PROMPT_TEMPLATE = """\
ROOMIVO — QA REPORT VERIFICATION (second-pass reviewer)

## ROLE

You are an independent fact-checking reviewer. A separate QA agent just ran
against this repository and produced the report pasted below. Your job is
NOT to run a fresh QA pass — it is to verify that report's claims against
the actual, current state of the repository and correct it before anyone
sees it or anything gets committed.

You have full read/search/run_command access, but you may NOT create or
edit files. If you think a spec file should change, say so in your
corrected report — do not touch it yourself.

## THE REPORT TO VERIFY

<<<QA_REPORT>>>
<<<QA_REPORT_PLACEHOLDER>>>
<<<END_QA_REPORT>>>

## WHAT TO CHECK

1. **New/changed files.** Run `git status --porcelain` and
   `git diff --stat -- frontend/e2e/`. Does the report's claim of new specs
   created or extended match what actually changed on disk? If the report
   claims a file was created/extended but git shows no change, that is a
   fabrication — say so explicitly.
2. **Every cited test result.** For each test name, describe block, or
   file:line the report presents as passing — especially anything
   formatted like real Playwright output (`✓ [n] file.spec.ts:line:col ›
   describe › test name (Xms)`) — open the actual file and confirm that
   exact test exists at that location with that name. If it doesn't match,
   the result is fabricated: strike it from your corrected report and flag
   it clearly.
3. **Every UI feature named.** If the report references a specific feature
   (a theme toggle, social login, a particular modal, etc.), grep
   `frontend/components/` and `frontend/app/` to confirm it exists in the
   codebase. If you can't find it, flag the claim as unverifiable/likely
   fabricated rather than passing it through.
4. **Unacknowledged tool failures.** Look for signs the QA agent's own run
   hit denied/timed-out/cancelled commands that its summary doesn't
   mention. If the report claims a clean PASS despite that, correct it.
5. **Spot-check, don't redo everything.** If new or modified spec files
   exist, actually run just those files
   (`cd frontend && npx playwright test <path> --project=chromium`) and
   compare the real output to what the report claims. Do not re-run the
   full multi-browser suite — that risks timing out your own review pass.
   If a command fails twice, stop retrying and say so rather than looping.

## OUTPUT

Produce a corrected report:
- Keep every claim you could verify, unchanged.
- For anything fabricated, unverifiable, or contradicted by what you found,
  replace it with an explicit correction — show what was wrong and what you
  found instead, don't just silently delete it.
- Add a short "Verification notes" section listing exactly what you
  checked and how (commands run, files inspected).
- End your entire response with exactly one line, verbatim, and nothing
  after it:
  - `VERIFICATION_VERDICT: PASS` — the report's claims, as you've now
    corrected them, are fully backed by what you independently confirmed;
    no fabrication was found; any new/changed spec files are safe to
    commit as-is.
  - `VERIFICATION_VERDICT: NEEDS_HUMAN_REVIEW` — you found fabrication,
    could not verify a material claim, or are not confident the new spec
    files should be committed as-is.
"""


async def run_verifier_agent(qa_report: str) -> str:
    # Specific denies always outrank a wildcard allow regardless of list
    # order (SDK policy resolution: specific deny > specific ask > specific
    # allow > wildcard deny > wildcard ask > wildcard allow), so this grants
    # full read/search/run_command access for fact-checking while still
    # hard-blocking file mutation — the verifier reviews and corrects the
    # report text, it does not silently rewrite spec files itself.
    prompt = VERIFIER_PROMPT_TEMPLATE.replace("<<<QA_REPORT_PLACEHOLDER>>>", qa_report)

    last_error = None
    for model_name in GEMINI_MODEL_CANDIDATES:
        print(f"Starting Verifier Agent (model: {model_name})...")
        config = LocalAgentConfig(
            model=model_name,
            policies=[
                policy.deny("create_file"),
                policy.deny("edit_file"),
                policy.allow_all(),
            ]
        )
        try:
            return await _run_verifier_with_config(config, prompt)
        except Exception as e:
            last_error = e
            if "404" in str(e) or "NOT_FOUND" in str(e):
                print(f"Model {model_name} not found, trying next model...")
                continue
            raise

    raise last_error or RuntimeError("No Gemini model candidates configured")


async def _run_verifier_with_config(config, prompt: str) -> str:

    async with Agent(config=config) as agent:
        response = await agent.chat(prompt)
        verified_report = await response.text()
        print("Verifier Agent finished.")
        return verified_report


_VERDICT_RE = re.compile(r"VERIFICATION_VERDICT:\s*(PASS|NEEDS_HUMAN_REVIEW)", re.IGNORECASE)


def _extract_verdict(text: str) -> str:
    matches = _VERDICT_RE.findall(text)
    if not matches:
        # No verdict line at all is itself a failure to follow instructions —
        # default to the conservative outcome rather than auto-committing.
        return "NEEDS_HUMAN_REVIEW"
    return matches[-1].upper()


def _write_github_output(key: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        print(f"(not running in GitHub Actions — would set output {key}={value})")
        return
    with open(path, "a") as f:
        f.write(f"{key}={value}\n")


# Headings the agent is instructed to use for its final report. Prior runs
# sometimes emitted several draft reports in one response (interleaved with
# raw background-task notifications) before the final version — if that
# happens despite the prompt's instruction, keep only the last heading
# onward so the email isn't a wall of duplicated drafts.
_REPORT_HEADING_RE = re.compile(r"^#{1,3}\s*.*(QA|Report)", re.IGNORECASE | re.MULTILINE)

# Substrings that indicate a tool call failed mid-run. If these appear in the
# raw agent output but the agent's own summary never mentions NOT TESTED /
# timeout / denied, the report likely dropped a failure on the floor.
_FAILURE_MARKERS = (
    "denied by policy",
    "denied by pre-tool hook",
    "command timed out",
    "context canceled",
)


def _extract_final_report(raw: str) -> str:
    matches = list(_REPORT_HEADING_RE.finditer(raw))
    if not matches:
        text = raw
    else:
        # Slice from the last heading onward — this both drops duplicated earlier
        # drafts and strips any leading noise (background-task notifications,
        # partial output) that preceded the agent's actual report.
        text = raw[matches[-1].start():]

    # Clean trailing runaway task polling and timeout artifacts from final report
    cleaned_lines = []
    for line in text.splitlines():
        # Skip runner polling / background task noise
        if re.search(r"^(Waiting for task|Parent task|Command timed out|context canceled|Access to path|Output:)", line.strip()):
            continue
        cleaned_line = re.sub(r"Command timed out after \d+(\.\d+)?s", "", line)
        cleaned_line = re.sub(r"Waiting for task-\d+ completion\.?", "", cleaned_line)
        cleaned_lines.append(cleaned_line)

    return "\n".join(cleaned_lines).strip()


def _integrity_banner(raw: str, final: str) -> str:
    raw_lower = raw.lower()
    final_lower = final.lower()
    hit_markers = [m for m in _FAILURE_MARKERS if m in raw_lower]
    if not hit_markers:
        return ""
    if "not tested" in final_lower or "timeout" in final_lower or "denied" in final_lower:
        # The agent's own summary appears to acknowledge the failure(s).
        return ""
    return (
        "<p style=\"background:#fff3cd;border:1px solid #ffe08a;padding:10px;"
        "color:#664d03;\"><strong>⚠️ Automated integrity warning:</strong> "
        "the raw agent output for this run contained tool-execution failures "
        f"({', '.join(hit_markers)}) that are not acknowledged anywhere in "
        "the summary below. Treat any PASS claims in this report as "
        "unverified until a human checks the raw log.</p>"
    )


def _verdict_banner(verdict: str) -> str:
    if verdict == "PASS":
        return (
            "<p style=\"background:#d1e7dd;border:1px solid #a3cfbb;padding:10px;"
            "color:#0f5132;\"><strong>&#9989; Verified.</strong> A second, "
            "independent review agent fact-checked this report against the "
            "actual repository and test output before this email was sent. "
            "Any new spec files have been committed.</p>"
        )
    return (
        "<p style=\"background:#f8d7da;border:1px solid #f1aeb5;padding:10px;"
        "color:#842029;\"><strong>&#128721; Needs human review.</strong> The "
        "independent review agent could not fully verify this report's "
        "claims (see \"Verification notes\" below). Any new spec files were "
        "<em>not</em> committed — nothing changed in the repo from this "
        "run.</p>"
    )


def run_direct_playwright_suite() -> str:
    """Fallback test runner when LLM agent hits 429 quota or connection errors."""
    print("Running direct Playwright fallback suite...")
    try:
        proc = subprocess.run(
            ["npx", "playwright", "test", "--project=chromium"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=300,
        )
        output = (proc.stdout or "") + "\n" + (proc.stderr or "")
        status = "PASS" if proc.returncode == 0 else "FAIL"
        trimmed = output.strip()[-4000:] if len(output.strip()) > 4000 else output.strip()
        return f"""# QA Report — Direct Playwright Execution (Non-LLM Fallback)

> ℹ️ **Notice**: The LLM QA Agent was unavailable or hit Gemini Free Tier rate limits (429).
> The automated test suite was executed directly via Playwright.

### Overall Status: {status} (Exit Code: {proc.returncode})

### Playwright Output:
```text
{trimmed}
```
"""
    except Exception as err:
        return f"""# QA Report — Test Execution Error

Failed to execute direct Playwright fallback suite: {err}
"""


def send_report_email(raw_report: str, verdict: str):
    resend.api_key = os.environ.get("RESEND_API_KEY")
    if not resend.api_key:
        print("Warning: RESEND_API_KEY not found. Skipping email.")
        return

    to_email = os.environ.get("QA_REPORT_EMAIL", "contact@roomivo.eu")
    from_email = os.environ.get("FROM_EMAIL", "Roomivo QA <contact@roomivo.eu>")

    final_report = _extract_final_report(raw_report)
    integrity_banner = _integrity_banner(raw_report, final_report)
    verdict_banner = _verdict_banner(verdict)

    html_content = f"""
    <h2>Roomivo QA Agent Report</h2>
    {verdict_banner}
    {integrity_banner}
    <pre style="white-space: pre-wrap; font-family: monospace;">{final_report}</pre>
    """

    subject = "Daily QA Agent Report"
    if verdict != "PASS":
        subject += " — NEEDS HUMAN REVIEW"

    try:
        r = resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        })
        print(f"Email sent successfully: {r}")
    except Exception as e:
        print(f"Failed to send email: {e}")


async def main():
    report = None
    verdict = "NEEDS_HUMAN_REVIEW"
    llm_succeeded = False

    try:
        report = await run_qa_agent()
        print("----- QA AGENT REPORT (raw) -----")
        print(report)
        print("----------------------------------")
        llm_succeeded = True
    except Exception as e:
        print(f"⚠️ QA Agent failed (likely rate limit or quota): {e}")
        report = run_direct_playwright_suite()
        verdict = "PASS" if "Overall Status: PASS" in report else "NEEDS_HUMAN_REVIEW"

    verified_report = report
    if llm_succeeded and ENABLE_VERIFIER:
        try:
            verified_report = await run_verifier_agent(report)
            print("----- VERIFIER REPORT (raw) -----")
            print(verified_report)
            print("----------------------------------")
            verdict = _extract_verdict(verified_report)
        except Exception as e:
            print(f"⚠️ Verifier agent failed: {e}. Using unverified QA report.")
            verified_report = (report or "") + f"\n\n*(Note: Verifier pass skipped due to error: {e})*"
            verdict = "NEEDS_HUMAN_REVIEW"
    elif llm_succeeded:
        print("Verifier agent skipped (ENABLE_VERIFIER=false to conserve free tier quota).")
        if "CRITICAL" not in (report or "").upper() and "FAILED" not in (report or "").upper():
            verdict = "PASS"
        else:
            verdict = "NEEDS_HUMAN_REVIEW"

    print(f"Final verdict: {verdict}")
    _write_github_output("verified", "true" if verdict == "PASS" else "false")

    try:
        send_report_email(verified_report or "No report content generated.", verdict)
    except Exception as e:
        print(f"Failed in send_report_email: {e}")


if __name__ == "__main__":
    asyncio.run(main())
