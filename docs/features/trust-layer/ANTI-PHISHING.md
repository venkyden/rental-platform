# Anti-Phishing Operations — Brand & Domain Defense

Stress-test finding F7 (WS-6): the moment Roomivo has any recognition, scammers
will send "verify yourself on roomivo-verify.app before the visit" links. The
brand becomes the phishing template. This file is the standing defense plan.

## What is already enforced in code

- **Verify-by-ID**: the evidence PDF instructs "don't trust the link — type the
  code yourself on roomivo.app" and now carries the canonical-domain statement
  (`CANONICAL_DOMAIN_STATEMENT`, `services/credential.py`): roomivo.app is the
  ONLY official domain; anything else is fraud.
- **Credential ID entropy**: `vc_` + 128 random bits — enumeration is hopeless
  (`test_anti_phishing.py`).
- **Per-IP rate limits on the public endpoints** (`routers/credentials.py`):
  30/min on verify, 10/min on evidence PDF. ⚠ Implementation note: these use
  `shared_limit(scope=...)`, NOT plain `@limiter.limit` — slowapi's default
  buckets per URL path, so a plain limit gives an enumerator a fresh allowance
  per guessed ID. Keep the shared scope if you touch these.
- **Published public key**: `GET /credentials/public-key` (PEM) and
  `/credentials/public-keys` (history with kid) — B2B verifiers never need to
  trust our web page to check a signature.

## Typo-domain watchlist

Candidates to register when budget allows (~€10–15/yr each), or to monitor
until then, in priority order:

| Domain | Attack |
|---|---|
| roomiv0.app / ro0mivo.app | zero-for-o |
| roomivo.fr / .com / .io | extension squat (register .fr and .com first — French users type them by reflex) |
| roomivo-verify.app / verif-roomivo.fr | "verification" prefix/suffix — the most convincing phishing form |
| room1vo.app | one-for-i |
| roomivo.app.* (subdomain of attacker domain) | covered by user education only |

## Monitoring (all free)

1. **Certificate-transparency watch**: weekly check of crt.sh for `%roomivo%`
   — every phishing site that wants the padlock shows up here first.
   `curl -s "https://crt.sh/?q=%25roomivo%25&output=json"`
2. **dnstwist run** (`pipx run dnstwist roomivo.app`) monthly: registered
   permutations + MX records (MX = they intend to phish by mail).
3. **Marketplace search**: periodic Leboncoin/FB search for "roomivo" in
   listings/messages once the brand is used in the wild.

## Takedown procedure (France)

In order, fastest first:
1. **Registrar abuse contact** of the offending domain (whois → abuse@) with
   screenshots; mention "phishing" explicitly — registrars act faster on
   phishing than on trademark.
2. **Phishing Initiative** (phishing-initiative.fr, Orange/Vade) — gets the URL
   into browser blocklists (Safe Browsing et al.), which kills most traffic.
3. **cybermalveillance.gouv.fr** + **Signal Arnaques** listing — public record,
   useful evidence for later legal steps.
4. **33700 / Pharos** report if SMS or serious criminal volume is involved.
5. If the site impersonates the brand persistently: LRAR to the registrar +
   UDRP/Syreli (AFNIC, for .fr) — costs money; only for persistent offenders.

## User-education surface (product copy rules)

- Every place a credential link can be shared must repeat the one rule:
  **"type the code on roomivo.app yourself — never click a link to 'verify'"**.
- Roomivo NEVER contacts users asking them to re-verify via a link. Say this
  on the site, in the PDF, and in every notification email footer.
- The publishable public key + kid history page doubles as the anchor for
  "how to check you're on the real site".

## Log

| Date | Event | Action |
|---|---|---|
| 2026-07-04 | Plan created (WS-6) | Rate limits + PDF statement shipped |
