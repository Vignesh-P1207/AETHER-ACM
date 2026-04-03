"""
AETHER ACM — Conjunction Assessment Engine
=============================================
Two-phase: KD-Tree coarse filter O(N log N) + Golden-section TCA refinement.
"""
import numpy as np
from scipy.spatial import KDTree
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from enum import Enum
import time
import logging

from backend.config import (CDM_CRITICAL_KM, CDM_WARNING_KM, CDM_CAUTION_KM,
                             COARSE_FILTER_KM, CONJUNCTION_HORIZON, TCA_SAMPLE_DT)
from backend.engine.propagator import propagate, propagate_trajectory

logger = logging.getLogger("aether.conjunction")


class CDMRiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING  = "WARNING"
    CAUTION  = "CAUTION"
    SAFE     = "SAFE"


@dataclass
class ConjunctionDataMessage:
    cdm_id: str
    satellite_id: str
    debris_id: str
    tca_seconds: float
    miss_distance_km: float
    risk_level: CDMRiskLevel
    relative_velocity_km_s: float = 0.0
    satellite_position: Optional[np.ndarray] = field(default=None, repr=False)
    debris_position: Optional[np.ndarray] = field(default=None, repr=False)
    satellite_state_at_tca: Optional[np.ndarray] = field(default=None, repr=False)
    debris_state_at_tca: Optional[np.ndarray] = field(default=None, repr=False)
    probability_of_collision: float = 0.0
    evasion_scheduled: bool = False
    created_at: float = field(default_factory=time.time)
    action_taken: str = "NONE"

    def to_dict(self) -> dict:
        return {
            "cdm_id": self.cdm_id,
            "satellite_id": self.satellite_id,
            "debris_id": self.debris_id,
            "tca_seconds": round(self.tca_seconds, 2),
            "miss_distance_km": round(self.miss_distance_km, 6),
            "risk_level": self.risk_level.value,
            "relative_velocity_km_s": round(self.relative_velocity_km_s, 4),
            "probability_of_collision": round(self.probability_of_collision, 8),
            "evasion_scheduled": self.evasion_scheduled,
            "action_taken": self.action_taken,
        }


def classify_risk(miss_distance_km: float) -> CDMRiskLevel:
    if miss_distance_km < CDM_CRITICAL_KM:
        return CDMRiskLevel.CRITICAL
    elif miss_distance_km < CDM_WARNING_KM:
        return CDMRiskLevel.WARNING
    elif miss_distance_km < CDM_CAUTION_KM:
        return CDMRiskLevel.CAUTION
    return CDMRiskLevel.SAFE


def estimate_probability_of_collision(miss_dist_km: float, rel_vel_kms: float,
                                      sat_radius_km: float = 0.005,
                                      deb_radius_km: float = 0.001) -> float:
    R_combined = sat_radius_km + deb_radius_km
    if miss_dist_km <= R_combined:
        return 1.0
    sigma = max(miss_dist_km / 3.0, 0.001)
    Pc = (np.pi * R_combined**2) / (2.0 * np.pi * sigma**2) * np.exp(
        -miss_dist_km**2 / (2.0 * sigma**2))
    return min(float(Pc), 1.0)


def kdtree_coarse_filter(sat_positions: np.ndarray,
                          debris_positions: np.ndarray,
                          threshold_km: float = COARSE_FILTER_KM
                          ) -> List[Tuple[int, List[int]]]:
    if len(debris_positions) == 0 or len(sat_positions) == 0:
        return []
    tree = KDTree(debris_positions)
    candidates = []
    for sat_idx in range(len(sat_positions)):
        nearby = tree.query_ball_point(sat_positions[sat_idx], threshold_km)
        if nearby:
            candidates.append((sat_idx, nearby))
    return candidates


def golden_section_refine(sat_state: np.ndarray, deb_state: np.ndarray,
                          t_center: float, half_window: float = 60.0,
                          substep: float = 10.0, tol: float = 0.5
                          ) -> Tuple[float, float]:
    golden = (np.sqrt(5.0) - 1.0) / 2.0
    a = max(0.0, t_center - half_window)
    b = t_center + half_window

    def distance_at(t):
        r_sat = propagate(sat_state, t, substep)[:3]
        r_deb = propagate(deb_state, t, substep)[:3]
        return float(np.linalg.norm(r_sat - r_deb))

    c = b - golden * (b - a)
    d = a + golden * (b - a)
    fc = distance_at(c)
    fd = distance_at(d)
    for _ in range(25):
        if abs(b - a) < tol:
            break
        if fc < fd:
            b = d; d = c; fd = fc
            c = b - golden * (b - a); fc = distance_at(c)
        else:
            a = c; c = d; fc = fd
            d = a + golden * (b - a); fd = distance_at(d)
    tca = (a + b) / 2.0
    miss = distance_at(tca)
    return tca, miss


