"""
AETHER ACM — Maneuver Planning & Execution Engine
====================================================
RTN-frame burns, Tsiolkovsky fuel model, evasion/recovery/graveyard maneuvers.
"""
import numpy as np
from dataclasses import dataclass
from typing import Optional
import logging

from backend.config import (MU, RE, G0, ISP, M_DRY, M_FUEL_INIT, MAX_DV_MS,
                             MAX_DV_KMS, COOLDOWN_S, SK_RADIUS_KM, EOL_THRESHOLD,
                             SIGNAL_LATENCY_S)
from backend.engine.propagator import propagate, compute_orbital_period
from backend.engine.coordinates import rtn_to_eci, eci_to_rtn, state_to_keplerian

logger = logging.getLogger("aether.maneuver")


@dataclass
class Burn:
    burn_id: str
    burn_time_unix: float
    dv_eci_kms: np.ndarray
    dv_rtn_kms: np.ndarray
    dv_magnitude_ms: float
    fuel_cost_kg: float
    burn_type: str
    reason: str


def tsiolkovsky(dv_ms: float, m_current_kg: float) -> float:
    """Δm = m × (1 - e^(-ΔV / (Isp × g0)))"""
    if dv_ms <= 0:
        return 0.0
    return m_current_kg * (1.0 - np.exp(-dv_ms / (ISP * G0)))


def available_dv(fuel_kg: float, m_dry_kg: float = M_DRY) -> float:
    """Max ΔV from remaining fuel. Returns m/s."""
    m_wet = m_dry_kg + fuel_kg
    if fuel_kg <= 0:
        return 0.0
    return ISP * G0 * np.log(m_wet / m_dry_kg)


def fuel_cost(dv_ms: float, m_current_kg: float) -> float:
    return tsiolkovsky(dv_ms, m_current_kg)


def plan_evasion_burn(sat_state, deb_state, tca_offset_s, miss_dist_km,
                      m_current_kg, standoff_km=0.500):
    """Plan minimum-ΔV evasion using CW linearized relative motion."""
    if tca_offset_s < SIGNAL_LATENCY_S + 30:
        return None
    r_sat = sat_state[:3]
    v_sat = sat_state[3:]
    r_mag = np.linalg.norm(r_sat)
    n = np.sqrt(MU / r_mag**3)
    required_dv_T_kms = standoff_km / (3.0 * n * tca_offset_s)
    required_dv_T_kms = min(required_dv_T_kms, MAX_DV_KMS * 0.8)
    required_dv_T_kms = max(required_dv_T_kms, 0.002)
    dv_rtn = np.array([0.0, -required_dv_T_kms, 0.0])
    rel_pos = deb_state[:3] - r_sat
    if np.linalg.norm(rel_pos) > 1e-6:
        radial_approach = np.dot(rel_pos / np.linalg.norm(rel_pos), r_sat / r_mag)
        if abs(radial_approach) > 0.5:
            dv_rtn[0] = -np.sign(radial_approach) * 0.001
    dv_eci = rtn_to_eci(dv_rtn, r_sat, v_sat)
    dv_mag_ms = float(np.linalg.norm(dv_eci)) * 1000.0
    if dv_mag_ms > MAX_DV_MS:
        scale = MAX_DV_MS / dv_mag_ms
        dv_eci *= scale
        dv_rtn = eci_to_rtn(dv_eci, r_sat, v_sat)
        dv_mag_ms = MAX_DV_MS
    f = tsiolkovsky(dv_mag_ms, m_current_kg)
    return Burn(
        burn_id=f"EVADE-{int(tca_offset_s)}", burn_time_unix=0,
        dv_eci_kms=dv_eci, dv_rtn_kms=dv_rtn, dv_magnitude_ms=dv_mag_ms,
        fuel_cost_kg=f, burn_type="EVASION",
        reason=f"Avoid {miss_dist_km*1000:.1f}m conjunction at TCA+{tca_offset_s:.0f}s")


