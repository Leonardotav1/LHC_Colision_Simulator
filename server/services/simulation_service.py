import numpy as np
from utils.kinemacts import pt_eta_phi_to_xyz
from utils.trajectories import (
    helical_trajectory,
    straight_trajectory,
    short_trajectory
)
from utils.root_reader import read_root_file

# Função principal para construir a simulação a partir do arquivo ROOT.
def build_simulation_from_root(
    file_path,
    start_event=0,
    n_events=1
):
    # Lê o arquivo ROOT e obtém o DataFrame dos eventos.
    df = read_root_file(file_path)

    # Define o intervalo de eventos a serem processados.
    total_events = len(df)
    end_event = min(start_event + n_events, total_events)

    print("Eventos no arquivo:", total_events)
    print("Simulando eventos:", start_event, "ate", end_event - 1)

    # Lista para armazenar todos os objetos gerados.
    all_objects = []

    # Processa cada evento no intervalo especificado.
    for i in range(start_event, end_event):
        event = df.iloc[i]
        objs = build_objects_from_event(event)
        all_objects.extend(objs)

    print("Total de objetos gerados:", len(all_objects))

    return {
        "start_event": start_event,
        "n_events": end_event - start_event,
        "objects": all_objects
    }

# Função auxiliar para construir objetos a partir de um evento.
def build_objects_from_event(event):
    # Lista para armazenar os objetos do evento.
    objects = []

    # LEPTONS RECONSTRUIDOS
    if event["lep_n"] > 0:
        for pt, eta, phi, ltype in zip(
            event["lep_pt"],
            event["lep_eta"],
            event["lep_phi"],
            event["lep_type"]
        ):
            direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=6)

            # ELETRON
            if ltype == 11:
                traj = helical_trajectory(direction, charge=-1, radius=0.6)
                objects.append({
                    "type": "electron",
                    "trajectory": traj,
                    "color": "#0800ff"
                })

            # MUON
            elif ltype == 13:
                traj = helical_trajectory(direction, charge=-1, radius=1.2)
                objects.append({
                    "type": "muon",
                    "trajectory": traj,
                    "color": "#01ae18"
                })

    # FOTONS
    if event["photon_n"] > 0:
        for pt, eta, phi in zip(
            event["photon_pt"],
            event["photon_eta"],
            event["photon_phi"]
        ):
            direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=8)
            traj = straight_trajectory(direction)
            objects.append({
                "type": "photon",
                "trajectory": traj,
                "color": "#FFFF00"
            })

    # TAUS
    if event["tau_n"] > 0:
        for pt, eta, phi in zip(
            event["tau_pt"],
            event["tau_eta"],
            event["tau_phi"]
        ):
            direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=4)
            traj = short_trajectory(direction)
            objects.append({
                "type": "tau",
                "trajectory": traj,
                "color": "#8d0081"
            })

    # JETS
    if event["jet_n"] > 0:
        for pt, eta, phi in zip(
            event["jet_pt"],
            event["jet_eta"],
            event["jet_phi"]
        ):
            direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=5)
            traj = straight_trajectory(direction, length=5)
            objects.append({
                "type": "jet",
                "trajectory": traj,
                "color": "#ff0000"
            })

    # MET
    if event["met"] > 0:
        phi = event["met_phi"]
        direction = (np.cos(phi), np.sin(phi), 0.0)
        traj = straight_trajectory(direction, length=event["met"] / 5)
        objects.append({
            "type": "met",
            "trajectory": traj,
            "color": "#00fbff"
        })

    return objects
