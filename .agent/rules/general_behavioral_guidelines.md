# General Behavioral & Engineering Guidelines

These are the core behavioral guidelines to reduce common LLM coding mistakes, manage risks, prevent scale bottlenecks, and adhere to engineering best practices.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

*Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.*

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

*The test: Every changed line should trace directly to the user's request.*

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

*Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.*

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. Project-Specific Conventions & Checklists
- **Documentation & Tracking**: 
  - Use **Openspec** for feature and logic description.
  - Create a `journal.md` file for every feature.
- **Auditing & Architecture Checklist**:
  - [ ] Audit workflow duplicates.
  - [ ] Review Database structure.
  - [ ] Check Search efficiency / N+1 queries.
  - [ ] Verify Payment handling before success rate.

---

## 6. Critical Security Risks & Best Practices
### General Security Vulnerabilities
- **Cross-Site Scripting (XSS)**: Ensure all inputs are validated and properly escaped/sanitized before rendering.
- **SQL Injections**: Use parameterized queries and safe ORM methods. Never concatenate user input directly.
- **Path Traversal**: Validate and sanitize file paths; prevent directory traversal.
- **Secrets Leakage**: Never hardcode secrets! Use environment variables (`.env` files) and check for leakage inside the IDE using utilities.
- **Supply Chain Attacks**: Scan open-source libraries, verify dependencies, and lock versions with lockfiles.

### Dev, CI/CD & Deployments
- **Git Best Practices**: Use `.gitignore` to hide sensitive files. Maintain a sane commit history, sign commits, and use clean branch delegation (`dev`, `staging`, `production`).
- **Secrets Management**: Never hardcode credentials. Use HashiCorp Vault or AWS Secrets Manager.
- **DDoS Protection**: Place a CDN like Cloudflare in front of the application for traffic flooding protection.
- **Auth & Cryptography**: Never roll your own security! Use standard expert providers (e.g., Auth0) for logon flows and libraries like NaCL for encryption.
- **Security Pipelines (SAST & DAST)**: Integrate Static Application Security Testing (SAST) and Dynamic Application Security Testing (DAST) (e.g., Trivy, ZAP) into the CI/CD pipeline to catch issues early.
- **CSP Headers & WAF**: Implement Content Security Policies (CSP) and use a Web Application Firewall (WAF).
- **Container Security**: Keep Docker base images updated, run containers with minimal non-root privileges, and manage secrets securely.
- **Cloud Account Isolation**: Separate cloud environments (e.g., dedicated accounts for `dev`, `staging`, `production`). Use CSPM tools (e.g., AWS Inspector) and set up budget alerts.

---

## 7. Scaling Guardrails: 5 Signs Your App Will Break at 500 Users
Before going live, verify the application does not suffer from these critical scaling issues:
1. **No Load Testing Before Launch**: Without testing limit boundaries, you don't know where it breaks. Run load tests to identify bottlenecks before production traffic hits.
2. **Session Data in Server Memory**: Storing session state in local memory works for single instances but breaks during multi-instance scaling. Store session data in Redis, databases, or client-side secure cookies.
3. **File Uploads Directly to App Server**: Direct uploads fill app server disks and lead to data loss or server crashes. Move uploads to Object Storage (e.g., AWS S3, Cloud Storage) on day one.
4. **Synchronous Email Sending in API Routes**: Slow email SMTP providers will block API response times. Always offload email tasks to a background queue.
5. **No Queue System for Background Tasks**: Blocking operations in HTTP requests pause subsequent tasks. Offload intensive background tasks to a dedicated message queue (e.g., Celery, BullMQ, Redis queue).
