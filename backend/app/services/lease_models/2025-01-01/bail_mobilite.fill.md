<!--
DERIVED TEMPLATE — NOT an official decree contrat-type.

⚠️ PROVENANCE / RISK: Bail mobilité has NO contrat-type annexed to a decree
(unlike vide/meublé under Décret 2015-587). This template is ASSEMBLED, not
reproduced: the meublé model body (Décret 2015-587, Annexe 2, verbatim from
Légifrance) MINUS the meublé tacit-renewal clause, PLUS the mandatory bail-
mobilité mentions taken VERBATIM from loi n°89-462 art. 25-12/25-13/25-14
(titre Ier ter, created by loi ELAN n°2018-1021).

The assembly (which official paragraphs to keep, which statutory mentions to
inject) is FOUNDER-AUTHORED and NOT YET COUNSEL-VERIFIED. Enabled per explicit
owner risk-acceptance (2026-07-05) ahead of the separate lawyer sign-off the
requirements file calls for. See bail_mobilite_requirements.md.

Requalification shield (art. 25-13 I, al. 2): a mobilité lease missing the
bail-mobilité statement, 4° (durée) or 8° (motif) is requalified as an ordinary
meublé. All three are present here by construction — the statement is hardcoded
verbatim; {{duree_contrat}} and {{motif_mobilite}} are REQUIRED fields.

Bracketed [...] = fillable descriptive blank. Double-brace tokens = schema-driven
fields. (n) = official footnote marker, preserved (annexe2_meuble_footnotes.md).
-->

# Contrat de location — bail mobilité (loi n°89-462, titre Ier ter)

## I. Désignation des parties

Le présent contrat est conclu entre les soussignés :

- {{bailleur_designation}} (25) désigné(s) ci-après le bailleur.
- Le cas échéant, représenté par le mandataire :
- [nom ou raison sociale et adresse du mandataire ainsi que l'activité exercée] ;
- Le cas échéant [numéro et lieu de délivrance de la carte professionnelle / nom et adresse du garant] (26).
- {{locataire_designation}} désigné(s) ci-après le locataire.

Il a été convenu ce qui suit :

## II. Objet du contrat

Le présent contrat a pour objet la location d'un logement ainsi déterminé :

### A. Consistance du logement

- localisation du logement : {{logement_localisation}} ;
- identifiant fiscal du logement : [Numéro Identifiant Fiscal du logement] ;
- type d'habitat : [immeuble collectif ou individuel] ;
- régime juridique de l'immeuble : [mono propriété ou copropriété] ;
- période de construction : [exemples : avant 1949, de 1949 à 1974, de 1975 à 1989, de 1989 à 2005, depuis 2005] ;
- surface habitable : {{logement_surface_habitable}} m2 ;
- nombre de pièces principales : {{logement_nb_pieces}} ;
- le cas échéant, autres parties du logement : [exemples : grenier, comble aménagé ou non, terrasse, balcon, loggia, jardin etc.] ;
- le cas échéant, Eléments d'équipements du logement : [exemples : cuisine équipée, détail des installations sanitaires etc.] ;
- modalité de production chauffage : [individuel ou collectif] (27) ;
- modalité de production d'eau chaude sanitaire : [individuelle ou collective] (28) ;

- rappel : un logement décent doit respecter les critères minimaux de performance suivants :

a) En France métropolitaine :

i) A compter du 1er janvier 2025, le niveau de performance minimal correspond à la classe F du DPE ;

ii) A compter du 1er janvier 2028, le niveau de performance minimal correspond à la classe E du DPE ;

iii) A compter du 1er janvier 2034, le niveau de performance minimal correspond à la classe D du DPE.

b) En Guadeloupe, en Martinique, en Guyane, à La Réunion et à Mayotte :

i) A compter du 1er janvier 2028, le niveau de performance minimal du logement correspond à la classe F du DPE ;

ii) A compter du 1er janvier 2031, le niveau de performance minimal du logement correspond à la classe E du DPE.

La consommation d'énergie finale et le niveau de performance du logement sont déterminés selon la méthode du diagnostic de performance énergétique mentionné à l'article L. 126-26 du code de la construction et de l'habitation.

- niveau de performance du logement : {{logement_dpe_classe}}.

### B. Destination des locaux : {{destination_locaux}}

### C. Le cas échéant, Désignation des locaux et équipements accessoires de l'immeuble à usage privatif du locataire : [exemples : cave, parking, garage etc.]

### D. Le cas échéant, Enumération des locaux, parties, équipements et accessoires de l'immeuble à usage commun : [Garage à vélo, ascenseur, espaces verts, aires et équipements de jeux, laverie, local poubelle, gardiennage, autres prestations et services collectifs etc.]

### E. Le cas échéant, Equipement d'accès aux technologies de l'information et de la communication : [exemples : modalités de réception de la télévision dans l'immeuble, modalités de raccordement internet etc.]

