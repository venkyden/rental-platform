import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class CrossVerificationService:
    """
    Stress-tests the verification pipeline by cross-referencing multiple data sources.
    Goal: Identify fraud and inconsistencies across different uploaded documents.
    """

    def perform_cross_reference(
        self, 
        identity_data: Dict[str, Any], 
        employment_data: List[Dict[str, Any]], 
        user_profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Cross-references identity and employment data.
        """
        checks = []
        is_consistent = True

        # 1. Name Consistency (Identity vs Employment)
        id_name = identity_data.get("full_name", "").lower()
        
        for idx, emp in enumerate(employment_data):
            emp_name = emp.get("employee_name", "").lower()
            match_score = self._fuzzy_match(id_name, emp_name)
            
            checks.append({
                "source": f"Employment Doc {idx+1}",
                "target": "Identity Document",
                "check": "Name Matching",
                "passed": match_score > 0.6,
                "score": match_score,
                "details": f"ID Name: {id_name} | Doc Name: {emp_name}"
            })
            if match_score <= 0.6:
                is_consistent = False

        # 2. Seniority vs Age Sanity Check
        # If we have identity birth date (not always extracted) or account age
        # This is a placeholder for more complex logic

        # 3. Income Consistency (Across multiple payslips)
        if len(employment_data) > 1:
            salaries = [float(emp.get("net_salary", 0)) for emp in employment_data]
            avg_salary = sum(salaries) / len(salaries)
            
            # Check for high variance (>20% difference)
            variance_flags = []
            for s in salaries:
                if avg_salary > 0 and abs(s - avg_salary) / avg_salary > 0.2:
                    variance_flags.append(s)
            
            checks.append({
                "source": "Multiple Payslips",
                "check": "Income Stability",
                "passed": len(variance_flags) == 0,
                "details": f"Salary variance detected: {variance_flags}" if variance_flags else "Stable income across documents"
            })

        return {
            "is_consistent": is_consistent,
            "status": "verified" if is_consistent else "flagged",
            "cross_checks": checks,
            "summary": "Full document cross-referencing complete. " + 
                       ("No anomalies found." if is_consistent else "Anomalies detected in cross-document matching.")
        }

    def _fuzzy_match(self, s1: str, s2: str) -> float:
        if not s1 or not s2: return 0.0
        set1 = set(s1.split())
        set2 = set(s2.split())
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0

cross_verification_service = CrossVerificationService()
