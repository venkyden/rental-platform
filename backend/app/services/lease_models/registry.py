"""
Versioned official-lease-model registry (Path A generation).

French housing law changes periodically, so the official contrat-type models are stored
as **immutable, dated assets** — a new legal version adds a new dated directory and is
NEVER overwritten. Every generated lease stamps the `template_version` it was produced
from; that version is recorded in the e-sign manifest (Path B), so a signed lease stays
verifiable against the exact legal text it was signed under, even after the law evolves.

Models are the verbatim Décret wording (placeholders `[…]` only). This module just
resolves + loads them; it never alters the text (loi 1971 / LG-6).
"""

from pathlib import Path

_MODELS_DIR = Path(__file__).parent

# version label → metadata. `dir` is the immutable dated directory; `models` maps a
# lease type to its model file. Entries appear only once the wording is fetched +
# lawyer-signed-off — an unsupported (type, version) raises (signals "not yet available").
TEMPLATE_VERSIONS: dict[str, dict] = {
    "2025.01": {
        "effective_from": "2025-01-01",
        "dir": "2025-01-01",
        "models": {
            "vide": "annexe1_vide.md",
            # "meuble"/"etudiant": Décret 2015-587 Annexe 2 — pending fetch + sign-off
            # "mobilite": bail mobilité (loi ELAN) model — pending fetch + sign-off
        },
    },
}

# The version new leases are generated from today.
CURRENT_TEMPLATE_VERSION = "2025.01"


def model_path(lease_type: str, version: str = CURRENT_TEMPLATE_VERSION) -> Path:
    """Resolve the immutable model file for (lease_type, version).

    Raises KeyError for an unknown version or a lease type whose model isn't yet
    available/signed-off in that version.
    """
    spec = TEMPLATE_VERSIONS[version]
    return _MODELS_DIR / spec["dir"] / spec["models"][lease_type]


def load_model(lease_type: str, version: str = CURRENT_TEMPLATE_VERSION) -> str:
    """Return the verbatim model text for (lease_type, version)."""
    return model_path(lease_type, version).read_text(encoding="utf-8")


def supported_types(version: str = CURRENT_TEMPLATE_VERSION) -> list[str]:
    return sorted(TEMPLATE_VERSIONS[version]["models"].keys())
