"""
Agency-tooling FREEZE tests (feature-audit verdict 2026-07-04).

ENABLE_AGENCY_TOOLING=False (default): property_manager/team/bulk/erp_webhooks
routers unmounted; team/bulk/webhooks features + nav stripped from served
segment configs. Code retained — flag flips it back at B2B demand.
"""

FROZEN_PREFIXES = ("/property-manager", "/team", "/bulk", "/webhooks/subscriptions")


def test_frozen_routers_not_mounted():
    from app.main import fastapi_app

    mounted = {r.path for r in fastapi_app.routes if hasattr(r, "methods")}
    offenders = {p for p in mounted if p.startswith(FROZEN_PREFIXES)}
    assert not offenders, f"frozen agency routes still mounted: {sorted(offenders)}"
    # general webhooks router (distinct from ERP /webhooks/subscriptions) stays
    assert any(p.startswith("/webhooks") for p in mounted)


def test_segment_configs_hide_frozen_features_and_nav():
    from app.core.segment_routing import get_segment_config, has_feature

    s3 = get_segment_config("S3")
    assert "team" not in s3.features
    assert "bulk_import" not in s3.features
    assert "webhooks" not in s3.features
    assert all(a.get("id") not in {"team", "bulk", "webhooks"} for a in s3.quick_actions)

    s2 = get_segment_config("S2")
    assert "team" not in s2.features

    assert has_feature("S3", "team") is False
    # non-frozen features untouched
    assert has_feature("S3", "analytics") is True


def test_source_configs_not_mutated():
    """Freeze filters served copies — SEGMENT_CONFIGS stays intact for unfreeze."""
    from app.core.segment_routing import SEGMENT_CONFIGS, get_segment_config

    get_segment_config("S3")
    assert "team" in SEGMENT_CONFIGS["S3"].features
