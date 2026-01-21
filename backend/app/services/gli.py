"""
GLI (Garantie Loyers Impayés) - Rent Guarantee Insurance Service.
Provides one-click insurance quotes for landlords.
"""
from typing import Dict, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel


class TenantProfile(BaseModel):
    """Tenant information for GLI eligibility check"""
    monthly_income: float
    employment_type: str  # 'cdi', 'cdd', 'freelance', 'retired', 'student'
    employment_verified: bool = False
    identity_verified: bool = False


class GLIQuote(BaseModel):
    """GLI insurance quote"""
    eligible: bool
    monthly_premium: Optional[float] = None
    annual_premium: Optional[float] = None
    coverage_amount: Optional[float] = None  # Max coverage per year
    coverage_months: int = 12  # Months of unpaid rent covered
    premium_rate: Optional[float] = None  # Percentage of monthly rent
    eligibility_reason: Optional[str] = None
    quote_valid_until: Optional[date] = None


class GLIService:
    """
    Rent Guarantee Insurance quote generator.
    Simulates GLI providers like Visale, Garantme, SmartGarant.
    """
    
    # Premium rates by employment type (% of monthly rent)
    PREMIUM_RATES = {
        'cdi': 2.5,         # Permanent contract - lowest risk
        'cdd': 3.5,         # Fixed-term contract
        'freelance': 4.0,   # Self-employed
        'retired': 2.8,     # Retirees - stable income
        'student': 3.0,     # Students (often with guarantor)
    }
    
    # Minimum income-to-rent ratio required
    MIN_INCOME_RATIO = 3.0  # Tenant must earn 3x the rent
    
    # Maximum rent covered (monthly)
    MAX_RENT_COVERED = 2500.0

    def check_eligibility(
        self,
        monthly_rent: float,
        tenant: TenantProfile
    ) -> tuple[bool, str]:
        """
        Check if tenant is eligible for GLI.
        
        Returns:
            (eligible, reason)
        """
        # Check income ratio
        income_ratio = tenant.monthly_income / monthly_rent if monthly_rent > 0 else 0
        
        if income_ratio < self.MIN_INCOME_RATIO:
            return False, f"Revenu insuffisant. Ratio actuel: {income_ratio:.1f}x (minimum: {self.MIN_INCOME_RATIO}x)"
        
        # Check rent cap
        if monthly_rent > self.MAX_RENT_COVERED:
            return False, f"Loyer trop élevé. Maximum couvert: {self.MAX_RENT_COVERED}€/mois"
        
        # Employment type restrictions
        if tenant.employment_type not in self.PREMIUM_RATES:
            return False, f"Type d'emploi non éligible: {tenant.employment_type}"
        
        # Verification bonus (not required but affects quote)
        if not tenant.employment_verified and tenant.employment_type in ['cdi', 'cdd']:
            return True, "Éligible sous réserve de vérification d'emploi"
        
        return True, "Éligible"

    def calculate_premium(
        self,
        monthly_rent: float, 
        tenant: TenantProfile
    ) -> Dict:
        """
        Calculate GLI premium based on rent and tenant profile.
        
        Returns premium details or None if not eligible.
        """
        eligible, reason = self.check_eligibility(monthly_rent, tenant)
        
        if not eligible:
            return {
                "eligible": False,
                "eligibility_reason": reason
            }
        
        # Get base rate for employment type
        base_rate = self.PREMIUM_RATES.get(tenant.employment_type, 4.0)
        
        # Adjust rate based on verification status
        if tenant.employment_verified:
            base_rate -= 0.3  # Discount for verified employment
        if tenant.identity_verified:
            base_rate -= 0.2  # Discount for verified identity
        
        # Calculate premiums
        monthly_premium = monthly_rent * (base_rate / 100)
        annual_premium = monthly_premium * 12
        
        # Coverage: 12 months of rent + legal fees
        coverage_amount = monthly_rent * 12
        
        return {
            "eligible": True,
            "monthly_premium": round(monthly_premium, 2),
            "annual_premium": round(annual_premium, 2),
            "coverage_amount": round(coverage_amount, 2),
            "coverage_months": 12,
            "premium_rate": round(base_rate, 2),
            "eligibility_reason": reason,
            "quote_valid_until": date.today() + timedelta(days=30)  # 30 days validity
        }

    def generate_quote(
        self,
        monthly_rent: float,
        tenant: TenantProfile,
        property_id: Optional[str] = None
    ) -> GLIQuote:
        """
        Generate a complete GLI quote.
        """
        result = self.calculate_premium(monthly_rent, tenant)
        
        return GLIQuote(
            eligible=result["eligible"],
            monthly_premium=result.get("monthly_premium"),
            annual_premium=result.get("annual_premium"),
            coverage_amount=result.get("coverage_amount"),
            coverage_months=result.get("coverage_months", 12),
            premium_rate=result.get("premium_rate"),
            eligibility_reason=result.get("eligibility_reason"),
            quote_valid_until=result.get("quote_valid_until")
        )


# Singleton instance
gli_service = GLIService()
