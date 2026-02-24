from datetime import datetime, timedelta
from typing import Any, Dict, Optional


class GLIService:
    """
    Service to handle Rent Guarantee Insurance (Garantie Loyers Impayés)
    logic, eligibility, and quotes.
    """

    PREMIUM_RATE = 0.025  # 2.5% of rent
    MIN_COVERAGE_MONTHS = 12
    QUOTE_VALIDITY_DAYS = 30

    def calculate_quote(
        self,
        monthly_rent: float,
        tenant_income: float,
        employment_type: str,
        employment_verified: bool,
        identity_verified: bool,
    ) -> Dict[str, Any]:
        """
        Calculate GLI eligibility and premium quote.
        """

        # 1. Eligibility Check
        is_eligible = True
        reasons = []

        # Rule 1: Solvency Ratio (33%, or Income >= 3x Rent)
        if tenant_income < (monthly_rent * 3):
            is_eligible = False
            reasons.append(
                f"Solvency ratio too low. Tenant income ({tenant_income}€) must be at least 3x rent ({monthly_rent}€)."
            )

        # Rule 2: Employment Type Risk
        high_risk_contracts = ["student", "freelance", "cdd"]
        if employment_type in high_risk_contracts:
            # Stricter rules or exclusions could apply, but for now we just flag it
            # Maybe require guarantor if student? For GLI usually it covers if tenant is soluble.
            # Some GLI exclude students or require 4x income for freelancers.
            # Let's keep it simple: Eligible if 3x, but warn.
            pass

        # Rule 3: Verification (Optional for quote, mandatory for subscription)
        # We don't block quote if not verified, but we warn.

        if not is_eligible:
            return {
                "eligible": False,
                "eligibility_reason": " ".join(reasons),
                "monthly_premium": None,
                "annual_premium": None,
                "premium_rate": self.PREMIUM_RATE * 100,
            }

        # 2. Quote Calculation
        monthly_premium = monthly_rent * self.PREMIUM_RATE
        annual_premium = monthly_premium * 12

        valid_until = (
            datetime.now() + timedelta(days=self.QUOTE_VALIDITY_DAYS)
        ).strftime("%d/%m/%Y")

        return {
            "eligible": True,
            "monthly_premium": round(monthly_premium, 2),
            "annual_premium": round(annual_premium, 2),
            "premium_rate": self.PREMIUM_RATE * 100,
            "coverage_amount": monthly_rent * 24,  # Covers up to 24 months usually
            "coverage_months": 24,
            "quote_valid_until": valid_until,
            "conditions": [
                "Tenant must provide proof of income before policy activation.",
                "First month premium due upon signing.",
            ],
        }


gli_service = GLIService()
