from flask import request, jsonify
from services.simulation_service import simulate_event

def run_event():
    data = request.get_json()
    n = data.get("n_particles", 40)

    fig = simulate_event(n)
    return fig