def plan_recovery_burn(sat_state_post_evade, nominal_slot_state, m_current_kg):
    r_sat = sat_state_post_evade[:3]
    v_sat = sat_state_post_evade[3:]
    sat_elems = state_to_keplerian(r_sat, v_sat)
    nom_elems = state_to_keplerian(nominal_slot_state[:3], nominal_slot_state[3:])
    dSMA = nom_elems["sma_km"] - sat_elems["sma_km"]
    v_circ = np.sqrt(MU / sat_elems["sma_km"])
    dv_T = v_circ * dSMA / (2.0 * sat_elems["sma_km"])
    dv_rtn = np.array([0.0, dv_T, 0.0])
    dv_eci = rtn_to_eci(dv_rtn, r_sat, v_sat)
    dv_mag_ms = abs(dv_T) * 1000.0
    if dv_mag_ms < 0.1:
        return None
    if dv_mag_ms > MAX_DV_MS:
        dv_mag_ms = MAX_DV_MS
        scale = MAX_DV_KMS / max(np.linalg.norm(dv_rtn), 1e-10)
        dv_rtn = dv_rtn * min(scale, 1.0)
        dv_eci = rtn_to_eci(dv_rtn, r_sat, v_sat)
    f = tsiolkovsky(dv_mag_ms, m_current_kg)
    return Burn(
        burn_id="RECOVERY-SK", burn_time_unix=0,
        dv_eci_kms=dv_eci, dv_rtn_kms=dv_rtn, dv_magnitude_ms=dv_mag_ms,
        fuel_cost_kg=f, burn_type="RECOVERY",
        reason=f"Return to nominal slot (dSMA={dSMA:.3f}km)")


def plan_graveyard_burn(sat_state, m_current_kg):
    """EOL: raise orbit +300km via prograde Hohmann."""
    r_sat = sat_state[:3]
    v_sat = sat_state[3:]
    r_mag = np.linalg.norm(r_sat)
    r1 = r_mag
    r2 = r_mag + 300.0
    v1 = np.sqrt(MU / r1)
    v_transfer = np.sqrt(MU * (2.0/r1 - 1.0/((r1+r2)/2.0)))
    dv_kms = v_transfer - v1
    dv_max_kms = available_dv(m_current_kg - M_DRY, M_DRY) / 1000.0
    dv_kms = min(dv_kms, MAX_DV_KMS, dv_max_kms)
    dv_rtn = np.array([0.0, dv_kms, 0.0])
    dv_eci = rtn_to_eci(dv_rtn, r_sat, v_sat)
    dv_mag_ms = dv_kms * 1000.0
    f = tsiolkovsky(dv_mag_ms, m_current_kg)
    return Burn(
        burn_id="EOL-GRAVEYARD", burn_time_unix=0,
        dv_eci_kms=dv_eci, dv_rtn_kms=dv_rtn, dv_magnitude_ms=dv_mag_ms,
        fuel_cost_kg=f, burn_type="GRAVEYARD",
        reason="EOL: fuel below 5%, raising to graveyard orbit")


def validate_burn(dv_magnitude_km_s, current_mass_kg, last_burn_time, proposed_burn_time):
    result = {"valid": True, "reason": "OK",
              "fuel_cost_kg": 0.0, "mass_after_kg": current_mass_kg}
    dv_ms = dv_magnitude_km_s * 1000.0
    if dv_ms > MAX_DV_MS * 1.001:
        result["valid"] = False
        result["reason"] = f"ΔV {dv_ms:.1f} m/s exceeds {MAX_DV_MS:.0f} m/s limit"
        return result
    if last_burn_time and proposed_burn_time - last_burn_time < COOLDOWN_S:
        result["valid"] = False
        result["reason"] = f"Cooldown violation"
        return result
    consumed = tsiolkovsky(dv_ms, current_mass_kg)
    if consumed > current_mass_kg - M_DRY:
        result["valid"] = False
        result["reason"] = f"Insufficient fuel"
        return result
    result["fuel_cost_kg"] = consumed
    result["mass_after_kg"] = current_mass_kg - consumed
    return result


def apply_burn(state, dv_eci):
    new_state = state.copy()
    new_state[3:] += dv_eci
    return new_state


def check_station_keeping(current_state, nominal_state):
    distance = float(np.linalg.norm(current_state[:3] - nominal_state[:3]))
    return distance <= SK_RADIUS_KM, distance


def check_eol(current_mass_kg):
    fuel_remaining = current_mass_kg - M_DRY
    return fuel_remaining < M_FUEL_INIT * EOL_THRESHOLD


def global_fuel_optimizer(satellites, target_sat_id, cdm):
    target_info = satellites.get(target_sat_id)
    if not target_info:
        return target_sat_id, 0.0
    best_sat, best_dv = target_sat_id, float('inf')
    target_state = target_info["state"]
    target_r = np.linalg.norm(target_state[:3])
    for sid, sinfo in satellites.items():
        if sinfo.get("status") == "GRAVEYARD":
            continue
        s = sinfo["state"]
        r = np.linalg.norm(s[:3])
        if abs(r - target_r) > 50.0:
            continue
        v = np.linalg.norm(s[3:])
        sep_needed = max(0.0, 0.5 - getattr(cdm, 'miss_distance_km', 0.0))
        tca = getattr(cdm, 'tca_seconds', 3600.0)
        if tca < COOLDOWN_S:
            continue
        dv_est = (2.0 / 3.0) * sep_needed * v / tca
        if dv_est < best_dv:
            best_dv, best_sat = dv_est, sid
    return best_sat, best_dv
