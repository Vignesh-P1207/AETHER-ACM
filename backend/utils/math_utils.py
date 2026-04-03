"""
AETHER ACM — Vector Math Helpers
"""
import numpy as np


def norm3(v: np.ndarray) -> float:
    return np.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2])


def hat3(v: np.ndarray) -> np.ndarray:
    n = norm3(v)
    if n < 1e-15:
        return np.zeros(3)
    return v / n


def cross3(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.array([
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ])


def dot3(a: np.ndarray, b: np.ndarray) -> float:
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]


def angle_between(a: np.ndarray, b: np.ndarray) -> float:
    cos_angle = dot3(hat3(a), hat3(b))
    return np.arccos(np.clip(cos_angle, -1.0, 1.0))
