"""
AETHER ACM — Global Simulation State Manager
"""
import asyncio
import time
import logging
from datetime import datetime, timezone
from typing import Dict, List
import numpy as np

from backend.config import SK_RADIUS_KM, M_FUEL_INIT
from backend.engine.initializer import generate_constellation, generate_debris_field

logger = logging.getLogger("aether.state")


class SimulationState:
    def __init__(self):
        self.sim_time: float = time.time()
        self.satellites: Dict = {}
        self.debris: Dict = {}
        self.active_cdms: List = []
        self.maneuver_queue: List = []
        self.total_delta_v_ms: float = 0.0
        self.total_cdms_generated: int = 0
        self.collisions_avoided: int = 0
        self._initialized: bool = False

    def initialize_constellation(self):
        if self._initialized:
            return
        logger.info("Initializing AETHER constellation...")
        self.satellites = generate_constellation(
            n_planes=5, sats_per_plane=10, alt_km=550.0, inc_deg=53.0)
        self.debris = generate_debris_field(n_debris=2000, seed=42)
        self._initialized = True
        logger.info(f"  Satellites: {len(self.satellites)}")
        logger.info(f"  Debris: {len(self.debris)}")

    def get_sat_states_dict(self):
        return {sid: s["state"] for sid, s in self.satellites.items()
                if s["status"] not in ("GRAVEYARD", "LOST")}

    def get_debris_states_dict(self):
        return {did: d["state"] for did, d in self.debris.items()}

    def get_sat_info_dict(self):
        return {
            sid: {"state": s["state"], "status": s["status"],
                  "mass_kg": s["mass"], "mass": s["mass"]}
            for sid, s in self.satellites.items()
        }

    def fleet_fuel_percent(self):
        active = [s for s in self.satellites.values() if s["status"] != "GRAVEYARD"]
        if not active:
            return 0.0
        return sum(s["fuel"] / M_FUEL_INIT * 100.0 for s in active) / len(active)


state = SimulationState()