def _fast_min_distance_screen(sat_state: np.ndarray, deb_state: np.ndarray,
                               window: float = 7200.0, step: float = 600.0) -> float:
    """Unused — kept for reference."""
    _, sat_traj = propagate_trajectory(sat_state, window, output_interval=step, substep=60.0)
    _, deb_traj = propagate_trajectory(deb_state, window, output_interval=step, substep=60.0)
    seps = np.linalg.norm(sat_traj[:, :3] - deb_traj[:, :3], axis=1)
    return float(np.min(seps))


def assess_conjunction_pair(sat_id, deb_id, sat_state, deb_state,
                            prediction_window=21600.0, sample_interval=60.0,
                            substep=10.0, sim_time=0.0):
    _, sat_traj = propagate_trajectory(sat_state, prediction_window, sample_interval, substep)
    _, deb_traj = propagate_trajectory(deb_state, prediction_window, sample_interval, substep)
    separations = np.linalg.norm(sat_traj[:, :3] - deb_traj[:, :3], axis=1)
    min_idx = np.argmin(separations)
    min_dist = separations[min_idx]
    if min_dist > CDM_CAUTION_KM * 2.0:
        return None
    t_approx = min_idx * sample_interval
    tca, miss_distance = golden_section_refine(
        sat_state, deb_state, t_approx,
        half_window=sample_interval, substep=substep)
    risk = classify_risk(miss_distance)
    if risk == CDMRiskLevel.SAFE:
        return None
    sat_at_tca = propagate(sat_state, tca, substep)
    deb_at_tca = propagate(deb_state, tca, substep)
    rel_vel = float(np.linalg.norm(sat_at_tca[3:] - deb_at_tca[3:]))
    Pc = estimate_probability_of_collision(miss_distance, rel_vel)
    cdm_id = f"CDM-{sat_id}-{deb_id}-{int(sim_time)}"
    return ConjunctionDataMessage(
        cdm_id=cdm_id, satellite_id=sat_id, debris_id=deb_id,
        tca_seconds=tca, miss_distance_km=miss_distance, risk_level=risk,
        relative_velocity_km_s=rel_vel,
        satellite_position=sat_at_tca[:3].copy(),
        debris_position=deb_at_tca[:3].copy(),
        satellite_state_at_tca=sat_at_tca.copy(),
        debris_state_at_tca=deb_at_tca.copy(),
        probability_of_collision=Pc,
    )


RE_KM = 6378.137  # Earth radius for altitude calculation
MU_KM = 398600.4418  # km³/s²


def _altitude_km(state: np.ndarray) -> float:
    return float(np.linalg.norm(state[:3])) - RE_KM


def _two_body_positions_batch(states: np.ndarray, times: np.ndarray) -> np.ndarray:
    """
    Vectorized analytical two-body position for a batch of objects.
    states: (N, 6) — ECI state vectors
    times:  (T,)   — time offsets in seconds
    returns: (N, T, 3) — positions at each time
    """
    N = states.shape[0]
    T = times.shape[0]

    r0 = states[:, :3]   # (N, 3)
    v0 = states[:, 3:]   # (N, 3)

    r_mag = np.linalg.norm(r0, axis=1, keepdims=True)  # (N, 1)
    v_mag = np.linalg.norm(v0, axis=1, keepdims=True)  # (N, 1)

    # Angular momentum h = r × v
    h = np.cross(r0, v0)                               # (N, 3)
    h_mag = np.linalg.norm(h, axis=1, keepdims=True)   # (N, 1)

    # Orbit normal and frame vectors
    h_hat = h / np.maximum(h_mag, 1e-10)               # (N, 3)
    r_hat = r0 / np.maximum(r_mag, 1e-10)              # (N, 3)
    t_hat = np.cross(h_hat, r_hat)                     # (N, 3) along-track

    # Angular rate (circular approximation): theta_dot = |h| / r²
    theta_dot = h_mag[:, 0] / np.maximum(r_mag[:, 0]**2, 1e-10)  # (N,)

    # For each time: theta = theta_dot * t
    # positions[i, t] = r_mag[i] * (cos(theta) * r_hat[i] + sin(theta) * t_hat[i])
    thetas = np.outer(theta_dot, times)  # (N, T)
    cos_t = np.cos(thetas)               # (N, T)
    sin_t = np.sin(thetas)               # (N, T)

    # r_hat: (N, 3) → (N, 1, 3), cos_t: (N, T) → (N, T, 1)
    r_hat_e = r_hat[:, np.newaxis, :]   # (N, 1, 3)
    t_hat_e = t_hat[:, np.newaxis, :]   # (N, 1, 3)
    cos_e = cos_t[:, :, np.newaxis]     # (N, T, 1)
    sin_e = sin_t[:, :, np.newaxis]     # (N, T, 1)
    r_mag_e = r_mag[:, np.newaxis, :]   # (N, 1, 1)

    positions = r_mag_e * (cos_e * r_hat_e + sin_e * t_hat_e)  # (N, T, 3)
    return positions


