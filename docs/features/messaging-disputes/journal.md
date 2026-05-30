# Journal — Messaging, Disputes & Inventory

## Purpose
Landlord↔tenant conversations, and the dispute-facilitation workflow (move-in/move-out
inventory, evidence, responses, geo-verification, admin mediation).

## Surface
- `app/routers/{messages,dispute,inventory}.py`,
  `app/models/{messages,dispute,inventory}.py`.
- Frontend: `/inbox`, `/disputes/*`, `/admin/disputes`, `/leases/[id]/incident`,
  `components/{UnifiedInbox,ConversationView}.tsx`.

## French-law touchpoints
- Loi ALUR art. 22 (deposit return) referenced in dispute handling; tenant `devoir de
  signalement` (duty to report damage). Disputes can redirect to external mediation.
- `amount_claimed` is `Numeric(10,2)`.

## Audit findings
- 🟢 Conversation/message access is scoped to participants; disputes scoped to
  `raised_by_id`/`accused_id`/lease parties.
- 🟡 **IDOR coverage gap (test-only):** the mocked-DB test harness can't exercise
  cross-user access with real rows, so authorization is verified by reading the code,
  not by an integration test. Logged as backlog.
- 🟡 Evidence uploads share the R2 storage path controls (allow-listed, random names).

## Backlog
- Real-DB integration tests: user A cannot read user B's conversation / dispute /
  inventory; concurrency test for evidence/response races.
