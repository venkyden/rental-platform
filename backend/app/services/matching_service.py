"""
Matching Service.
Calculates compatibility scores between Tenants and Properties.
Implements "Soft Scoring" logic (Weighted Preferences) as per Differentiation Strategy.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from decimal import Decimal

from app.models.property import Property
from app.models.user import User


class MatchingService:
    """
    Service to calculate match scores (0-100%) between tenants and properties.
    """

    def calculate_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate distance between two GPS coordinates in meters (Haversine formula)"""
        from math import asin, cos, radians, sin, sqrt

        # Convert to float and radians
        lat1, lon1, lat2, lon2 = map(
            lambda x: radians(float(x)), [lat1, lon1, lat2, lon2]
        )

        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * asin(sqrt(a))
        r = 6371000  # Earth radius in meters

        return c * r

    def calculate_match_details(self, tenant: User, property: Property) -> dict:
        """
        Calculate detailed match score breakdown.
        Weights (Total 100 points):
        - Affordability: 30
        - Location: 20
        - Tenant Type: 20
        - CAF Match: 10
        - Guarantor Match: 10
        - Timing: 10
        - Bonuses (Amenities, Surface Area): Extra points clamped to 100
        """
        score = 0.0
        breakdown = {}
        all_prefs = tenant.preferences or {}
        
        # Use role-specific key if it exists, otherwise fallback to flat for backward compatibility
        if isinstance(all_prefs, dict):
            prefs = all_prefs.get("tenant", all_prefs)
        else:
            prefs = {}

        # 1. Tenant Preference / Identity (20 points)
        accepted_types = property.accepted_tenant_types or []
        tenant_type = self._map_situation_to_type(prefs)

        if not accepted_types:
            score += 20
            breakdown["preference"] = "perfect"
        elif tenant_type in accepted_types:
            score += 20
            breakdown["preference"] = "perfect"
        else:
            # Check for partial matches or fallback
            score += 5
            breakdown["preference"] = "partial"

        # 2. Affordability (30 points)
        tenant_budget = float(prefs.get("budget") or 0)
        # Total rent calculation
        if getattr(property, "charges_included", False):
            rent = float(property.monthly_rent or 0)
        else:
            rent = float(property.monthly_rent or 0) + float(property.charges or 0)

        if tenant_budget > 0:
            if rent <= tenant_budget:
                score += 30
                breakdown["affordability"] = "great"
            elif rent <= tenant_budget * 1.15:
                score += 15
                breakdown["affordability"] = "stretch"
            elif rent <= tenant_budget * 1.3:
                score += 5
                breakdown["affordability"] = "expensive"
            else:
                score += 0
                breakdown["affordability"] = "impossible"
        else:
            # No budget set? Default score
            score += 15
            breakdown["affordability"] = "unknown"

        # 3. Location (20 points)
        location_preference = prefs.get("location_preference")
        location_match = False

        if (
            location_preference
            and isinstance(location_preference, dict)
            and property.latitude
            and property.longitude
        ):
            target_lat = location_preference.get("lat")
            target_lng = location_preference.get("lng")
            raw_radius = location_preference.get("radius", 5000)
            radius = min(int(raw_radius), 50000)

            if target_lat and target_lng:
                distance = self.calculate_distance(
                    target_lat, target_lng, property.latitude, property.longitude
                )

                if distance <= radius:
                    score += 20
                    breakdown["location"] = "exact_geo"
                    location_match = True
                elif distance <= radius * 1.5:
                    score += 12
                    breakdown["location"] = "nearby_geo"
                    location_match = True

        if not location_match:
            # Text-based fallback
            wanted_location = str(prefs.get("location") or "").lower()
            prop_city = (property.city or "").lower()
            
            if wanted_location and wanted_location in prop_city:
                score += 15
                breakdown["location"] = "exact_city"
            else:
                score += 0
                breakdown["location"] = "miss"

        # 4. CAF Eligibility Match (10 points)
        # Tenant preference: 'yes', 'no'
        tenant_caf_pref = prefs.get("caf_preference")
        prop_caf_eligible = getattr(property, "caf_eligible", False)

        if tenant_caf_pref == "yes":
            if prop_caf_eligible:
                score += 10
                breakdown["caf"] = "match"
            else:
                # Penalty for not being eligible when user wants it
                score -= 5
                breakdown["caf"] = "mismatch"
        elif tenant_caf_pref == "no":
            if not prop_caf_eligible:
                score += 5  # Small boost for matching "no" preference
                breakdown["caf"] = "match_no"
            else:
                breakdown["caf"] = "neutral"
        else:
            # If not specified, neutral or slight boost if property is eligible (added value)
            if prop_caf_eligible:
                score += 5
            breakdown["caf"] = "not_specified"

        # 5. Guarantor Match (10 points)
        # Check tenant's guarantor types against property accepted types
        tenant_guarantors = prefs.get("accepted_guarantees") or []
        if not isinstance(tenant_guarantors, list):
            tenant_guarantors = []
            
        prop_guarantors = property.accepted_guarantor_types or []
        prop_guarantor_required = getattr(property, "guarantor_required", False)

        if not prop_guarantor_required:
            score += 10
            breakdown["guarantor"] = "not_required"
        elif any(g in prop_guarantors for g in tenant_guarantors):
            score += 10
            breakdown["guarantor"] = "match"
        elif not tenant_guarantors:
            score += 0
            breakdown["guarantor"] = "missing_tenant_info"
        else:
            score -= 5
            breakdown["guarantor"] = "mismatch"

        # 6. Timing (10 points)
        move_in_req = prefs.get("move_in_timeline", "flexible")
        avail_date = property.available_from

        if not avail_date:
            score += 10
            breakdown["timing"] = "flexible"
        else:
            days_until_avail = (avail_date - datetime.utcnow().date()).days
            if move_in_req == "asap" and days_until_avail > 14:
                score -= 5
                breakdown["timing"] = "late"
            else:
                score += 10
                breakdown["timing"] = "perfect"

        # --- Bonuses ---

        # 7. Surface Area Bonus (Max 10 points)
        min_surface = float(prefs.get("min_surface_area") or 0)
        prop_surface = float(property.size_sqm or 0)
        if min_surface > 0 and prop_surface > 0:
            if prop_surface >= min_surface:
                # Score based on how much it exceeds or meets
                score += min(10, (prop_surface / min_surface) * 2)
                breakdown["surface"] = "match"
            else:
                # Penalty for being too small
                score -= min(10, (1 - (prop_surface / min_surface)) * 20)
                breakdown["surface"] = "too_small"

        # 8. Amenities Bonus (+2 per match)
        wanted_amenities = prefs.get("must_have_amenities") or []
        prop_amenities = (property.amenities or [])
        
        matched_amenities = []
        for want in wanted_amenities:
            if want in prop_amenities:
                score += 2
                matched_amenities.append(want)
        
        breakdown["matched_features"] = matched_amenities

        # Final score clamping
        final_score = max(0, min(100, int(score)))
        
        return {
            "score": final_score,
            "breakdown": breakdown
        }

    def calculate_match_score(self, tenant: User, property: Property) -> int:
        return self.calculate_match_details(tenant, property)["score"]

    def _map_situation_to_type(self, prefs: dict) -> str:
        """Map questionnaire preferences to expected property accepted types"""
        contract = str(prefs.get("contract_type") or "").lower()
        
        # CDI/CDD -> employee
        if contract in ["cdi", "cdd"]:
            return "employee"
        # freelancer/self_employed -> freelancer
        if contract in ["freelancer", "self_employed"]:
            return "freelancer"
        # student/internship -> student
        if contract in ["student", "internship"]:
            return "student"

        return "other"


matching_service = MatchingService()
