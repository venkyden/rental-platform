"""
Digital Lease Generator Service using ReportLab.
Generates French-compliant PDF leases with all required legal clauses.
Supports: Bail Meublé, Bail Vide, Bail Mobilité, Bail Étudiant
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from dateutil.relativedelta import relativedelta
from jinja2 import Template
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from app.models.property import Property
from app.models.user import User
from app.services.lease_templates import (LEASE_CODE_CIVIL_HTML,
                                          LEASE_COLOCATION_HTML,
                                          LEASE_MEUBLE_HTML, LEASE_SIMPLE_HTML)


class LeaseGenerator:
    """
    French-compliant lease PDF generator.

    Lease types and their rules:
    - meuble: Furnished, 1 year (9 months for students), 1 month préavis tenant, 3 months landlord
    - vide: Unfurnished, 3 years, 3 months préavis tenant, 6 months landlord
    - mobilite: Short-term (1-10 months), no renewal, no préavis
    - etudiant: Student lease, 9 months, 1 month préavis
    """

    LEASE_CONFIGS = {
        "meuble": {
            "name": "Location Meublée",
            "duration_months": 12,
            "renewable": True,
            "tenant_notice_months": 1,
            "landlord_notice_months": 3,
            "max_deposit_months": 2,
            "law_reference": "Loi n° 89-462 du 6 juillet 1989, titre Ier bis",
        },
        "vide": {
            "name": "Location Vide (Non Meublée)",
            "duration_months": 36,
            "renewable": True,
            "tenant_notice_months": 3,
            "landlord_notice_months": 6,
            "max_deposit_months": 1,
            "law_reference": "Loi n° 89-462 du 6 juillet 1989, titre Ier",
        },
        "mobilite": {
            "name": "Bail Mobilité",
            "duration_months": 10,  # Max, can be 1-10
            "renewable": False,
            "tenant_notice_months": 1,
            "landlord_notice_months": 0,  # Cannot terminate early
            "max_deposit_months": 0,  # No deposit allowed
            "law_reference": "Loi ELAN du 23 novembre 2018, art. 107 à 116",
        },
        "etudiant": {
            "name": "Bail Étudiant",
            "duration_months": 9,
            "renewable": False,
            "tenant_notice_months": 1,
            "landlord_notice_months": 0,
            "max_deposit_months": 2,
            "law_reference": "Loi n° 89-462 du 6 juillet 1989, art. 25-7",
        },
    }

    def generate_pdf(
        self,
        property: Property,
        landlord: User,
        tenant: User,
        start_date: str,
        rent: float,
        output_path: str,
        lease_type: str = "meuble",
        deposit: Optional[float] = None,
        charges: Optional[float] = None,
        duration_months: Optional[int] = None,
    ) -> str:
        """
        Generate a French-compliant lease PDF.

        Args:
            property: Property model instance
            landlord: User model instance (landlord)
            tenant: User model instance (tenant)
            start_date: Lease start date (YYYY-MM-DD)
            rent: Monthly rent in euros
            output_path: Where to save the PDF
            lease_type: One of 'meuble', 'vide', 'mobilite', 'etudiant'
            deposit: Security deposit (validated against legal max)
            charges: Monthly charges (provisions sur charges)
            duration_months: Custom duration (for mobilité: 1-10 months)
        """
        config = self.LEASE_CONFIGS.get(lease_type, self.LEASE_CONFIGS["meuble"])

        # Calculate dates
        start = datetime.strptime(start_date, "%Y-%m-%d")
        duration = duration_months or config["duration_months"]
        end = start + relativedelta(months=duration) - timedelta(days=1)

        # Validate deposit
        max_deposit = rent * config["max_deposit_months"]
        if deposit is None:
            deposit = max_deposit
        elif deposit > max_deposit:
            deposit = max_deposit  # Cap at legal maximum

        # Default charges if not provided
        if charges is None:
            charges = property.charges or 0

        c = canvas.Canvas(output_path, pagesize=A4)
        width, height = A4

        # --- PAGE 1 ---
        self._draw_header(c, config)
        y = 25 * cm

        # Section 1: Parties
        y = self._draw_parties(c, y, landlord, tenant)

        # Section 2: Property
        y = self._draw_property_section(c, y, property)

        # Section 3: Duration and Dates
        y = self._draw_duration_section(c, y, config, start, end, duration)

        # Section 4: Financial Terms
        y = self._draw_financial_section(c, y, rent, deposit, charges, config)

        # Section 5: Préavis (Notice Period)
        y = self._draw_notice_section(c, y, config, lease_type)

        # Check if we need a new page
        if y < 6 * cm:
            c.showPage()
            y = 27 * cm

        # Section 6: Fin de Bail (End of Lease)
        y = self._draw_end_of_lease_section(c, y, config, lease_type, end)

        # Section 7: Obligations
        y = self._draw_obligations_section(c, y)

        # --- PAGE 2 (if needed) ---
        if y < 10 * cm:
            c.showPage()
            y = 27 * cm

        # Section 8: État des lieux
        y = self._draw_etat_des_lieux_section(c, y)

        # Section 9: Assurance
        y = self._draw_insurance_section(c, y)

        # Section 10: Clause Résolutoire
        y = self._draw_termination_clause(c, y)

        # Signatures
        self._draw_signatures(c, y - 2 * cm, start)

        # Footer
        self._draw_footer(c, config)

        c.save()
        return output_path

    def generate_html(
        self,
        property: Property,
        landlord: User,
        tenant: User,
        start_date: str,
        rent: float,
        lease_type: str = "meuble",
        deposit: Optional[float] = None,
        charges: Optional[float] = None,
        duration_months: Optional[int] = None,
        guarantor_name: Optional[str] = None,
        landlord_signature: Optional[str] = None,
    ) -> str:
        config = self.LEASE_CONFIGS.get(lease_type, self.LEASE_CONFIGS["meuble"])
        start = datetime.strptime(start_date, "%Y-%m-%d")
        duration = duration_months or config["duration_months"]
        end = start + relativedelta(months=duration) - timedelta(days=1)

        # Determine the right template
        templates = {
            "meuble": LEASE_MEUBLE_HTML,
            "colocation": LEASE_COLOCATION_HTML,
            "code_civil": LEASE_CODE_CIVIL_HTML,
            "simple": LEASE_SIMPLE_HTML,
        }
        template_str = templates.get(lease_type, LEASE_MEUBLE_HTML)
        template = Template(template_str)

        max_deposit = rent * config["max_deposit_months"]
        if deposit is None:
            deposit = max_deposit
        elif deposit > max_deposit:
            deposit = max_deposit

        charges = charges if charges is not None else (property.charges or 0)

        address = f"{property.address_line1}"
        if property.address_line2:
            address += f", {property.address_line2}"
        address += f", {property.postal_code} {property.city}"

        landlord_img = ""
        if landlord_signature:
            landlord_img = f'<img src="{landlord_signature}" style="max-height: 50px;" alt="Signature Bailleur" />'

        return template.render(
            landlord_name=landlord.full_name,
            landlord_address=address,  # Simplified
            landlord_email=landlord.email,
            tenant_name=tenant.full_name,
            tenant_email=tenant.email,
            tenant_address="A l'adresse du bien",
            property_address=address,
            property_description=property.description or "Logement",
            property_size=property.size_sqm or 0,
            property_rooms=property.bedrooms,  # simplification
            property_city=property.city,
            start_date=start.strftime("%d/%m/%Y"),
            duration_text=f"{duration} mois",
            duration_months=duration,
            today_date=datetime.now().strftime("%d/%m/%Y"),
            rent_amount=f"{rent:.2f}",
            charges_amount=f"{charges:.2f}",
            total_amount=f"{(rent + charges):.2f}",
            deposit_amount=f"{deposit:.2f}",
            guarantor_name=guarantor_name,
            landlord_img=landlord_img,
        )

    def _draw_header(self, c: canvas.Canvas, config: dict):
        """Draw the document header."""
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(10.5 * cm, 28 * cm, "CONTRAT DE LOCATION")
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(10.5 * cm, 27.3 * cm, config["name"].upper())
        c.setFont("Helvetica", 9)
        c.drawCentredString(10.5 * cm, 26.7 * cm, f"({config['law_reference']})")

    def _draw_parties(
        self, c: canvas.Canvas, y: float, landlord: User, tenant: User
    ) -> float:
        """Draw landlord and tenant information."""
        # Landlord
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 1 - LES PARTIES")
        y -= 0.8 * cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * cm, y, "Le Bailleur:")
        c.setFont("Helvetica", 10)
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, f"Nom: {landlord.full_name}")
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, f"Email: {landlord.email}")
        if hasattr(landlord, "phone") and landlord.phone:
            y -= 0.4 * cm
            c.drawString(2.5 * cm, y, f"Téléphone: {landlord.phone}")

        # Tenant
        y -= 0.8 * cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * cm, y, "Le Locataire:")
        c.setFont("Helvetica", 10)
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, f"Nom: {tenant.full_name}")
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, f"Email: {tenant.email}")

        return y - 1 * cm

    def _draw_property_section(
        self, c: canvas.Canvas, y: float, property: Property
    ) -> float:
        """Draw property details."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 2 - DÉSIGNATION DU LOGEMENT")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        address = f"{property.address_line1}"
        if property.address_line2:
            address += f", {property.address_line2}"
        address += f", {property.postal_code} {property.city}"

        c.drawString(2.5 * cm, y, f"Adresse: {address}")
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, f"Type de bien: {property.property_type}")
        y -= 0.5 * cm
        c.drawString(
            2.5 * cm, y, f"Surface habitable (Loi Carrez): {property.size_sqm} m²"
        )
        y -= 0.5 * cm
        rooms = getattr(property, "rooms", None) or property.bedrooms + 1
        c.drawString(2.5 * cm, y, f"Nombre de pièces principales: {rooms}")
        if property.floor_number is not None:
            y -= 0.5 * cm
            c.drawString(2.5 * cm, y, f"Étage: {property.floor_number}")
        y -= 0.5 * cm
        furnished = "Oui" if property.furnished else "Non"
        c.drawString(2.5 * cm, y, f"Meublé: {furnished}")

        return y - 1 * cm

    def _draw_duration_section(
        self,
        c: canvas.Canvas,
        y: float,
        config: dict,
        start: datetime,
        end: datetime,
        duration: int,
    ) -> float:
        """Draw lease duration information."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 3 - DURÉE DU BAIL")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        c.drawString(
            2.5 * cm, y, f"Date de prise d'effet: {start.strftime('%d/%m/%Y')}"
        )
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, f"Date de fin: {end.strftime('%d/%m/%Y')}")
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, f"Durée: {duration} mois")
        y -= 0.5 * cm

        if config["renewable"]:
            c.drawString(
                2.5 * cm, y, "Renouvellement: Tacite reconduction à l'échéance du bail"
            )
        else:
            c.drawString(
                2.5 * cm,
                y,
                "Renouvellement: Non renouvelable (bail à durée déterminée)",
            )

        return y - 1 * cm

    def _draw_financial_section(
        self,
        c: canvas.Canvas,
        y: float,
        rent: float,
        deposit: float,
        charges: float,
        config: dict,
    ) -> float:
        """Draw financial terms."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 4 - CONDITIONS FINANCIÈRES")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        c.drawString(2.5 * cm, y, f"Loyer mensuel (hors charges): {rent:.2f} €")
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, f"Charges mensuelles (provisions): {charges:.2f} €")
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, f"Total mensuel: {(rent + charges):.2f} €")
        y -= 0.5 * cm

        if deposit > 0:
            deposit_months = config["max_deposit_months"]
            c.drawString(
                2.5 * cm,
                y,
                f"Dépôt de garantie: {deposit:.2f} € ({deposit_months} mois max légal)",
            )
        else:
            c.drawString(
                2.5 * cm, y, "Dépôt de garantie: Non applicable (bail mobilité)"
            )
        y -= 0.5 * cm

        c.drawString(
            2.5 * cm, y, "Modalités de paiement: À terme échu, le 1er de chaque mois"
        )

        return y - 1 * cm

    def _draw_notice_section(
        self, c: canvas.Canvas, y: float, config: dict, lease_type: str
    ) -> float:
        """Draw préavis (notice period) section - CRITICAL FRENCH LEGAL REQUIREMENT."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 5 - PRÉAVIS (CONGÉ)")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        tenant_notice = config["tenant_notice_months"]
        landlord_notice = config["landlord_notice_months"]

        # Tenant notice
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2.5 * cm, y, "Préavis du Locataire:")
        c.setFont("Helvetica", 10)
        y -= 0.5 * cm

        if lease_type == "mobilite":
            c.drawString(
                2.5 * cm,
                y,
                f"• Délai: {tenant_notice} mois avant la date de départ souhaitée",
            )
            y -= 0.4 * cm
            c.drawString(
                2.5 * cm, y, "• Le locataire peut partir à tout moment avec préavis"
            )
        else:
            c.drawString(2.5 * cm, y, f"• Délai standard: {tenant_notice} mois")
            y -= 0.4 * cm
            # Reduced notice cases for meuble/vide
            if lease_type in ["meuble", "vide"]:
                c.drawString(2.5 * cm, y, "• Délai réduit à 1 mois en cas de:")
                y -= 0.35 * cm
                c.setFont("Helvetica", 9)
                c.drawString(3 * cm, y, "- Mutation professionnelle")
                y -= 0.35 * cm
                c.drawString(3 * cm, y, "- Perte d'emploi")
                y -= 0.35 * cm
                c.drawString(3 * cm, y, "- Obtention d'un premier emploi")
                y -= 0.35 * cm
                c.drawString(
                    3 * cm, y, "- État de santé justifiant un changement de domicile"
                )
                y -= 0.35 * cm
                c.drawString(3 * cm, y, "- Zone tendue (loi ALUR)")
                c.setFont("Helvetica", 10)

        y -= 0.6 * cm

        # Landlord notice
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2.5 * cm, y, "Préavis du Bailleur:")
        c.setFont("Helvetica", 10)
        y -= 0.5 * cm

        if landlord_notice == 0:
            c.drawString(
                2.5 * cm,
                y,
                "• Le bailleur ne peut pas donner congé avant l'échéance du bail",
            )
        else:
            c.drawString(
                2.5 * cm, y, f"• Délai: {landlord_notice} mois avant l'échéance du bail"
            )
            y -= 0.4 * cm
            c.drawString(2.5 * cm, y, "• Motifs légaux uniquement:")
            y -= 0.35 * cm
            c.setFont("Helvetica", 9)
            c.drawString(
                3 * cm, y, "- Reprise pour habiter (bailleur ou famille proche)"
            )
            y -= 0.35 * cm
            c.drawString(3 * cm, y, "- Vente du logement")
            y -= 0.35 * cm
            c.drawString(
                3 * cm, y, "- Motif légitime et sérieux (manquements du locataire)"
            )
            c.setFont("Helvetica", 10)

        y -= 0.6 * cm
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(
            2.5 * cm,
            y,
            "Le congé doit être notifié par lettre recommandée avec AR ou par acte d'huissier.",
        )

        return y - 1 * cm

    def _draw_end_of_lease_section(
        self,
        c: canvas.Canvas,
        y: float,
        config: dict,
        lease_type: str,
        end_date: datetime,
    ) -> float:
        """Draw fin de bail section."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 6 - FIN DE BAIL")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        c.drawString(2.5 * cm, y, f"Date d'échéance: {end_date.strftime('%d/%m/%Y')}")
        y -= 0.5 * cm

        if config["renewable"]:
            c.drawString(
                2.5 * cm,
                y,
                "À l'échéance, le bail est reconduit tacitement pour la même durée,",
            )
            y -= 0.4 * cm
            c.drawString(2.5 * cm, y, "sauf congé donné dans les délais légaux.")
        else:
            c.drawString(
                2.5 * cm,
                y,
                "Le bail prend fin de plein droit à l'échéance sans qu'il soit",
            )
            y -= 0.4 * cm
            c.drawString(2.5 * cm, y, "nécessaire de donner congé.")

        y -= 0.6 * cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2.5 * cm, y, "Restitution du logement:")
        c.setFont("Helvetica", 10)
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, "• Le locataire doit rendre le logement en bon état")
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, "• État des lieux de sortie obligatoire")
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, "• Restitution des clés")
        y -= 0.4 * cm
        c.drawString(
            2.5 * cm, y, "• Dépôt de garantie restitué sous 1 mois (sans dégradations)"
        )
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, "  ou 2 mois (si dégradations constatées)")

        return y - 1 * cm

    def _draw_obligations_section(self, c: canvas.Canvas, y: float) -> float:
        """Draw mutual obligations."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 7 - OBLIGATIONS DES PARTIES")
        y -= 0.7 * cm

        c.setFont("Helvetica-Bold", 10)
        c.drawString(2.5 * cm, y, "Obligations du Bailleur:")
        c.setFont("Helvetica", 9)
        y -= 0.45 * cm
        c.drawString(2.5 * cm, y, "• Délivrer un logement décent et en bon état")
        y -= 0.35 * cm
        c.drawString(2.5 * cm, y, "• Assurer la jouissance paisible du logement")
        y -= 0.35 * cm
        c.drawString(
            2.5 * cm, y, "• Entretenir les locaux et faire les réparations nécessaires"
        )
        y -= 0.35 * cm
        c.drawString(
            2.5 * cm,
            y,
            "• Fournir les diagnostics obligatoires (DPE, CREP, Amiante, etc.)",
        )

        y -= 0.6 * cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2.5 * cm, y, "Obligations du Locataire:")
        c.setFont("Helvetica", 9)
        y -= 0.45 * cm
        c.drawString(2.5 * cm, y, "• Payer le loyer et les charges aux termes convenus")
        y -= 0.35 * cm
        c.drawString(2.5 * cm, y, "• User paisiblement des locaux")
        y -= 0.35 * cm
        c.drawString(
            2.5 * cm, y, "• Répondre des dégradations survenues pendant la location"
        )
        y -= 0.35 * cm
        c.drawString(2.5 * cm, y, "• Souscrire une assurance habitation")
        y -= 0.35 * cm
        c.drawString(2.5 * cm, y, "• Permettre l'accès pour travaux urgents")

        return y - 1 * cm

    def _draw_etat_des_lieux_section(self, c: canvas.Canvas, y: float) -> float:
        """Draw état des lieux section."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 8 - ÉTAT DES LIEUX")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        c.drawString(2.5 * cm, y, "Un état des lieux contradictoire sera établi:")
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, "• À l'entrée: lors de la remise des clés")
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, "• À la sortie: lors de la restitution des clés")
        y -= 0.5 * cm
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(
            2.5 * cm, y, "L'état des lieux doit être annexé au présent contrat."
        )

        return y - 1 * cm

    def _draw_insurance_section(self, c: canvas.Canvas, y: float) -> float:
        """Draw insurance requirements."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 9 - ASSURANCE")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        c.drawString(
            2.5 * cm,
            y,
            "Le locataire est tenu de s'assurer contre les risques locatifs",
        )
        y -= 0.4 * cm
        c.drawString(
            2.5 * cm,
            y,
            "(incendie, dégât des eaux, explosion) et d'en justifier annuellement",
        )
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, "auprès du bailleur.")
        y -= 0.5 * cm
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(
            2.5 * cm,
            y,
            "À défaut, le bailleur peut souscrire une assurance pour le compte",
        )
        y -= 0.35 * cm
        c.drawString(2.5 * cm, y, "du locataire et en récupérer le coût.")

        return y - 1 * cm

    def _draw_termination_clause(self, c: canvas.Canvas, y: float) -> float:
        """Draw clause résolutoire."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "ARTICLE 10 - CLAUSE RÉSOLUTOIRE")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        c.drawString(2.5 * cm, y, "Le bail sera résilié de plein droit:")
        y -= 0.5 * cm
        c.drawString(2.5 * cm, y, "• En cas de non-paiement du loyer ou des charges")
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, "• En cas de non-versement du dépôt de garantie")
        y -= 0.4 * cm
        c.drawString(2.5 * cm, y, "• En cas de défaut d'assurance")
        y -= 0.4 * cm
        c.drawString(
            2.5 * cm,
            y,
            "• En cas de troubles de voisinage constatés par décision de justice",
        )
        y -= 0.5 * cm
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(
            2.5 * cm,
            y,
            "Après un commandement de payer resté infructueux pendant 2 mois.",
        )

        return y - 1 * cm

    def _draw_signatures(self, c: canvas.Canvas, y: float, start: datetime):
        """Draw signature section."""
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "SIGNATURES")
        y -= 1 * cm

        c.setFont("Helvetica", 10)
        c.drawString(
            2 * cm,
            y,
            f"Fait en deux exemplaires originaux, le {start.strftime('%d/%m/%Y')}",
        )
        y -= 0.5 * cm
        c.drawString(2 * cm, y, "À ________________________")

        y -= 1.5 * cm
        c.line(2 * cm, y, 8 * cm, y)
        c.line(12 * cm, y, 18 * cm, y)

        y -= 0.5 * cm
        c.setFont("Helvetica", 9)
        c.drawString(2 * cm, y, "Le Bailleur")
        c.drawString(12 * cm, y, "Le Locataire")
        y -= 0.35 * cm
        c.drawString(2 * cm, y, "(Signature précédée de")
        c.drawString(12 * cm, y, "(Signature précédée de")
        y -= 0.35 * cm
        c.drawString(2 * cm, y, '"Lu et approuvé")')
        c.drawString(12 * cm, y, '"Lu et approuvé")')

    def _draw_footer(self, c: canvas.Canvas, config: dict):
        """Draw document footer."""
        c.setFont("Helvetica-Oblique", 7)
        c.drawString(
            2 * cm,
            1.5 * cm,
            f"Document établi conformément à la {config['law_reference']}.",
        )
        c.drawString(
            2 * cm,
            1.1 * cm,
            "Ce contrat type est conforme aux dispositions de l'annexe au décret n° 2015-587 du 29 mai 2015.",
        )
        c.drawString(
            2 * cm,
            0.7 * cm,
            "Document généré automatiquement. Les parties sont invitées à vérifier la conformité avec leur situation particulière.",
        )


lease_generator = LeaseGenerator()
