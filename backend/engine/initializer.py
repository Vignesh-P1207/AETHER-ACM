"""
AETHER ACM — Constellation & Debris Field Initializer
"""
import numpy as np
from backend.config import MU, RE, M_DRY, M_FUEL_INIT
from backend.engine.coordinates import keplerian_to_state


def generate_constellation(n_planes=5, sats_per_plane=10, alt_km=550.0, inc_deg=53.0):
    """Walker Delta constellation (50 sats default)."""
    satellites = {}
    total_sats = n_planes * sats_per_plane
    sma = RE + alt_km
    for plane in range(n_planes):
        raan = 360.0 * plane / n_planes
        for sat_num in range(sats_per_plane):
            phase_offset = 360.0 * plane / total_sats
            ta = (360.0 * sat_num / sats_per_plane + phase_offset) % 360.0
            r_eci, v_eci = keplerian_to_state(sma, 0.0001, inc_deg, raan, 0.0, ta)
            sat_id = f"SAT-P{plane+1}-{sat_num+1:02d}"
            state = np.concatenate([r_eci, v_eci])
            satellites[sat_id] = {
                "state": state, "nominal_slot_state": state.copy(),
                "mass": M_DRY + M_FUEL_INIT, "fuel": M_FUEL_INIT,
                "status": "NOMINAL", "plane": plane + 1, "slot": sat_num + 1,
                "last_burn_time": None, "active_cdms": [],
                "total_dv_used_ms": 0.0, "uptime_seconds": 0.0,
                "outage_seconds": 0.0, "burn_history": [],
                "keplerian": {"sma_km": sma, "inc_deg": inc_deg, "raan_deg": raan, "ecc": 0.0001}
            }
    return satellites


def generate_debris_field(n_debris=2000, alt_range=(480, 650), inc_spread_deg=20.0, seed=42):
    """Realistic LEO debris field."""
    rng = np.random.default_rng(seed)
    debris = {}
    for i in range(n_debris):
        alt = rng.uniform(*alt_range)
        sma = RE + alt
        inc_base = rng.choice([53.0, 97.8, 28.5, 51.6, 98.0], p=[0.3, 0.25, 0.2, 0.15, 0.1])
        inc = np.clip(inc_base + rng.uniform(-inc_spread_deg, inc_spread_deg), 0.1, 179.9)
        raan = rng.uniform(0, 360)
        ta = rng.uniform(0, 360)
        aop = rng.uniform(0, 360)
        ecc = min(rng.exponential(0.005), 0.05)
        r_eci, v_eci = keplerian_to_state(sma, ecc, inc, raan, aop, ta)
        v_eci = v_eci + rng.normal(0, 0.001, 3)
        deb_id = f"DEB-{i+1:05d}"
        state = np.concatenate([r_eci, v_eci])
        debris[deb_id] = {"state": state, "alt_km": alt, "inc_deg": inc}
    return debris
