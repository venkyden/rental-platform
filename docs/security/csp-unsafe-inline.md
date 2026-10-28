# Accepted risk: `script-src 'unsafe-inline'` on the frontend

Decided 2026-10-28, after a council review (five advisors with an anonymous peer review). The security policy manual (§2.2) asks for nonce-based scripts; this records why the frontend does not do that yet, and what is done instead.

## Decision

Keep `'unsafe-inline'` in `script-src` (`frontend/next.config.ts`). Do not add nonces, either on every page or only on the sensitive routes.

## Why not nonces

- **Every page.** Next.js nonces force dynamic rendering, so every page, landing and listings included, would be rendered per request on a 0.5-CPU Render instance. That is a poor trade against a vector that is already well defended: React escapes all user content, and the only raw-HTML sinks are three JSON-LD blocks with `<` escaped.
- **Only the sensitive routes.** A CSP applies to the document that was loaded, not to the route shown. Users reach `/verification` and `/settings` through client-side `<Link>` navigation, so those pages would mostly run under the policy of whichever page loaded first. A script on any page of the origin can also call `/auth/refresh` (the frontend origin is allowed) and act through the API. A route-scoped nonce would look like protection without being it.

## What protects instead

- **Signing a lease needs a one-time code** emailed to the signer, bound to the lease, the signer and the document hash (`backend/app/routers/esign.py`). A script in the page or a stolen access token can no longer sign alone. This holds however the script got in, including through a compromised dependency, which CSP does not stop.
- The access token lives in memory only, and the refresh token is an httpOnly cookie behind an Origin check.
- Pinned by `frontend/e2e/security_guards.spec.ts`: raw HTML only in the allow-listed JSON-LD files, and a CSP that keeps `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` and `form-action 'self'`, with no `'unsafe-eval'` and no wildcard script sources.
- The Dependency Audit CI gate and Dependabot cover vulnerable packages.

Not covered by a code: issuing a credential (`/credentials/issue-mine`). Credentials carry banded claims only, and the user can revoke them.

## Revisit when

- the app renders any user-supplied HTML (rich text, imported listings, markdown);
- the sign-in, verification and e-sign pages move to their own subdomain, which would make a strict policy meaningful;
- Next.js supports nonces or hashes on statically rendered pages.
