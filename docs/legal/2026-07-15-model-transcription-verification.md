# Model transcription verification — Décret n°2015-587 assets vs. Légifrance

> **Author:** Claude (engineering session), verified against the Légifrance API.
> **Date:** 15 July 2026.
> **Scope:** `backend/app/services/lease_models/2025-01-01/annexe2_meuble.md` (the meublé /
> étudiant contrat-type) and `annexe1_vide.md` (the vide contrat-type) — both checked.
> **Status:** ✅ **F1, F3, F4 fixed and re-verified against the Légifrance API the same
> day** (cleaned similarity 85%/84% → **99.17%/99.30%** for meublé/vide; remaining "diffs"
> are our own added navigation heading — harmless — and one pre-existing punctuation-
> spacing artifact in the API's plain-text field, unrelated to these edits). **F2 (the
> inserted "identifiant fiscal du logement" field) removed from the model text**, but its
> `lease_fields.py` schema entry is corrected (false citation removed), not deleted — an
> owner decision on reinstating it under a real legal basis is still open. See "Fixes
> applied" section below for exactly what changed. This is not a legal opinion — the
> mechanical comparison method still stands as the evidence base for counsel/owner review;
> the underlying model text is still gated on lawyer sign-off (unchanged by this pass —
> fixing transcription defects doesn't substitute for that review).
> **Trigger:** owner asked to enforce "no template → refuse" against what Legifrance
> actually publishes (2026-07-13/14); that required verifying our transcription is
> actually verbatim before treating "official model exists" as true. It wasn't, fully.

---

## Method

1. Registered a PISTE (piste.gouv.fr) application, subscribed it to the **Légifrance** API
   (self-service, `Soumis à validation` empty — no approval wait), set the OAuth client
   type to **Confidential** (required for `client_credentials`; `Public` clients fail
   `invalid_client` on every combination — this cost most of the setup time).
2. Obtained an OAuth2 token (`client_credentials` grant) from
   `https://oauth.piste.gouv.fr/api/oauth/token`.
3. Pulled the authoritative article JSON from
   `https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/getArticle`:
   - `LEGIARTI000043842249` — Annexe 2 (logement meublé), the source our
     `annexe2_meuble.md` claims to reproduce.
   - `LEGIARTI000043842254` — Annexe 1 (logement vide), the source our
     `annexe1_vide.md` claims to reproduce.
4. Normalized both sides (strip markdown syntax / our own headings, strip `[…]`
   placeholders and `(n)` footnote markers, collapse whitespace, drop the list-bullet vs.
   inline-dash formatting difference — a normalization artifact, not a content diff) and
   ran a token-level `difflib` comparison.
5. This is a **direct primary-source comparison** — the article JSON's `texte` field is
   the API's authoritative field, not a web-rendered or AI-summarized version. (An earlier
   attempt via a URL-fetching tool that renders pages through a small LLM was explicitly
   abandoned for this reason: it truncated/elided text under a quote-length cap and cannot
   be trusted for verbatim verification. That attempt is documented in-conversation, not
   used as evidence here.)

Raw token-similarity: 74%. Once the bullet/dash normalization artifact is excluded:
**85%** — and the residual 15% resolves to the specific, itemized divergences below
(F1–F5), not diffuse noise.

---

## Findings — `annexe2_meuble.md` (85% cleaned similarity) and `annexe1_vide.md` (84%)

F1–F3 below reproduce **identically in both files** — same field inserted at the same
structural position, same clause rewritten the same way, same footnote dropped in each
file's own numbering scheme. This is a systematic editing pattern across the asset set,
not an isolated slip in one file. F4 is specific to `annexe1_vide.md` only.

### F1 — Missing preamble (already disclosed in the asset header, 2026-07-13)
The published article opens with:
- Official title: *"CONTRAT TYPE DE LOCATION OU DE COLOCATION DE LOGEMENT MEUBLÉ"*
- Subtitle: *"(Soumis au titre Ier bis de la loi du 6 juillet 1989…)"*
- **"Champ du contrat type"** — scope + exclusions (colocations formalisées par plusieurs
  contrats ; logements HLM conventionnés art. L.351-2 CCH)
- **"Modalités d'application du contrat type"** — ordre public / clauses essentielles
  explanation

None of this appears in `annexe2_meuble.md`, which starts at `I. Désignation des parties`
under an invented markdown heading. **Severity: incompleteness**, not alteration — the
body that follows is (mostly) the right text, just missing its frame. Already flagged in
the asset's own header as "KNOWN INCOMPLETE".

`annexe1_vide.md` — **same finding**: official opens with *"CONTRAT TYPE DE LOCATION OU
DE COLOCATION DE LOGEMENT NU (Soumis au titre Ier…)"* + the same two preamble sections
(worded for "nu"/unfurnished instead of "meublé"); our file again starts at section I.

