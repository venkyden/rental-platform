"""
Employment Verification Service
Real implementation for French payslip (bulletin de paie) verification.
Uses AI for OCR and data extraction, with validation rules.
"""

import hashlib
import logging
import asyncio
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import BinaryIO, Optional, Dict, Any
from app.services.french_government_api import french_gov_service
from app.core.database import AsyncSessionLocal
from app.models.document import DocumentExtraction
from sqlalchemy import select

logger = logging.getLogger(__name__)

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

    async def verify_payslip(self, file_content: bytes, file_type: str, expected_name: str) -> dict:
        """Alias for verify_document to maintain backward compatibility with tests."""
        return await self.verify_document(file_content, file_type, expected_name, document_type="payslip")

    def _get_file_hash(self, file_content: bytes) -> str:
        """Generate a SHA-256 hash of the file content."""
        return hashlib.sha256(file_content).hexdigest()

    async def verify_document(
        self, file_content: bytes, file_type: str, expected_name: str, document_type: str = "payslip"
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
        file_hash = self._get_file_hash(file_content)
        cached_extraction = None

        # Try to get from cache
        async with AsyncSessionLocal() as session:
            stmt = select(DocumentExtraction).where(DocumentExtraction.file_hash == file_hash)
            result = await session.execute(stmt)
            db_extraction = result.scalar_one_or_none()
            
            if db_extraction:
                logger.info(f"OCR Cache Hit for hash {file_hash}")
                data = db_extraction.extraction_data
                cached_extraction = EmploymentData(
                    employer_name=data.get("employer_name", "Unknown"),
                    employee_name=data.get("employee_name", "Unknown"),
                    gross_salary=Decimal(str(data.get("gross_salary", 0))),
                    net_salary=Decimal(str(data.get("net_salary", 0))),
                    pay_period=data.get("pay_period", ""),
                    employment_type=data.get("employment_type", "Unknown"),
                    siret=data.get("siret"),
                    job_title=data.get("job_title"),
                    confidence_score=data.get("confidence_score", 1.0),
                )

        # Extract data using AI if not cached
        if cached_extraction:
            extracted_data = cached_extraction
        else:
            extracted_data = await self._extract_document_data(file_content, file_type, document_type)
            
            # Store in cache if successful
            if extracted_data:
                async with AsyncSessionLocal() as session:
                    new_extraction = DocumentExtraction(
                        file_hash=file_hash,
                        extraction_data={
                            "employer_name": extracted_data.employer_name,
                            "employee_name": extracted_data.employee_name,
                            "gross_salary": float(extracted_data.gross_salary),
                            "net_salary": float(extracted_data.net_salary),
                            "pay_period": extracted_data.pay_period,
                            "employment_type": extracted_data.employment_type,
                            "siret": extracted_data.siret,
                            "job_title": extracted_data.job_title,
                            "confidence_score": float(extracted_data.confidence_score),
                        }
                    )
                    session.add(new_extraction)
                    try:
                        await session.commit()
                    except Exception as e:
                        # Handle potential race condition or DB error
                        await session.rollback()
                        logger.warning(f"Failed to cache extraction: {e}")

        if not extracted_data:
            return {
                "verified": False,
                "status": "rejected",
                "data": None,
                "validation_checks": [],
                "rejection_reason": "Could not extract data from document",
            }

        # Run validation checks
        validation_results = self._validate_employment_data(
            extracted_data, expected_name, document_type
        )

        # SIRET Verification (Real-time check)
        siret_data = None
        if extracted_data.siret:
            siret_result = await french_gov_service.verify_siret(extracted_data.siret)
            if siret_result.get("valid"):
                siret_data = siret_result
                validation_results.append({
                    "name": "siret_api_verified",
                    "description": "Employer found in National Business Register",
                    "passed": True,
                    "critical": False,
                    "details": f"Verified: {siret_result['company_name']}"
                })
            else:
                validation_results.append({
                    "name": "siret_api_verified",
                    "description": "Employer verification in Register",
                    "passed": False,
                    "critical": False,
                    "details": siret_result.get("error", "SIRET not found")
                })

        # Determine overall status
        all_passed = all(check["passed"] for check in validation_results)
        critical_failed = any(
            not check["passed"] and check["critical"] for check in validation_results
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
                "siret_api_data": siret_data,
                "confidence_score": float(extracted_data.confidence_score),
            },
            "validation_checks": validation_results,
            "rejection_reason": (
                None if verified else self._get_rejection_reason(validation_results)
            ),
        }

    async def _extract_document_data(
        self, file_content: bytes, file_type: str, document_type: str
    ) -> Optional[EmploymentData]:
        """Extract data from document using AI OCR with retry and model fallback"""

        if not self.ai_client:
            # No AI client available — cannot extract data
            return None

        models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash"]
        max_retries = 2

        # Prepare image for Gemini Vision
        document_part = types.Part.from_bytes(
            data=file_content,
            mime_type=file_type,
        )

        prompt = f"""Analyze this document of type '{document_type}' and extract the following information in JSON format:

{{
    "employer_name": "Company/University/Organization name",
    "employee_name": "Person's full name",
    "gross_salary": 0.00,
    "net_salary": 0.00,
    "pay_period": "YYYY-MM or relevant period",
    "employment_type": "CDI/CDD/Student/Freelance/interim",
    "siret": "SIRET number if visible",
    "job_title": "Job title or academic program if visible",
    "is_rib": true or false,
    "confidence_score": 0.0 to 1.0
}}

Important Context:
- If this is a Relevé d'Identité Bancaire (RIB), set 'is_rib' to true.
- If this is a payslip, extract 'Salaire brut' (gross) and 'Net à payer' (net).
- If this is a student ID or enrollment certificate, 'net_salary' and 'gross_salary' should be 0.00, 'employment_type' should be 'Student', 'employer_name' should be the University.
- If this is a tax return or KBIS, extract relevant identifiers, incomes as salaried, and company names.
- If this is an institutional guarantee (Visale, Garantme), extract the guaranteed amount as 'net_salary', 'employer_name' as the institution, and 'employment_type' as 'Guarantor'.
- If this is a bank funds certificate, extract the total blocked funds as 'net_salary', 'employer_name' as the Bank.

Return ONLY the JSON, no explanation."""

        last_error = None
        for model_name in models_to_try:
            for attempt in range(max_retries + 1):
                try:
                    response = self.ai_client.models.generate_content(
                        model=model_name,
                        contents=[document_part, prompt],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                        ),
                    )

                    json_text = response.text
                    data = json.loads(json_text)

                    return EmploymentData(
                        employer_name=data.get("employer_name", "Unknown"),
                        employee_name=data.get("employee_name", "Unknown"),
                        gross_salary=Decimal(str(data.get("gross_salary") if data.get("gross_salary") is not None else 0)),
                        net_salary=Decimal(str(data.get("net_salary") if data.get("net_salary") is not None else 0)),
                        pay_period=data.get("pay_period", ""),
                        employment_type=data.get("employment_type", "Unknown"),
                        siret=data.get("siret"),
                        job_title=data.get("job_title"),
                        confidence_score=data.get("confidence_score", 0.5),
                    )

                except Exception as e:
                    last_error = e
                    error_str = str(e)
                    if "503" in error_str or "UNAVAILABLE" in error_str or "429" in error_str:
                        wait_time = (attempt + 1) * 2
                        logger.warning(f"Model {model_name} unavailable (attempt {attempt+1}/{max_retries+1}), retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    elif "404" in error_str or "NOT_FOUND" in error_str:
                        logger.warning(f"Model {model_name} not found, trying next model...")
                        break
                    else:
                        logger.error(f"AI extraction failed: {e}", exc_info=True)
                        return None

        logger.error(f"All AI models failed for employment extraction. Last error: {last_error}")
        return None

    def _validate_employment_data(
        self, data: EmploymentData, expected_name: str, document_type: str = "payslip"
    ) -> list:
        """Run validation checks on extracted data"""

        checks = []

        # 1. Name match check (CRITICAL)
        name_match = self._fuzzy_name_match(data.employee_name, expected_name)
        checks.append(
            {
                "name": "name_match",
                "description": "Employee name matches account",
                "passed": name_match > 0.5,
                "critical": True,
                "details": f"Document: {data.employee_name} | Account: {expected_name} | Match: {name_match:.0%}",
            }
        )

        # 1b. RIB check (CRITICAL - Illegal to collect in dossier stage)
        is_rib = getattr(data, "is_rib", False)
        checks.append(
            {
                "name": "unauthorized_document",
                "description": "Document type is allowed for dossier stage",
                "passed": not is_rib,
                "critical": True,
                "details": "RIB (Bank Account details) are not allowed at this stage in France." if is_rib else "Document type is allowed.",
            }
        )

        is_non_salaried = document_type in (
            "student_id", "kbis", "urssaf", "scholarship", 
            "tax_return", "foreign_tax_return", "contract", "internship_contract",
            "caf", "benefits", "pension", "accounting", "bank_funds_certificate",
            "visale_certificate", "garantme_certificate", "employer_certificate",
            "professional_card", "bank_statement"
        )

        # 2. Salary sanity check
        if is_non_salaried:
            salary_valid = True
        else:
            salary_valid = data.net_salary > 0 and data.net_salary < 100000
            
        checks.append(
            {
                "name": "salary_valid",
                "description": "Salary within reasonable range or not applicable",
                "passed": salary_valid,
                "critical": False,
                "details": f"Net salary: €{data.net_salary}",
            }
        )

        # 3. Recent payslip check
        if is_non_salaried:
            pay_period_recent = True
        else:
            pay_period_recent = self._is_recent_payslip(data.pay_period)
            
        checks.append(
            {
                "name": "recent_document",
                "description": "Payslip from last 3 months or not applicable",
                "passed": pay_period_recent,
                "critical": not is_non_salaried,
                "details": f"Pay period: {data.pay_period}",
            }
        )

        # 4. Employment type check
        if is_non_salaried:
            stable_employment = True
        else:
            stable_employment = data.employment_type.upper() in ["CDI", "FONCTIONNAIRE"]
            
        checks.append(
            {
                "name": "stable_employment",
                "description": "Stable employment type (CDI) or not applicable",
                "passed": stable_employment,
                "critical": False,
                "details": f"Type: {data.employment_type}",
            }
        )

        # 5. Confidence score check
        high_confidence = data.confidence_score >= 0.7
        checks.append(
            {
                "name": "extraction_confidence",
                "description": "High extraction confidence",
                "passed": high_confidence,
                "critical": False,
                "details": f"Confidence: {data.confidence_score:.0%}",
            }
        )

        # 6. SIRET validation (if provided)
        if data.siret:
            siret_valid = self._validate_siret(data.siret)
            checks.append(
                {
                    "name": "siret_valid",
                    "description": "Valid SIRET number",
                    "passed": siret_valid,
                    "critical": False,
                    "details": f"SIRET: {data.siret}",
                }
            )

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
            months_ago = (datetime.now().year - payslip_date.year) * 12 + (
                datetime.now().month - payslip_date.month
            )
            return 0 <= months_ago <= 3
        except:
            return False

    def _validate_siret(self, siret: str) -> bool:
        """Validate French SIRET number (14 digits with Luhn check)"""
        siret = re.sub(r"\s", "", siret)

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
            return (
                failed_critical[0]["description"]
                + " - "
                + failed_critical[0]["details"]
            )

        failed = [c for c in checks if not c["passed"]]
        if failed:
            return "Manual review required: " + ", ".join(c["name"] for c in failed)

        return "Unknown error"

    def calculate_income_ratio(
        self, net_salary: Decimal, monthly_rent: Decimal
    ) -> dict:
        """
        Calculate rent-to-income ratio for French rental applications.
        French standard: rent should be max 33% of net income.
        """
        if net_salary <= 0:
            return {
                "ratio": 0,
                "meets_standard": False,
                "recommendation": "Income verification required",
            }

        ratio = float(monthly_rent / net_salary)
        meets_standard = ratio <= 0.33

        return {
            "ratio": round(ratio, 2),
            "percentage": f"{ratio * 100:.0f}%",
            "meets_standard": meets_standard,
            "french_standard": "33%",
            "recommendation": (
                "Meets French rental standard"
                if meets_standard
                else "Exceeds recommended 33% ratio"
            ),
        }


# Global instance
employment_service = EmploymentVerificationService()
