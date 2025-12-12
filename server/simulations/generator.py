import random
import math

from simulations.constants import (
    MIN_R,
    MAX_R,
    DEFAULT_SPEED,
    DT_DEFAULT
)

from simulations.trajectory import (
    build_random_trajectory
)


def build_pp_event_trajectories(n_particles, t_max, dt=DT_DEFAULT):
    trajectories = []

    for _ in range(n_particles):
        # raio inicial aleatorio
        r = random.uniform(MIN_R, MAX_R)

        # direcao aleatoria
        angle = random.uniform(0, 2 * math.pi)

        # cria trajetoria
        traj = build_random_trajectory(
            r=r,
            angle=angle,
            speed=DEFAULT_SPEED
        )

        # evolui no tempo
        t = 0.0
        while t <= t_max:
            traj.step(dt)
            t += dt

        trajectories.append(traj)

    # retorna todas as trajetorias em forma serializavel
    return [traj.to_dict() for traj in trajectories]
