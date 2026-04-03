"""
AETHER ACM — Global Burn Scheduler
"""
import logging
from typing import List
from backend.config import COOLDOWN_S

logger = logging.getLogger("aether.scheduler")


def detect_conflicts(scheduled_burns, new_burn):
    conflicts = []
    sat_id = new_burn["satellite_id"]
    burn_time = new_burn["burn_time_unix"]
    for existing in scheduled_burns:
        if existing["satellite_id"] == sat_id:
            dt = abs(burn_time - existing["burn_time_unix"])
            if dt < COOLDOWN_S:
                conflicts.append(f"Cooldown conflict: {dt:.0f}s < {COOLDOWN_S}s")
    return conflicts


def schedule_burn_with_priority(scheduled_burns, new_burn, priority="NORMAL"):
    conflicts = detect_conflicts(scheduled_burns, new_burn)
    if conflicts and priority != "CRITICAL":
        return False, f"Conflicts: {'; '.join(conflicts)}"
    if conflicts and priority == "CRITICAL":
        sat_id = new_burn["satellite_id"]
        scheduled_burns[:] = [
            b for b in scheduled_burns
            if not (b["satellite_id"] == sat_id and
                    abs(b["burn_time_unix"] - new_burn["burn_time_unix"]) < COOLDOWN_S)]
    scheduled_burns.append(new_burn)
    return True, "Scheduled"
