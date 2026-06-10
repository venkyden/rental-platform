# Note de cadrage juridique — Roomivo
## Consultation : module de génération de bail & signature électronique

> **Destinataire :** avocat·e en droit immobilier (et, le cas échéant, droit du
> numérique / RGPD).
> **Émetteur :** Roomivo — Nallam Venkataramaya & C.A. Nishanth, Étudiants-Entrepreneurs
> (SNEE), accompagnés par PÉPITE Pays de la Loire (Audencia).
> **Statut société :** pré-amorçage, pas encore de société immatriculée, pas de chiffre
> d'affaires.
> **Objet :** obtenir un avis sécurisant **avant développement** sur deux modules situés
> dans une zone grise (loi du 31 déc. 1971 / loi Hoguet). Le reste du produit a été conçu
> pour rester hors de tout régime réglementé ; ces deux modules sont les seuls bloqués.
> **Date :** 9 juin 2026.

---

## 1. Objet précis de la consultation

Nous sollicitons un avis sur **deux modules uniquement**, que nous n'avons **pas encore
développés** et que nous ne déploierons pas tant que leur cadrage n'aura pas été validé :

1. **Génération de bail en self-service** à partir du **modèle réglementaire** (Décret
   n°2015-587), l'utilisateur ne saisissant que des champs (parties, bien, montants, dates),
   **sans aucune rédaction de clause libre**.
2. **Signature électronique** de ce bail entre les deux parties (acte sous seing privé),
   avec piste d'audit auto-hébergée.

Nous voulons savoir : **où passe précisément la ligne** entre un outil documentaire licite
et l'exercice d'une activité réglementée, et **comment rédiger nos CGU et notre interface**
pour rester du bon côté.

---

## 2. Présentation du service (contexte indispensable)

Roomivo est une **utilité de vérification et de documentation** utilisée **à côté** d'une
annonce que les parties ont déjà trouvée elles-mêmes sur une plateforme tierce (Leboncoin,
Facebook Marketplace, PAP). Le produit fait une seule chose sur le plan économique :
**vendre des faits vérifiés** (identité, solvabilité, contrôle du bien) sous forme d'une
**attestation cryptographique signée, à durée de vie courte**, puis détruire le document
source. Aucune donnée personnelle conservée au repos.

**Limites volontaires inscrites dans l'architecture** (ce que Roomivo ne fait jamais) :

| Roomivo ne fait JAMAIS… | …car cela déclencherait |
|---|---|
| Rechercher / mettre en relation / recommander des contreparties | Loi Hoguet (*entremise* → carte pro) |
| Détenir un mandat / agir pour le compte d'une partie | Loi Hoguet (mandat) |
| Toucher / détenir / déclencher / conditionner des fonds | Loi Hoguet (*maniement de fonds*) + services de paiement |
| Percevoir une commission/un honoraire au succès sur un bail signé | Critère d'intermédiation Hoguet |
| Vendre / proposer / toucher une commission sur une assurance | ORIAS + DDA (IDD) |
| Garantir le loyer / indemniser une partie | Assureur / garant non agréé |
| Filtrer / tarifer selon la nationalité ou le statut migratoire | Code pénal art. 225-1/225-2 |

**Modèle de revenu :** **forfaitaire / à la vérification, jamais au succès.** Aucun flux
financier ne transite par Roomivo.

**Notre thèse générale :** les parties se sont rencontrées sur l'annonce → pas
d'*entremise* → il s'agit d'un **SaaS de vérification + d'un outil de PDF signé**. Nous
souhaitons que vous confirmiez (ou corrigiez) la solidité de cette thèse **spécifiquement
pour les deux modules ci-dessous**.

---

## 3. Module A — Génération de bail en self-service

### 3.1 Description fonctionnelle envisagée
- L'utilisateur choisit le type de bail (vide, meublé, étudiant, bail mobilité).
- L'outil charge le **modèle imposé par le Décret n°2015-587** correspondant.
- L'utilisateur **remplit uniquement des champs** : identité des parties (déjà vérifiées),
  désignation du bien, loyer, charges, dépôt de garantie, dates.
