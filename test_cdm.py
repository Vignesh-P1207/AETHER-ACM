import sys
sys.path.insert(0, '.')
from backend.engine.initializer import generate_constellation, generate_debris_field
from backend.engine.conjunction import run_conjunction_assessment
import numpy as np

RE = 6378.137
def alt(state): return np.linalg.norm(state[:3]) - RE

sats = generate_constellation()
deb = generate_debris_field(n_debris=2000, seed=42)

sat_alts = {sid: alt(s['state']) for sid, s in sats.items()}
deb_alts = {did: alt(d['state']) for did, d in deb.items()}

print(f"Sat alts: {min(sat_alts.values()):.1f} - {max(sat_alts.values()):.1f} km")
print(f"Debris alts: {min(deb_alts.values()):.1f} - {max(deb_alts.values()):.1f} km")

avg_sat_alt = sum(sat_alts.values()) / len(sat_alts)
in_band = sum(1 for a in deb_alts.values() if abs(a - avg_sat_alt) < 80.0)
print(f"Debris within 80km of sat altitude ({avg_sat_alt:.1f}km): {in_band} / {len(deb_alts)}")

# Run conjunction assessment
sat_states = {sid: s['state'] for sid, s in sats.items()}
deb_states = {did: d['state'] for did, d in deb.items()}

print("\nRunning conjunction assessment (fast screen + 2h window)...")
cdms = run_conjunction_assessment(sat_states, deb_states, sim_time=0.0,
                                   prediction_window=7200.0, sample_interval=120.0)
print(f"\nFound {len(cdms)} CDMs")
for c in cdms[:10]:
    print(f"  {c.satellite_id} x {c.debris_id}: {c.miss_distance_km:.3f}km [{c.risk_level.value}] TCA={c.tca_seconds:.0f}s")
