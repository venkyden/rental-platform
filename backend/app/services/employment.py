"""
Employment Verification Service
Real implementation for French payslip (bulletin de paie) verification.
Uses AI for OCR and data extraction, with validation rules.
"""
import os
import re
from typing import Optional, BinaryIO
from datetime import datetime, date
from dataclasses import dataclass
from decimal import Decimal
import json

# Optional AI imports
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    GEMINI_AVAILABLE = False


@dataclass
class EmploymentData:
    """Extracted employment data from documents"""
    employer_name: str
    employee_name: str
    gross_salary: Decimal
    net_salary: Decimal
    pay_period: str  # "2026-01" format
    employment_type: str  # "CDI", "CDD", "interim"
    siret: Optional[str] = None
    job_title: Optional[str] = None
    start_date: Optional[date] = None
    confidence_score: float = 0.0
    raw_text: Optional[str] = None


class EmploymentVerificationService:
    """
    Employment verification service for French rental applications.
    
    Supports:
    - French payslips (bulletin de paie)
    - Employment contracts (contrat de travail)
    - Tax returns (avis d'imposition)
    
    Uses Claude AI for OCR and data extraction.
    """
    
    def __init__(self):
        self.ai_client = None
        
        from app.core.config import settings
        if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
            self.ai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    async def verify_payslip(
        self,
        file_content: bytes,
        file_type: str,
        expected_name: str
    ) -> dict:
        """
        Verify French payslip (bulletin de paie).
        
        Returns:
            {
                "verified": bool,
                "status": "verified" | "pending_review" | "rejected",
                "data": EmploymentData,
                "validation_checks": [...],
                "rejection_reason": Optional[str]
            }
        """
        # Extract data using AI
        extracted_data = await self._extract_payslip_data(file_content, file_type)
        
        if not extracted_data:
            return {
                "verified": False,
                "status": "rejected",
                "data": None,
                "validation_checks": [],
                "rejection_reason": "Could not extract data from document"
            }
        
        # Run validation checks
        validation_results = self._validate_employment_data(extracted_data, expected_name)
        
        # Determine overall status
        all_passed = all(check["passed"] for check in validation_results)
        critical_failed = any(
            not check["passed"] and check["critical"] 
            for check in validation_results
        )
        
        if critical_failed:
            status = "rejected"
            verified = False
        elif all_passed:
            status = "verified"
            verified = True
        else:
            status = "pending_review"
            verified = False
        
        return {
            "verified": verified,
            "status": status,
            "data": {
                "employer": extracted_data.employer_name,
                "employee_name": extracted_data.employee_name,
                "net_salary": float(extracted_data.net_salary),
                "gross_salary": float(extracted_data.gross_salary),
                "employment_type": extracted_data.employment_type,
                "pay_period": extracted_data.pay_period,
                "job_title": extracted_data.job_title,
                "siret": extracted_data.siret,
                "confidence_score": extracted_data.confidence_score,
            },
            "validation_checks": validation_results,
            "rejection_reason": None if verified else self._get_rejection_reason(validation_results)
        }
    
    async def _extract_payslip_data(
        self,
        file_content: bytes,
        file_type: str
    ) -> Optional[EmploymentData]:
        """Extract data from payslip using AI OCR"""
        
        if not self.ai_client:
            # No AI client available — cannot extract data
            return None
        
        try:
            # Prepare image for Gemini Vision
            document_part = types.Part.from_bytes(
                data=file_content,
                mime_type=file_type,
            )
            
            prompt = """Analyze this French payslip (bulletin de paie) and extract the following information in JSON format:

{
    "employer_name": "Company name",
    "employee_name": "Employee full name",
    "gross_salary": 0.00,
    "net_salary": 0.00,
    "pay_period": "YYYY-MM",
    "employment_type": "CDI/CDD/Interim",
    "siret": "SIRET number if visible",
    "job_title": "Job title if visible",
    "confidence_score": 0.0 to 1.0
}

Important French payslip terms:
- "Salaire brut" = gross salary
- "Net à payer" or "Net imposable" = net salary
- "Période" = pay period
- "Employeur" = employer
- "SIRET" = company registration number

Return ONLY the JSON, no explanation."""

            # Generate structured JSON using Gemini 1.5 Flash
            response = self.ai_client.models.generate_content(
                model='gemini-1.5-flash',
                contents=[
                    document_part,
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            
            # Parse response
            json_text = response.text
            data = json.loads(json_text)
            
            return EmploymentData(
                employer_name=data.get("employer_name", "Unknown"),
                employee_name=data.get("employee_name", "Unknown"),
                gross_salary=Decimal(str(data.get("gross_salary", 0))),
                net_salary=Decimal(str(data.get("net_salary", 0))),
                pay_period=data.get("pay_period", ""),
                employment_type=data.get("employment_type", "Unknown"),
                siret=data.get("siret"),
                job_title=data.get("job_title"),
                confidence_score=data.get("confidence_score", 0.5),
            )
            
        except Exception as e:
            print(f"AI extraction failed: {e}")
            return None
    

    def _validate_employment_data(
        self,
        data: EmploymentData,
        expected_name: str
    ) -> list:
        """Run validation checks on extracted data"""
        
        checks = []
        
        # 1. Name match check (critical)
        name_match = self._fuzzy_name_match(data.employee_name, expected_name)
        checks.append({
            "name": "name_match",
            "description": "Employee name matches account",
            "passed": name_match > 0.8,
            "critical": True,
            "details": f"Match score: {name_match:.0%}"
        })
        
        # 2. Salary sanity check
        salary_valid = data.net_salary > 0 and data.net_salary < 100000
        checks.append({
            "name": "salary_valid",
            "description": "Salary within reasonable range",
            "passed": salary_valid,
            "critical": False,
            "details": f"Net salary: €{data.net_salary}"
        })
        
        # 3. Recent payslip check
        pay_period_recent = self._is_recent_payslip(data.pay_period)
        checks.append({
            "name": "recent_document",
            "description": "Payslip from last 3 months",
            "passed": pay_period_recent,
            "critical": True,
            "details": f"Pay period: {data.pay_period}"
        })
        
        # 4. Employment type check
        stable_employment = data.employment_type.upper() in ["CDI", "FONCTIONNAIRE"]
        checks.append({
            "name": "stable_employment",
            "description": "Stable employment type (CDI)",
            "passed": stable_employment,
            "critical": False,
            "details": f"Type: {data.employment_type}"
        })
        
        # 5. Confidence score check
        high_confidence = data.confidence_score >= 0.7
        checks.append({
            "name": "extraction_confidence",
            "description": "High extraction confidence",
            "passed": high_confidence,
            "critical": False,
            "details": f"Confidence: {data.confidence_score:.0%}"
        })
        
        # 6. SIRET validation (if provided)
        if data.siret:
            siret_valid = self._validate_siret(data.siret)
            checks.append({
                "name": "siret_valid",
                "description": "Valid SIRET number",
                "passed": siret_valid,
                "critical": False,
                "details": f"SIRET: {data.siret}"
            })
        
        return checks
    
    def _fuzzy_name_match(self, name1: str, name2: str) -> float:
        """Calculate fuzzy match score between two names"""
        # Normalize names
        n1 = set(name1.lower().split())
        n2 = set(name2.lower().split())
        
        if not n1 or not n2:
            return 0.0
        
        # Jaccard similarity
        intersection = len(n1 & n2)
        union = len(n1 | n2)
        
        return intersection / union if union > 0 else 0.0
    
    def _is_recent_payslip(self, pay_period: str) -> bool:
        """Check if payslip is from last 3 months"""
        try:
            payslip_date = datetime.strptime(pay_period, "%Y-%m")
            months_ago = (datetime.now().year - payslip_date.year) * 12 + \
                        (datetime.now().month - payslip_date.month)
            return 0 <= months_ago <= 3
        except:
            return False
    
    def _validate_siret(self, siret: str) -> bool:
        """Validate French SIRET number (14 digits with Luhn check)"""
        siret = re.sub(r'\s', '', siret)
        
        if not siret.isdigit() or len(siret) != 14:
            return False
        
        # Luhn algorithm for SIRET
        total = 0
        for i, digit in enumerate(siret):
            d = int(digit)
            if i % 2 == 1:
                d *= 2
                if d > 9:
                    d -= 9
            total += d
        
        return total % 10 == 0
    
    def _get_rejection_reason(self, checks: list) -> str:
        """Get human-readable rejection reason"""
        failed_critical = [c for c in checks if not c["passed"] and c["critical"]]
        if failed_critical:
            return failed_critical[0]["description"] + " - " + failed_critical[0]["details"]
        
        failed = [c for c in checks if not c["passed"]]
        if failed:
            return "Manual review required: " + ", ".join(c["name"] for c in failed)
        
        return "Unknown error"
    
    def calculate_income_ratio(self, net_salary: Decimal, monthly_rent: Decimal) -> dict:
        """
        Calculate rent-to-income ratio for French rental applications.
        French standard: rent should be max 33% of net income.
        """
        if net_salary <= 0:
            return {"ratio": 0, "meets_standard": False, "recommendation": "Income verification required"}
        
        ratio = float(monthly_rent / net_salary)
        meets_standard = ratio <= 0.33
        
        return {
            "ratio": round(ratio, 2),
            "percentage": f"{ratio * 100:.0f}%",
            "meets_standard": meets_standard,
            "french_standard": "33%",
            "recommendation": "Meets French rental standard" if meets_standard else "Exceeds recommended 33% ratio"
        }


# Global instance
employment_service = EmploymentVerificationService()
