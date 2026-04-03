"""
AETHER ACM — Ground Station Communications Module
====================================================
LOS checking, communication windows, blind conjunction handling.
"""
import numpy as np
from typing import Optional, List, Tuple
import logging

from backend.config import GROUND_STATIONS, SIGNAL_LATENCY_S, MIN_BURN_LEAD_S, RE
from backend.engine.coordinates import geodetic_to_ecef, eci_to_ecef, compute_elevation_angle
from backend.engine.propagator import rk4_step, propagate

logger = logging.getLogger("aether.comms")

SIGNAL_LATENCY = SIGNAL_LATENCY_S


def check_los_at_time(sat_state_eci, unix_time):
    sat_ecef = eci_to_ecef(sat_state_eci[:3], unix_time)
    best_el = -90.0
    best_gs = None
    for gs in GROUND_STATIONS:
        gs_ecef = geodetic_to_ecef(gs["lat"], gs["lon"], gs["alt_km"])
        el = compute_elevation_angle(sat_ecef, gs_ecef)
        if el > best_el:
            best_el = el
            if el >= gs["min_el"]:
                best_gs = gs["id"]
    return best_gs is not None, best_gs, best_el


def check_los(sat_eci, unix_time):
    has_los, gs_id, _ = check_los_at_time(sat_eci, unix_time)
    return has_los, gs_id


def find_next_los_window(sat_state, unix_time, search_horizon_s=7200.0, dt=30.0):
    s = sat_state.copy()
    in_window = False
    window_start = None
    window_station = None
    t = 0.0
    while t < search_horizon_s:
        s = rk4_step(s, dt)
        t += dt
        has_los, gs_id, el = check_los_at_time(s, unix_time + t)
        if has_los and not in_window:
            in_window = True; window_start = unix_time + t; window_station = gs_id
        elif not has_los and in_window:
            return (window_start, unix_time + t - dt, window_station)
    if in_window:
        return (window_start, unix_time + search_horizon_s, window_station)
    return None


def find_last_los_before(sat_state, unix_time, target_unix, dt=30.0):
    duration = target_unix - unix_time
    if duration <= 0:
        return None
    s = sat_state.copy()
    last_los_time = None
    t = 0.0
    while t < duration:
        s = rk4_step(s, dt)
        t += dt
        has_los, _, _ = check_los_at_time(s, unix_time + t)
        if has_los:
            last_los_time = unix_time + t
    return last_los_time


def compute_coverage_windows(sat_state, unix_time, horizon_s=86400.0):
    windows = []
    s = sat_state.copy()
    dt = 15.0
    current_window = None
    max_el_in_window = 0.0
    t = 0.0
    while t < horizon_s:
        s = rk4_step(s, dt)
        t += dt
        has_los, gs_id, el = check_los_at_time(s, unix_time + t)
        if has_los:
            if current_window is None:
                current_window = {"start": unix_time + t, "station_id": gs_id, "max_el": el}
                max_el_in_window = el
            else:
                max_el_in_window = max(max_el_in_window, el)
                current_window["max_el"] = max_el_in_window
        else:
            if current_window is not None:
                current_window["end"] = unix_time + t - dt
                windows.append(current_window)
                current_window = None
                max_el_in_window = 0.0
    if current_window:
        current_window["end"] = unix_time + horizon_s
        windows.append(current_window)
    return windows


def is_blind_conjunction(sat_state, unix_time, tca_unix):
    tca_dt = tca_unix - unix_time
    if tca_dt > 0:
        state_at_tca = propagate(sat_state, tca_dt, 30.0)
    else:
        state_at_tca = sat_state
    has_los_at_tca, _, _ = check_los_at_time(state_at_tca, tca_unix)
    if has_los_at_tca:
        return False, None
    last_los = find_last_los_before(sat_state, unix_time, tca_unix)
    if last_los:
        uplink_deadline = last_los - SIGNAL_LATENCY_S - MIN_BURN_LEAD_S
        if uplink_deadline > unix_time:
            return True, uplink_deadline
    return True, None


def check_blind_conjunction(sat_state, tca_time, current_time):
    is_blind, uplink_time = is_blind_conjunction(sat_state, current_time, tca_time)
    if is_blind:
        return uplink_time
    return None
