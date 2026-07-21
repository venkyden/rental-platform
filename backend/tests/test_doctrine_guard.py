"""
Doctrine CI guard (WS-8, stress-test finding F13).

The stress test found doctrine (no PII at rest, controlled product surface)
enforced only where an audit had already looked. These tests make drift loud:

1. Route-surface manifest: the set of mounted routes must equal
   tests/route_manifest.json. Adding an endpoint is a product-surface decision
   (Hoguet exposure, GDPR surface) — update the manifest IN THE SAME PR so the
   reviewer sees the surface change explicitly. (DG-0 2026-07-04: one product,
   marketplace as passive publisher — the manifest covers the unified surface.)

2. Storage-write allowlist: every `.upload_file(` call site persists user
   content, i.e. potential PII at rest needing a purge/erasure story
   (WS-1 invariant). New call sites must be added here deliberately, with
   their deletion story stated.
"""

import json
import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
APP_ROOT = BACKEND_ROOT / "app"
MANIFEST = Path(__file__).resolve().parent / "route_manifest.json"


def _mounted_routes() -> set:
    from app.main import fastapi_app

    # Directly-decorated routes (docs, health, compatibility) are plain APIRoutes…
    mounted = {
        f"{m} {r.path}"
        for r in fastapi_app.routes
        if hasattr(r, "methods") and r.methods
        for m in r.methods
        if m != "HEAD"
    }
    # …but FastAPI ≥0.139 mounts included routers lazily (_IncludedRouter), so
    # their paths only surface through the resolved OpenAPI schema. No route in
    # this app sets include_in_schema=False, so the union is the full surface.
    for path, ops in fastapi_app.openapi()["paths"].items():
        for method in ops:
            if method.upper() != "HEAD":
                mounted.add(f"{method.upper()} {path}")
    return mounted


class TestRouteSurfaceManifest:
    def test_mounted_routes_match_manifest(self):
        manifest = set(json.loads(MANIFEST.read_text()))
        mounted = _mounted_routes()

        added = sorted(mounted - manifest)
        removed = sorted(manifest - mounted)

        msg = []
        if added:
            msg.append(
                "Routes mounted but NOT in tests/route_manifest.json (adding an "
                "endpoint is a product-surface decision — add it to the manifest "
                f"in the same PR so review sees it):\n  " + "\n  ".join(added)
            )
        if removed:
            msg.append(
                "Routes in the manifest but no longer mounted (remove them from "
                f"tests/route_manifest.json):\n  " + "\n  ".join(removed)
            )
        assert not added and not removed, "\n\n".join(msg)


# Every file allowed to call storage.upload_file, with its deletion story.
# A new entry REQUIRES a purge/erasure story (WS-1 invariant: dropping the
# last reference to a stored object must delete the object).
STORAGE_WRITE_ALLOWLIST = {
    "app/routers/auth.py",          # avatar — replace + erasure purge via users.avatar_storage_key
    "app/routers/documents.py",     # Document rows; delete purges via storage_key (WS-1)
    "app/routers/esign.py",         # signed lease PDF; lifecycle tied to lease (legal-gate module)
    "app/routers/media.py",         # generic upload — ⚠ no reference tracking (feature-audit program)
    "app/routers/properties.py",    # property media; erased via properties/{id} prefix (gdpr.py)
    "app/routers/verification.py",  # identity/guarantor docs; purge_identity_doc + purge_object (WS-1)
    "app/services/dossier_service.py",  # trust-dossier PDF (banded claims only, DOSSIER §0.20);
                                       # erased via the dossiers/{user_id} prefix in gdpr.py
}


class TestStorageWriteAllowlist:
    def test_upload_call_sites_are_allowlisted(self):
        pattern = re.compile(r"\.upload_file\(")
        offenders = set()
        for py in APP_ROOT.rglob("*.py"):
            rel = str(py.relative_to(BACKEND_ROOT))
            if "services/storage.py" in rel:
                continue  # the definition itself
            if pattern.search(py.read_text(encoding="utf-8", errors="ignore")):
                offenders.add(rel)

        new_sites = sorted(offenders - STORAGE_WRITE_ALLOWLIST)
        stale = sorted(STORAGE_WRITE_ALLOWLIST - offenders)

        msg = []
        if new_sites:
            msg.append(
                "New storage-write call sites (files persisting user content). "
                "Each needs a purge/erasure story before it ships — add the file "
                "to STORAGE_WRITE_ALLOWLIST with a comment stating that story:\n  "
                + "\n  ".join(new_sites)
            )
        if stale:
            msg.append(
                "Allowlist entries with no remaining call site (remove them):\n  "
                + "\n  ".join(stale)
            )
        assert not new_sites and not stale, "\n\n".join(msg)
