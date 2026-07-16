<!--
OFFICIAL MODEL — DO NOT EDIT THE LEGAL TEXT.

Source: Décret n°2015-587 du 29 mai 2015, Annexe 2 (logement meublé), contrat type de
location — reproduced VERBATIM from Légifrance, version en vigueur depuis le 01/01/2025.
https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000043842249

Serves both lease types `meuble` and `etudiant`: section III carries the furnished
1-year tacit-renewal rule AND the 9-month student variant (no tacit renewal). The
published title is "…OU DE COLOCATION…", so this annexe also covers colocation under a
single contract (excluded: colocations formalisées par plusieurs contrats).

✅ 2026-07-15: preamble reproduced (F1), the "identifiant fiscal du logement" line removed
(F2 — confirmed to have NO basis anywhere in the official text; the schema entry in
`lease_fields.py` is corrected, not deleted, pending an owner decision on whether to
reinstate it under a real, cited legal basis), and the décence cross-reference clause
restored verbatim + footnote (28 bis) reinstated (F3). All verified word-for-word against
the Légifrance API (LEGIARTI000043842249, direct JSON `texte` field, not a web render) —
see docs/legal/2026-07-15-model-transcription-verification.md for the diff method,
evidence, and the F2 owner-decision flag.

Status: ⏳ PENDING LAWYER SIGN-OFF before it is wired into generation (Path A).
The generator fills the [...] placeholders only — it MUST NOT alter the standardized
clause text (loi 1971 / LG-6). Bracketed [...] = fillable field. (n) = official footnote
marker, preserved; texts in annexe2_meuble_footnotes.md (markers 24–44).
-->

# Contrat de location — logement meublé (Décret n°2015-587, Annexe 2)

CONTRAT TYPE DE LOCATION OU DE COLOCATION DE LOGEMENT MEUBLÉ

(Soumis au titre Ier bis de la loi du 6 juillet 1989 tendant à améliorer les rapports locatifs et portant modification de la loi n° 86-1290 du 23 décembre 1986)

**Champ du contrat type :** Le présent contrat type de location est applicable aux locations et aux colocations de logement meublé et qui constitue la résidence principale du preneur, à l'exception :

- des colocations formalisées par la conclusion de plusieurs contrats entre les locataires et le bailleur ;
- des locations de logement appartenant à un organisme d'habitation à loyer modéré et faisant l'objet d'une convention passée en application de l'article L.351-2 du code de la construction et de l'habitation.

**Modalités d'application du contrat type :** Le régime de droit commun en matière de baux d'habitation est défini principalement par la loi n° 89-462 du 6 juillet 1989 tendant à améliorer les rapports locatifs et portant modification de la loi n° 86-1290 du 23 décembre 1986. L'ensemble de ces dispositions étant d'ordre public, elles s'imposent aux parties qui, en principe, ne peuvent pas y renoncer. En conséquence :

- le présent contrat type de location contient uniquement les clauses essentielles du contrat dont la législation et la réglementation en vigueur au jour de sa publication imposent la mention par les parties dans le contrat. Il appartient cependant aux parties de s'assurer des dispositions applicables au jour de la conclusion du contrat.
- au-delà de ces clauses, les parties sont également soumises à l'ensemble des dispositions légales et réglementaires d'ordre public applicables aux baux d'habitation sans qu'il soit nécessaire de les faire figurer dans le contrat et qui sont rappelées utilement dans la notice d'information qui doit être jointe à chaque contrat.
- les parties sont libres de prévoir dans le contrat d'autres clauses particulières, propres à chaque location, dans la mesure où celles-ci sont conformes aux dispositions législatives et réglementaires en vigueur. Les parties peuvent également convenir de l'utilisation de tout autre support pour établir leur contrat, dans le respect du présent contrat type.

Le contrat type de location ou de colocation contient les éléments suivants :

## I. Désignation des parties

Le présent contrat est conclu entre les soussignés :

