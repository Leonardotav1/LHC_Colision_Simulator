from flask import Blueprint
from controllers.simulation_controller import simulate_event

simulation_bp = Blueprint("simulation", __name__, url_prefix="/simulate")

@simulation_bp.post("/")
def simulate():
    return simulate_event()