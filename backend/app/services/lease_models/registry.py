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
            # Annexe 2 (meublé) serves both meublé and the 9-month student variant.
            "meuble": "annexe2_meuble.md",
            "etudiant": "annexe2_meuble.md",
            # bail mobilité has NO decree contrat-type → not a fillable model here; see `references`.
        },
        # Official explanatory footnotes (markers (n) in the body) — version-matched.
        "footnotes": {
            "vide": "annexe1_vide_footnotes.md",
            "meuble": "annexe2_meuble_footnotes.md",
            "etudiant": "annexe2_meuble_footnotes.md",
        },
        # Legal-requirement references (NOT fillable contrat-types). The bail mobilité has
        # no decree model — it reuses the meublé body + the art. 25-13 mandatory mentions.
        "references": {
            "mobilite": "bail_mobilite_requirements.md",
        },
        # Tokenized fillable variants: the {{token}} blanks are filled by the generator;
        # ALL non-blank standardized text is byte-identical to the verbatim model (enforced
        # by test_lease_generation). v0.1: `vide` core fields tokenized; more to follow.
        "fillables": {
            "vide": "annexe1_vide.fill.md",
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


def footnotes_path(lease_type: str, version: str = CURRENT_TEMPLATE_VERSION) -> Path:
    """Resolve the immutable footnotes file for (lease_type, version)."""
    spec = TEMPLATE_VERSIONS[version]
    return _MODELS_DIR / spec["dir"] / spec["footnotes"][lease_type]


def load_footnotes(lease_type: str, version: str = CURRENT_TEMPLATE_VERSION) -> str:
    """Return the verbatim official footnotes text for (lease_type, version)."""
    return footnotes_path(lease_type, version).read_text(encoding="utf-8")


def supported_types(version: str = CURRENT_TEMPLATE_VERSION) -> list[str]:
    """Lease types with a fillable contrat-type model (excludes reference-only types)."""
    return sorted(TEMPLATE_VERSIONS[version]["models"].keys())


def reference_path(lease_type: str, version: str = CURRENT_TEMPLATE_VERSION) -> Path:
    """Resolve a legal-requirement reference (e.g. bail mobilité) — NOT a fillable model."""
    spec = TEMPLATE_VERSIONS[version]
    return _MODELS_DIR / spec["dir"] / spec["references"][lease_type]


def load_reference(lease_type: str, version: str = CURRENT_TEMPLATE_VERSION) -> str:
    """Return the verbatim legal-requirement reference text for (lease_type, version)."""
    return reference_path(lease_type, version).read_text(encoding="utf-8")


def fill_model_path(lease_type: str, version: str = CURRENT_TEMPLATE_VERSION) -> Path:
    """Resolve the tokenized fillable model for (lease_type, version)."""
    spec = TEMPLATE_VERSIONS[version]
    return _MODELS_DIR / spec["dir"] / spec["fillables"][lease_type]


def load_fill_model(lease_type: str, version: str = CURRENT_TEMPLATE_VERSION) -> str:
    """Return the tokenized fillable model text for (lease_type, version)."""
    return fill_model_path(lease_type, version).read_text(encoding="utf-8")


def fillable_types(version: str = CURRENT_TEMPLATE_VERSION) -> list[str]:
    return sorted(TEMPLATE_VERSIONS[version]["fillables"].keys())