- [nom et prénom, ou dénomination du bailleur / domicile ou siège social / qualité du bailleur (personne physique, personne morale, (24)) / adresse électronique (facultatif)] (25) désigné(s) ci-après le bailleur.
- Le cas échéant, représenté par le mandataire :
- [nom ou raison sociale et adresse du mandataire ainsi que l'activité exercée] ;
- Le cas échéant [numéro et lieu de délivrance de la carte professionnelle / nom et adresse du garant] (26).
- [nom et prénom du ou des locataires ou, en cas de colocation, des colocataires, adresse électronique (facultatif)] désigné(s) ci-après le locataire.

Il a été convenu ce qui suit :

## II. Objet du contrat

Le présent contrat a pour objet la location d'un logement ainsi déterminé :

### A. Consistance du logement

- localisation du logement : [exemples : adresse / bâtiment / étage / porte etc.] ;
- type d'habitat : [immeuble collectif ou individuel] ;
- régime juridique de l'immeuble : [mono propriété ou copropriété] ;
- période de construction : [exemples : avant 1949, de 1949 à 1974, de 1975 à 1989, de 1989 à 2005, depuis 2005] ;
- surface habitable : […] m2 ;
- nombre de pièces principales : […] ;
- le cas échéant, autres parties du logement : [exemples : grenier, comble aménagé ou non, terrasse, balcon, loggia, jardin etc.] ;
- le cas échéant, Eléments d'équipements du logement : [exemples : cuisine équipée, détail des installations sanitaires etc.] ;
- modalité de production chauffage : [individuel ou collectif] (27) ;
- modalité de production d'eau chaude sanitaire : [individuelle ou collective] (28) ;
- le cas échéant, La consommation énergétique du logement, déterminée selon la méthode du diagnostic de performance énergétique mentionné à l'article L. 126-26 du code de la construction et de l'habitation, ne doit pas excéder, à compter du 1er janvier 2028, le seuil fixé au I de l'article L. 173-2 du même code (28 bis).

### B. Destination des locaux : [usage d'habitation ou usage mixte professionnel et d'habitation]

### C. Le cas échéant, Désignation des locaux et équipements accessoires de l'immeuble à usage privatif du locataire : [exemples : cave, parking, garage etc.]

### D. Le cas échéant, Enumération des locaux, parties, équipements et accessoires de l'immeuble à usage commun : [Garage à vélo, ascenseur, espaces verts, aires et équipements de jeux, laverie, local poubelle, gardiennage, autres prestations et services collectifs etc.]

### E. Le cas échéant, Equipement d'accès aux technologies de l'information et de la communication : [exemples : modalités de réception de la télévision dans l'immeuble, modalités de raccordement internet etc.]

## III. Date de prise d'effet et durée du contrat

La durée du contrat et sa date de prise d'effet sont ainsi définies :

A. Date de prise d'effet du contrat : […]

B. Durée du contrat : [durée minimale d'un an ou de neuf mois si la location est consentie à un étudiant]

À l'exception des locations consenties à un étudiant pour une durée de neuf mois, les contrats de location de logements meublés sont reconduits tacitement à leur terme pour une durée d'un an et dans les mêmes conditions. Le locataire peut mettre fin au bail à tout moment, après avoir donné congé. Le bailleur peut, quant à lui, mettre fin au bail à son échéance et après avoir donné congé, soit pour reprendre le logement en vue de l'occuper lui-même ou une personne de sa famille, soit pour le vendre, soit pour un motif sérieux et légitime.

Les contrats de locations meublées consenties à un étudiant pour une durée de neuf mois ne sont pas reconduits tacitement à leur terme et le locataire peut mettre fin au bail à tout moment, après avoir donné congé. Le bailleur peut, quant à lui, mettre fin au bail à son échéance et après avoir donné congé.

## IV. Conditions financières

Les parties conviennent des conditions financières suivantes :

### A. Loyer

1° Fixation du loyer initial :
a) Montant du loyer mensuel : […] (29).
b) Le cas échéant, Modalités particulières de fixation initiale du loyer applicables dans certaines zones tendues (30) :

- le loyer du logement objet du présent contrat est soumis au décret fixant annuellement le montant maximum d'évolution des loyers à la relocation : [Oui / Non] ;
- le loyer du logement objet du présent contrat est soumis au loyer de référence majoré fixé par arrêté préfectoral : [Oui / Non].
- montant du loyer de référence : […] €/m2 / Montant du loyer de référence majoré : […] €/m2 ;
- Le cas échéant, Complément de loyer : [si un complément de loyer est prévu, indiquer le montant du loyer de base, nécessairement égal au loyer de référence majoré, le montant du complément de loyer et les caractéristiques du logement justifiant le complément de loyer].