## III. Nature du contrat, date de prise d'effet, durée et motif

Le présent contrat de location est un bail mobilité régi par les dispositions du titre Ier ter de la loi n° 89-462 du 6 juillet 1989. (art. 25-13 I)

A. Date de prise d'effet du contrat : {{date_prise_effet}}

B. Durée du contrat : {{duree_contrat}}

Le bail mobilité est conclu pour une durée minimale d'un mois et une durée maximale de dix mois, non renouvelable et non reconductible. La durée du contrat peut être modifiée une fois par avenant sans que la durée totale du contrat dépasse dix mois. Si, au terme du contrat, les parties concluent un nouveau bail portant sur le même logement meublé, ce nouveau bail est soumis aux dispositions du titre Ier bis de la présente loi. (art. 25-14)

C. Motif justifiant le bénéfice du bail mobilité, le locataire justifiant à la date de prise d'effet du bail être dans l'une des situations mentionnées à l'article 25-12 : {{motif_mobilite}}

## IV. Conditions financières

Les parties conviennent des conditions financières suivantes :

### A. Loyer

1° Fixation du loyer initial :
a) Montant du loyer mensuel : {{loyer_mensuel}} (29).
b) Le cas échéant, Modalités particulières de fixation initiale du loyer applicables dans certaines zones tendues (30) :

- le loyer du logement objet du présent contrat est soumis au décret fixant annuellement le montant maximum d'évolution des loyers à la relocation : [Oui / Non] ;
- le loyer du logement objet du présent contrat est soumis au loyer de référence majoré fixé par arrêté préfectoral : [Oui / Non].
- montant du loyer de référence : […] €/m2 / Montant du loyer de référence majoré : […] €/m2 ;
- Le cas échéant, Complément de loyer : [si un complément de loyer est prévu, indiquer le montant du loyer de base, nécessairement égal au loyer de référence majoré, le montant du complément de loyer et les caractéristiques du logement justifiant le complément de loyer].

c) Le cas échéant, Informations relatives au loyer du dernier locataire : [montant du dernier loyer acquitté par le précédent locataire, date de versement et date de la dernière révision du loyer] (31).

### B. Charges récupérables

1. Modalité de règlement des charges récupérables : [Provisions sur charges avec régularisation annuelle ou paiement périodique des charges sans provision ou récupération des charges par le bailleur sous la forme d'un forfait].
2. Le cas échéant, Montant des provisions sur charges ou du forfait de charges […].

### C. Modalités de paiement

- périodicité du paiement : [… (35)] ;
- paiement [à échoir / à terme échu] ;
- date ou période de paiement : […] ;
- le cas échéant, Lieu de paiement : […].

## V. Travaux

A. Le cas échéant, Montant et nature des travaux d'amélioration ou de mise en conformité avec les caractéristiques de décence effectués depuis la fin du dernier contrat de location : […] (36)

## VI. Dépôt de garantie

Conformément à l'article 25-13 I, 11° et à l'article 25-17 de la loi n° 89-462 du 6 juillet 1989, aucun dépôt de garantie ne peut être exigé par le bailleur.

## VII. Colocation

Conformément à l'article 25-13 II de la loi n° 89-462 du 6 juillet 1989, toute clause prévoyant une solidarité entre les colocataires ou leurs cautions est réputée non écrite.

## VIII. Le cas échéant, Clause résolutoire

Modalités de résiliation de plein droit du contrat : [clause prévoyant la résiliation de plein droit du contrat de location pour un défaut de paiement du loyer ou des charges aux termes convenus, la non-souscription d'une assurance des risques locatifs ou le non-respect de l'obligation d'user paisiblement des locaux loués, résultant de troubles de voisinage constatés par une décision de justice passée en force de chose jugée].

## IX. Autres conditions particulières

[A définir par les parties, dans le respect des dispositions d'ordre public du titre Ier ter]

## X. Annexes

Sont annexées et jointes au contrat de location les pièces suivantes :

A. Le cas échéant, un extrait du règlement concernant la destination de l'immeuble, la jouissance et l'usage des parties privatives et communes, et précisant la quote-part afférente au lot loué dans chacune des catégories de charges

B. Un dossier de diagnostic technique comprenant

- un diagnostic de performance énergétique ;
- un constat de risque d'exposition au plomb pour les immeubles construits avant le 1er janvier 1949 ;
- le cas échéant, un état des risques naturels et technologiques pour les zones couvertes par un plan de prévention des risques.

C. Une notice d'information relative aux droits et obligations des locataires et des bailleurs

D. Un état des lieux, un inventaire et un état détaillé du mobilier (42)

---

Le [date], à [lieu],
Signature du bailleur [ou de son mandataire, le cas échéant]     Signature du locataire
