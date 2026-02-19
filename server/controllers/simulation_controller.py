from flask import current_app, request, jsonify
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
    file_path = "uploads/ODEO_FEB2025_v0_3J1LMET30_mc_301204.Pythia8EvtGen_A14MSTW2008LO_Zprime_NoInt_ee_SSM3000.3J1LMET30.root"
    if not file_path:
        return jsonify({"error": "Nenhum arquivo ROOT foi enviado ainda."}), 400

    result = build_simulation_from_root(
        file_path=file_path,
        start_event=start_event,
        n_events=n_events
    )

    safe_result = to_json_safe(result)
    return build_collision_figure(safe_result)
