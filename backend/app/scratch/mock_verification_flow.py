import asyncio
import sys
import os
from decimal import Decimal

# Add the parent directory to sys.path to allow imports from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app.services.identity import identity_service, IdentityData
from app.services.employment import employment_service, EmploymentData
from app.services.cross_verification import cross_verification_service
from app.services.french_government_api import french_gov_service

async def mock_verification_flow():
    print("🚀 Starting Mock Verification Flow...")
    print("-" * 50)

    # 1. Mock Identity Verification Result (Simulated Gemini Output)
    print("Step 1: Mocking Identity Verification (CNI)...")
    mock_id_data = IdentityData(
        full_name="Jean-Marc DUPONT",
        document_number="230175100123",
        expiry_date="2032-12-31",
        document_type="id_card",
        has_face_photo=True,
        is_identity_document=True,
        confidence_score=0.98
    )
    
    # Simulate the service return structure
    id_result = {
        "verified": True,
        "status": "verified",
        "data": {
            "full_name": mock_id_data.full_name,
            "document_number": mock_id_data.document_number,
            "expiry_date": mock_id_data.expiry_date,
            "document_type": mock_id_data.document_type
        }
    }
    print(f"✅ Identity Verified: {id_result['data']['full_name']}")

    # 2. Mock Employment Verification Result (Simulated Gemini Output)
    print("\nStep 2: Mocking Employment Verification (Payslip)...")
    mock_emp_data = EmploymentData(
        employer_name="GOOGLE FRANCE",
        employee_name="Jean-Marc DUPONT",
        gross_salary=Decimal("5000.00"),
        net_salary=Decimal("3850.50"),
        pay_period="2026-04",
        employment_type="CDI",
        siret="44306184100047", # Real Google France SIRET for a better test
        job_title="Software Engineer",
        confidence_score=0.95
    )

    # 3. Real-time SIRET Verification (Calling the actual API I just implemented)
    print(f"🔍 Verifying SIRET {mock_emp_data.siret} against National Register...")
    try:
        siret_result = await french_gov_service.verify_siret(mock_emp_data.siret)
    except:
        siret_result = {"valid": False, "error": "Network unavailable"}
    
    if siret_result.get("valid"):
        print(f"✅ SIRET Verified! Company: {siret_result['company_name']} (Status: {siret_result['is_active']})")
    else:
        print(f"⚠️ SIRET API Offline/Unavailable. Simulating SUCCESS for demonstration...")
        siret_result = {
            "valid": True,
            "company_name": "GOOGLE FRANCE",
            "is_active": True,
            "location": "PARIS",
            "source": "SIMULATED_RECOVERY"
        }
        print(f"✅ [SIMULATED] SIRET Verified! Company: {siret_result['company_name']}")

    emp_result = {
        "verified": True,
        "status": "verified",
        "data": {
            "employer": mock_emp_data.employer_name,
            "employee_name": mock_emp_data.employee_name,
            "net_salary": float(mock_emp_data.net_salary),
            "siret": mock_emp_data.siret,
            "siret_api_data": siret_result
        }
    }

    # 4. Cross-Verification Stress Test
    print("\nStep 3: Performing Cross-Verification Stress Test...")
    cross_result = cross_verification_service.perform_cross_reference(
        identity_data=id_result["data"],
        employment_data=[emp_result["data"]],
        user_profile={"name": "Jean-Marc Dupont"}
    )

    print(f"Overall Status: {cross_result['status'].upper()}")
    print(f"Summary: {cross_result['summary']}")
    
    for check in cross_result["cross_checks"]:
        status_icon = "✅" if check["passed"] else "❌"
        print(f" {status_icon} [{check['check']}] {check['source']} -> {check['target']}: {check.get('details', '')}")

    print("-" * 50)
    print("🎯 Verification Flow Simulation Complete.")

if __name__ == "__main__":
    asyncio.run(mock_verification_flow())
