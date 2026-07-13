# Roomivo — Dossier de Présentation

> **Document destiné à un jury / incubateur** (PÉPITE Pays de la Loire, Audencia, French Tech).
> Fondateurs : **Nallam Venkataramaya** & **C.A. Nishanth** — Étudiants-Entrepreneurs (SNEE).
> Version 1.0 — Juin 2026.
>
> ⚠️ **Note méthodologique sur les chiffres.** Roomivo est en phase d'amorçage (pas encore
> de SIRET, pas de revenus). Tous les chiffres financiers et de marché de ce dossier sont
> des **hypothèses de travail explicitement étiquetées `[Hypothèse]`**, accompagnées de leurs
> sources ou de la méthode de calcul (§16). Ils servent à démontrer la logique économique,
> pas à affirmer un réel.

---

## Sommaire

1. Résumé Exécutif
2. Le Problème
3. Pourquoi Maintenant
4. Traction & Projections Financières
5. Retour sur Investissement (ROI)
6. Marché & Chiffres Clés
7. Positionnement
8. Modèle Économique — **deux modèles de revenus distincts**
9. Budget R&D
10. Plan Opérationnel — 5 ans
11. Équipe & Besoins d'Accompagnement
12. Synthèse
13. Grille Tarifaire — Roomivo Particulier (à l'acte)
14. Grille Tarifaire — Roomivo Pro (abonnement)
15. Grille Tarifaire — Credential Layer (Vérification-as-a-Service)
16. Sources & Références
17. Annexe — Preuves d'exécution (technique)

---

## 01 — Résumé Exécutif

**Roomivo est la couche de confiance qui manque aux petites annonces de location.**

Sur Leboncoin, Facebook Marketplace ou PAP, locataires et propriétaires concluent
directement, sans tiers de confiance. Résultat : l'**arnaque au dépôt de garantie**
(un faux propriétaire encaisse une caution puis disparaît), les **faux dossiers**
(avis d'imposition et fiches de paie falsifiés) et les **annonces fantômes** prospèrent.
La plateforme ne protège personne — ce n'est pas son rôle.

Roomivo émet une **preuve signée, à durée de vie courte et portable** attestant que
chaque partie est réelle et solvable — **sans jamais jouer l'intermédiaire, sans toucher
aux fonds, sans stocker de documents**. On vérifie, on émet une attestation cryptographique,
on oublie la source. On vend des **faits vérifiés**, jamais une protection.

**La motion phare (B2B) : la détection de fraude au dossier.** La capacité la plus
défendable est la vérification de la **signature cryptographique DGFiP d'un avis d'imposition
(2D-Doc)** — un avis falsifié est détecté car la signature de l'État ne valide pas. C'est ce
que l'on vend en premier, aux **assureurs GLI et gestionnaires immobiliers** : ROI chiffrable
(sinistralité réduite), un budget, et — surtout — cela vérifie une *signature de document*,
pas une personne, ce qui contourne le mur de certification ANSSI-PVID qui bloque la
vérification d'identité open-source. Une intégration pèse plus que des milliers de micro-frais
grand public pour une équipe sans budget marketing.

**La marketplace grand public est la démo qui tourne, pas le coin de revenu.** La marketplace
de Roomivo fait tourner le moteur de vérification de bout en bout sur de vrais utilisateurs —
c'est la preuve de concept vivante montrée aux assureurs (« voici le contrôle anti-fraude qui
fonctionne, branchez-le sur votre souscription ») et la surface d'acquisition/crédibilité. Ce
n'est délibérément **pas** le pari de revenu principal : le flux bilatéral grand public exige
que le *propriétaire* — qui a tout le levier en marché tendu — se vérifie lui-même, ce qu'il
ne fera pas.

**Deux modèles de revenus, une motion phare :**
- **B. Credential Layer (Vérification-as-a-Service) — LA PHARE.** Le moteur exposé en API/badge
  aux **assureurs GLI, gestionnaires**, puis plateformes tierces (Leboncoin, FB Marketplace,
  PAP). Moteur de marge et cible de revenu de la Phase 1.
- **A. Roomivo (natif)** — la marketplace (à l'acte + Pro) : acquisition, démo et preuve de
  valeur ; une motion de soutien, pas le coin d'entrée.

**Chiffres clés `[Hypothèse]`** : marché locatif privé français ≈ 7 M de ménages ; coût
marginal d'une vérification ≈ 0 € à l'échelle (services d'État gratuits + briques open-source) ;
marge brute cible > 85 % sur le Credential Layer.

**La demande** : **30–50 k€ d'amorçage + accompagnement** (mentorat, mise en relation B2B
avec un assureur GLI / gestionnaire pilote, hébergement, conseil juridique en droit
immobilier pour franchir le « gate légal » bail/e-signature).

---

## 02 — Le Problème

Les annonces de location en ligne sont un marché **pair-à-pair sans tiers de confiance**.
Les deux parties se font face sans aucun moyen fiable de se vérifier mutuellement.

**Taxonomie des arnaques que Roomivo neutralise :**

| Arnaque | Mécanique | Victime | Réponse Roomivo |
|---|---|---|---|
| **Vol de dépôt de garantie** | Faux propriétaire (souvent annonce fantôme) encaisse la caution, disparaît | Locataire | Vérification identité + contrôle du bien côté propriétaire → preuve avant tout paiement |
| **Faux dossier locataire** | Avis d'imposition / fiches de paie falsifiés | Propriétaire | Lecture de la **charge signée** du 2D-Doc (DGFiP) → la falsification du texte imprimé devient sans effet |
| **Annonce fantôme** | Bien qui n'existe pas / n'appartient pas à l'annonceur | Locataire | Contrôle taxe foncière + DPE ADEME → « contrôle, non-propriété attestée » (limite divulguée) |
| **Usurpation d'identité** | Pièce d'identité empruntée / volée | Les deux | Phase 1 : OCR + liveness → **MEDIUM, labellisé comme tel** ; HIGH via FranceConnect (OIDC d'État) après immatriculation — le niveau d'assurance n'est jamais gonflé |
| **Hameçonnage (phishing)** | Faux lien de « vérification » envoyé dans la messagerie | Les deux | Modèle *verify-by-ID* : « ne fais pas confiance au lien, tape le code sur roomivo.app » |

**Pourquoi le marché ne se corrige pas seul** : la plateforme d'annonces ne peut pas
devenir tiers de confiance sans basculer dans un régime réglementé (carte professionnelle
Loi Hoguet). Les solutions existantes (DossierFacile côté locataire, GLI côté propriétaire)
ne couvrent **qu'un seul côté** et ne produisent pas de preuve **portable et bilatérale**
utilisable hors de leur silo.

---

## 03 — Pourquoi Maintenant

Plusieurs déblocages convergent en 2025–2026 :

- **Les rails d'identité d'État s'ouvrent.** Le *justificatif* France Identité signé par le
  Ministère de l'Intérieur existe, mais a été évalué puis **écarté pour la v1** (son portail
  de vérification s'adresse à un humain, pas à une API, et la friction est prohibitive). Le
  vrai déblocage est **FranceConnect** (OIDC d'État) : une **identité HIGH gratuite**,
  conditionnée à l'immatriculation (SIRET + DataPass). La Phase 1 livre du **MEDIUM**
  (OCR + liveness), labellisé comme tel — jamais gonflé.
- **Avis d'imposition 2D-Doc (DGFiP)** : la charge signée ECDSA est lisible et vérifiable
  via l'open-source d'État `betagouv/2ddoc-parser`. La donnée de solvabilité signée par
  l'État devient gratuite. La signature prouve le **document**, pas le présentateur : le
  recoupement du nom ajoute un signal anti-fraude, et l'attribution à la personne reste
  plafonnée par le niveau d'identité (MEDIUM jusqu'à FranceConnect).
- **Réforme DPE (loi Climat, depuis 2025 ; recalibrage du coefficient janv. 2026)** : la
  classe énergétique conditionne désormais la mise en location (classe G bloquée). La
  donnée ADEME ouverte rend le contrôle du bien possible à coût nul.
- **DossierFacile** (service public) a normalisé l'idée d'un **dossier locatif vérifié** :
  des millions de dossiers créés `[Hypothèse — source à confirmer]`. Le comportement a déjà
  changé ; il manque la **preuve portable et bilatérale**.
- **Fraude aux annonces en hausse** : la médiatisation des arnaques au logement crée une
  demande de confiance que personne n'adresse côté open-classifieds.
- **Une fenêtre qui se referme, dite honnêtement :** eIDAS 2.0 / le portefeuille EUDI
  (déploiement 2026–27) permettra à terme à l'État d'assembler lui-même ces briques en
  attestations portables. La douve est une **fenêtre d'exécution de 2–3 ans** — le meilleur
  argument pour avancer maintenant, pas pour attendre.

**En résumé** : l'État a, ces deux dernières années, ouvert gratuitement toutes les briques
cryptographiques nécessaires. Roomivo est la première à les **assembler en une preuve
portable bilatérale anti-arnaque**.

---

## 04 — Traction & Projections Financières

> **Statut réel** : phase d'amorçage ; dossier technique complet rédigé et backend
> implémenté (FastAPI, 300+ tests automatisés), en pré-production (cf. §17). Pas de
> lancement public, pas de revenus. Les projections ci-dessous sont un **modèle
> d'hypothèses** destiné à montrer la mécanique économique.

**Hypothèses-socle `[Hypothèse]` :**
- Coût marginal d'une vérification ≈ **0 €** (services d'État gratuits + OSS auto-hébergé).
- Prix moyen Roomivo (à l'acte, mix identité/dossier/pack) ≈ **6,90 €**.
- Prix moyen Credential Layer (API, dégressif au volume) ≈ **1,20 €** / vérification.
- Cycle de vente B2B (Credential Layer) : **6–9 mois** par contrat pilote.
- **L'immatriculation est sur le chemin critique de l'An 1** `[Hypothèse — visée mi-An 1]` :
  le SIRET débloque la capacité contractuelle (aucun revenu B2B signable sans lui) et la
  demande DataPass/FranceConnect (identité HIGH). D'ici là : identité MEDIUM uniquement,
  pilotes en lettres d'intention.

**Projection base-case `[Hypothèse]` (5 ans) :**

| Année | Vérifs Roomivo (natif) | CA Roomivo | Clients Credential Layer | Vérifs API | CA Credential Layer | **CA total** |
|---|---|---|---|---|---|---|
| An 1 | 2 000 | ~14 k€ | 1 pilote | 5 000 | ~6 k€ | **~20 k€** |
| An 2 | 15 000 | ~100 k€ | 2–3 | 50 000 | ~60 k€ | **~160 k€** |
| An 3 | 50 000 | ~340 k€ | 4–5 | 200 000 | ~240 k€ | **~580 k€** |
| An 4 | 120 000 | ~830 k€ | 6–8 | 450 000 | ~540 k€ | **~1,37 M€** |
| An 5 | 220 000 | ~1,5 M€ | 10+ | 900 000 | ~1,1 M€ | **~2,6 M€** |

**Lecture** : le produit natif **Roomivo** porte l'acquisition et la preuve de valeur ;
le **Credential Layer** porte l'échelle et la marge (un contrat assureur/gestionnaire >
des milliers de micro-paiements). Chiffres volontairement prudents pour une équipe à
budget marketing nul — la croissance vient des **intégrations B2B2C**, pas de la publicité.

---

## 05 — Retour sur Investissement (ROI)

Pour un jury / incubateur, le ROI se lit sur **trois plans** :

**1. Efficience du capital.** La pile technique est **100 % open-source + services d'État
gratuits** : le coût marginal d'une vérification est quasi nul **à l'échelle**. Le vrai COGS
d'une activité de vérification à faible volume, c'est la revue humaine des échecs OCR, les
litiges fraude et le support — les projections l'absorbent en An 1–2. Chaque euro d'amorçage
finance de la **R&D et de la mise en relation B2B**, pas des licences. Marge brute cible
> **85 %** sur le Credential Layer `[Hypothèse — à l'échelle]`.

**2. ROI sociétal.** Chaque arnaque au dépôt évitée épargne à une victime
**~700 € `[Hypothèse — un mois de loyer moyen]`** et désengorge police/justice. À l'échelle
de l'An 5, le volume de vérifications modélisé représente un volume significatif de
fraudes potentiellement déjouées. **Argument fort pour un financement public** (impact
mesurable, alignement intérêt général).

**3. ROI de l'accompagnement.** Avec **30–50 k€ + accompagnement**, le levier est :
une seule mise en relation B2B réussie (assureur GLI / gestionnaire) déclenche le
**Credential Layer**, dont l'économie unitaire (marge > 85 %) rembourse l'amorçage en
quelques contrats. L'argent ne sert pas à brûler du cash d'acquisition mais à **franchir
deux gates** : le gate légal (conseil droit immobilier) et le gate commercial (premier
client de référence).

---

## 06 — Marché & Chiffres Clés

> Tous les ordres de grandeur ci-dessous sont des `[Hypothèse]` à confirmer auprès des
> sources citées en §16.

- **Locataires en France** : ~**40 %** des ménages sont locataires (INSEE). Parc locatif
  privé ≈ **7 M de ménages** `[Hypothèse]`.
- **Flux annuel** : plusieurs millions d'**emménagements / nouveaux baux** par an dans le
  privé `[Hypothèse]`. Chaque nouveau bail = une occasion de double-vérification.
- **Annonces en ligne** : Leboncoin est le premier canal de location entre particuliers en
  France ; volume d'annonces immobilières très élevé `[Hypothèse]`.
- **Fraude au logement** : milliers de victimes/an d'arnaques à la location (faux bailleurs,
  fausses annonces), montant moyen détourné ≈ un mois de loyer `[Hypothèse — sources :
  Signal Arnaques, DGCCRF, cybermalveillance.gouv.fr]`.
- **Marché GLI / impayés** : les assureurs cherchent à **réduire leur ratio de sinistralité**
  via de meilleures données de souscription — c'est l'acheteur naturel du Credential Layer.

**Marché adressable (logique) :** SAM = vérifications liées aux nouveaux baux du parc privé
français + dossiers de souscription GLI. Le Credential Layer transforme un **TAM B2C diffus**
en **contrats B2B concentrés**.

---

## 07 — Positionnement

| Acteur | Couvre | Limite | Place de Roomivo |
|---|---|---|---|
| **DossierFacile** (État) | Dossier **locataire** vérifié | Un seul côté ; pas de preuve portable bilatérale ; pas de contrôle du bien | Roomivo vérifie **les deux côtés** + produit une **preuve portable signée** |
| **Assureurs GLI** | Garantie loyers impayés (côté propriétaire) | Vendent une protection, pas une vérification ; régime ORIAS/IDD | Roomivo leur **fournit la donnée de souscription** (≠ vendre de l'assurance) |
| **Agences immobilières** | Intermédiation complète | Carte pro (Loi Hoguet), coûteux | Roomivo est un **outil**, pas un intermédiaire — jamais d'entremise |
| **Badges « vérifié » des plateformes** | Signal interne au silo | Non portable, non cryptographique | Roomivo = preuve **portable et vérifiable hors silo** |

**Le créneau unique de Roomivo** : *stateless* (pas de PII au repos), **portable**
(vérifiable sans compte, contre une clé publique), **bilatéral** (les deux parties),
**anti-arnaque** d'abord, et **résolument non-intermédiaire**. C'est ce dernier point qui
nous garde hors de tout régime réglementé — et c'est un **avantage défendable**, pas une
contrainte.

---

## 08 — Modèle Économique : deux modèles de revenus, une motion phare

Règle d'or, non-négociable : revenu **forfaitaire / à l'acte, jamais au succès**. Les fonds
ne transitent jamais par Roomivo. L'assurance est **vérifiée**, jamais vendue (pas d'ORIAS).

### Modèle B — Credential Layer (Vérification-as-a-Service) — **LA PHARE**
Le moteur de vérification exposé en **API / badge** aux **assureurs GLI** et **gestionnaires
immobiliers** d'abord, puis aux plateformes tierces (Leboncoin, FB Marketplace, PAP). En
tête d'affiche : la **détection de fraude au dossier via 2D-Doc** — vérifier la signature
DGFiP d'un avis d'imposition, qui (a) a un ROI acheteur chiffrable (sinistralité réduite),
(b) se vend à une partie qui a un budget, et (c) vérifie une *signature de document*, pas
une personne, franchissant ainsi le mur de certification ANSSI-PVID qui bloque la
vérification d'identité open-source.
- **API à l'usage**, tarif **dégressif au volume** (cf. §15).
- **Frais d'intégration / licence annuelle** selon le client.
- **Pack-preuve post-incident** : l'attestation d'audit signée vendue à la partie lésée
  pour son dossier juridique/assurance.
- Économie : **marge > 85 %** à l'échelle, contrats concentrés. **C'est le moteur de marge
  et la cible de revenu de la Phase 1.**

### Modèle A — Roomivo (marketplace native) — motion de soutien
Revenu issu de **nos propres utilisateurs** — mais positionné comme acquisition, démo et
preuve de concept vivante derrière le pitch B2B, **pas** comme le pari de revenu principal.
- **À l'acte** (particuliers) : micro-paiement par vérification + document-preuve filigrané.
- **Abonnement Pro** (propriétaires récurrents, petites agences) : forfait mensuel.
- Rappel : le flux bilatéral grand public exige que le propriétaire — qui a le levier en
  marché tendu — se vérifie lui-même, ce qu'il ne fera pas. D'où : soutien, pas phare.

> Pourquoi mener en B2B : l'acheteur a un budget et un ROI chiffrable, le contrôle 2D-Doc
> résiste au PVID, et il ne dépend d'**aucune** question non tranchée (rail d'identité,
> géographie d'immatriculation) — il vérifie un document, pas une personne. La marketplace
> rend la démo crédible ; le Credential Layer fait l'argent.

---

## 09 — Budget R&D

Usage des **30–50 k€** d'amorçage (`[Hypothèse]`, base-case 40 k€) :

| Poste | Montant | Justification |
|---|---|---|
| **Conseil juridique — droit immobilier** | 3–5 k€ | Franchir le *gate légal* (positionnement self-service bail / e-signature vs loi 1971 / Hoguet). **Bloquant et bon marché.** |
| **Revue GDPR / DPO** | 2–3 k€ | Confirmer base légale + preuve de non-rétention (traitement transitoire) ; base Art. 9 + AIPD pour l'étape de comparaison faciale. |
| **Immatriculation** | 1–2 k€ | Création de société → capacité contractuelle B2B. Structure : **Roomivo Technologies Pvt. Ltd. (Inde)** maintenant ; **entité UE ajoutée plus tard** (juridiction à définir — le seul avantage propre de la France ici est l'accès FranceConnect, qui exige un SIRET français ; une base UE non-française atteint l'identité HIGH via eIDAS 2.0 / portefeuille UE). **Sur le chemin critique B2B de l'An 1.** |
| **Infrastructure & sécurité** | 2–4 k€/an | Hébergement, infra de signature (Ed25519), audit de sécurité. Coût marginal par vérif ≈ 0 €. |
| **R&D Credential core + rails FR** | (temps fondateurs) | Modèle credential, OCR+liveness (MEDIUM), FranceConnect (post-immatriculation), 2D-Doc, contrôle du bien ADEME. |
| **R&D rail INTL HIGH (Phase 2)** | à provisionner | Lecture NFC passeport (JMRTD / NFCPassportReader) ; **gap opérationnel : liste maîtresse CSCA via ICAO PKD**. |
| **Amorçage fondateurs / stipend** | solde | Permettre le plein-temps sur la phase critique. |

**Éligibilité CIR/CII** : la R&D credential (cryptographie de la preuve, vérification de
signatures d'État, normalisation) est susceptible d'ouvrir droit au Crédit d'Impôt
Recherche / Innovation `[Hypothèse — à valider avec un expert-comptable]`.

---

## 10 — Plan Opérationnel — 5 ans

**Phase 1 (An 1) — phare : détection de fraude 2D-Doc B2B ; marketplace en démo.** *(cf. §17)*
1. **API solvabilité / anti-fraude 2D-Doc** (avis signé DGFiP → vérif ECDSA hors-ligne →
   ratio bandé `>=3.0`) : l'actif B2B vendable, résistant au PVID, indépendant du rail
   d'identité. Productiser derrière l'API + décrocher le premier pilote assureur / gestionnaire.
2. **Credential core** : modèle, signature Ed25519, endpoints émission/vérification, clé
   publique, export du document-preuve filigrané — le moteur partagé par les deux motions.
3. **Marketplace en démo vivante** : faire tourner le moteur de bout en bout sur de vrais
   utilisateurs (identité OCR + liveness → **MEDIUM, labellisé** ; contrôle du bien DPE ADEME
   + taxe foncière) — la surface de crédibilité montrée aux assureurs, pas le coin de revenu.
4. Page anti-hameçonnage *verify-by-ID* + endossement institutionnel.

> Jalon transverse An 1 : **immatriculation.** La Pvt Ltd indienne (en cours) donne la
> capacité contractuelle B2B maintenant ; l'**entité UE (ajoutée juste-à-temps avant le
> premier pilote traitant des données UE)** conditionne l'identité HIGH et la posture GDPR
> côté utilisateurs UE. Rail identité HIGH = FranceConnect *si* l'entité UE est française,
> sinon eIDAS 2.0 / portefeuille UE — décidé avec le choix du pays UE.

**Phase 2+ (An 2–3) — derrière le gate légal pour bail/e-sign :**
7. Profondeur DPE (blocage classe G, zone tendue, réforme en direct).
8. Scan de conformité d'un bail **téléversé** (VALIDÉ vs ATTACHÉ). ⚠ gate.
9. **E-signature + pack-preuve** (DocuSeal / Documenso **non modifiés** — AGPL). ⚠ gate.
10. Vérification d'attestation d'assurance MRH.
11. **Rails INTL** (NFC natif HIGH ; web MRZ-OCR MEDIUM ; normalisation FX). Bloqué sur CSCA.

**An 3–5 — passage à l'échelle du Credential Layer** : montée en charge des contrats
plateformes/assureurs, retrofit *stateless* des flux legacy.

---

## 11 — Équipe & Besoins d'Accompagnement

**Équipe fondatrice (2 personnes) :**
- **Nallam Venkataramaya** — Co-fondateur, Étudiant-Entrepreneur (SNEE).
- **C.A. Nishanth** — Co-fondateur, Étudiant-Entrepreneur (SNEE).

Statut : **Étudiants-Entrepreneurs** sous **SNEE**, accompagnés par **PÉPITE Pays de la
Loire** (Audencia). *Les statuts sont mentionnables ; l'usage des logos officiels du
Ministère / PÉPITE requiert une autorisation préalable — à confirmer avant tout affichage.*

**Besoins d'accompagnement (au-delà du financement) :**

| Besoin | Pourquoi | Ce que cela débloque |
|---|---|---|
| **Mentor / avocat en droit immobilier** | Franchir le gate légal bail/e-sign (loi 1971 / Hoguet) | Ouvre la Phase 2 (bail, e-signature) |
| **Mise en relation B2B** : un assureur GLI ou gestionnaire pilote | Premier client de référence du Credential Layer | Active le **modèle de marge** |
| **Accès ICAO PKD / liste CSCA** | Authentification passive des puces passeport (INTL HIGH) | Débloque le rail international |
| **Hébergement / crédits cloud** | Infra de signature et de vérification | Réduit le burn |
| **Caution morale institutionnelle** | Convertir « est-ce une arnaque ? » en « c'est adossé à l'État » | Adoption sur les annonces |

---

## 12 — Synthèse

Roomivo apporte aux petites annonces de location la **couche de confiance** qui leur
manque : une **preuve signée, portable et bilatérale** qui neutralise l'arnaque au dépôt
de garantie — **sans intermédiation, sans maniement de fonds, sans stockage de documents**.

Deux modèles de revenus distincts sur un même moteur : **Roomivo** (produit natif,
acquisition + preuve de valeur) et le **Credential Layer** (Vérification-as-a-Service pour
plateformes tierces et assureurs — le moteur de marge). Pile 100 % open-source + services
d'État → coût marginal quasi nul, marge brute cible > 85 %.

**La demande : 30–50 k€ d'amorçage + accompagnement** (mentorat juridique, première mise en
relation B2B, hébergement). L'argent franchit deux gates — légal et commercial — après quoi
l'économie unitaire fait le reste.

