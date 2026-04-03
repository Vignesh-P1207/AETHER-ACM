"""
AETHER ACM — Time Conversion Utilities
"""
import numpy as np
from backend.config import OMEGA_EARTH


def unix_to_jd(unix_time: float) -> float:
    return unix_time / 86400.0 + 2440587.5


def jd_to_unix(jd: float) -> float:
    return (jd - 2440587.5) * 86400.0


def gmst_from_unix(unix_time: float) -> float:
    """
    Compute Greenwich Mean Sidereal Time from Unix timestamp.
    Uses IAU 1982 model. Returns angle in radians [0, 2π).
    """
    JD = unix_to_jd(unix_time)
    T = (JD - 2451545.0) / 36525.0
    gmst_sec = (24110.54841
                + 8640184.812866 * T
                + 0.093104 * T**2
                - 6.2e-6 * T**3)
    ut1_frac = (unix_time % 86400.0)
    gmst_sec += ut1_frac * 1.00273790935
    gmst_rad = (gmst_sec % 86400.0) * (2.0 * np.pi / 86400.0)
    if gmst_rad < 0:
        gmst_rad += 2.0 * np.pi
    return gmst_rad


def format_timestamp(unix_time: float) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(unix_time, tz=timezone.utc).isoformat()
