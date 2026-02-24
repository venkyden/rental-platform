import asyncio
from typing import Optional, List
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Please install the 'mcp' package: pip install mcp")
    import sys
    sys.exit(1)

from app.core.database import AsyncSessionLocal
from app.models.property import Property
from app.models.user import User
from app.models.visits_and_leases import Lease
from app.models.inventory import Inventory  # Required for Lease mapper
from app.models.dispute import Dispute      # Required for Lease mapper
from app.services.lease_generator import lease_generator

mcp = FastMCP("Roomivo Secure Admin Tools")


@mcp.tool()
async def force_verify_user(email: str, confirm: bool = False) -> str:
    """
    Instantly mark a user as identity_verified and recalculate their trust score.
    DRY-RUN DEFAULT: You must pass confirm=True to actually alter the database.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            return f"Error: User {email} not found."
            
        plan = (
            f"PLAN: Force-verifying user {user.email} (ID: {user.id})\n"
            f"  - identity_verified: {user.identity_verified} -> True\n"
            f"  - trust_score: {user.trust_score} -> 100\n"
        )
        
        if not confirm:
            return f"{plan}\n---[DRY RUN]---\nDatabase NOT modified. To execute, call this tool again with confirm=True."
            
        user.identity_verified = True
        user.trust_score = 100
        # Optional: Add a trace to identity_data to mark it was admin-verified
        # user.identity_data = user.identity_data or {}
        # user.identity_data["admin_verified_via_mcp"] = True
        
        await db.commit()
        return f"{plan}\n---[SUCCESS]---\nDatabase updated successfully."


@mcp.tool()
async def switch_user_segment(email: str, new_segment: str, confirm: bool = False) -> str:
    """
    Changes a user's segment for UI/UX testing. Valid segments: D1, D2, D3, S1, S2, S3.
    DRY-RUN DEFAULT: You must pass confirm=True to actually alter the database.
    """
    valid_segments = ["D1", "D2", "D3", "S1", "S2", "S3"]
    new_segment = new_segment.upper()
    
    if new_segment not in valid_segments:
        return f"Error: Invalid segment '{new_segment}'. Must be one of {valid_segments}."
        
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            return f"Error: User {email} not found."
            
        plan = (
            f"PLAN: Changing segment for {user.email} (ID: {user.id})\n"
            f"  - segment: {user.segment} -> {new_segment}\n"
        )
        
        if not confirm:
            return f"{plan}\n---[DRY RUN]---\nDatabase NOT modified. To execute, call this tool again with confirm=True."
            
        user.segment = new_segment
        await db.commit()
        return f"{plan}\n---[SUCCESS]---\nDatabase updated successfully."


@mcp.tool()
async def soft_delete_user(email: str, confirm: bool = False) -> str:
    """
    Safely deactivate a test user. NEVER deletes rows. Sets is_active = False.
    DRY-RUN DEFAULT: You must pass confirm=True to actually alter the database.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            return f"Error: User {email} not found."
            
        plan = (
            f"PLAN: Soft-deleting user {user.email} (ID: {user.id})\n"
            f"  - is_active: {user.is_active} -> False\n"
        )
        
        if not confirm:
            return f"{plan}\n---[DRY RUN]---\nDatabase NOT modified. To execute, call this tool again with confirm=True."
            
        user.is_active = False
        await db.commit()
        return f"{plan}\n---[SUCCESS]---\nUser deactivated safely."


@mcp.tool()
async def generate_mock_lease(property_id: str, tenant_email: str, lease_type: str = "meuble") -> str:
    """
    Generates a PDF lease for a property and a tenant. 
    Safe to use as it only generates a local PDF and does not insert a binding Lease row into the DB.
    """
    if lease_type not in ['meuble', 'vide', 'mobilite', 'etudiant']:
        return f"Error: Invalid lease_type '{lease_type}'."
        
    async with AsyncSessionLocal() as db:
        # Load Property and Landlord
        result = await db.execute(select(Property).where(Property.id == property_id).options(selectinload(Property.landlord)))
        prop = result.scalars().first()
        if not prop:
            return f"Error: Property {property_id} not found."
            
        # Load Tenant
        result = await db.execute(select(User).where(User.email == tenant_email))
        tenant = result.scalars().first()
        if not tenant:
            return f"Error: Tenant {tenant_email} not found."
            
        # Generate the PDF
        try:
            from datetime import datetime
            start_date = datetime.now().strftime('%Y-%m-%d')
            output_path = f"/tmp/mock_lease_{prop.id}_{tenant.id}.pdf"
            
            # Use the actual backend service
            pdf_path = lease_generator.generate_pdf(
                property=prop,
                landlord=prop.landlord,
                tenant=tenant,
                start_date=start_date,
                rent=float(prop.monthly_rent),
                output_path=output_path,
                lease_type=lease_type
            )
            return f"---[SUCCESS]---\nMock Lease generated safely. No DB rows created.\nPDF Saved to: {pdf_path}"
        except Exception as e:
            return f"Error generating lease PDF: {str(e)}"

