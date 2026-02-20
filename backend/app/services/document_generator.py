"""
Document Generator Service.
Generates utility documents like Receipts and Exit Attestations.
"""
from datetime import datetime
from jinja2 import Template
from typing import Optional
from app.models.property import Property
from app.models.user import User
from app.services.lease_templates import RENT_RECEIPT_HTML, EXIT_ATTESTATION_HTML


def format_user_address(user: User) -> str:
    """Format user address from model fields (no more email placeholders!)"""
    parts = []
    if user.address_line1:
        parts.append(user.address_line1)
    if user.address_line2:
        parts.append(user.address_line2)
    if user.postal_code and user.city:
        parts.append(f"{user.postal_code} {user.city}")
    elif user.city:
        parts.append(user.city)
    if user.country and user.country != "France":
        parts.append(user.country)
    return ", ".join(parts) if parts else f"Adresse à compléter ({user.email})"


class DocumentGenerator:
    """
    Generates non-lease documents.
    """
    
    def generate_receipt(
        self,
        property: Property,
        landlord: User,
        tenant: User,
        start_date: str, # Period start
        end_date: str,   # Period end
        payment_date: str,
        rent_amount: float,
        charges_amount: float
    ) -> str:
        """
        Generate Rent Receipt (Quittance).
        """
        total = rent_amount + charges_amount
        today_date = datetime.now().strftime("%d/%m/%Y")
        
        context = {
            "landlord_name": landlord.full_name,
            "landlord_address": format_user_address(landlord),
            "tenant_name": tenant.full_name,
            "tenant_address": format_user_address(tenant),
            "property_address": f"{property.address_line1}, {property.postal_code} {property.city}",
            "property_city": property.city,
            
            "start_date": start_date,
            "end_date": end_date,
            "payment_date": payment_date,
            
            "rent_amount": f"{rent_amount:.2f}",
            "charges_amount": f"{charges_amount:.2f}",
            "total_amount": f"{total:.2f}",
            "today_date": today_date
        }
        
        template = Template(RENT_RECEIPT_HTML)
        return template.render(**context)

    def generate_exit_attestation(
        self,
        property: Property,
        landlord: User,
        tenant: User,
        notice_date: str,
        exit_date: str,
        deposit_amount: float,
        deposit_returned: bool = True
    ) -> str:
        """
        Generate Exit Attestation (Fin de bail).
        """
        today_date = datetime.now().strftime("%d/%m/%Y")
        
        context = {
            "landlord_name": landlord.full_name,
            "landlord_address": format_user_address(landlord),
            "landlord_city": landlord.city or property.city,
            
            "tenant_name": tenant.full_name,
            "notice_date": notice_date,
            
            "property_address": f"{property.address_line1}, {property.postal_code} {property.city}",
            
            "exit_date": exit_date,
            
            "deposit_returned": deposit_returned,
            "deposit_amount": f"{deposit_amount:.2f}",
            
            "today_date": today_date
        }
        
        template = Template(EXIT_ATTESTATION_HTML)
        return template.render(**context)

document_generator = DocumentGenerator()

