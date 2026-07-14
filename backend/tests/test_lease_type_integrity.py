"""
Lease-type integrity on the legacy free-form generation path.

Two defects this locks down:

1. `generate_html` picked its template from {meuble, colocation, code_civil,
   simple} with a **meublé fallback**, while the API accepts the loi-89
   vocabulary {vide, meuble, etudiant, mobilite}. A `vide` (unfurnished) request
   silently rendered a "Contrat de Location Meublée" — a different legal regime
   (loi 89 titre Ier vs titre Ier bis). There is no `vide` template, so the only
   safe behaviour is to refuse, as `_reject_mobilite` already does.

2. `POST /leases/create` persisted `deposit_amount = rent * 2` regardless of
   lease type — illegal for `vide` (loi 89 art. 22 caps it at 1 month) and for
   `mobilite` (art. 25-13 forbids any deposit).
"""
import types
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app as main_app
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.services.lease_generator import lease_generator


def _mk(**kw):
    m = MagicMock()
    for k, v in kw.items():
        setattr(m, k, v)
    return m


# ── Bug 1: no silent meublé fallback ─────────────────────────────────────────

class TestNoSilentTemplateFallback:
    def _args(self, lease_type):
        return dict(
            property=_mk(address_line1="12 rue de la Paix", address_line2=None,
                         postal_code="44000", city="Nantes", charges=50,
                         furnished=False, description="T2"),
            landlord=_mk(full_name="Jean Dupont"),
            tenant=_mk(full_name="Marie Martin"),
            start_date="2026-09-01", rent=800.0, lease_type=lease_type,
        )

    @pytest.mark.parametrize("lease_type", ["vide", "etudiant"])
    def test_unmapped_type_refuses_instead_of_emitting_meuble(self, lease_type):
        # Regression: these used to render "Contrat de Location Meublée".
        with pytest.raises(ValueError, match="no lease template"):
            lease_generator.generate_html(**self._args(lease_type))

    def test_meuble_renders(self):
        # Only type with BOTH an official Décret model and a wired template.
        html = lease_generator.generate_html(**self._args("meuble"))
        assert "<title>Contrat de Location Meublée</title>" in html

    def test_mobilite_still_blocked(self):
        with pytest.raises(ValueError, match="art. 25-13"):
            lease_generator.generate_html(**self._args("mobilite"))


# ── No official Legifrance contrat-type → refuse (loi 1971) ──────────────────

class TestOfficialModelRequired:
    """Roomivo may fill an official model's blanks, never author a lease.

    Décret n°2015-587 publishes contrat-types for vide / meublé (+ the meublé model
    serves the 9-month étudiant variant). `colocation`, `code_civil` and `simple` have
    NO published model — a document emitted for them is wording we invented, which is
    exactly the loi-1971 (rédaction d'actes) red line.
    """

    def _args(self, lease_type):
        return dict(
            property=_mk(address_line1="12 rue de la Paix", address_line2=None,
                         postal_code="44000", city="Nantes", charges=50,
                         furnished=True, description="T2"),
            landlord=_mk(full_name="Jean Dupont"),
            tenant=_mk(full_name="Marie Martin"),
            start_date="2026-09-01", rent=800.0, lease_type=lease_type,
        )

    @pytest.mark.parametrize("lease_type", ["colocation", "code_civil", "simple"])
    def test_html_refuses_types_with_no_published_model(self, lease_type):
        with pytest.raises(ValueError, match="no official contrat-type published"):
            lease_generator.generate_html(**self._args(lease_type))

    @pytest.mark.parametrize("lease_type", ["colocation", "code_civil", "simple"])
    def test_pdf_refuses_types_with_no_published_model(self, lease_type, tmp_path):
        # /leases/{id}/download regenerates via generate_pdf — same gate applies.
        with pytest.raises(ValueError, match="no official contrat-type published"):
            lease_generator.generate_pdf(
                **self._args(lease_type), output_path=str(tmp_path / "l.pdf"))

    def test_gate_tracks_the_registry_not_a_hardcoded_list(self):
        # The allow-list must come from the official-model registry, so adding a
        # verbatim model is what unlocks a type — not editing the generator.
        from app.services.lease_models.registry import supported_types
        assert set(supported_types()) == {"vide", "meuble", "etudiant"}


# ── Bug 2: deposit ceiling on POST /leases/create ────────────────────────────

def _create_client(landlord, application, property_obj):
    target = main_app.app if hasattr(main_app, "app") else main_app
    sess = MagicMock()
    # create_lease does two selects: Application, then Property.
    sess.execute = AsyncMock(side_effect=[
        MagicMock(scalar_one_or_none=MagicMock(return_value=application)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=property_obj)),
    ])
    sess.add = MagicMock()
    sess.commit = AsyncMock()
    sess.refresh = AsyncMock()

    def _get_db():
        yield sess

    target.dependency_overrides[get_db] = _get_db
    target.dependency_overrides[get_current_user] = lambda: landlord
    return TestClient(main_app), target, sess


def _post_create(lease_type, deposit_override=None, rent=800.0):
    landlord_id = uuid.uuid4()
    landlord = types.SimpleNamespace(id=landlord_id, identity_verified=True,
                                     full_name="Jean Dupont")
    application = _mk(id=uuid.uuid4(), property_id=uuid.uuid4(),
                      tenant_id=uuid.uuid4(), status="approved")
    property_obj = _mk(id=application.property_id, landlord_id=landlord_id,
                       monthly_rent=rent, charges=50)
    client, target, sess = _create_client(landlord, application, property_obj)
    body = {"application_id": str(application.id), "start_date": "2026-09-01",
            "lease_type": lease_type}
    if deposit_override is not None:
        body["deposit_override"] = deposit_override
    try:
        r = client.post("/leases/create", json=body)
        added = sess.add.call_args[0][0] if sess.add.call_args else None
        return r, added
    finally:
        target.dependency_overrides.clear()


class TestCreateLeaseDepositCeiling:
    @pytest.mark.parametrize("lease_type,expected_months", [
        ("vide", 1),      # loi 89 art. 22 — was persisting 2x
        ("meuble", 2),
        ("etudiant", 2),
    ])
    def test_default_deposit_follows_legal_cap(self, lease_type, expected_months):
        r, lease = _post_create(lease_type)
        assert r.status_code == 200, r.text
        assert lease.deposit_amount == 800.0 * expected_months

    def test_mobilite_defaults_to_zero_deposit(self):
        # art. 25-13: bail mobilité forbids any deposit — was defaulting to 2x rent.
        r, lease = _post_create("mobilite")
        assert r.status_code == 200, r.text
        assert lease.deposit_amount == 0

    def test_override_above_cap_rejected(self):
        r, _ = _post_create("vide", deposit_override=1600.0)  # 2x on a 1-month cap
        assert r.status_code == 422

    def test_mobilite_nonzero_override_rejected(self):
        r, _ = _post_create("mobilite", deposit_override=800.0)
        assert r.status_code == 422

    def test_override_within_cap_accepted(self):
        r, lease = _post_create("meuble", deposit_override=1200.0)
        assert r.status_code == 200, r.text
        assert lease.deposit_amount == 1200.0
