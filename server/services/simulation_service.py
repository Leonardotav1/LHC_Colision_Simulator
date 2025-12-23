import numpy as np
from utils.kinemacts import pt_eta_phi_to_xyz
from utils.trajectories import (
    helical_trajectory,
    straight_trajectory,
    short_trajectory
)
from utils.root_reader import read_root_file

def build_simulation_from_root(
    file_path,
    start_event=0,
    n_events=1
):
    df = read_root_file(file_path)

    total_events = len(df)
    end_event = min(start_event + n_events, total_events)

    print("Eventos no arquivo:", total_events)
    print("Simulando eventos:", start_event, "ate", end_event - 1)

    all_objects = []

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


def build_objects_from_event(event):
    objects = []

    # ELETRONS
    if event["truth_elec_n"] > 0:
        for pt, eta, phi in zip(
            event["truth_elec_pt"],
            event["truth_elec_eta"],
            event["truth_elec_phi"]
        ):
            direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=6)
            traj = helical_trajectory(direction, charge=-1, radius=0.6)
            objects.append({
                "type": "electron",
                "trajectory": traj,
                "color": "blue"
            })

    # MUONS
    if event["truth_muon_n"] > 0:
        for pt, eta, phi in zip(
            event["truth_muon_pt"],
            event["truth_muon_eta"],
            event["truth_muon_phi"]
        ):
            direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=7)
            traj = helical_trajectory(direction, charge=-1, radius=1.2)
            objects.append({
                "type": "muon",
                "trajectory": traj,
                "color": "green"
            })

    # FOTONS
    if event["truth_photon_n"] > 0:
        for pt, eta, phi in zip(
            event["truth_photon_pt"],
            event["truth_photon_eta"],
            event["truth_photon_phi"]
        ):
            direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=8)
            traj = straight_trajectory(direction)
            objects.append({
                "type": "photon",
                "trajectory": traj,
                "color": "yellow"
            })

    # TAUS
    if event["truth_tau_n"] > 0:
        for pt, eta, phi in zip(
            event["truth_tau_pt"],
            event["truth_tau_eta"],
            event["truth_tau_phi"]
        ):
            direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=4)
            traj = short_trajectory(direction)
            objects.append({
                "type": "tau",
                "trajectory": traj,
                "color": "purple"
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
                "style": "cone",
                "color": "red"
            })

    # MET
    if event["met"] > 0:
        phi = event["met_phi"]
        direction = (np.cos(phi), np.sin(phi), 0.0)
        traj = straight_trajectory(direction, length=event["met"] / 5)
        objects.append({
            "type": "met",
            "trajectory": traj,
            "color": "purple"
        })

    return objects


# # Função para construir a simulação a partir do arquivo ROOT
# def build_simulation_from_root(file_path, event_index, max_objects):
#     # Lê o arquivo ROOT
#     df = read_root_file(file_path)

#     print("Número total de eventos no arquivo:", len(df))

#     # print(df.columns.tolist())

#     # for i in range(5):
#     #     event = df.iloc[i]
#     #     print(f"Evento {i}:",
#     #         len(event["truth_elec_pt"]) if "truth_elec_pt" in df.columns else 0)

#     # Seleciona o evento específico
#     event = df.iloc[event_index]

#     print("Evento:", event_index)

#     print("truth_elec_n:", event["truth_elec_n"])
#     print("truth_muon_n:", event["truth_muon_n"])
#     print("truth_tau_n:", event["truth_tau_n"])
#     print("truth_photon_n:", event["truth_photon_n"])
#     print("jet_n:", event["jet_n"])



#     # Lista para armazenar os objetos da simulação
#     objects = []

#     # Eletrons 
#     if "truth_elec_pt" in df.columns:
#         for pt, eta, phi in zip(
#             event["truth_elec_pt"],
#             event["truth_elec_eta"],
#             event["truth_elec_phi"]
#         ):
#             # Calcula a direção 3D a partir de pt, eta, phi
#             direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=6)

#             # Gera a trajetória helicoidal para o elétron
#             traj = helical_trajectory(
#                 direction,
#                 charge=-1,
#                 radius=0.6
#             )

#             # Adiciona o elétron à lista de objetos
#             objects.append({
#                 "type": "electron",
#                 "trajectory": traj,
#                 "color": "blue"
#             })

#     # Muons
#     if "truth_muon_pt" in df.columns:
#         for pt, eta, phi in zip(
#             event["truth_muon_pt"],
#             event["truth_muon_eta"],
#             event["truth_muon_phi"]
#         ):
#             # Calcula a direção 3D a partir de pt, eta, phi
#             direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=7)

#             # Gera a trajetória helicoidal para o múon
#             traj = helical_trajectory(
#                 direction,
#                 charge=-1,
#                 radius=1.2
#             )

#             # Adiciona o múon à lista de objetos
#             objects.append({
#                 "type": "muon",
#                 "trajectory": traj,
#                 "color": "green"
#             })

#     # Fotons
#     if "truth_photon_pt" in df.columns:
#         for pt, eta, phi in zip(
#             event["truth_photon_pt"],
#             event["truth_photon_eta"],
#             event["truth_photon_phi"]
#         ):
#             direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=8)

#             traj = straight_trajectory(direction)

#             objects.append({
#                 "type": "photon",
#                 "trajectory": traj,
#                 "color": "yellow"
#             })

#     # TAUS
#     if "truth_tau_pt" in df.columns:
#         for pt, eta, phi in zip(
#             event["truth_tau_pt"],
#             event["truth_tau_eta"],
#             event["truth_tau_phi"]
#         ):
#             direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=4)

#             traj = short_trajectory(direction)

#             objects.append({
#                 "type": "tau",
#                 "trajectory": traj,
#                 "color": "purple"
#             })

#     # JETS 
#     if "jet_pt" in df.columns:
#         for pt, eta, phi in zip(
#             event["jet_pt"],
#             event["jet_eta"],
#             event["jet_phi"]
#         ):
#             direction = pt_eta_phi_to_xyz(pt, eta, phi, scale=5)

#             traj = straight_trajectory(direction, length=5)

#             objects.append({
#                 "type": "jet",
#                 "trajectory": traj,
#                 "direction": direction,
#                 "style": "cone",
#                 "color": "red"
#             })

#     # MET 
#     if "met" in df.columns:
#         met = event["met"]
#         phi = event["met_phi"]

#         direction = (
#             np.cos(phi),
#             np.sin(phi),
#             0.0
#         )

#         traj = straight_trajectory(direction, length=met / 5)

#         objects.append({
#             "type": "met",
#             "trajectory": traj,
#             "color": "purple"
#         })

#     print("Total de objetos criados:", len(objects))

#     return {
#         "event": event_index,
#         "objects": objects
#     }