- Le système applique des **contrôles de légalité automatiques** : plafond du dépôt selon le
  type (vide ≤ 1 mois HC ; meublé/étudiant ≤ 2 mois ; bail mobilité = 0), liste des 11
  éléments du mobilier (Décret n°2015-981), annexes obligatoires (DPE, notice d'information,
  ERP, diagnostics), blocage de la classe G (loi Climat).
- **Aucune clause libre, aucun texte personnalisé** : l'utilisateur ne peut pas rédiger de
  stipulation hors du modèle. Le PDF produit est strictement le modèle réglementaire
  pré-rempli.

### 3.2 Notre thèse (à valider)
Fournir un **modèle réglementaire pré-rempli par l'utilisateur lui-même**, sans conseil
juridique personnalisé ni rédaction de clause sur mesure, ne constitue **pas** la
« rédaction d'actes sous seing privé pour autrui » réservée par le **Titre II de la loi
n°71-1130 du 31 décembre 1971** (art. 54 et s.). Roomivo livre un outil ; c'est
l'utilisateur qui établit son propre acte.

### 3.3 Questions précises
1. La fourniture d'un **modèle officiel pré-rempli en self-service** (sans rédaction de
   clause libre) tombe-t-elle hors du champ de la loi de 1971 ? Quels éléments de notre
   interface ou de nos CGU pourraient au contraire faire **basculer** l'activité dans la
   « rédaction d'actes » ou la « consultation juridique » réglementée ?
2. Nos **contrôles de légalité automatiques** (plafonds, annexes, blocage classe G) sont-ils
   un simple paramétrage licite, ou risquent-ils d'être requalifiés en **conseil juridique**
   (donc activité réglementée) ?
3. Le fait de proposer cet outil **en complément d'une prestation de vérification payante**
   (forfait) crée-t-il un risque d'*entremise* au sens de la **loi Hoguet (n°70-9 du 2 janv.
   1970)**, sachant que les parties se sont déjà trouvées seules et qu'aucun fonds ni mandat
   n'est en jeu ?
4. Quelles **mentions / avertissements** devons-nous afficher (par ex. « vous établissez
   vous-même votre bail à partir du modèle réglementaire ; Roomivo ne fournit aucun conseil
   juridique ») pour sécuriser le positionnement ?

---

## 4. Module B — Signature électronique

### 4.1 Description fonctionnelle envisagée
- Le bail (acte sous seing privé) est signé par les deux parties via une **signature
  électronique** simple ou avancée.
- Piste d'audit **auto-hébergée** : hash du document, horodatage, référence de l'attestation
  d'identité vérifiée du signataire, IP, consentement.
- Contrôle envisagé : **le signataire doit correspondre à la partie vérifiée** (sinon
  blocage). Si une partie abandonne, la session expire et **rien n'est conservé**.
- Outils OSS envisagés (DocuSeal / Documenso, en **AGPL**) utilisés **non modifiés**,
  derrière leur API/embed.
- Une montée en gamme **horodatage qualifié / PSCo (QTSP)** est envisagée comme option
  payante ultérieure.

### 4.2 Notre thèse (à valider)
Un bail d'habitation est un **acte sous seing privé** : il **n'exige pas** de signature
électronique **qualifiée** au sens du règlement **eIDAS** (n°910/2014) et des **art.
1366-1367 du Code civil**. Une signature simple ou avancée avec piste d'audit suffit à
l'opposabilité entre les parties.

### 4.3 Questions précises
1. Confirmez-vous qu'une **signature électronique simple/avancée** (non qualifiée) est
   suffisante pour un bail d'habitation, et quel **niveau de piste d'audit** est
   recommandé pour résister à une contestation (répudiation, altération) ?
2. En facilitant la signature, Roomivo endosse-t-il un rôle de **tiers de confiance** assorti
   d'obligations particulières (information, conservation, responsabilité) ? Si oui,
   lesquelles ?
3. Le recours à **DocuSeal / Documenso (AGPL) non modifiés**, derrière leur API, soulève-t-il
   un problème de **responsabilité** distinct côté Roomivo ?
