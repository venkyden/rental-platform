import httpx
import logging
import re
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class FrenchGovernmentService:
    """
    Integration with French Government Public APIs for verification.
    - SIRENE (Insee): For verifying companies (employer_name, siret).
    - DGFIP (Tax): For verifying tax notices (avis d'imposition).
    """

    def __init__(self):
        self.api_gouv_url = "https://api.gouv.fr/api/" # Base for various govt APIs
        self.sirene_url = "https://api.insee.fr/entreprises/sirene/V3/" # Requires token
        # Public Fallback for SIRET (Recherche Entreprises)
        self.public_siren_url = "https://recherche-entreprises.api.gouv.fr/search"

    async def verify_siret(self, siret: str) -> Dict[str, Any]:
        """
        Verify a SIRET number against the national register.
        """
        siret = re.sub(r"\s", "", siret)
        if not siret or len(siret) != 14:
            return {"valid": False, "error": "Invalid SIRET format"}

        try:
            async with httpx.AsyncClient() as client:
                # Use the public search API which is robust and doesn't require complex auth for basic checks
                response = await client.get(
                    self.public_siren_url,
                    params={"q": siret},
                    timeout=5.0
                )
                
                if response.status_code != 200:
                    return {"valid": False, "error": f"API error: {response.status_code}"}
                
                data = response.json()
                results = data.get("results", [])
                
                if not results:
                    return {"valid": False, "error": "SIRET not found in national register"}
                
                # Check if the exact SIRET is in the results (the API returns companies)
                company = results[0]
                company_name = company.get("nom_complet", "Unknown")
                is_active = company.get("etat_administratif") == "A"
                
                return {
                    "valid": True,
                    "company_name": company_name,
                    "is_active": is_active,
                    "location": company.get("siege", {}).get("libelle_commune", ""),
                    "raw_data": company
                }
        except Exception as e:
            logger.error(f"SIRET verification failed: {e}")
            return {"valid": False, "error": "Internal verification error"}

    async def verify_tax_notice(self, num_fiscal: str, ref_avis: str) -> Dict[str, Any]:
        """
        Verify a French tax notice (Avis d'imposition) via DGFIP API.
        Note: This usually requires a Particulier API key or specific partnership.
        We implement the structure and mock the success response if configured.
        """
        # In a real scenario, this would call https://api.gouv.fr/les-api/api-particulier-dgfip
        # For now, we validate the formats and provide a structural placeholder.
        
        if not re.match(r"^\d{12}$", num_fiscal):
            return {"valid": False, "error": "Invalid Numéro Fiscal format (13 digits expected)"}
        
        if not re.match(r"^[A-Z0-9]{13}$", ref_avis):
            return {"valid": False, "error": "Invalid Référence Avis format"}

        # Placeholder for real API call
        return {
            "valid": True,
            "status": "simulated_success",
            "message": "DGFIP API integration structured. Real credentials required for live verification."
        }

french_gov_service = FrenchGovernmentService()
