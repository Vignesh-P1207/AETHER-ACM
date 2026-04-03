"""
AETHER ACM — Coordinate Transformation Library
=================================================
ECI (J2000) ↔ ECEF ↔ Geodetic ↔ RTN ↔ Keplerian elements
All angles in radians internally, degrees at API boundary.
"""
import numpy as np
from backend.config import MU, RE, F, OMEGA_EARTH
from backend.utils.time_utils import gmst_from_unix


# ── ECI ↔ ECEF ──────────────────────────────────────────────

def eci_to_ecef(r_eci: np.ndarray, unix_time: float) -> np.ndarray:
    theta = gmst_from_unix(unix_time)
    cos_t, sin_t = np.cos(theta), np.sin(theta)
    R = np.array([
        [ cos_t, sin_t, 0],
        [-sin_t, cos_t, 0],
        [     0,     0, 1]
    ])
    return R @ r_eci


def ecef_to_eci(r_ecef: np.ndarray, unix_time: float) -> np.ndarray:
    theta = gmst_from_unix(unix_time)
    cos_t, sin_t = np.cos(theta), np.sin(theta)
    R = np.array([
        [cos_t, -sin_t, 0],
        [sin_t,  cos_t, 0],
        [    0,      0, 1]
    ])
    return R @ r_ecef


# ── ECEF ↔ Geodetic ─────────────────────────────────────────

def ecef_to_geodetic(r_ecef: np.ndarray) -> tuple:
    """Convert ECEF to geodetic using iterative Bowring method.
    Returns: (lat_deg, lon_deg, alt_km)"""
    x, y, z = r_ecef
    b = RE * (1 - F)
    e2 = 1 - (b / RE)**2
    ep2 = (RE / b)**2 - 1
    lon = np.arctan2(y, x)
    p = np.sqrt(x**2 + y**2)
    theta = np.arctan2(z * RE, p * b)
    lat = np.arctan2(
        z + ep2 * b * np.sin(theta)**3,
        p - e2 * RE * np.cos(theta)**3
    )
    for _ in range(3):
        sin_lat = np.sin(lat)
        N = RE / np.sqrt(1 - e2 * sin_lat**2)
        lat_new = np.arctan2(z + e2 * N * sin_lat, p)
        if abs(lat_new - lat) < 1e-12:
            break
        lat = lat_new
    sin_lat = np.sin(lat)
    N = RE / np.sqrt(1 - e2 * sin_lat**2)
    if abs(np.cos(lat)) > 1e-10:
        alt = p / np.cos(lat) - N
    else:
        alt = abs(z) / abs(sin_lat) - N * (1 - e2)
    return np.degrees(lat), np.degrees(lon), alt


def geodetic_to_ecef(lat_deg: float, lon_deg: float, alt_km: float) -> np.ndarray:
    lat = np.radians(lat_deg)
    lon = np.radians(lon_deg)
    b = RE * (1 - F)
    e2 = 1 - (b / RE)**2
    sin_lat = np.sin(lat)
    N = RE / np.sqrt(1 - e2 * sin_lat**2)
    x = (N + alt_km) * np.cos(lat) * np.cos(lon)
    y = (N + alt_km) * np.cos(lat) * np.sin(lon)
    z = (N * (1 - e2) + alt_km) * sin_lat
    return np.array([x, y, z])


# ── Full Pipelines ───────────────────────────────────────────

def eci_to_geodetic(r_eci: np.ndarray, unix_time: float) -> tuple:
    r_ecef = eci_to_ecef(r_eci, unix_time)
    return ecef_to_geodetic(r_ecef)


def batch_eci_to_geodetic(positions: np.ndarray, unix_time: float) -> np.ndarray:
    theta = gmst_from_unix(unix_time)
    cos_t, sin_t = np.cos(theta), np.sin(theta)
    x_ecef = cos_t * positions[:, 0] + sin_t * positions[:, 1]
    y_ecef = -sin_t * positions[:, 0] + cos_t * positions[:, 1]
    z_ecef = positions[:, 2]
    r = np.sqrt(x_ecef**2 + y_ecef**2 + z_ecef**2)
    lat = np.degrees(np.arcsin(np.clip(z_ecef / r, -1, 1)))
    lon = np.degrees(np.arctan2(y_ecef, x_ecef))
    alt = r - RE
    return np.column_stack([lat, lon, alt])


# ── Elevation Angle ──────────────────────────────────────────