4. Quelles **clauses de limitation de responsabilité** sont admissibles, sachant que nous
   voulons limiter la garantie au **seul acte de vérification / de facilitation technique**,
   sans jamais garantir l'exécution du bail ni la bonne foi des parties ?

---

## 5. Éléments factuels d'architecture (favorables au cadrage)

À verser au dossier, car ils soutiennent le positionnement « outil, pas intermédiaire » :

- **Pas de mise en relation :** Roomivo n'a ni moteur de recherche, ni *matching*, ni
  recommandation de contreparties. L'utilisateur arrive avec sa contrepartie déjà identifiée.
- **Pas de fonds :** aucun paiement de loyer/dépôt ne transite ni n'est conditionné par
  Roomivo.
- **Pas de mandat, pas de succès :** revenu forfaitaire à la vérification, jamais indexé sur
  un bail signé.
- **Pas de rédaction sur mesure :** uniquement le modèle Décret n°2015-587, champs remplis
  par l'utilisateur, **aucune clause libre**.
- **Minimisation des données (RGPD) :** vérifier → émettre une attestation à bandes (ex.
  « solvabilité ≥ 3,0 », jamais le revenu brut) → détruire la source. Pas de PII au repos.
- **Niveaux d'assurance affichés honnêtement :** un contrôle OCR+selfie est étiqueté MEDIUM,
  jamais présenté comme HIGH.

---

## 6. Risques que nous avons déjà identifiés (à confirmer / compléter)

1. **Cadrage génération de bail + signature** vs loi 1971 / Hoguet — **l'objet principal de
   cette consultation.**
2. **Base légale RGPD** du traitement transitoire — à confirmer (intérêt légitime ou
   consentement) + preuve de non-conservation. *(Peut relever d'un volet droit du numérique /
   DPO distinct.)*
3. **Responsabilité du fait du produit / confiance induite** — vendre de la vérification
   suscite une confiance ; nous voulons borner la garantie au seul acte de vérification via
   les CGU (« nous certifions des faits, pas la bonne foi »). Validité de cette limitation ?
4. **Fraude à la propriété** — le contrôle taxe foncière atteste d'un « contrôle, non d'une
   propriété » ; limite divulguée. Suffit-il juridiquement de l'afficher ?

---

## 7. Ce que nous attendons concrètement de la consultation

- Un **avis écrit** indiquant si les modules A et B, **tels que décrits**, peuvent être
  développés et exploités sans agrément (carte professionnelle Hoguet ; qualification loi
  1971).
- Le cas échéant, la **liste des conditions / mentions / garde-fous** à mettre en œuvre dans
  l'interface et les CGU pour sécuriser le positionnement.
- L'identification de **tout point qui ferait basculer** l'activité dans un régime réglementé.

---

## 8. Références (textes que nous appliquons déjà dans le produit)

- **Loi n°70-9 du 2 janvier 1970** (loi Hoguet) — intermédiation immobilière (*entremise*,
  mandat, maniement de fonds, honoraire au succès).
- **Loi n°71-1130 du 31 décembre 1971, Titre II** — consultation juridique et rédaction
  d'actes sous seing privé.
- **Règlement (UE) n°910/2014 (eIDAS)** + **Code civil, art. 1366-1367** — signature
  électronique.
- **Loi n°89-462 du 6 juillet 1989** — rapports locatifs (notamment art. 7g : assurance MRH
  obligatoire ; art. 4 : clauses réputées non écrites).
- **Décret n°2015-587** — contrats de location types. **Décret n°2015-981** — liste des
  11 éléments du mobilier (meublé).
- **Loi Climat et résilience** — interdiction de location des passoires (classe G), échelle
  DPE A–G.
- **Code pénal, art. 225-1 / 225-2** — non-discrimination.
- **RGPD** (règlement UE 2016/679) — minimisation, base légale du traitement transitoire.

---

*Document de cadrage interne destiné à préparer la consultation. Ne constitue pas un avis
juridique. À relire par les fondateurs avant transmission.*
