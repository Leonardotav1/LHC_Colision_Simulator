from flask import request, jsonify
from services.simulation_service import generate_simulation

def simulate_event():
    try:
        params = request.json
        n = params.get("n_particles", 40)

        result = generate_simulation(n)
        return result

    except Exception as e:
        return jsonify({"error": str(e)}), 500