### F2 — NEW: inserted field with no basis in the décret
`annexe2_meuble.md`, section "A. Consistance du logement":
```
- identifiant fiscal du logement : [Numéro Identifiant Fiscal du logement] ;
```
**This line does not exist in the official annexe.** It sits between "localisation du
logement" and "type d'habitat", both of which are official. Confirmed by its total
absence in the API `texte` field at the corresponding position (and everywhere else in
the article). **Severity: alteration** — content added, not merely omitted. May be
well-intentioned (a per-property tax identifier may be a real, separate obligation
somewhere in French law) but it is not part of the Décret 2015-587 contrat-type, and the
asset header claims "reproduced VERBATIM… DO NOT EDIT THE LEGAL TEXT."

`annexe1_vide.md` — **same finding, identical wording, same structural position**
("A. Consistance du logement", right after "localisation du logement"). The same line
was inserted into both models.

### F3 — NEW: a rewritten clause replacing a cross-reference
Official text (energy-performance clause, section II.A):
> *"…la consommation énergétique du logement, déterminée selon la méthode du diagnostic
> de performance énergétique mentionné à l'article L. 126-26 du code de la construction
> et de l'habitation, ne doit pas excéder, à compter du 1er janvier 2028, le seuil fixé
> au I de l'article L. 173-2 du même code (28 bis)."* (~40 words, one cross-reference,
> one footnote marker)

`annexe2_meuble.md` replaces this with an expanded, spelled-out table of DPE-class
décence thresholds by date and by region (métropole vs. Guadeloupe/Martinique/
Guyane/Réunion/Mayotte) — roughly 130 words — and **drops footnote (28 bis) entirely**
(confirmed absent from `annexe2_meuble_footnotes.md` too, independently, via the same
diff method on the footnotes file: 93.7% similarity, sole divergence = missing 28 bis).

**Severity: alteration**, the most serious of the findings — a decree cross-reference was
substituted with someone's paraphrase of what that cross-reference resolves to. Whether
the substituted content is factually accurate as a statement of the underlying law
(L.173-2 CCH thresholds) is a separate question from whether it belongs in a file
presented as the verbatim contrat-type text. It does not.