def run_conjunction_assessment(satellites, debris, sim_time=0.0,
                               prediction_window=21600.0,
                               coarse_threshold_km=50.0,
                               sample_interval=60.0):
    """
    Three-phase conjunction assessment:
    Phase 1 — Altitude-band filter (vectorized numpy).
    Phase 2 — Fully vectorized analytical two-body coarse screen — no RK4, O(N) per sat.
    Phase 3 — Full RK4 golden-section TCA refinement on surviving pairs only.
    """
    if not satellites or not debris:
        return []
    t_start = time.time()

    sat_ids = list(satellites.keys())
    deb_ids = list(debris.keys())

    sat_states_arr = np.array([satellites[sid] for sid in sat_ids])   # (50, 6)
    deb_states_arr = np.array([debris[did] for did in deb_ids])       # (2000, 6)

    # ── Phase 1: Altitude-band filter ──
    sat_alts = np.linalg.norm(sat_states_arr[:, :3], axis=1) - RE_KM  # (50,)
    deb_alts = np.linalg.norm(deb_states_arr[:, :3], axis=1) - RE_KM  # (2000,)
    ALT_BAND_KM = 80.0

    # ── Phase 2: Vectorized analytical coarse screen ──
    SCREEN_STEP = 600.0
    SCREEN_WINDOW = min(prediction_window, 7200.0)
    SCREEN_THRESHOLD_KM = 20.0
    screen_times = np.arange(0.0, SCREEN_WINDOW + SCREEN_STEP, SCREEN_STEP)  # (T,)

    # Pre-compute ALL satellite positions at screen times: (50, T, 3)
    sat_screen_pos = _two_body_positions_batch(sat_states_arr, screen_times)

    # Pre-compute ALL debris positions at screen times: (2000, T, 3)
    deb_screen_pos = _two_body_positions_batch(deb_states_arr, screen_times)

    cdm_list = []
    pairs_checked = 0
    pairs_refined = 0

    for i, sid in enumerate(sat_ids):
        sat_alt = sat_alts[i]

        # Phase 1: altitude mask → candidate debris indices
        alt_mask = np.abs(deb_alts - sat_alt) < ALT_BAND_KM
        cand_idx = np.where(alt_mask)[0]
        if len(cand_idx) == 0:
            continue

        # Phase 2: vectorized distance computation for all candidates at once
        # sat_pos_i: (T, 3) → broadcast against (n_cands, T, 3)
        diffs = deb_screen_pos[cand_idx] - sat_screen_pos[i][np.newaxis, :, :]  # (n_cands, T, 3)
        dists = np.linalg.norm(diffs, axis=2)   # (n_cands, T)
        min_dists = np.min(dists, axis=1)        # (n_cands,)

        close_mask = min_dists < SCREEN_THRESHOLD_KM
        close_cand_idx = cand_idx[close_mask]
        pairs_checked += len(cand_idx)

        # Phase 3: full RK4 TCA refinement on survivors
        for j in close_cand_idx:
            did = deb_ids[j]
            pairs_refined += 1
            cdm = assess_conjunction_pair(
                sid, did, satellites[sid], debris[did],
                prediction_window=prediction_window,
                sample_interval=sample_interval,
                sim_time=sim_time)
            if cdm is not None:
                cdm_list.append(cdm)

    cdm_list.sort(key=lambda c: (c.tca_seconds, c.miss_distance_km))
    elapsed = time.time() - t_start
    logger.info(
        f"Conjunction: {len(cdm_list)} CDMs | "
        f"{pairs_checked} screened → {pairs_refined} refined | {elapsed:.2f}s"
    )
    return cdm_list


def quick_conjunction_check(satellites, debris, threshold_km=0.1):
    if not satellites or not debris:
        return []
    sat_ids = list(satellites.keys())
    deb_ids = list(debris.keys())
    sat_pos = np.array([satellites[sid][:3] for sid in sat_ids])
    deb_pos = np.array([debris[did][:3] for did in deb_ids])
    tree = KDTree(deb_pos)
    collisions = []
    for i, pos in enumerate(sat_pos):
        dists, indices = tree.query(pos, k=min(5, len(deb_pos)))
        if np.ndim(dists) == 0:
            dists = [dists]; indices = [indices]
        for d, j in zip(dists, indices):
            if d < threshold_km:
                collisions.append((sat_ids[i], deb_ids[j], float(d)))
    return collisions