---

## 13 — Grille Tarifaire : Roomivo Particulier (à l'acte) — *Modèle A*

> Tous prix `[Hypothèse]`, TTC, à valider en test de marché.

| Offre | Contenu | Prix indicatif |
|---|---|---|
| **Identité seule** | Vérification d'identité (MEDIUM aujourd'hui, labellisé ; HIGH via FranceConnect post-immatriculation) + attestation signée | **2,90 €** |
| **Dossier vérifié** | Identité + solvabilité bandée + document-preuve filigrané | **6,90 €** |
| **Pack bilatéral (anti-dépôt)** | Vérification des deux côtés + contrôle du bien + document-preuve opposable | **9,90 €** |

Coût marginal ≈ 0 € à l'échelle (le support et la revue manuelle dominent à faible
volume) → marge élevée. Pas de frais au succès, jamais.

---

## 14 — Grille Tarifaire : Roomivo Pro (abonnement) — *Modèle A*

> Pour propriétaires récurrents et petites agences. Prix `[Hypothèse]`, HT/mois.

| Palier | Inclus / mois | Liens de demande-de-preuve | Prix |
|---|---|---|---|
| **Starter** | 10 vérifications | illimités | **19 €/mois** |
| **Pro** | 40 vérifications | illimités | **49 €/mois** |
| **Au-delà** | — | — | **1,90 € / vérification** |

