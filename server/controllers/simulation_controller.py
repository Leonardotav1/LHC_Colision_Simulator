from flask import request, jsonify
import os
from services.simulation_service import build_simulation_from_root
from utils.json_utils import to_json_safe
from utils.plot_builder import build_collision_figure

def simulate_event():
    data = request.get_json(silent=True) or {}

    start_event = data.get("start_event", 0)
    n_events = data.get("num_events", 1)

    # fallback seguro para None/NaN/strings invalidas
    try:
        start_event = int(start_event)
    except (TypeError, ValueError):
        start_event = 0

    try:
        n_events = int(n_events)
    except (TypeError, ValueError):
        n_events = 1

    if n_events <= 0:
        n_events = 1
    if start_event < 0:
        start_event = 0

    # Para desenvolvimento, estamos usando um caminho fixo. Em produção, isso deve ser dinâmico.
    file_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "uploads",
            "mc_410219.ttmumu.4lep.root",
        )
    )
    if not file_path:
        return jsonify({"error": "Nenhum arquivo ROOT foi enviado ainda."}), 400

    result = build_simulation_from_root(
        file_path=file_path,
        start_event=start_event,
        n_events=n_events
    )

    safe_result = to_json_safe(result)
    return build_collision_figure(safe_result)
