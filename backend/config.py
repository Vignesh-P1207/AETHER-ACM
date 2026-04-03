"""
AETHER ACM — Configuration & Physical Constants
=================================================
All physical constants, simulation parameters, and ground station data.
Every module imports from here — single source of truth.
"""
import numpy as np

# ── Gravitational Constants ──────────────────────────────────
MU          = 398600.4418          # km³/s² — Earth gravitational parameter (WGS84)
RE          = 6378.137             # km     — Earth equatorial radius (WGS84)
J2          = 1.08263e-3           # J2 zonal harmonic coefficient
J3          = -2.53265e-6          # J3 zonal harmonic coefficient
J4          = -1.61962e-6          # J4 zonal harmonic coefficient
F           = 1 / 298.257223563    # Earth flattening factor (WGS84)
OMEGA_EARTH = 7.2921150e-5         # rad/s — Earth rotation rate

# ── Propulsion ───────────────────────────────────────────────
G0          = 9.80665              # m/s²   — standard gravity
ISP         = 300.0                # s      — specific impulse (monopropellant)
M_DRY       = 500.0                # kg     — satellite dry mass
M_FUEL_INIT = 50.0                 # kg     — initial propellant mass per satellite
MAX_DV_KMS  = 0.015                # km/s   — max ΔV per burn
MAX_DV_MS   = 15.0                 # m/s    — max ΔV per burn
COOLDOWN_S  = 600                  # s      — minimum time between consecutive burns

# ── Conjunction Thresholds ───────────────────────────────────
CDM_CRITICAL_KM  = 0.100           # km — critical conjunction distance (100m)
CDM_WARNING_KM   = 1.000           # km — warning threshold
CDM_CAUTION_KM   = 5.000           # km — caution threshold
COARSE_FILTER_KM = 10.0            # km — KD-Tree first-pass query radius

# ── Station Keeping ──────────────────────────────────────────
SK_RADIUS_KM  = 10.0               # km — station keeping box radius
EOL_THRESHOLD = 0.05               # 5% fuel → graveyard orbit

# ── Communication ────────────────────────────────────────────
SIGNAL_LATENCY_S = 10              # s — uplink signal latency
MIN_BURN_LEAD_S  = 15              # s — minimum seconds before burn to uplink

# ── Simulation Parameters ────────────────────────────────────
RK4_SUBSTEP_SAT_S   = 10.0        # s — RK4 substep for satellites (high accuracy)
RK4_SUBSTEP_DEB_S   = 30.0        # s — RK4 substep for debris (lower accuracy)
CONJUNCTION_HORIZON  = 86400       # s — 24-hour CDM look-ahead
TCA_SAMPLE_DT        = 30         # s — time between TCA trajectory samples

# ── Ground Station Network ───────────────────────────────────
GROUND_STATIONS = [
    {"id": "GS-001", "name": "ISTRAC_Bengaluru",
     "lat": 13.0333, "lon": 77.5167, "alt_km": 0.820, "min_el": 5.0},
    {"id": "GS-002", "name": "Svalbard_Sat_Station",
     "lat": 78.2297, "lon": 15.4077, "alt_km": 0.400, "min_el": 5.0},
    {"id": "GS-003", "name": "Goldstone_Tracking",
     "lat": 35.4266, "lon": -116.890, "alt_km": 1.000, "min_el": 10.0},
    {"id": "GS-004", "name": "Punta_Arenas",
     "lat": -53.150, "lon": -70.9167, "alt_km": 0.030, "min_el": 5.0},
    {"id": "GS-005", "name": "IIT_Delhi_Ground_Node",
     "lat": 28.545, "lon": 77.1926, "alt_km": 0.225, "min_el": 15.0},
    {"id": "GS-006", "name": "McMurdo_Station",
     "lat": -77.846, "lon": 166.668, "alt_km": 0.010, "min_el": 5.0},
]
