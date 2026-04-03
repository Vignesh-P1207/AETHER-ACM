"""
AETHER ACM — Fleet Fuel Budget Manager
"""
import math
import logging
from backend.config import M_FUEL_INIT, EOL_THRESHOLD

logger = logging.getLogger("aether.budget")


def fleet_fuel_summary(satellites):
    total_fuel = 0.0
    max_fuel = 0.0
    min_fuel = float('inf')
    active_count = 0
    eol_count = 0
    graveyard_count = 0
    fuel_histogram = {"0-10%": 0, "10-25%": 0, "25-50%": 0, "50-75%": 0, "75-100%": 0}
    for sat_id, sat in satellites.items():
        if sat["status"] == "GRAVEYARD":
            graveyard_count += 1
            continue
        fuel = sat["fuel"]
        fuel_pct = fuel / M_FUEL_INIT * 100.0
        total_fuel += fuel
        max_fuel = max(max_fuel, fuel)
        min_fuel = min(min_fuel, fuel)
        active_count += 1
        if fuel / M_FUEL_INIT < EOL_THRESHOLD:
            eol_count += 1
        if fuel_pct < 10: fuel_histogram["0-10%"] += 1
        elif fuel_pct < 25: fuel_histogram["10-25%"] += 1
        elif fuel_pct < 50: fuel_histogram["25-50%"] += 1
        elif fuel_pct < 75: fuel_histogram["50-75%"] += 1
        else: fuel_histogram["75-100%"] += 1
    avg_fuel = total_fuel / max(active_count, 1)
    total_dv_remaining = sum(
        300.0 * 9.80665 * math.log((500.0 + sat["fuel"]) / 500.0)
        for sat in satellites.values()
        if sat["status"] != "GRAVEYARD" and sat["fuel"] > 0)
    return {
        "active_satellites": active_count, "graveyard_satellites": graveyard_count,
        "eol_warning_count": eol_count,
        "total_fuel_kg": round(total_fuel, 3),
        "avg_fuel_kg": round(avg_fuel, 3),
        "avg_fuel_pct": round(avg_fuel / M_FUEL_INIT * 100.0, 1),
        "max_fuel_kg": round(max_fuel, 3),
        "min_fuel_kg": round(min_fuel, 3) if min_fuel != float('inf') else 0,
        "total_dv_remaining_ms": round(total_dv_remaining, 2),
        "fuel_histogram": fuel_histogram,
    }
