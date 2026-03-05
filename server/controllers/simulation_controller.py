from flask import request, jsonify
import os
from services.simulation_service import build_simulation_from_root
from services.upload_service import get_active_root
from utils.json_utils import to_json_safe
from utils.plot_builder import build_collision_figure

# Rota para simular eventos a partir do arquivo ROOT ativo
def simulate_event():
    data = request.get_json(silent=True) or {}

    start_event = data.get("start_event", 0)
    n_events = data.get("num_events", 1)

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

    active = get_active_root()
    file_path = active.get("path")
    if not file_path:
        return jsonify({
            "error": "Nenhum arquivo ROOT foi enviado ainda.",
            "error_code": "ROOT_NOT_FOUND"
        }), 400
    if not os.path.exists(file_path):
        return jsonify({
            "error": "O arquivo ROOT ativo não existe mais no disco.",
            "error_code": "ROOT_MISSING_ON_DISK"
        }), 404

    try:
        result = build_simulation_from_root(
            file_path=file_path,
            start_event=start_event,
            n_events=n_events
        )
    except IndexError as exc:
        return jsonify({
            "error": str(exc),
            "error_code": "EVENT_OUT_OF_RANGE"
        }), 422
    except (ValueError, KeyError) as exc:
        return jsonify({
            "error": str(exc),
            "error_code": "INVALID_SIMULATION_INPUT"
        }), 400
    except FileNotFoundError:
        return jsonify({
            "error": "Nao foi possivel abrir o arquivo ROOT ativo.",
            "error_code": "ROOT_OPEN_ERROR"
        }), 404
    except Exception:
        return jsonify({
            "error": "Erro interno ao processar simulacao.",
            "error_code": "SIMULATION_INTERNAL_ERROR"
        }), 500

    safe_result = to_json_safe(result)
    return build_collision_figure(safe_result)
