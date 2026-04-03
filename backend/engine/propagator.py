"""
AETHER ACM — RK4 Orbital Propagator with J2/J3/J4
====================================================
High-accuracy numerical integrator for LEO orbit propagation.
State vector: [x, y, z, vx, vy, vz] in ECI (J2000), units: km and km/s.
"""
import numpy as np
from backend.config import MU, RE, J2, J3, J4, RK4_SUBSTEP_SAT_S


def gravitational_acceleration(r_vec: np.ndarray) -> np.ndarray:
    """Full gravitational acceleration including J2, J3, J4 zonal harmonics."""
    x, y, z = r_vec
    r = np.linalg.norm(r_vec)
    r2 = r * r
    r3 = r2 * r
    r5 = r2 * r3
    z2 = z * z

    # Two-body Keplerian
    a_2body = -MU / r3 * r_vec

    # J2 perturbation
    J2_factor = (3.0 / 2.0) * J2 * MU * RE**2 / r5
    z2_r2 = z2 / r2
    a_J2 = J2_factor * np.array([
        x * (5.0 * z2_r2 - 1.0),
        y * (5.0 * z2_r2 - 1.0),
        z * (5.0 * z2_r2 - 3.0)
    ])

    # J3 perturbation
    r7 = r5 * r2
    J3_factor = (1.0 / 2.0) * J3 * MU * RE**3 / r7
    a_J3 = J3_factor * np.array([
        5.0 * x * (7.0 * z2_r2 * z / r - 3.0 * z / r),
        5.0 * y * (7.0 * z2_r2 * z / r - 3.0 * z / r),
        3.0 * r2 - 30.0 * z2 + 35.0 * z2 * z2 / r2
    ])

    # J4 perturbation
    J4_factor = (5.0 / 8.0) * J4 * MU * RE**4 / r7
    z4_r4 = z2 * z2 / (r2 * r2)
    a_J4 = J4_factor * np.array([
        x * (3.0 - 42.0 * z2_r2 + 63.0 * z4_r4),
        y * (3.0 - 42.0 * z2_r2 + 63.0 * z4_r4),
        z * (15.0 - 70.0 * z2_r2 + 63.0 * z4_r4)
    ])

    return a_2body + a_J2 + a_J3 + a_J4


def eom(state: np.ndarray) -> np.ndarray:
    r = state[:3]
    v = state[3:]
    a = gravitational_acceleration(r)
    return np.concatenate([v, a])


def rk4_step(state: np.ndarray, dt: float) -> np.ndarray:
    """Classic 4th-order Runge-Kutta step. O(dt⁴) global error."""
    k1 = eom(state)
    k2 = eom(state + 0.5 * dt * k1)
    k3 = eom(state + 0.5 * dt * k2)
    k4 = eom(state + dt * k3)
    return state + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)


def propagate(state: np.ndarray, total_seconds: float,
              substep: float = RK4_SUBSTEP_SAT_S) -> np.ndarray:
    """Propagate state vector forward using RK4 + J2/J3/J4."""
    if total_seconds <= 0:
        return state.copy()
    current = state.copy()
    n_steps = int(total_seconds / substep)
    remainder = total_seconds - n_steps * substep
    for _ in range(n_steps):
        current = rk4_step(current, substep)
    if remainder > 1e-9:
        current = rk4_step(current, remainder)
    return current


def propagate_trajectory(state: np.ndarray, total_seconds: float,
                         output_interval: float = 30.0,
                         substep: float = 10.0) -> tuple:
    """Propagate and return full trajectory at regular intervals."""
    n_outputs = int(total_seconds / output_interval) + 1
    times = np.zeros(n_outputs)
    states = np.zeros((n_outputs, 6))
    current = state.copy()
    states[0] = current
    times[0] = 0.0
    current_time = 0.0
    output_idx = 1
    while output_idx < n_outputs:
        next_output = output_idx * output_interval
        dt_to_next = next_output - current_time
        steps = int(dt_to_next / substep)
        for _ in range(steps):
            current = rk4_step(current, substep)
        rem = dt_to_next - steps * substep
        if rem > 1e-10:
            current = rk4_step(current, rem)
        current_time = next_output
        times[output_idx] = current_time
        states[output_idx] = current
        output_idx += 1
    return times, states


def compute_orbital_period(sma_km: float) -> float:
    return 2.0 * np.pi * np.sqrt(abs(sma_km)**3 / MU)


def compute_circular_velocity(alt_km: float) -> float:
    return np.sqrt(MU / (RE + alt_km))


def orbital_energy(state: np.ndarray) -> float:
    r = np.linalg.norm(state[:3])
    v = np.linalg.norm(state[3:])
    return 0.5 * v**2 - MU / r


def orbital_period_from_state(state: np.ndarray) -> float:
    energy = orbital_energy(state)
    if energy >= 0:
        return 1e9
    sma = -MU / (2.0 * energy)
    return compute_orbital_period(sma)
