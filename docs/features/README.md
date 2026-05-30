# Roomivo — Feature Inventory & Journals

Per `.agent/rules/master_rules.md`, each feature has a journal. This index maps the
**entire feature surface** (24 backend routers + the Next.js pages) and links the
detailed journals. Audit status from the 2026-05-30 full audit.

| Feature domain | Backend router(s) | Frontend | Journal | Audit |
|---|---|---|---|---|
| Authentication & accounts | `auth.py` | `/auth/*`, `AuthContext` | [auth](auth/journal.md) | ✅ fixed (async email, tz tokens) |
| Listings & French compliance | `properties.py`, `location.py`, `media.py` | `/search`, `/properties/*` | [listings-compliance](listings-compliance/journal.md) | ✅ fixed (rent control) |
| Search & AI matching | `properties.py` (recommendations), `matching_service` | `/search`, `SearchMap` | [search-matching](search-matching/journal.md) | 🟡 reviewed |
| Applications | `applications.py` | `/applications/*` | [applications](applications/journal.md) | 🟡 reviewed (IDOR notes) |
| Visits & leases | `visits.py`, `leases.py`, `lease_generator` | `/leases/*`, `VisitScheduler` | [leases-visits](leases-visits/journal.md) | 🟡 reviewed |
| Verification / KYC | `verification.py`, `identity.py`, `webhooks.py` | `/verify/*`, `/verification` | [verification-kyc](verification-kyc/journal.md) | 🟡 reviewed |
| Guarantor / GLI / Visale | `verification.py` (gli/visale), `gli_service` | `/gli`, `/verify/guarantor` | [verification-kyc](verification-kyc/journal.md) | 🟡 reviewed |
| Messaging | `messages.py` | `/inbox`, `UnifiedInbox` | [messaging-disputes](messaging-disputes/journal.md) | 🟡 reviewed |
| Disputes & inventory | `dispute.py`, `inventory.py` | `/disputes/*`, `/admin/disputes` | [messaging-disputes](messaging-disputes/journal.md) | 🟡 reviewed |
| Documents vault | `documents.py` | `/documents` | [verification-kyc](verification-kyc/journal.md) | 🟡 reviewed |
| Team & property managers | `team.py`, `property_manager.py` | `/team` | [auth](auth/journal.md) | 🟡 reviewed (authz) |
| Notifications | `notifications.py`, `notification_service` | `NotificationBell` | [auth](auth/journal.md) | 🟡 reviewed |
| Stats & dashboards | `stats.py` | `/dashboard/*`, `/analytics` | [listings-compliance](listings-compliance/journal.md) | 🟡 reviewed |
| GDPR & privacy | `gdpr.py` | `/legal/*`, `CookieConsentBanner` | [gdpr-privacy](gdpr-privacy/journal.md) | ✅ fixed (export, CNIL) |
| Mentions Légales (SNEE) | — | `/legal/mentions-legales` | [gdpr-privacy](gdpr-privacy/journal.md) | ✅ fixed (no SIRET) |
| Onboarding & segments | `onboarding.py`, `segment_routing` | `/onboarding` | [auth](auth/journal.md) | 🟡 reviewed |
| Admin & feature flags | `admin.py`, `feature_flag_service` | `/admin/*` | [security-infrastructure](security-infrastructure/journal.md) | 🟡 reviewed |
| Bulk import/export | `bulk.py` | `/bulk` | [listings-compliance](listings-compliance/journal.md) | 🟡 reviewed |
| Webhooks (ERP/Stripe) | `webhooks.py`, `webhook_subscriptions` | `/webhooks` | [security-infrastructure](security-infrastructure/journal.md) | 🟡 reviewed |
| Feedback | `feedback.py` | — | [security-infrastructure](security-infrastructure/journal.md) | 🟡 reviewed |
| Security, headers & infra | `main.py`, `core/*`, nginx, docker | global | [security-infrastructure](security-infrastructure/journal.md) | ✅ fixed (headers, CORS, log) |

Legend: ✅ changed in the 2026-05 remediation · 🟡 reviewed, findings in the journal/backlog.

See `openspec/changes/2026-05-critical-remediation/proposal.md` for the consolidated change set.
