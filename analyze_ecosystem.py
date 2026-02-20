import json
from collections import Counter
import re

# Load the dataset
file_path = '/Users/venkat/Downloads/French_Rental_Ecosystem_Dataset_418_Players/french_rental_ecosystem_dataset.json'

try:
    with open(file_path, 'r') as f:
        data = json.load(f)
except FileNotFoundError:
    print(f"Error: File not found at {file_path}")
    exit()

print(f"Dataset Loaded. Top level keys: {list(data.keys())}")

# 1. Player Analysis
players = data.get('ecosystem_players', [])
print(f"\nTotal Players: {len(players)}")

if not players:
    print("No players found in 'ecosystem_players'. Exiting.")
    exit()

# Metrics to collect
segments = []
subsegments = []
business_models = []
funding_amounts = []
coverage_scopes = []

for player in players:
    segments.append(player.get('segment', 'Unknown'))
    subsegments.append(player.get('subsegment', 'Unknown'))
    business_models.append(player.get('business_model', 'Unknown'))
    coverage_scopes.append(player.get('coverage_scope', 'Unknown'))
    
    # Funding cleaning
    raw_funding = player.get('funding', '0')
    if isinstance(raw_funding, dict):
        funding_str = raw_funding.get('total_raised', '0')
    else:
        funding_str = str(raw_funding)
    
    funding_amounts.append((player.get('platform_name', 'Unknown'), funding_str, player.get('segment', 'Unknown')))

# SEGMENT BREAKDOWN
print("\n--- Segment Breakdown ---")
seg_counts = Counter(segments)
for seg, count in seg_counts.most_common():
    print(f"{seg}: {count}")

# SUBSEGMENT BREAKDOWN (Top 10)
print("\n--- Subsegment Breakdown (Top 10) ---")
subseg_counts = Counter(subsegments)
for sub, count in subseg_counts.most_common(10):
    print(f"{sub}: {count}")

# BUSINESS MODEL BREAKDOWN
print("\n--- Business Model Breakdown ---")
bm_counts = Counter(business_models)
for bm, count in bm_counts.most_common(10): # Top 10
    print(f"{bm}: {count}")

# FUNDING ANALYSIS
def parse_funding_val(funding_str):
    if not funding_str or funding_str == 'Unknown' or funding_str == '0':
        return 0
    # Clean string
    clean = funding_str.upper().replace('€', '').replace('$', '').replace('£', '').replace(',', '')
    # Extract number
    match = re.search(r'[\d\.]+', clean)
    if not match:
        return 0
    val = float(match.group())
    
    # Check multiplier
    if 'B' in clean or 'BILLION' in clean:
        val *= 1_000_000_000
    elif 'M' in clean or 'MILLION' in clean:
        val *= 1_000_000
    elif 'K' in clean:
        val *= 1_000
    return val

print("\n--- High Funding Players ---")
# Filter out 0 funding
funded_players = [p for p in funding_amounts if parse_funding_val(p[1]) > 0]
sorted_by_funding = sorted(funded_players, key=lambda x: parse_funding_val(x[1]), reverse=True)

for p in sorted_by_funding[:20]:
    print(f"{p[0]}: {p[1]} ({p[2]})")

# 3. Reputation & Scam Analysis Summary (No change needed here as it worked)
scam_analysis = data.get('scam_analysis', {})
risk_map = scam_analysis.get('ecosystem_scam_risk_map', {})
print("\n--- Scam Risk Map Summary ---")
for risk_level, platforms in risk_map.items():
    print(f"\nRisk Level: {risk_level}")
    for p in platforms:
        print(f" - {p.get('platform')}: {p.get('user_warning')}")

# 4. Social Intelligence Summary (No change needed)
social_intel = data.get('social_analysis', {})
print("\n--- Social Media Leaders ---")
channel_eff = social_intel.get('channel_effectiveness', {})
for channel, details in channel_eff.items():
    print(f"\nChannel: {channel}")
    print(f"Leaders: {details.get('leaders')}")
