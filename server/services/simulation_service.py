# from simulations.generator import build_pp_event_trajectories
# from simulations.constants import T_MAX_EVENT
# from utils.plot_builder import build_plot_json

from flask import Response
from utils.plot_builder import build_collision_figure

def simulate_event():
    fig_json = build_collision_figure(n_products=40)
    return Response(fig_json, mimetype='application/json')