Engagement mensuel sans tacite reconduction agressive. Reste **forfaitaire**, jamais indexé
sur un bail signé.

---

## 15 — Grille Tarifaire : Credential Layer (Vérification-as-a-Service) — *Modèle B*

> Pour **plateformes tierces et leurs utilisateurs** (Leboncoin, FB Marketplace, PAP),
> **assureurs GLI**, **gestionnaires**. Prix `[Hypothèse]`, HT.

**API à l'usage — tarif dégressif au volume :**

| Volume mensuel | Prix / vérification |
|---|---|
| 0 – 1 000 | **2,00 €** |
| 1 000 – 10 000 | **1,20 €** |
| 10 000 – 50 000 | **0,80 €** |
| 50 000 + | **0,60 €** (sur devis) |

**Options :**
- **Frais d'intégration** (one-shot) : **1 500 – 5 000 €** selon complexité.
- **Licence annuelle / badge « Vérifié »** : sur devis (plateforme classifieds).
- **Pack-preuve post-incident** : **9,90 € – 19 €** l'attestation d'audit signée (partie lésée).

Marge brute cible > **85 %**. **C'est le moteur de marge** : un contrat plateforme/assureur
remplace des milliers de micro-paiements B2C.

---

## 16 — Sources & Références

> Toutes les valeurs étiquetées `[Hypothèse]` ci-dessus doivent être confirmées par les
> sources suivantes avant tout usage externe officiel.

