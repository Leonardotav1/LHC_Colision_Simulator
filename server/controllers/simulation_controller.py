import json
from flask import request, jsonify
from services.simulation_service import build_simulation_from_root
from utils.json_utils import to_json_safe
from utils.plot_builder import build_collision_figure

# Definindo o caminho fixo para o arquivo ROOT
ROOT_FILE_PATH = "./upload/Arquivo_lhc_lep.root"

def simulate_event():
    #Pega os dados do frontend
    data = request.get_json(silent=True) or {}

    # Extrai os parâmetros com valores padrão
    start_event = data.get("start_event", 1)
    n_events = data.get("num_events", 10200)

    result = build_simulation_from_root(
        file_path=ROOT_FILE_PATH,
        start_event=start_event,
        n_events=n_events
    )

    safe_result = to_json_safe(result)

    # # Extrai o caminho do arquivo ROOT
    # file_path = data.get("file_path")

    # if not file_path:
    #     return jsonify({"error": "file_path is required"}), 400

    # # Chama o serviço para construir a simulação    
    # fig_json = build_simulation_from_root(file_path)

    # print(json.dumps(safe_result, indent=1))
    
    # return safe_result
    return build_collision_figure(safe_result)