c) Le cas échéant, Informations relatives au loyer du dernier locataire : [montant du dernier loyer acquitté par le précédent locataire, date de versement et date de la dernière révision du loyer] (31).
2° Le cas échéant, Modalités de révision :
a) Date de révision : […].
b) Date ou trimestre de référence de l'IRL : […].

### B. Charges récupérables

1. Modalité de règlement des charges récupérables : [Provisions sur charges avec régularisation annuelle ou paiement périodique des charges sans provision ou récupération des charges par le bailleur sous la forme d'un forfait].
2. Le cas échéant, Montant des provisions sur charges ou du forfait de charges […].
3. Le cas échéant, Modalités de révision du forfait de charges : […] (32).

### C. Le cas échéant, En cas de colocation, souscription par le bailleur d'une assurance pour le compte des colocataires (33) : [Oui / Non]

a) Montant total annuel récupérable au titre de l'assurance pour compte des colocataires : […] (34).
b) Montant récupérable par douzième : […].

### D. Modalités de paiement

- périodicité du paiement : [… (35)] ;
- paiement [à échoir / à terme échu] ;
- date ou période de paiement : […] ;
- le cas échéant, Lieu de paiement : […] ;
- le cas échéant, Montant total dû à la première échéance de paiement pour une période complète de location : [Détailler la somme des montants relatifs au loyer, aux charges récupérable, à la contribution pour le partage des économies de charges et, en cas de colocation, à l'assurance récupérable pour le compte des colocataires].

### E. Le cas échéant, exclusivement lors d'un renouvellement de contrat, Modalités de réévaluation d'un loyer manifestement sous évalué

3. Montant de la hausse ou de la baisse de loyer mensuelle : […].
4. Modalité d'application annuelle de la hausse : [par tiers ou par sixième selon la durée du contrat et le montant de la hausse de loyer].

### F. Dépenses énergétiques (pour information)

Montant estimé des dépenses annuelles d'énergie pour un usage standard de l'ensemble des usages énumérés dans le diagnostic de performance énergétique (chauffage, refroidissement, production d'eau chaude sanitaire, éclairage et auxiliaires de chauffage, de refroidissement, d'eau chaude sanitaire et de ventilation) mentionné à l'article L. 126-26 du code de la construction et de l'habitation : [montant ou fourchette inscrit dans le diagnostic de performance énergétique] (estimation réalisée à partir des prix énergétiques de référence de l'année : [année de référence des prix énergétiques du diagnostic énergétique à l'origine de l'estimation]).

## V. Travaux

A. Le cas échéant, Montant et nature des travaux d'amélioration ou de mise en conformité avec les caractéristiques de décence effectués depuis la fin du dernier contrat de location ou depuis le dernier renouvellement : […] (36)

B. Le cas échéant, Majoration du loyer en cours de bail consécutive à des travaux d'amélioration entrepris par le bailleur ou d'acquisitions d'équipements : [nature des travaux ou des équipements, modalités d'exécution, délai de réalisation ou d'acquisition ainsi que montant de la majoration du loyer] (37)

C. Le cas échéant, Diminution de loyer en cours de bail consécutive à des travaux entrepris par le locataire : [durée de cette diminution et, en cas de départ anticipé du locataire, modalités de son dédommagement sur justification des dépenses effectuées]

## VI. Garanties

Le cas échéant, Montant du dépôt de garantie de l'exécution des obligations du locataire : [inférieur ou égal à deux mois de loyers hors charges].

## VII. Le cas échéant, Clause de solidarité

Modalités particulières des obligations en cas de pluralité de locataires : [clause prévoyant la solidarité des locataires et l'indivisibilité de leurs obligations en cas de pluralité de locataires].

## VIII. Le cas échéant, Clause résolutoire

Modalités de résiliation de plein droit du contrat : [clause prévoyant la résiliation de plein droit du contrat de location pour un défaut de paiement du loyer ou des charges aux termes convenus, le non versement du dépôt de garantie, la non-souscription d'une assurance des risques locatifs ou le non-respect de l'obligation d'user paisiblement des locaux loués, résultant de troubles de voisinage constatés par une décision de justice passée en force de chose jugée].

## IX. Le cas échéant, Honoraires de location (38)

### A. Dispositions applicables

Il est rappelé les dispositions du I de l'article 5 de la loi du 6 juillet 1989, alinéas 1 à 3 : La rémunération des personnes mandatées pour se livrer ou prêter leur concours à l'entremise ou à la négociation d'une mise en location d'un logement, tel que défini aux articles 2 et 25-3, est à la charge exclusive du bailleur, à l'exception des honoraires liés aux prestations mentionnées aux deuxième et troisième alinéas du présent I.

Les honoraires des personnes mandatées pour effectuer la visite du preneur, constituer son dossier et rédiger un bail sont partagés entre le bailleur et le preneur. Le montant toutes taxes comprises imputé au preneur pour ces prestations ne peut excéder celui imputé au bailleur et demeure inférieur ou égal à un plafond par mètre carré de surface habitable de la chose louée fixé par voie réglementaire et révisable chaque année, dans des conditions définies par décret. Ces honoraires sont dus à la signature du bail.

Les honoraires des personnes mandatées pour réaliser un état des lieux sont partagés entre le bailleur et le preneur. Le montant toutes taxes comprises imputé au locataire pour cette prestation ne peut excéder celui imputé au bailleur et demeure inférieur ou égal à un plafond par mètre carré de surface habitable de la chose louée fixé par voie réglementaire et révisable chaque année, dans des conditions définies par décret. Ces honoraires sont dus à compter de la réalisation de la prestation.

Plafonds applicables :

- montant du plafond des honoraires imputables aux locataires en matière de prestation de visite du preneur, de constitution de son dossier et de rédaction de bail : […] €/m2 de surface habitable ;
- montant du plafond des honoraires imputables aux locataires en matière d'établissement de l'état des lieux d'entrée : […] €/m2 de surface habitable.

### B. Détail et répartition des honoraires

1. Honoraires à la charge du bailleur :

- prestations de visite du preneur, de constitution de son dossier et de rédaction de bail : [détail des prestations effectivement réalisées et montant des honoraires toutes taxes comprises dus à la signature du bail] ;
- le cas échéant, Prestation de réalisation de l'état des lieux d'entrée : [montant des honoraires toutes taxes comprises dus à compter de la réalisation de la prestation] ;
- le cas échéant, Autres prestations : [détail des prestations et conditions de rémunération].

2. Honoraires à la charge du locataire :

- prestations de visite du preneur, de constitution de son dossier et de rédaction de bail : [détail des prestations effectivement réalisées et montant des honoraires toutes taxes comprises dus à la signature du bail] ;
- le cas échéant, Prestation de réalisation de l'état des lieux d'entrée : [montant des honoraires toutes taxes comprises dus à compter de la réalisation de la prestation].

## X. Autres conditions particulières

[A définir par les parties]

## XI. Annexes

Sont annexées et jointes au contrat de location les pièces suivantes :

A. Le cas échéant, un extrait du règlement concernant la destination de l'immeuble, la jouissance et l'usage des parties privatives et communes, et précisant la quote-part afférente au lot loué dans chacune des catégories de charges

B. Un dossier de diagnostic technique comprenant

- un diagnostic de performance énergétique ;
- un constat de risque d'exposition au plomb pour les immeubles construits avant le 1er janvier 1949 ;
- le cas échéant, une copie d'un état mentionnant l'absence ou la présence de matériaux ou de produits de la construction contenant de l'amiante (39) ;
- le cas échéant, Un état de l'installation intérieure d'électricité et de gaz, dont l'objet est d'évaluer les risques pouvant porter atteinte à la sécurité des personnes (40) ;
- le cas échéant, un état des risques naturels et technologiques pour les zones couvertes par un plan de prévention des risques technologiques ou par un plan de prévention des risques naturels prévisibles, prescrit ou approuvé, ou dans des zones de sismicité (41).

C. Une notice d'information relative aux droits et obligations des locataires et des bailleurs

D. Un état des lieux, un inventaire et un état détaillé du mobilier (42)

E. Le cas échéant, une autorisation préalable de mise en location (43)

F. Le cas échéant, Les références aux loyers habituellement constatés dans le voisinage pour des logements comparables (44)

---

Le [date], à [lieu],
Signature du bailleur [ou de son mandataire, le cas échéant]     Signature du locataire
