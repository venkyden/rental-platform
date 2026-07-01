<!--
OFFICIAL LEGAL REQUIREMENTS — NOT a contrat-type model. DO NOT EDIT THE LEGAL TEXT.

Unlike the bail vide (Annexe 1) and bail meublé (Annexe 2), the **bail mobilité** has NO
official contrat-type annexed to a decree. It is a furnished lease (logement meublé au
sens de l'art. 25-4) governed by Titre Ier ter de la loi n°89-462 (art. 25-12 à 25-18),
created by la loi ELAN n°2018-1021. The regime is **d'ordre public**.

So a generated bail mobilité = the **meublé model body** (annexe2_meuble.md) ADAPTED to the
mandatory mentions below — there is no separate verbatim contrat-type to reproduce. This
file records the authoritative legal requirements (art. 25-12/13/14, verbatim from
Légifrance, en vigueur) + a generation checklist.

Status: ⏳ PENDING LAWYER SIGN-OFF before any bail-mobilité generation is wired.
Sources:
- art. 25-12 https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037649115/
- art. 25-13 https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037649090/
- art. 25-14 https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037649092/
-->

# Bail mobilité — exigences légales (loi n°89-462, titre Ier ter)

## Generation checklist (what a bail mobilité MUST do, beyond the meublé body)

- **Statement (à peine de requalification):** the contract must state it is a *bail mobilité
  régi par les dispositions du présent titre*. Absent that statement, or absent item 4°
  (durée) or 8° (motif), the lease is **requalified as an ordinary meublé** (titre Ier bis).
- **Durée (art. 25-14):** 1 à 10 mois, **non renouvelable et non reconductible** (1 semaine à
  18 mois en résidence à vocation d'emploi). Modifiable **une fois** par avenant, total ≤ 10
  (ou 18) mois. Un nouveau bail au terme → titre Ier bis (meublé classique).
- **Dépôt de garantie : INTERDIT** (art. 25-13 I 11°). → `lease_rules` LG-2 (deposit = 0).
- **Motif (art. 25-12):** the tenant must, at the effective date, be in: formation
  professionnelle, études supérieures, contrat d'apprentissage, stage, engagement de service
  civique, mutation professionnelle, ou mission temporaire. The motif is a mandatory mention.
- **No solidarity clause:** *toute clause prévoyant une solidarité entre les colocataires ou
  leurs cautions est réputée non écrite* (art. 25-13 II).
- The 11 mandatory mentions of art. 25-13 I (parties, locataire, prise d'effet, durée,
  consistance/surface, désignation des locaux, loyer + modalités, motif, dernier loyer si <18
  mois, travaux, mention d'interdiction du dépôt de garantie).

---

## Art. 25-12 (verbatim)

Le bail mobilité est un contrat de location de courte durée d'un logement meublé au sens de l'article 25-4 à un locataire justifiant, à la date de la prise d'effet du bail, être en formation professionnelle, en études supérieures, en contrat d'apprentissage, en stage, en engagement volontaire dans le cadre d'un service civique prévu au II de l'article L. 120-1 du code du service national, en mutation professionnelle ou en mission temporaire dans le cadre de son activité professionnelle.

Le bail mobilité est régi par les dispositions du présent titre, qui sont d'ordre public. Sauf disposition contraire, les dispositions du titre Ier bis ne sont pas applicables.

Les articles 1er, 3-2, 3-3, 4, 5, 6, 6-2, 7, 7-1 et 8, les I à IV de l'article 8-1 et les articles 17, 18, 21, 22-1, 22-2, 25-4 et 25-5 sont applicables au bail mobilité.

La commission départementale de conciliation n'est pas compétente pour l'examen des litiges résultant de l'application des dispositions du présent titre.

Le présent titre ne s'applique ni aux logements-foyers, ni aux logements faisant l'objet d'une convention avec l'Etat portant sur leurs conditions d'occupation et leurs modalités d'attribution.

## Art. 25-13 (verbatim)

I.- Le contrat de location est établi par écrit et précise :

1° Le nom ou la dénomination du bailleur et son domicile ou son siège social ainsi que, le cas échéant, ceux de son mandataire ;

2° Le nom du locataire ;

3° La date de prise d'effet ;

4° La durée du contrat de location conformément à l'article 25-14 ;

5° La consistance, la destination ainsi que la surface habitable de la chose louée, définie par le code de la construction et de l'habitation ;

6° La désignation des locaux et équipements d'usage privatif dont le locataire a la jouissance exclusive et, le cas échéant, l'énumération des parties, équipements et accessoires de l'immeuble qui font l'objet d'un usage commun ainsi que des équipements d'accès aux technologies de l'information et de la communication ;

7° Le montant du loyer et ses modalités de paiement ;

8° Le motif justifiant le bénéfice du bail mobilité conformément à l'article 25-12 ;

9° Le montant et la date de versement du dernier loyer appliqué au précédent locataire, dès lors que ce dernier a quitté le logement moins de dix-huit mois avant la signature du bail ;

10° La nature et le montant des travaux effectués dans le logement depuis la fin du dernier contrat de location ;

11° Une mention informant le locataire de l'interdiction pour le bailleur d'exiger le versement d'un dépôt de garantie.

Le contrat comporte en outre une mention selon laquelle le contrat de location est un bail mobilité régi par les dispositions du présent titre. A défaut de cette mention ou de l'une des informations prévues aux 4° ou 8° du I du présent article, le contrat de location est régi par les dispositions du titre Ier bis.

Lorsque l'immeuble est soumis au statut de la copropriété, le copropriétaire bailleur est tenu de communiquer au locataire les extraits du règlement de copropriété concernant la destination de l'immeuble, la jouissance et l'usage des parties privatives et communes, et précisant la quote-part afférente au lot loué dans chacune des catégories de charges.

Le bailleur ne peut pas se prévaloir de la violation du présent article.

En cas de mutation à titre gratuit ou onéreux du logement, le nouveau bailleur est tenu de notifier au locataire son nom ou sa dénomination et son domicile ou son siège social ainsi que, le cas échéant, ceux de son mandataire.

II.- Toute clause prévoyant une solidarité entre les colocataires ou leurs cautions est réputée non écrite.

## Art. 25-14 (verbatim)

Le bail mobilité est conclu pour une durée minimale d'un mois et une durée maximale de dix mois, non renouvelable et non reconductible.

Par dérogation au premier alinéa, le bail mobilité peut être conclu pour une durée minimale d'une semaine et une durée maximale de dix-huit mois lorsque le logement sur lequel il porte fait partie d'une résidence à vocation d'emploi définie à l'article L. 631-16-1 du code de la construction et de l'habitation.

La durée du contrat de location prévue au 4° du I de l'article 25-13 de la présente loi peut être modifiée une fois par avenant sans que la durée totale du contrat dépasse dix mois, ou dix-huit mois si le logement fait partie d'une résidence à vocation d'emploi définie à l'article L. 631-16-1 du code de la construction et de l'habitation.

Si, au terme du contrat, les parties concluent un nouveau bail portant sur le même logement meublé, ce nouveau bail est soumis aux dispositions du titre Ier bis de la présente loi.