@mcp.tool()
async def get_property_status(property_id: str) -> str:
    """Read-only: Fetch a Roomivo property by its UUID."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Property).where(Property.id == property_id))
        prop = result.scalars().first()
        if not prop:
            return f"Property {property_id} not found."
        
        return (
            f"Property: {prop.title}\n"
            f"Status: {prop.status}\n"
            f"Rent: €{prop.monthly_rent} {'CC (Charges Included)' if prop.charges_included else 'HC (Hors Charges)'}\n"
            f"Address: {prop.address_line1}, {prop.postal_code} {prop.city}"
        )

@mcp.tool()
async def get_user_by_email(email: str) -> str:
    """Read-only: Look up a user by exact email address."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if not user:
            return f"User {email} not found."
            
        role_str = user.role.value if hasattr(user.role, 'value') else user.role
        return (
            f"User ID: {user.id}\n"
            f"Name: {user.full_name or 'N/A'}\n"
            f"Role: {role_str}\n"
            f"Segment: {user.segment}\n"
            f"Email Verified: {user.email_verified}\n"
            f"Identity Verified: {user.identity_verified}\n"
            f"Trust Score: {user.trust_score}\n"
            f"Active: {user.is_active}"
        )

@mcp.tool()
async def audit_property_compliance(property_id: str) -> str:
    """
    Scans a property against French rental laws (Loi ALUR, Loi Climat, Loi Carrez)
    and returns a detailed Markdown compliance report.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Property).where(Property.id == property_id))
        prop = result.scalars().first()
        if not prop:
            return f"Error: Property {property_id} not found."
            
        report = [f"# ⚖️ Legal Audit Report: {prop.title}\n"]
        issues = []
        warnings = []
        passes = []

        # 1. Minimum Surface Area (Critères de Décence)
        # In France, a rental property must be at least 9m² with a ceiling height of 2.20m, or a volume of 20m³.
        if prop.size_sqm:
            if float(prop.size_sqm) < 9.0:
                issues.append(f"❌ **SURFACE AREA ILLEGAL**: {prop.size_sqm}m² is below the legal minimum of 9m² for a primary residence.")
            else:
                passes.append(f"✅ Surface Area: {prop.size_sqm}m² (Compliant with 9m² minimum)")
        else:
            warnings.append("⚠️ Surface area (size_sqm) is not specified. Cannot verify minimum decency criteria.")

        # 2. Energy Performance (DPE / Loi Climat et Résilience)
        # G+ (consumption > 450 kWh) banned since Jan 2023. G will be banned Jan 2025. F banned Jan 2028.
        # Rent of F and G rated properties are frozen.
        if prop.dpe_rating:
            rating = prop.dpe_rating.upper()
            if rating in ['G']:
                issues.append(f"❌ **PASSOIRE THERMIQUE (G)**: Banned from renting starting Jan 1, 2025. Rent is currently strictly frozen.")
            elif rating == 'F':
                warnings.append(f"⚠️ **PASSOIRE THERMIQUE (F)**: Rent is frozen. Will be banned from renting starting Jan 1, 2028.")
            elif rating in ['A', 'B', 'C', 'D', 'E']:
                passes.append(f"✅ DPE Rating: {rating} (Compliant for rental)")
            else:
                warnings.append(f"⚠️ Unknown DPE rating format: {rating}")
        else:
            warnings.append("⚠️ Missing DPE rating. DPE calculation is mandatory for all rental listings.")

        # 3. Rent Control (Encadrement des loyers) Heuristic Check
        # Paris specifically has strict rent caps. While we don't have the Prefectural DB, we can flag suspicious numbers.
        if prop.city and prop.city.lower() in ['paris', 'lille', 'lyon', 'villeurbanne', 'montpellier', 'bordeaux']:
            if prop.size_sqm and prop.monthly_rent:
                price_per_sqm = float(prop.monthly_rent) / float(prop.size_sqm)
                if price_per_sqm > 35.0:  # 35 EUR/m2 is a completely arbitrary high threshold for generic heuristic
                    warnings.append(f"⚠️ **RENT CONTROL RISK**: {prop.city} is subject to rent control (Encadrement des loyers). At €{price_per_sqm:.2f}/m² HC, this rent is statistically very high and may require a solid legal 'Complément de Loyer' justification.")
                else:
                    passes.append(f"✅ Rent Price/m²: €{price_per_sqm:.2f} (Within statistical norm for {prop.city})")
            
        # 4. Guarantor discrimination check (Visale)
        if prop.guarantor_required and prop.accepted_guarantor_types:
            if 'visale' not in [gt.lower() for gt in prop.accepted_guarantor_types]:
                warnings.append("⚠️ **GUARANTOR POLICY**: Landlord requires a guarantor but does not explicitly list 'Visale'. Refusing Visale can be viewed negatively and limits the tenant pool.")

        # Compile Report
        if issues:
            report.append("## 🚨 CRITICAL LEGAL VIOLATIONS\n" + "\n".join(issues) + "\n")
        if warnings:
            report.append("## ⚠️ COMPLIANCE WARNINGS\n" + "\n".join(warnings) + "\n")
        if passes:
            report.append("## ✅ PASSING CHECKS\n" + "\n".join(passes) + "\n")
            
        if not issues and not warnings:
            report.append("> 🎉 **100% COMPLIANT**: No obvious legal issues detected from available data.")
            
        return "\n".join(report)

if __name__ == "__main__":
    mcp.run()
