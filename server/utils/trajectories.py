import numpy as np

def helical_trajectory(direction, charge, steps=60, radius=5.0, pitch=0.4):
    dx, dy, dz = direction

    # Normaliza a direção
    v = np.array([dx, dy, dz], dtype=float)
    v = v / np.linalg.norm(v)

    # Vetor perpendicular qualquer
    if abs(v[2]) < 0.9:
        perp = np.cross(v, [0, 0, 1])
    else:
        perp = np.cross(v, [0, 1, 0])

    perp = perp / np.linalg.norm(perp)

    # Outro vetor perpendicular (base ortonormal)
    perp2 = np.cross(v, perp)

    t = np.linspace(0, 8 * np.pi, steps)

    points = []

    for i, ti in enumerate(t):
        pos = (
            v * (pitch * ti) +
            perp * (radius * np.cos(ti) * charge) +
            perp2 * (radius * np.sin(ti))
        )
        points.append(tuple(pos))

    return points


def straight_trajectory(direction, length=6.0, steps=30):
    dx, dy, dz = direction

    t = np.linspace(0, length, steps)

    x = dx * t
    y = dy * t
    z = dz * t

    return list(zip(x, y, z))


def short_trajectory(direction, length=1.5, steps=10):
    return straight_trajectory(direction, length, steps)
