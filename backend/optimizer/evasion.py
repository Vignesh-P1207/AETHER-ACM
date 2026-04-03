"""
AETHER ACM — Multi-Objective Evasion Optimizer
"""
import numpy as np
from typing import List, Optional
from dataclasses import dataclass
import logging

from backend.config import (MAX_DV_KMS, MAX_DV_MS, COOLDOWN_S, EOL_THRESHOLD,
                             M_FUEL_INIT, SIGNAL_LATENCY_S)
from backend.engine.maneuver import (plan_evasion_burn, plan_recovery_burn,
                                      plan_graveyard_burn, tsiolkovsky, Burn)
from backend.engine.comms import check_los_at_time, is_blind_conjunction
from backend.engine.propagator import propagate

logger = logging.getLogger("aether.optimizer")


@dataclass
class ManeuverPlan:
    cdm_id: str
    satellite_id: str
    evasion_burn: Burn
    recovery_burn: Optional[Burn]
    total_dv_ms: float
    total_fuel_kg: float
    predicted_miss_distance_km: float
    is_preemptive: bool
    uplink_time_unix: float
    confidence: float


def optimize_evasion_for_cdm(cdm, satellite, sim_unix_time, satellites):
    sat_state = satellite["state"]
    m_current = satellite["mass"]
    fuel = satellite["fuel"]
    if fuel / M_FUEL_INIT < EOL_THRESHOLD:
        return None
    is_blind, uplink_deadline = is_blind_conjunction(
        sat_state, sim_unix_time, cdm.tca_seconds + sim_unix_time)
    burn_time_unix = sim_unix_time + SIGNAL_LATENCY_S + 30
    if is_blind and uplink_deadline:
        burn_time_unix = uplink_deadline - SIGNAL_LATENCY_S
    elif is_blind and not uplink_deadline:
        return None
    last_burn = satellite.get("last_burn_time")
    if last_burn and (burn_time_unix - last_burn) < COOLDOWN_S:
        burn_time_unix = last_burn + COOLDOWN_S + 5
    dt_to_burn = max(burn_time_unix - sim_unix_time, 30)
    burn_time_unix = sim_unix_time + dt_to_burn
    sat_at_burn = propagate(sat_state, dt_to_burn)
    tca_from_burn = max(cdm.tca_seconds - dt_to_burn, 60)
    deb_state = getattr(cdm, 'debris_state_at_tca', np.zeros(6))
    if deb_state is None:
        deb_state = np.zeros(6)
    evade_burn = plan_evasion_burn(sat_at_burn, deb_state, tca_from_burn,
                                   cdm.miss_distance_km, m_current)
    if evade_burn is None:
        return None
    evade_burn.burn_time_unix = burn_time_unix
    m_after_evade = m_current - evade_burn.fuel_cost_kg
    recovery_time_unix = sim_unix_time + cdm.tca_seconds + 900
    sat_post_evade = propagate(sat_at_burn, tca_from_burn + 900)
    sat_post_evade[3:] += evade_burn.dv_eci_kms
    nominal_at_recovery = propagate(satellite["nominal_slot_state"],
                                     recovery_time_unix - sim_unix_time)
    recovery_burn = plan_recovery_burn(sat_post_evade, nominal_at_recovery, m_after_evade)
    if recovery_burn:
        recovery_burn.burn_time_unix = recovery_time_unix
    total_dv = evade_burn.dv_magnitude_ms + (recovery_burn.dv_magnitude_ms if recovery_burn else 0)
    total_fuel = evade_burn.fuel_cost_kg + (recovery_burn.fuel_cost_kg if recovery_burn else 0)
    has_los, _, _ = check_los_at_time(sat_at_burn, burn_time_unix)
    return ManeuverPlan(
        cdm_id=cdm.cdm_id, satellite_id=cdm.satellite_id,
        evasion_burn=evade_burn, recovery_burn=recovery_burn,
        total_dv_ms=total_dv, total_fuel_kg=total_fuel,
        predicted_miss_distance_km=cdm.miss_distance_km + 0.5,
        is_preemptive=is_blind, uplink_time_unix=burn_time_unix,
        confidence=0.95 if has_los else 0.3)


def check_eol_and_plan(satellites, sim_unix_time):
    eol_commands = []
    for sat_id, sat in satellites.items():
        if sat["status"] in ("GRAVEYARD", "LOST"):
            continue
        fuel_fraction = sat["fuel"] / M_FUEL_INIT
        if fuel_fraction < EOL_THRESHOLD:
            burn = plan_graveyard_burn(sat["state"], sat["mass"])
            burn.burn_time_unix = sim_unix_time + SIGNAL_LATENCY_S + 30
            eol_commands.append({"satellite_id": sat_id, "burn": burn,
                                 "reason": f"Fuel at {fuel_fraction*100:.1f}%"})
            sat["status"] = "EOL_PENDING"
    return eol_commands
