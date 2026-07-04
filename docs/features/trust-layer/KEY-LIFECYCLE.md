# Credential Signing Key — Lifecycle & Compromise Runbook

Ed25519 signing key **is the product**: every credential and evidence document
is only as trustworthy as this key. Runbook covers key identification, routine
rotation, compromise response. (Stress-test finding F12, WS-3.)

## Key identification (`kid`)

- `kid` = first 16 hex chars of SHA-256 over the raw 32-byte public key
  (`services/credential.py::_kid_for`).
- The `kid` is **inside the signed payload** — tampering with it invalidates the
  signature. It is persisted on the `credentials.kid` column and returned by the
  issue/verify endpoints.
- Credentials issued before 2026-07 carry no `kid` and verify by trial against
  all known keys.

## Environment variables

| Var | Contents | Role |
|---|---|---|
| `CREDENTIAL_SIGNING_KEY` | hex, 32-byte Ed25519 **seed** | ACTIVE key — signs everything new. Secret. |
| `CREDENTIAL_RETIRED_VERIFY_KEYS` | comma-separated hex, 32-byte raw **public** keys | Verify-only. Not secret. |

Public endpoints: `GET /credentials/public-key` (active, PEM) and
`GET /credentials/public-keys` (full history JSON: `{kid, public_key_pem, status}`).

## Routine rotation (planned, e.g. yearly or on personnel change)

1. Generate a new seed:
   `python -c "import os; print(os.urandom(32).hex())"`
2. Derive the OLD key's raw public hex before replacing it:
   ```python
   from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
   from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
   old = Ed25519PrivateKey.from_private_bytes(bytes.fromhex("<OLD_SEED>"))
   print(old.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex())
   ```
3. Set `CREDENTIAL_SIGNING_KEY=<new seed>` and **append** the old public hex to
   `CREDENTIAL_RETIRED_VERIFY_KEYS` on **both** the web service and the worker.
4. Deploy. New credentials sign under the new `kid`; old ones keep verifying.
5. After the **longest TTL of any credential signed by the old key** has elapsed
   (default TTL: 30 days — wait ≥ the max `ttl_days` ever granted), remove the
   old public key from `CREDENTIAL_RETIRED_VERIFY_KEYS`.
6. Record the rotation (date, old kid, new kid) in this file's log below.

## Compromise response (seed leaked or suspected)

A leaked seed lets an attacker sign credentials indistinguishable from real ones.
Speed matters more than ceremony:

1. **Rotate immediately** (steps 1–4 above) — but do **NOT** put the compromised
   public key in `CREDENTIAL_RETIRED_VERIFY_KEYS`. Verification of everything it
   signed must fail from this moment; that is the point.
2. **Bulk-revoke** all unexpired credentials whose `kid` matches the compromised
   key (`UPDATE credentials SET revoked = true, revoked_at = now() WHERE kid =
   '<compromised kid>' AND expires_at > now()`), so the verify page says
   *revoked* rather than *signature mismatch* — honest messaging for holders.
3. **Notify**: post the incident on the canonical domain's key page (the same
   page that publishes the public key), including the compromised `kid` and the
   date range affected. B2B verifiers caching keys must be told directly.
4. **Re-issue**: affected users re-run issuance (their verified state is still
   in the DB; re-issue is cheap) — new credentials sign under the new key.
5. Post-mortem: how did the seed leak (Render env access? repo? laptop?), and
   record it here.

## Storage rules

- The seed lives ONLY in the deployment platform's secret store (Render env).
  Never in the repo, never in logs, never in client code.
- The seed is a single point of failure by design (€0 OPEX constraint — no HSM).
  Mitigations: this runbook, `kid`-based fail-closed verification, short TTLs,
  and the bulk-revoke path above.

## Rotation log

| Date | Old kid | New kid | Reason |
|---|---|---|---|
| — | — | — | (no rotation yet; initial key) |
