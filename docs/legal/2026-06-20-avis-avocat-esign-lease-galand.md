# Avis juridique — Génération de bail numérique & signature électronique

> **Auteur :** Mathieu Galand, Avocat au Barreau de Paris.
> **Date :** 20 juin 2026.
> **Destinataire :** Roomivo (Nallam Venkataramaya & C.A. Nishanth, Étudiants-Entrepreneurs SNEE).
> **Objet :** réponse à la note de cadrage [brief-avocat-droit-immobilier.md](brief-avocat-droit-immobilier.md)
> — avis sécurisant sur le module de génération de bail (Path A) et de signature électronique (Path B).
> **Statut :** ✅ **avis écrit obtenu** — clôt le point ouvert PRD §7.6 / DOSSIER §0.16
> ("obtenir la bénédiction de l'avocat par écrit").

---

> *Reproduction fidèle de l'avis transmis par l'avocat. Document de référence pour le dossier
> juridique ; ne pas modifier le texte de l'avis.*

**Subject: Legal Assessment of Digital Lease Generation and Electronic Signature Process**

**Date: 20 June 2026**

Following a review of the proposed digital lease generation and electronic signature workflow
implemented on the Platform, and based on the information provided to us, it is our opinion that:

1. The generation of residential lease agreements in electronic format is permissible under
   French law.
2. The execution of lease agreements through electronic signatures is legally valid, provided
   that the electronic signature solution complies with applicable European and French legal
   requirements, including Regulation (EU) No. 910/2014 (eIDAS).
3. The Platform may facilitate the conclusion of lease agreements electronically, provided that:
   * all mandatory contractual provisions required by French tenancy legislation are included;
   * required annexes and diagnostics are provided to the parties;
   * appropriate identity verification and authentication measures are implemented;
   * an auditable record of the signing process is maintained; and
   * personal data is processed in compliance with applicable data protection laws.
4. Subject to the foregoing assumptions and conditions, there are no legal impediments identified
   that would prevent the Platform from offering digital lease generation and electronic signature
   services for residential rental agreements in France.

**Conclusion**

Based on the information reviewed, we consider the proposed digital lease and electronic signature
process to be legally permissible under French law and suitable for commercial deployment, subject
to ongoing compliance with applicable legal and regulatory requirements.

This opinion is limited to the matters expressly addressed herein and is based on French law in
force on the date of this opinion.

Mathieu Galand
Avocat au Barreau de Paris

---

## How the current build maps to the opinion's conditions (condition 3)

The opinion green-lights deployment **subject to** the §3 conditions. Mapping to the shipped
e-sign Path B rail (`feat/esign-path-b`) and the still-unbuilt Path A:

| Condition (§3) | Path B (upload + e-sign) — shipped | Path A (template generation) — not built |
|---|---|---|
| Mandatory contractual provisions | N/A — landlord provides their own wording; recorded **ATTACHED / NOT LEGALITY-VERIFIED** | **Gating** — Décret 2015-587 model + LU-* legality rules must enforce this |
| Required annexes & diagnostics (DPE/ERP/notice) | Out of scope for upload; flagged but not gated | **Gating** — auto-stitch/validate annexes before finalisation |
| Identity verification & authentication | ✅ SG-1: only `identity_verified` parties may sign | same |
| Auditable record of signing | ✅ Ed25519-signed manifest: doc SHA-256, per-signer timestamp/IP/consent/credential ref | same |
| GDPR-compliant data processing | ✅ no PII source docs at rest; banded claims only; durable storage of the signed instrument | same |

**Takeaway:** the conditions identity-verification, auditable-record, and GDPR are **met** by
Path B as shipped. The "mandatory provisions" and "annexes/diagnostics" conditions are the
**gating requirements for Path A** (Roomivo-generated leases) — they do not block Path B, where
the landlord supplies their own document.
