import numpy as np
from simulations.constants import (
    TRACKER_RADIUS_CM,
    TRACKER_HALF_Z_CM,
    CALO_RADIUS_CM,
    CALO_HALF_Z_CM,
    MUON_RADIUS_CM,
    MUON_HALF_Z_CM,
)


def _normalize(vec):
    arr = np.array(vec, dtype=float)
    norm = np.linalg.norm(arr) + 1e-12
    return arr / norm


def helical_trajectory(direction, charge, steps=120, radius=5.0, pitch_per_turn=15.0, turns=4.0):
    """Build a helix around the direction axis.

    Distances are in centimeters.
    """
    v = _normalize(direction)

    # Build an orthonormal basis around v.
    if abs(v[2]) < 0.9:
        perp = np.cross(v, [0.0, 0.0, 1.0])
    else:
        perp = np.cross(v, [0.0, 1.0, 0.0])

    perp = _normalize(perp)
    perp2 = _normalize(np.cross(v, perp))

    t = np.linspace(0.0, 2.0 * np.pi * turns, steps)
    q_sign = 1.0 if charge >= 0 else -1.0
    points = []

    for ti in t:
        axial = pitch_per_turn * (ti / (2.0 * np.pi))
        pos = (
            v * axial
            + perp * (radius * np.cos(ti) * q_sign)
            + perp2 * (radius * np.sin(ti))
        )
        points.append(tuple(float(x) for x in pos))

    return points


def straight_trajectory(direction, length=6.0, steps=60):
    u = _normalize(direction)
    t = np.linspace(0.0, float(length), int(steps))

    x = u[0] * t
    y = u[1] * t
    z = u[2] * t

    return list(zip(x.tolist(), y.tolist(), z.tolist()))


def short_trajectory(direction, length=1.5, steps=20):
    return straight_trajectory(direction, length=length, steps=steps)


def clip_trajectory_to_cylinder(points, radius_cm, half_z_cm, stop_reason):
    """Keep points until first exit from a cylindrical volume."""
    kept = []

    for point in points:
        x, y, z = point
        r_xy = float(np.hypot(x, y))

        if r_xy > radius_cm or abs(z) > half_z_cm:
            if kept:
                return kept, stop_reason
            return [point], stop_reason

        kept.append(point)

    return kept, "within_volume"


def trim_trajectory_to_detector(points):
    """Clip a trajectory at the outer muon-system envelope."""
    kept, reason = clip_trajectory_to_cylinder(
        points,
        radius_cm=MUON_RADIUS_CM,
        half_z_cm=MUON_HALF_Z_CM,
        stop_reason="out_of_acceptance",
    )

    # Track where it crosses detector envelopes (for diagnostics).
    crossed_tracker = any(np.hypot(x, y) >= TRACKER_RADIUS_CM or abs(z) >= TRACKER_HALF_Z_CM for x, y, z in kept)
    crossed_calo = any(np.hypot(x, y) >= CALO_RADIUS_CM or abs(z) >= CALO_HALF_Z_CM for x, y, z in kept)

    if reason == "within_volume":
        if crossed_calo:
            reason = "hit_calo"
        elif crossed_tracker:
            reason = "hit_tracker"
        else:
            reason = "contained"

    return kept, reason