def compute_elevation_angle(sat_ecef: np.ndarray, gs_ecef: np.ndarray) -> float:
    diff = sat_ecef - gs_ecef
    gs_hat = gs_ecef / np.linalg.norm(gs_ecef)
    range_dist = np.linalg.norm(diff)
    if range_dist < 1e-10:
        return 90.0
    diff_hat = diff / range_dist
    sin_el = np.dot(diff_hat, gs_hat)
    return np.degrees(np.arcsin(np.clip(sin_el, -1.0, 1.0)))


# ── RTN Frame ────────────────────────────────────────────────

def eci_to_rtn_matrix(r_eci: np.ndarray, v_eci: np.ndarray) -> np.ndarray:
    R_hat = r_eci / np.linalg.norm(r_eci)
    h = np.cross(r_eci, v_eci)
    N_hat = h / np.linalg.norm(h)
    T_hat = np.cross(N_hat, R_hat)
    T_hat = T_hat / np.linalg.norm(T_hat)
    return np.array([R_hat, T_hat, N_hat])


def rtn_to_eci(dv_rtn: np.ndarray, r_eci: np.ndarray, v_eci: np.ndarray) -> np.ndarray:
    M = eci_to_rtn_matrix(r_eci, v_eci)
    return M.T @ dv_rtn


def eci_to_rtn(dv_eci: np.ndarray, r_eci: np.ndarray, v_eci: np.ndarray) -> np.ndarray:
    M = eci_to_rtn_matrix(r_eci, v_eci)
    return M @ dv_eci


# ── Keplerian Elements ──────────────────────────────────────

def state_to_keplerian(r_eci: np.ndarray, v_eci: np.ndarray) -> dict:
    r = np.linalg.norm(r_eci)
    v = np.linalg.norm(v_eci)
    h_vec = np.cross(r_eci, v_eci)
    h = np.linalg.norm(h_vec)
    K = np.array([0.0, 0.0, 1.0])
    n_vec = np.cross(K, h_vec)
    n = np.linalg.norm(n_vec)
    e_vec = (np.cross(v_eci, h_vec) / MU) - (r_eci / r)
    ecc = np.linalg.norm(e_vec)
    energy = v**2 / 2.0 - MU / r
    sma = -MU / (2.0 * energy) if abs(energy) > 1e-10 else 1e12
    inc = np.arccos(np.clip(h_vec[2] / h, -1, 1))
    if n > 1e-10:
        raan = np.arccos(np.clip(n_vec[0] / n, -1, 1))
        if n_vec[1] < 0: raan = 2.0 * np.pi - raan
    else:
        raan = 0.0
    if n > 1e-10 and ecc > 1e-10:
        aop = np.arccos(np.clip(np.dot(n_vec, e_vec) / (n * ecc), -1, 1))
        if e_vec[2] < 0: aop = 2.0 * np.pi - aop
    else:
        aop = 0.0
    if ecc > 1e-10:
        ta = np.arccos(np.clip(np.dot(e_vec, r_eci) / (ecc * r), -1, 1))
        if np.dot(r_eci, v_eci) < 0: ta = 2.0 * np.pi - ta
    else:
        ta = 0.0
    period = 2.0 * np.pi * np.sqrt(abs(sma)**3 / MU) if sma > 0 else 0.0
    return {
        "sma_km": float(sma), "ecc": float(ecc),
        "inc_deg": float(np.degrees(inc)), "raan_deg": float(np.degrees(raan)),
        "aop_deg": float(np.degrees(aop)), "ta_deg": float(np.degrees(ta)),
        "period_s": float(period),
    }


def keplerian_to_state(sma, ecc, inc_deg, raan_deg, aop_deg, ta_deg) -> tuple:
    inc  = np.radians(inc_deg)
    raan = np.radians(raan_deg)
    aop  = np.radians(aop_deg)
    ta   = np.radians(ta_deg)
    p = sma * (1.0 - ecc**2)
    r_mag = p / (1.0 + ecc * np.cos(ta))
    r_pf = r_mag * np.array([np.cos(ta), np.sin(ta), 0.0])
    v_pf = np.sqrt(MU / p) * np.array([-np.sin(ta), ecc + np.cos(ta), 0.0])
    cos_O, sin_O = np.cos(raan), np.sin(raan)
    cos_i, sin_i = np.cos(inc), np.sin(inc)
    cos_w, sin_w = np.cos(aop), np.sin(aop)
    R = np.array([
        [cos_O*cos_w - sin_O*sin_w*cos_i,
         -cos_O*sin_w - sin_O*cos_w*cos_i, sin_O*sin_i],
        [sin_O*cos_w + cos_O*sin_w*cos_i,
         -sin_O*sin_w + cos_O*cos_w*cos_i, -cos_O*sin_i],
        [sin_w*sin_i, cos_w*sin_i, cos_i]
    ])
    return R @ r_pf, R @ v_pf
