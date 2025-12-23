import numpy as np

def helical_trajectory(direction, charge, steps=80, radius=1.0, pitch=0.15):
    print(direction)
    dx, dy, dz = direction

    t = np.linspace(0, 6 * np.pi, steps)

    # Base helix no plano XY
    hx = radius * np.cos(t) * charge
    hy = radius * np.sin(t)
    hz = pitch * t 

    # Projetar a helix na direção da partícula
    x = hx * abs(dy) + dx * t * 0.05
    y = hy * abs(dx) + dy * t * 0.05
    z = dz * t

    return list(zip(x, y, z))


def straight_trajectory(direction, length=6.0, steps=30):
    dx, dy, dz = direction

    t = np.linspace(0, length, steps)

    x = dx * t
    y = dy * t
    z = dz * t

    return list(zip(x, y, z))


def short_trajectory(direction, length=1.5, steps=10):
    return straight_trajectory(direction, length, steps)
