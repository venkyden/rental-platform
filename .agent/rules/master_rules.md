# Rental Platform Master Engineering Rules & Guidelines

This is the master engineering ruleset for the Rental Platform. It consolidates the guidelines, workflows, and checklists across all specialized roles and behavioral standards.

> [!NOTE]
> This master document serves as a unified reference. The modular rules files remain in the rules folder for specialized agents to load. Refer to the table of contents below for specific guides.

---

## Table of Contents
1. [General Behavioral & Engineering Guidelines](file:///Users/venkat/rental-platform/.agent/rules/general_behavioral_guidelines.md)
2. [Code Review Guidelines](file:///Users/venkat/rental-platform/.agent/rules/code_review_agent.md)
3. [Security Audit & Vulnerability Guidelines](file:///Users/venkat/rental-platform/.agent/rules/security_audit_agent.md)
4. [API Design & Documentation Standards](file:///Users/venkat/rental-platform/.agent/rules/api_design_agent.md)
5. [Database Design & Schema Migration Standards](file:///Users/venkat/rental-platform/.agent/rules/database_design_agent.md)
6. [Systematic Debugging Workflow](file:///Users/venkat/rental-platform/.agent/rules/debugging_agent.md)
7. [Safe Refactoring Process & Code Smells](file:///Users/venkat/rental-platform/.agent/rules/refactoring_agent.md)
8. [Comprehensive Test Writing Guidelines](file:///Users/venkat/rental-platform/.agent/rules/test_writing_agent.md)
9. [DevOps, CI/CD, & Infrastructure Standards](file:///Users/venkat/rental-platform/.agent/rules/devops_expert.md)
10. [Performance Optimization Guidelines](file:///Users/venkat/rental-platform/.agent/rules/performance_optimization_agent.md)
11. [Code & Framework Migration Guidelines](file:///Users/venkat/rental-platform/.agent/rules/code_migration_agent.md)

---

## 1. General Behavioral & Engineering Guidelines
*(Consolidated from [general_behavioral_guidelines.md](file:///Users/venkat/rental-platform/.agent/rules/general_behavioral_guidelines.md))*

### Core Behavioral Axioms
* **Think Before Coding**: Don't assume or hide confusion. Surface tradeoffs. State assumptions explicitly. If uncertain, ask.
* **Simplicity First**: Write the minimum code that solves the problem. No speculative abstractions, features, or configurability.
* **Surgical Changes**: Touch only what you must. Clean up only your own mess. Every changed line must trace directly to the request.
* **Goal-Driven Execution**: Define success criteria. Loop and verify. Transform tasks into verifiable goals with a clear plan.

### Project-Specific Conventions
* **Openspec**: Use Openspec for all feature and logic descriptions.
* **Feature Journals**: For every feature implemented, create a `journal.md` file.

### Scaling & Reliability Guardrails
* **No local session storage**: Never store session data in server memory; use Redis or external databases to allow multi-instance scaling.
* **Object Storage for Uploads**: Move file uploads to object storage (like AWS S3) immediately. Never save uploads directly to the app server disk.
* **Asynchronous Email & Tasks**: Never send emails synchronously or perform blocking operations in API routes. Offload them to background queues (e.g., Celery, BullMQ).
* **Load Testing**: Never go live without load testing key routes first to identify bottlenecks.

---

## 2. Code Review & Quality Standards
*(Consolidated from [code_review_agent.md](file:///Users/venkat/rental-platform/.agent/rules/code_review_agent.md))*

All code changes must undergo a rigorous evaluation across these eight vectors before merge:
1. **Context Understanding**: Understand the purpose, requirements, and constraints.
2. **Correctness**: Validate logic, check boundary/edge cases, ensure runtime safety.
3. **Security**: Validate/sanitize inputs, verify authorization, prevent data leakage.
4. **Performance**: Check for N+1 queries, verify indexing, ensure proper caching.
5. **Quality & Readability**: Maintain style consistency, keep code modular, use clear names.
6. **Architecture**: Separate concerns, follow SOLID principles, match project patterns.
7. **Testing**: Write unit/integration tests with meaningful assertions.
8. **Documentation**: Write self-documenting code, update public APIs, maintain READMEs.

### Review Tone & Feedback Format
* **Format**: State **Severity** (🔴 Critical, 🟠 Important, 🟡 Suggestion, 💡 Nitpick), **Location**, **Issue**, **Remediation**, and **Example Code**.
* **Tone**: Be constructive, explain the *why*, and focus on the code, not the author.

---

## 3. Security Audit & Vulnerability Remediation
*(Consolidated from [security_audit_agent.md](file:///Users/venkat/rental-platform/.agent/rules/security_audit_agent.md))*

### Threat Mitigation Rules
* **Injection Prevention**: Always use parameterized queries. Never use raw concatenation with user input in database queries or shell execution.
* **Authentication & Cryptography**: Never roll your own security. Use established identity providers (e.g., Auth0) and standard libraries (e.g., NaCl) for encryption.
* **Secret Management**: Never hardcode API keys, credentials, or tokens. Store them in environment variables, and use secrets checkers to scan code.
* **DDoS & Traffic Flood Protection**: Place a CDN (e.g., Cloudflare) in front of production servers.
* **XSS Defense**: Escape all user input before rendering. Use a strict Content Security Policy (CSP). Avoid innerHTML and eval.

### Security Headers Checklist
- [ ] Strict-Transport-Security (HSTS)
- [ ] Content-Security-Policy (CSP)
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Referrer-Policy
- [ ] Permissions-Policy

---

## 4. API Design & Documentation Standards
*(Consolidated from [api_design_agent.md](file:///Users/venkat/rental-platform/.agent/rules/api_design_agent.md))*

### REST API Conventions
* **URI Naming**: Use plural nouns (e.g., `/users`), lowercase with hyphens (e.g., `/user-profiles`), and nest resources representing relationships (e.g., `/users/{id}/orders`). Do not use verbs in endpoints.
* **HTTP Methods**: Respect idempotency rules:
  * `GET`: Retrieve data (idempotent, cacheable)
  * `POST`: Create a new resource
  * `PUT`: Replace a resource entirely
  * `PATCH`: Update a resource partially
  * `DELETE`: Remove a resource
* **HTTP Status Codes**: Use correct status codes (e.g., `201 Created` for creations, `204 No Content` for successful empty responses, `400` for bad client parameters, `409` for state conflicts, `422` for validation failures, and `429` for rate limits).
* **Consistent Response Envelope**:
  ```json
  {
    "data": { ... },
    "meta": { "total": 100, "page": 1 },
    "errors": [ { "code": "INVALID_EMAIL", "message": "..." } ]
  }
  ```

### GraphQL Conventions
* **Schema Design**: Use clear, custom types; define inputs for mutations; use nullable fields intentionally.
* **Query N+1 Prevention**: Limit depth, use connection patterns for lists, and enforce the DataLoader pattern to batch database calls.
* **Mutations**: Always return the modified/affected object and include a field for user errors.

---

## 5. Database Design & Schema Migration Standards
*(Consolidated from [database_design_agent.md](file:///Users/venkat/rental-platform/.agent/rules/database_design_agent.md))*

### Schema Design & Keys
* **Normalization**: Follow 1NF, 2NF, and 3NF. Denormalize only for read-heavy query performance or complex reporting, and document it extensively.
* **Primary Keys**: Use auto-incrementing integers or UUIDs (especially for distributed architectures).
* **Foreign Keys**: Always define foreign key constraints with explicit update/delete actions (e.g., `RESTRICT`, `CASCADE`, `SET NULL`).
* **Data Types**: Choose optimal types (e.g., `DECIMAL` for currency, `TIMESTAMP WITH TIME ZONE` for date-times). Use constraint checks and `NOT NULL` wherever applicable.

### Indexing Strategy
* **Index Targets**: Index columns frequently used in `WHERE` clauses, `JOIN` conditions, `ORDER BY`, and foreign keys.
* **Composite Indexes**: Place the most selective column first. Ensure left-prefix compatibility matches query structures.
* **Anti-patterns**: Avoid over-indexing (which degrades write speeds) and indexing low-cardinality columns.

### Safe Migrations
* **Backward Compatibility**: Never drop database columns in the same migration where code changes. Add columns as nullable first, backfill data, make non-nullable if required, and drop old columns in a subsequent release.
* **Concurrent Operations**: In production PostgreSQL databases, always build indexes concurrently (`CREATE INDEX CONCURRENTLY`) to prevent locking tables.

---

## 6. Systematic Debugging & Root Cause Analysis
*(Consolidated from [debugging_agent.md](file:///Users/venkat/rental-platform/.agent/rules/debugging_agent.md))*

### Debugging Workflow
1. **Understand & Reproduce**: Gather symptoms, isolate the environment, and establish a consistent reproduction script/test.
2. **Hypothesize**: Brainstorm potential causes, sorting by likelihood (recent code changes, race conditions, edge cases). Avoid premature conclusions.
3. **Isolate (Binary Search)**: Narrow down the problem space step-by-step. Add strategic logging at critical state decision points.
4. **Identify Root Cause**: Distinguish symptoms from root causes. Ask "Why?" five times to find the source.
5. **Verify**: Ensure the proposed minimal fix addresses the root cause without introducing regressions. Assert that it resolves all symptoms.

---

## 7. Safe Refactoring Process
*(Consolidated from [refactoring_agent.md](file:///Users/venkat/rental-platform/.agent/rules/refactoring_agent.md))*

### Smells to Refactor
* **Long Functions**: Extensively nested or >20 line functions. Extract them.
* **Large Classes**: Violating Single Responsibility Principle (SRP). Split them.
* **Duplicate Code**: Identical logic blocks. Extract to shared helpers.
* **Nested Conditionals**: Use guard clauses for early returns instead of deep `if/else` ladders.

### Safe Refactoring Steps
1. **Verify Test Coverage**: Never refactor code without tests. Write tests first if they are missing.
2. **Run Tests Continuously**: Ensure tests pass before, during (after every small step), and after the refactoring.
3. **No Mixins**: Never combine refactoring and adding features in the same commit.
4. **When NOT to Refactor**: Do not refactor under deadline pressure, when tests do not exist, or when you do not fully understand the logic.

---

## 8. Test Writing & Coverage Strategy
*(Consolidated from [test_writing_agent.md](file:///Users/venkat/rental-platform/.agent/rules/test_writing_agent.md))*

### Testing Design
* **AAA Pattern**: Always structure tests using **Arrange** (set up data/mocks), **Act** (execute function), and **Assert** (verify results).
* **Test Case Scenarios**: Include Happy Path (normal flow), Edge Cases (empty inputs, boundaries, single elements), and Error Cases (invalid inputs, timeouts, network/permission failures).
* **Mocking**: Mock external boundaries (APIs, filesystem, DB keys) but do not mock the logic/unit being tested.
* **Coverage Priorities**:
  1. 🔴 Critical business logic (Goal: 90%+)
  2. 🟠 Complex algorithms (Goal: 80%+)
  3. 🟡 Legacy regression areas / edge cases
  4. 🟢 Public APIs & shared utilities

---

## 9. DevOps, CI/CD, & Infrastructure Standards
*(Consolidated from [devops_expert.md](file:///Users/venkat/rental-platform/.agent/rules/devops_expert.md))*

### CI/CD Pipelines
* **CI Stage order**: Checkout → Install & Cache dependencies → Lint/Typecheck → Unit & Integration Tests → Security & Secrets Scanning → Container Build & Push.
* **CD Promotion**: Same artifacts across `dev` → `staging` → `production` parameterized only by environment-specific config files. Use gated manual approvals for production.
* **Rollbacks**: Ensure automatic rollbacks if post-deployment health checks or smoke tests fail.

### Docker & Containerization
* **Dockerfile Optimization**: Use multi-stage builds, pin base image versions (avoid `latest`), run as non-root users, and use `.dockerignore`.
* **Container Security**: Avoid storing secrets in images; use read-only file systems where possible.

### Kubernetes & Infrastructure
* **Resource Limits**: Enforce CPU and Memory requests and limits. Implement `liveness` and `readiness` probes.
* **Infrastructure as Code (IaC)**: Code and version-control all infrastructure modifications (e.g., Terraform). Enable state locking.

---

## 10. Performance Optimization Guidelines
*(Consolidated from [performance_optimization_agent.md](file:///Users/venkat/rental-platform/.agent/rules/performance_optimization_agent.md))*

### Measurement Rules
* **Measure First**: Always profile before optimizing. Never optimize based on assumptions.
* **Compare**: Benchmark performance before and after to verify improvements.

### Frontend Optimization
* **Core Web Vitals**: Target LCP < 2.5s, CLS < 0.1, and INP < 200ms.
* **Resource Delivery**: Compress images (WebP/AVIF), lazy load below-the-fold assets, code-split JS bundles, and use CDN caching.

### Backend Optimization
* **Database**: Identify slow queries using `EXPLAIN ANALYZE` and eliminate N+1 query patterns.
* **Caching Levels**: Cache expensive calculations and static data (Browser cache-control, CDN edge, application Redis caching).

---

## 11. Code & Framework Migration Guidelines
*(Consolidated from [code_migration_agent.md](file:///Users/venkat/rental-platform/.agent/rules/code_migration_agent.md))*

### Migration Workflow
1. **Assessment & Risks**: List breaking changes, check dependency compatibility, and design a rollback strategy.
2. **Increase Safety Net**: Strengthen test coverage to 80%+ before beginning migration.
3. **Update Gradually**: Upgrade dependencies first, resolve warnings, then migrate major frameworks incrementally.
4. **Validation**: Run integration suites and regression benchmarks in a staging environment. Keep feature flags ready for instant rollbacks.

---

## Unified Engineering Checklist
When performing changes in this codebase, run through this master checklist:
- [ ] Conforms to **Think Before Coding** and **Simplicity First** guidelines.
- [ ] No unrelated files modified (**Surgical Changes**).
- [ ] **Openspec** updated and a `journal.md` created for this feature.
- [ ] Database structures normalized, foreign keys defined, and indexes added concurrently.
- [ ] Database queries checked for N+1 issues and optimized using execution plans.
- [ ] API endpoints follow standard REST/GraphQL naming, methods, and status codes.
- [ ] Security reviewed: no raw SQL/commands, inputs sanitized, secrets placed in `.env`.
- [ ] Session data off server memory, file uploads configured for object storage, and slow tasks offloaded to a queue.
- [ ] Test cases cover happy paths, boundaries, and error codes using the AAA pattern.
- [ ] Deployment variables documented and rollback verification completed.