**Marché & fraude :**
- INSEE — part des ménages locataires, structure du parc locatif.
- DGCCRF, Signal Arnaques, cybermalveillance.gouv.fr — fraude à la location.
- DossierFacile (service public) — volumétrie des dossiers vérifiés.

**Briques techniques (gratuites / open-source) :**
- **FranceConnect** (OIDC d'État, via DataPass — post-immatriculation) : le rail identité
  HIGH. Le justificatif France Identité (`valider-attest`) a été évalué puis écarté pour la
  v1 (portail de vérification humain, pas une API).
- **betagouv/2ddoc-parser** — lecture & vérification ECDSA de l'avis d'imposition 2D-Doc.
- **ADEME** — API DPE open-data (classe A–G, pas de H ; réforme coefficient janv. 2026).
- **JMRTD** (Android, LGPL) / **AndyQ/NFCPassportReader** (iOS, MIT) — lecture puce passeport.
- **pdf-lib** (MIT) — génération de documents. **DocuSeal / Documenso** (AGPL — non modifiés).

**Cadre juridique (à respecter dans le produit) :**
- Loi Hoguet (entremise, mandat, maniement de fonds) ; Loi du 31 déc. 1971 (rédaction
  d'actes) ; ORIAS + IDD (assurance) ; Code pénal art. 225-1/2 (non-discrimination) ;
  loi Climat / DPE ; loi 89-462 (baux) ; Décrets 2015-587 et 2015-981.

**Statut & endossement :**
- SNEE (Statut National Étudiant-Entrepreneur), PÉPITE Pays de la Loire, Audencia,
  Ministère de l'Enseignement supérieur et de la Recherche.
  ⚠ **Statuts mentionnables ; logos officiels soumis à autorisation d'usage.**

---

## 17 — Annexe — Preuves d'exécution (technique)

> Roomivo n'est pas une idée sur slide : le **dossier technique complet** est rédigé
> (`docs/features/trust-layer/DOSSIER.md`), avec architecture, matrice de tests par cas-limite,
> et plan de phasage. Extraits :

**Le credential (sortie cœur) — exemple :**
```json
{
  "credential_id": "vc_8f3a...",
  "subject_role": "tenant",
  "issued_at": "2026-06-03T10:00:00Z",
  "expires_at": "2026-07-03T10:00:00Z",
  "rail": "FR",
  "claims": {
    "identity_verified": true,
    "identity_assurance": "MEDIUM",
    "identity_source": "ocr_liveness",
    "solvency_ratio": ">=3.0",
    "solvency_assurance": "HIGH",
    "solvency_presenter_binding": "name_crosscheck_flag"
  },
  "disclaimer": "Certifies verification of the stated facts only. Does not warrant future conduct or good faith.",
  "signature": "..."
}
```

**Principes de conception (non-négociables) :** bandes et non chiffres bruts ; niveau
d'assurance **labellisé, jamais gonflé** (un MEDIUM n'est jamais affiché HIGH) ;
recipient-scoping quand la source le permet ; TTL court + révocation ; aucune PII au repos.

**Les deux rails (sélectionnés par les documents détenus, jamais par la nationalité) :**

| Étape | Rail FR | Rail INTL |
|---|---|---|
| Identité | OCR+liveness (MEDIUM, aujourd'hui) → FranceConnect (HIGH, post-immatriculation) | Puce NFC passeport (HIGH) → MRZ-OCR web (MEDIUM) |
| Solvabilité | Avis 2D-Doc (authenticité du document HIGH ; présentateur via recoupement du nom) | Docs étrangers (MEDIUM) + normalisation FX |
| Bien | DPE ADEME + contrôle taxe foncière | idem |

**Frontières légales gravées dans le code** (jamais : entremise, mandat, maniement de fonds,
honoraire au succès, rédaction de bail sur-mesure, vente d'assurance, garantie de loyer,
tri par nationalité, stockage de PII sans nécessité).

**Modèle anti-hameçonnage** : un seul domaine officiel ; *verify-by-ID* (« tape le code
toi-même ») ; clé publique publiée ; endossement institutionnel sur la landing/verify.