`annexe1_vide.md` — **same finding, same mechanism**: official cross-reference sentence
(*"…ne doit pas excéder, à compter du 1er janvier 2028, le seuil fixé au I de l'article
L. 173-2 du même code (5 bis)"* — footnote numbered `(5 bis)` here, vs `(28 bis)` in
meublé, per each file's own footnote sequence) replaced by the same expanded décence
table, and footnote `(5 bis)` correspondingly dropped from `annexe1_vide_footnotes.md`
(confirmed independently: 94.05% similarity, sole divergence = the missing footnote).

### F4 — `annexe1_vide.md` only: inserted quotation marks around a statutory citation
Official text (section IX, honoraires — quoting loi 89 art. 5, alinéas 1–3), **no
quotation marks in the source**:
> *"Il est rappelé les dispositions du I de l'article 5 (I) de la loi du 6 juillet 1989…
> : La rémunération des personnes mandatées… Les honoraires des personnes mandatées pour
> effectuer la visite…"* — continuous unquoted prose.

`annexe1_vide.md` inserts `"…"` quote marks around two of these sentences, presenting
them as visually distinct quoted blocks the source does not distinguish that way.
**Severity: cosmetic/formatting** — meaning is unaffected, but it is still an inserted
character sequence in a "verbatim" file. **Not present in `annexe2_meuble.md`**, whose
transcription of the same statutory citation (same wording, same law, both models quote
loi 89 art. 5) is unquoted and matches the official text exactly — so this is
file-specific, not systematic. (Also checked: `(I)` after "l'article 5" is correctly
present in vide, per its official source, and correctly absent in meublé, per *its*
official source — no discrepancy on that point in either file.)

### F5 — Minor: silent orthographic corrections (both files)
`A` → `À`, `du` → `dû` (grammatically "corrected" accents in running text). Small, but
still literal alterations in a file claiming byte-for-byte fidelity. **Severity: cosmetic**,
noted for completeness.

---

## Interpretation

F1 is an *incompleteness* problem (fixable by appending text we're missing). F2 and F3
are *alteration* problems — content was added or substituted, not just left out — and
that is precisely the category of risk the file's own **"⏳ PENDING LAWYER SIGN-OFF
before it is wired into generation"** gate exists to catch. Finding the *same two*
non-trivial alterations, at the same structural positions, in **both** ~200-line assets
checked so far, is evidence *for* keeping that gate closed, not an argument to
risk-accept past it — it indicates a deliberate (if undocumented) editorial pass across
the model set, not a one-off transcription slip.

This also bears on `docs/features/trust-layer/DOSSIER.md` §9 item 15/16 doctrine note
(residual "④"): the live legacy generator's *"conforme aux dispositions de l'annexe au
décret n° 2015-587"* stamp is unsupportable for a document built from custom templates —
and now it is demonstrated that even the *intended-to-be-verbatim* asset itself cannot
yet honestly carry an unqualified "conforme" claim either, until F1–F3 are resolved.

## Not yet done
- `bail_mobilite.fill.md` is founder-authored (owner risk-accepted 2026-07-05, pending
  counsel) — out of scope here, it was never claimed to be a décret reproduction, so
  there is no "verbatim" claim to verify against Legifrance for it.
- No attempt made to determine whether F2 ("identifiant fiscal du logement") reflects a
  real, separately-sourced legal obligation that was intentionally added by whoever wrote
  the assets — only that it is not part of either décret contrat-type text. Worth asking
  before deleting it outright, especially since it was added consistently to both files
  rather than by accident in one.

## Fixes applied (2026-07-15, same session)

Applied to all four model-text files (`annexe2_meuble.md`, `annexe2_meuble.fill.md`,
`annexe1_vide.md`, `annexe1_vide.fill.md`) plus both footnote files, then re-verified
against the Légifrance API (not re-trusted from the fix itself):

- **F1** — prepended the official title, subtitle, "Champ du contrat type", and
  "Modalités d'application du contrat type" verbatim, sourced from the API JSON's
  `texte` field (not retyped from memory or a rendered page).
- **F2** — removed the "identifiant fiscal du logement" line from all four model files.
  Also corrected its `lease_fields.py` schema entry (`source` was falsely "Annexe II.A";
  now flagged `UNVERIFIED` with a pointer to this doc) — **the schema entry was NOT
  deleted**, only corrected, so it can be reinstated if a real legal basis is found.
  One dependent test (`test_missing_required_field_blocks`) referenced this field by
  name to test the required-field gate; repointed to `logement_localisation`, a field
  that is genuinely required and still in the template, so the test's actual intent
  (missing-required-field blocks generation) is preserved. Confirmed via
  `lease_generation.py`'s `generate()` that removing an unused-in-template schema field
  is functionally inert — it only iterates tokens found in the current template — so
  this was a safe, contained change, not a behavioral risk.
- **F3** — replaced the inserted décence-threshold table with the official single
  cross-reference sentence in both bodies, and reinstated the corresponding footnote
  (`28 bis` meublé / `5 bis` vide) in both footnote files.
- **F4** — removed the inserted quotation marks around the loi 89 art. 5 citation in
  `annexe1_vide.md`/`.fill.md` (meublé's transcription of the same citation was already
  correct, unquoted).

**Not changed:** the `Status: ⏳ PENDING LAWYER SIGN-OFF` line in every file header — a
corrected transcription still needs the lawyer's review before Path A is wired into
production; fixing these defects narrows what counsel needs to check, it doesn't replace
the check.

**Verification:** full backend suite green (451 passed) after the fixes, including the
pre-existing `test_safety_invariant_all_fillables_match_verbatim` (confirms `.md` and
`.fill.md` stayed byte-identical modulo tokens/blanks across all edits) and 6 new/updated
tests in `test_lease_generation.py`. Independently, the same normalized diff method used
to find F1–F4 was re-run against the fixed files: 85%/84% → 99.17%/99.30% cleaned
similarity, with the residual gap fully accounted for (harmless additions / pre-existing
API-artifact, not new divergences).

## Recommendation (non-binding — owner/counsel decision)

Original items (a)–(d) below are **done** (see "Fixes applied"). What's still open:

- **F2 owner decision**: does "identifiant fiscal du logement" reflect a real, citable
  obligation? If yes, reinstate it — clearly labelled as an addition, not part of the
  décret body, with the actual source cited in `lease_fields.py`. If no, the corrected
  schema entry can eventually be deleted outright; left as-is for now since deleting is
  harder to undo than leaving a clearly-flagged unused entry.
- **Lawyer sign-off** — unchanged status, still required before Path A wires either
  model into generation. These fixes make that review faster (99%+ verified verbatim
  going in, versus 85%/84% with two live alterations), not unnecessary.
- **Re-run this diff before Path A ships**, and again if `TEMPLATE_VERSIONS` ever adds a
  new dated version — the décret text itself can be amended, and this check is now a
  cheap, repeatable one (PISTE credentials + the normalization script used here).
- `annexe1_vide_footnotes.md` has one pre-existing cosmetic diff unrelated to F1–F4
  (official footnote (16)/(15)-equivalent ends in "décence ;", ours in "décence.") — not
  fixed in this pass, harmless, noted for completeness.
