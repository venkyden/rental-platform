"""
Zone tendue detection — advisory only, not enforcement.

A "zone tendue" (Décret n° 2013-392, modified by Décret n° 2023-822) is a
commune in an urban area of 50,000+ inhabitants where housing demand
materially exceeds supply. In these zones: landlords must give only 1 month
notice (not 3) at re-letting, rent increases between tenancies are capped
(loi ALUR), and encadrement des loyers (loi ALUR/ELAN Art. 140) may apply
where a prefectoral arrêté has been issued (Paris, Lille, Lyon, etc.).

Implementation notes:
- Uses 2-character department code as proxy for zone tendue.
  Over-approximates slightly (not every commune in listed department
  is zone tendue), but under-approximation would skip affected
  landlords. Result is advisory only — never a hard block.
- Corsica (2A/2B) and overseas departments (971–976) excluded;
  operate under different legal frameworks.
- Full commune-level list (~1 149 communes) in annexe to
  Arrêté du 1er août 2013 (NOR: ETLL1319837A), updated by Décret 2023-822.
"""
from typing import Optional

# Departments where at least one major agglomération is zone tendue.
# Source: annexe Arrêté 01/08/2013 + Décret 2023-822.
_ZONE_TENDUE_DEPT_PREFIXES: frozenset = frozenset({
    "06",  # Alpes-Maritimes — Nice
    "13",  # Bouches-du-Rhône — Aix-Marseille
    "14",  # Calvados — Caen
    "17",  # Charente-Maritime — La Rochelle
    "22",  # Côtes-d'Armor — Saint-Brieuc
    "25",  # Doubs — Besançon
    "29",  # Finistère — Brest / Quimper
    "30",  # Gard — Nîmes
    "31",  # Haute-Garonne — Toulouse
    "33",  # Gironde — Bordeaux
    "34",  # Hérault — Montpellier
    "35",  # Ille-et-Vilaine — Rennes
    "37",  # Indre-et-Loire — Tours
    "38",  # Isère — Grenoble
    "44",  # Loire-Atlantique — Nantes
    "45",  # Loiret — Orléans
    "49",  # Maine-et-Loire — Angers
    "51",  # Marne — Reims
    "54",  # Meurthe-et-Moselle — Nancy
    "57",  # Moselle — Metz
    "59",  # Nord — Lille
    "60",  # Oise — Compiègne / Beauvais
    "62",  # Pas-de-Calais — Lens / Béthune
    "63",  # Puy-de-Dôme — Clermont-Ferrand
    "64",  # Pyrénées-Atlantiques — Bayonne / Biarritz / Pau
    "67",  # Bas-Rhin — Strasbourg
    "69",  # Rhône — Lyon
    "72",  # Sarthe — Le Mans
    "73",  # Savoie — Chambéry
    "74",  # Haute-Savoie — Annecy / Thonon
    "75",  # Paris
    "76",  # Seine-Maritime — Rouen
    "77",  # Seine-et-Marne (IDF)
    "78",  # Yvelines (IDF)
    "80",  # Somme — Amiens
    "83",  # Var — Toulon
    "84",  # Vaucluse — Avignon
    "85",  # Vendée — La Roche-sur-Yon
    "86",  # Vienne — Poitiers
    "87",  # Haute-Vienne — Limoges
    "91",  # Essonne (IDF)
    "92",  # Hauts-de-Seine (IDF)
    "93",  # Seine-Saint-Denis (IDF)
    "94",  # Val-de-Marne (IDF)
    "95",  # Val-d'Oise (IDF)
})


def is_zone_tendue(postal_code: Optional[str]) -> bool:
    """
    Returns True if postal code likely in zone tendue.

    Uses 2-digit department prefix. Advisory — may over-approximate;
    never use as hard compliance gate.
    """
    if not postal_code:
        return False
    clean = postal_code.strip().replace(" ", "")
    if len(clean) < 2:
        return False
    dept = clean[:2]
    # Exclude Corsica (2A/2B not digit-only) — already excluded (won't match
    # any entry in all-numeric set), but make explicit.
    if not dept.isdigit():
        return False
    return dept in _ZONE_TENDUE_DEPT_PREFIXES
