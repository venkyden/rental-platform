"""
Matching Service.
Calculates compatibility scores between Tenants and Properties.
Implements "Soft Scoring" logic (Weighted Preferences) as per Differentiation Strategy.
"""

from datetime import datetime
from typing import Any, Dict, List

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
        Returns: {
            "score": int,
            "breakdown": {
                "preference": "perfect" | "partial" | "mismatch",
                "affordability": "great" | "stretch" | "expensive",
                "location": "exact" | "nearby" | "miss",
                "timing": "perfect" | "late" | "early"
            }
        }
        """
        score = 0.0
        breakdown = {}

        # 1. Tenant Preference (30 points)
        accepted_types = property.accepted_tenant_types or []

        if not accepted_types:
            score += 30
            breakdown["preference"] = "perfect"
        elif self._map_situation_to_type(tenant.preferences or {}) in accepted_types:
            score += 30
            breakdown["preference"] = "perfect"
        else:
            score += 10
            breakdown["preference"] = "partial"

        # 2. Affordability (40 points)
        tenant_budget = (tenant.preferences or {}).get("budget", 0)
        # Total rent: for CC, charges already included in monthly_rent
        if getattr(property, "charges_included", False):
            rent = float(property.monthly_rent or 0)
        else:
            rent = float(property.monthly_rent or 0) + float(property.charges or 0)

        if rent <= tenant_budget:
            score += 40
            breakdown["affordability"] = "great"
        elif rent <= tenant_budget * 1.15:
            score += 25
            breakdown["affordability"] = "stretch"
        elif rent <= tenant_budget * 1.3:
            score += 10
            breakdown["affordability"] = "expensive"
        else:
            score += 0
            breakdown["affordability"] = "impossible"

        # 3. Location (15 points)
        # Check both standard location and university city (from onboarding)
        wanted_location = (tenant.preferences or {}).get("location", "").lower()

        # New Radius Preference from Onboarding
        location_preference = (tenant.preferences or {}).get("location_preference")

        university_info = (tenant.preferences or {}).get("university", {})
        university_city = (
            university_info.get("city", "").lower()
            if isinstance(university_info, dict)
            else ""
        )
        university_name = (
            university_info.get("university_name", "").lower()
            if isinstance(university_info, dict)
            else ""
        )
        office_location = (tenant.preferences or {}).get("office_location", "").lower()

        prop_city = (property.city or "").lower()
        prop_landmarks = str(property.nearby_landmarks or "").lower()
        prop_transport = str(property.public_transport or "").lower()

        location_match = False

        # Priority 1: Geospatial Radius Match (The "Uber" Logic)
        if (
            location_preference
            and isinstance(location_preference, dict)
            and property.latitude
            and property.longitude
        ):
            target_lat = location_preference.get("lat")
            target_lng = location_preference.get("lng")
            # Enforce Max Radius of 50km (50,000m) to prevent abuse
            raw_radius = location_preference.get("radius", 5000)
            radius = min(int(raw_radius), 50000)

            if target_lat and target_lng:
                distance = self.calculate_distance(
                    target_lat, target_lng, property.latitude, property.longitude
                )

                if distance <= radius:
                    score += 15
                    breakdown["location"] = "exact_geo"
                    location_match = True
                elif distance <= radius * 1.5:
                    score += 10
                    breakdown["location"] = "nearby_geo"
                    location_match = True

        # Priority 2: Text-based fallback (if no geospatial match found yet)
        if not location_match:
            if not wanted_location and not university_city and not office_location:
                # No preference at all? (Shouldn't happen with new onboarding, but failsafe)
                score += 5
                breakdown["location"] = "broad"
                location_match = True
            elif university_city and university_city in prop_city:
                score += 15
                breakdown["location"] = "exact_city"
                location_match = True
            elif wanted_location in prop_city or prop_city in wanted_location:
                score += 15
                breakdown["location"] = "exact_city"
                location_match = True
            elif office_location and office_location in prop_city:
                score += 12
                breakdown["location"] = "nearby_city"
                location_match = True

        if not location_match:
            score += 0  # Explicit 0 for miss
            breakdown["location"] = "miss"

        # Bonus: Check if university/school name appears in property landmarks or transport
        # This helps match manual entries with API-enriched property data
        if university_name and len(university_name) > 3:
            # Split name into words and check for significant matches
            uni_keywords = [word for word in university_name.split() if len(word) > 3]
            for keyword in uni_keywords:
                if keyword in prop_landmarks or keyword in prop_transport:
                    score += 8  # Bonus for school proximity match
                    breakdown["school_proximity"] = "match"
                    break

        # 4. Availability (15 points)
        move_in_req = (tenant.preferences or {}).get("move_in_timeline", "flexible")
        avail_date = property.available_from

        if not avail_date:
            score += 15
            breakdown["timing"] = "perfect"
        else:
            days_until_avail = (avail_date - datetime.utcnow().date()).days
            if move_in_req == "asap" and days_until_avail > 14:
                score -= 10  # Penality but NOT hidden
                breakdown["timing"] = "late"
            elif move_in_req == "soon" and days_until_avail > 45:
                score -= 5
                breakdown["timing"] = "late"
            else:
                score += 15
                breakdown["timing"] = "perfect"

        # 5. Granular Features (Bonus Points: +2 per match)
        # "The number should explain itself. If it's 50%, what specs matched?"

        # Support both 'amenities' and 'must_have_amenities' (from onboarding questionnaire)
        wanted_amenities = (tenant.preferences or {}).get("amenities", []) or (
            tenant.preferences or {}
        ).get("must_have_amenities", [])
        wanted_landmarks = (tenant.preferences or {}).get(
            "landmarks", []
        )  # e.g. ['hospital', 'metro']

        prop_amenities = (property.amenities or []) + (
            property.utilities_included or []
        )
        # Simplify amenities to lowercase set for matching
        prop_feat_set = {str(a).lower() for a in prop_amenities}

        # Check Amenities
        matched_feats = []
        missing_feats = []

        for want in wanted_amenities:
            # Fuzzy match? strictly text for now
            if want.lower() in prop_feat_set:
                score += 5  # High value for specific requests
                matched_feats.append(want)
            else:
                missing_feats.append(want)

        # Check Landmarks (Simple Keyword check in JSONB)
        prop_landmarks = (
            str(property.nearby_landmarks or "").lower()
            + str(property.public_transport or "").lower()
        )
        for want in wanted_landmarks:
            if want.lower() in prop_landmarks:
                score += 5
                matched_feats.append(want)
            else:
                missing_feats.append(want)

        # 6. Transport & Services Matching (NEW - Smart Onboarding)
        # Check if tenant's required transport/services are near the property
        tenant_transport_needs = (tenant.preferences or {}).get("transport_needs", [])
        tenant_service_needs = (tenant.preferences or {}).get("service_needs", [])

        prop_transport_text = str(property.public_transport or "").lower()
        prop_landmarks_text = str(property.nearby_landmarks or "").lower()

        for transport in tenant_transport_needs:
            if transport.lower() in prop_transport_text:
                score += 5
                matched_feats.append(f"🚇 {transport}")

        for service in tenant_service_needs:
            if service.lower() in prop_landmarks_text:
                score += 5
                matched_feats.append(f"🏪 {service}")

        breakdown["matched_features"] = matched_feats
        breakdown["missing_features"] = missing_feats

        # Calculate final score with clear breakdown
        # Base score (preference, affordability, location, timing) max = 100
        # Bonus features and penalties adjust relative to 100
        base_score = max(0, min(100, int(score)))

        # Store raw score for debugging if needed
        breakdown["raw_score"] = int(score)
        breakdown["clamped"] = score != base_score

        return {"score": base_score, "breakdown": breakdown}

    # Backward compatibility wrapper if needed, but we'll update usage
    def calculate_match_score(self, tenant: User, property: Property) -> int:
        return self.calculate_match_details(tenant, property)["score"]

    def _map_situation_to_type(self, prefs: dict) -> str:
        """Map questionnaire preferences to expected property accepted types"""
        contract = prefs.get("contract_type", "").lower()
        situation = prefs.get("situation", "").lower()

        # Priority 1: Clear Contract Type Match
        if contract in ["cdi", "cdd"]:
            return "employee"
        if contract == "self_employed":
            return "freelancer"
        if contract in ["student", "internship"]:
            return "student"

        # Priority 2: Fallback to Situation
        mapping = {
            "student_budget": "student",
            "family_stability": "employee",
            "flexibility_relocation": "freelancer",
        }
        return mapping.get(situation, "other")


matching_service = MatchingService()
