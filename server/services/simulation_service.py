from simulations.generator import build_pp_event_trajectories
from simulations.constants import T_MAX_EVENT
from utils.plot_builder import build_plot_json


def generate_simulation(n_particles: int):
    trajectories = build_pp_event_trajectories(
        n_particles=n_particles,
        t_max=T_MAX_EVENT,
        dt=0.5
    )

    return build_plot_json(trajectories)
