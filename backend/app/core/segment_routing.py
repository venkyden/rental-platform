"""
Segment-based routing configuration.
Defines features, dashboards, and quick actions for each customer segment.
"""
from typing import Dict, List, Optional
from pydantic import BaseModel


class SegmentConfig(BaseModel):
    """Configuration for a user segment"""
    segment: str
    segment_name: str
    segment_type: str  # 'demand' (tenant) or 'supply' (landlord)
    dashboard_path: str
    features: List[str]
    quick_actions: List[Dict[str, str]]
    settings: Dict[str, object] # Changed from bool to object to support strings/enums


# ============================================================
# COMMON FEATURES - Available to ALL segments
# ============================================================
COMMON_FEATURES = [
    # Identity & Verification
    "id_verification",       # Identity document verification
    "questionnaire",         # Onboarding questionnaire
    "document_vault",        # Secure document storage
    
    # Profile & Account
    "profile",               # Profile management
    "notifications",         # Push/email notifications
    "settings",              # Account settings
    
    # Communication
    "support",               # Customer support/help
    "chat",                  # In-app messaging
    
    # Legal & Compliance
    "gdpr_export",           # Data export (GDPR)
    "privacy_settings",      # Privacy controls
]


def get_full_features(segment_features: List[str]) -> List[str]:
    """Combine segment-specific features with common features"""
    return COMMON_FEATURES + segment_features


# Segment configurations for the one-stop rental shop
SEGMENT_CONFIGS: Dict[str, SegmentConfig] = {
    # === DEMAND SIDE (Tenants) ===
    # v3 Philosophy: "Search Democratized, Proof Personalized"
    
    "D1": SegmentConfig(
        segment="D1",
        segment_name="First-Time Tenant",
        segment_type="demand",
        dashboard_path="/dashboard/tenant",
        features=["search", "favorites", "applications", "documents", "verification", "history", "premium_search"],
        quick_actions=[
            {"id": "search", "label": "Search Property", "icon": "🔍", "path": "/search"},
            {"id": "verify", "label": "Verify Profile", "icon": "✓", "path": "/verify"},
            {"id": "guide", "label": "Tenant Guide", "icon": "📖", "path": "/guide/tenant"},
        ],
        settings={
            "verification_flow": "guarantor", # Prompt for Guarantor
            "default_filter_mode": "budget",
            "show_onboarding_tips": True,
        }
    ),
    
    "D2": SegmentConfig(
        segment="D2",
        segment_name="Experienced Tenant",
        segment_type="demand",
        dashboard_path="/dashboard/tenant",
        features=["search", "favorites", "applications", "documents", "verification", "history", "premium_search"],
        quick_actions=[
            {"id": "search", "label": "Search", "icon": "🔍", "path": "/search"},
            {"id": "applications", "label": "Applications", "icon": "📋", "path": "/applications"},
            {"id": "documents", "label": "My Documents", "icon": "📁", "path": "/documents"},
        ],
        settings={
            "verification_flow": "income", # Prompt for Tax/Pay-slips
            "default_filter_mode": "location",
            "show_onboarding_tips": False,
        }
    ),
    
    "D3": SegmentConfig(
        segment="D3",
        segment_name="Mobile Professional",
        segment_type="demand",
        dashboard_path="/dashboard/tenant",
        features=["search", "favorites", "applications", "documents", "verification", "history", "premium_search", "relocation"],
        quick_actions=[
            {"id": "search", "label": "Search", "icon": "🔍", "path": "/search"},
            {"id": "relocation", "label": "Relocation Services", "icon": "🚚", "path": "/relocation"},
            {"id": "documents", "label": "Secure Vault", "icon": "🔒", "path": "/documents"},
        ],
        settings={
            "verification_flow": "identity", # Prompt for Visa/Passport
            "default_filter_mode": "term",
            "show_premium_badge": True,
        }
    ),
    
    # === SUPPLY SIDE (Landlords) ===
    # v3 Philosophy: "Additive Scale"
    
    "S1": SegmentConfig(
        segment="S1",
        segment_name="New Landlord",
        segment_type="supply",
        dashboard_path="/dashboard/landlord",
        features=["properties", "applications", "visits", "messages"],
        quick_actions=[
            {"id": "add_property", "label": "Add a Property", "icon": "➕", "path": "/properties/new"},
            {"id": "applications", "label": "Applications", "icon": "📋", "path": "/applications"},
            {"id": "pricing", "label": "Pricing Guide", "icon": "💰", "path": "/guide/pricing"},
        ],
        settings={
            "show_onboarding_tips": True,
            "analytics_enabled": False,
        }
    ),
    
    "S2": SegmentConfig(
        segment="S2",
        segment_name="Professional Investor",
        segment_type="supply",
        dashboard_path="/dashboard/landlord",
        # Additive: S1 + Team + Analytics
        features=["properties", "applications", "visits", "messages", "team", "analytics", "inbox"],
        quick_actions=[
            {"id": "portfolio", "label": "My Portfolio", "icon": "🏢", "path": "/properties"},
            {"id": "team", "label": "My Team", "icon": "👥", "path": "/team"},
            {"id": "analytics", "label": "Analytics", "icon": "📊", "path": "/analytics"},
        ],
        settings={
            "show_onboarding_tips": False,
            "analytics_enabled": True,
        }
    ),
    
    "S3": SegmentConfig(
        segment="S3",
        segment_name="Real Estate Agency",
        segment_type="supply",
        dashboard_path="/dashboard/agency",
        # Additive: S2 + Enterprise Integrations
        features=["properties", "applications", "visits", "messages", "team", "analytics", "inbox",
                  "bulk_import", "gli", "webhooks", "api_access", "white_label"],
        quick_actions=[
            {"id": "bulk", "label": "Bulk Import", "icon": "📤", "path": "/bulk"},
            {"id": "gli", "label": "GLI Quote", "icon": "🛡️", "path": "/gli"},
            {"id": "webhooks", "label": "ERP Integration", "icon": "🔗", "path": "/webhooks"},
            {"id": "team", "label": "Team", "icon": "👥", "path": "/team"},
        ],
        settings={
            "show_onboarding_tips": False,
            "analytics_enabled": True,
            "enterprise_mode": True,
        }
    ),
}


def get_segment_config(segment: Optional[str]) -> SegmentConfig:
    """Get configuration for a user segment, with fallback to D1/S1"""
    if segment and segment in SEGMENT_CONFIGS:
        return SEGMENT_CONFIGS[segment]
    # Default to D1 for tenants or S1 for landlords
    return SEGMENT_CONFIGS["D1"]


def get_redirect_path(segment: Optional[str], role: str) -> str:
    """Get the appropriate dashboard path based on segment and role"""
    if segment and segment in SEGMENT_CONFIGS:
        return SEGMENT_CONFIGS[segment].dashboard_path
    
    # Fallback based on role
    if role in ["landlord", "property_manager"]:
        return "/dashboard/landlord"
    return "/dashboard/tenant"


def has_feature(segment: Optional[str], feature: str) -> bool:
    """Check if a segment has access to a specific feature (includes common features)"""
    # Common features are available to everyone
    if feature in COMMON_FEATURES:
        return True
    
    config = get_segment_config(segment)
    return feature in config.features


def get_all_features(segment: Optional[str]) -> List[str]:
    """Get all features for a segment (common + segment-specific)"""
    config = get_segment_config(segment)
    return get_full_features(config.features)
