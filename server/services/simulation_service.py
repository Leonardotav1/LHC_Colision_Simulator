import numpy as np
from simulations.constants import (
    B_FIELD_T,
    MEV_TO_GEV,
    M_TO_CM,
    PHOTON_LENGTH_CM,
    JET_LENGTH_CM,
    MET_SCALE_CM_PER_GEV,
    TRACKER_RADIUS_CM,
    TRACKER_HALF_Z_CM,
    ECAL_RADIUS_CM,
    ECAL_HALF_Z_CM,
    HCAL_RADIUS_CM,
    HCAL_HALF_Z_CM,
    MUON_RADIUS_CM,
    MUON_HALF_Z_CM,
)
from utils.kinemacts import pt_eta_phi_to_xyz
from utils.trajectories import (
    helical_trajectory,
    straight_trajectory,
    short_trajectory,
    clip_trajectory_to_cylinder,
)
from utils.root_reader import read_root_file

ELECTRON_RADIUS_VISUAL_SCALE = 0.45
MIN_CHARGE_ABS = 1e-9

# Função para normalizar phi no intervalo [-pi, pi].
def _wrap_phi(phi):
    return float((phi + np.pi) % (2.0 * np.pi) - np.pi)

# Função para aplicar uma sistemática simples de variação de pt, que pode ser expandida no futuro.
def _pt_systematics(pt_gev, frac):
    return {"nominal": float(pt_gev)}

# Gerador de números aleatórios determinístico baseado em valores de entrada, para garantir que a simulação seja reproduzível para os mesmos eventos.
def _deterministic_rng(*values):
    seed = 0
    for idx, value in enumerate(values):
        try:
            val = float(value)
        except (TypeError, ValueError):
            val = 0.0
        seed_part = int(abs(val) * (10 ** (idx + 2))) & 0xFFFFFFFF
        seed = (seed * 1664525 + seed_part + 1013904223) & 0xFFFFFFFF
    return np.random.default_rng(seed)

# Função principal para construir a simulação a partir de um arquivo ROOT, processando os eventos e gerando os objetos correspondentes com suas trajetórias e resumos, enquanto lida com casos de erro como eventos fora do intervalo ou arquivos sem eventos.
def build_simulation_from_root(file_path, start_event=0, n_events=1):
    # Lê o arquivo ROOT e converte para um DataFrame.
    df = read_root_file(file_path)

    total_events = len(df)
    if total_events <= 0:
        raise ValueError("O arquivo ROOT nao possui eventos para simulacao.")

    if start_event < 0:
        raise ValueError("start_event deve ser maior ou igual a 0.")
    if n_events <= 0:
        raise ValueError("num_events deve ser maior ou igual a 1.")
    if start_event >= total_events:
        raise IndexError(
            f"Evento inicial {start_event} fora do intervalo. "
            f"Eventos disponiveis: 0 ate {total_events - 1}."
        )

    end_event = min(start_event + n_events, total_events)

    all_objects = []
    event_summaries = []
    for i in range(start_event, end_event):
        event = df.iloc[i]
        objs, summary = build_objects_from_event(event)
        all_objects.extend(objs)
        event_summaries.append(summary)

    return {
        "start_event": start_event,
        "n_events": end_event - start_event,
        "total_events": total_events,
        "objects": all_objects,
        "event_summaries": event_summaries,
    }

# Função para construir os objetos de simulação a partir dos dados de um evento, gerando as trajetórias para cada tipo de partícula (elétrons, múons, fótons, taus e jatos) e calculando o MET reconstruído a partir dos objetos visíveis, enquanto lida com casos como MET de entrada ou partículas que escapam do detector.
def build_objects_from_event(event):
    objects = []
    reco_px = 0.0
    reco_py = 0.0

    if event["lep_n"] > 0:
        for pt, eta, phi, ltype, q in zip(
            event["lep_pt"],
            event["lep_eta"],
            event["lep_phi"],
            event["lep_type"],
            event["lep_charge"],
        ):
            pt_gev = float(pt) * MEV_TO_GEV
            eta_reco = float(eta)
            phi_reco = _wrap_phi(float(phi))
            direction = pt_eta_phi_to_xyz(pt_gev, eta_reco, phi_reco)

            q_abs = max(abs(q), MIN_CHARGE_ABS)
            radius_m = pt_gev / (0.3 * q_abs * B_FIELD_T)

            if ltype == 11:
                ptype = "electron"
                color = "#0800ff"
                radius_cm = float(np.clip(radius_m * M_TO_CM * ELECTRON_RADIUS_VISUAL_SCALE, 3.0, 55.0))
                pitch_per_turn_cm = float(np.clip(radius_cm * abs(np.sinh(eta_reco)) * 0.10, 1.0, 22.0))
                turns = float(np.clip(ECAL_RADIUS_CM / max(radius_cm, 1.0), 4.0, 10.0))
                traj_raw = helical_trajectory(
                    direction,
                    charge=q,
                    radius=radius_cm,
                    pitch_per_turn=pitch_per_turn_cm,
                    turns=turns,
                    steps=220,
                )
                traj, stop_reason = clip_trajectory_to_cylinder(
                    traj_raw,
                    radius_cm=ECAL_RADIUS_CM,
                    half_z_cm=ECAL_HALF_Z_CM,
                    stop_reason="hit_ecal",
                )
            elif ltype == 13:
                ptype = "muon"
                color = "#01ae18"
                radius_cm = float(np.clip(radius_m * M_TO_CM, 350.0, 6000.0))
                pitch_per_turn_cm = float(np.clip(radius_cm * abs(np.sinh(eta_reco)) * 0.95, 80.0, 2500.0))
                traj_raw = helical_trajectory(
                    direction,
                    charge=q,
                    radius=radius_cm,
                    pitch_per_turn=pitch_per_turn_cm,
                    turns=1.4,
                    steps=220,
                )
                traj, stop_reason = clip_trajectory_to_cylinder(
                    traj_raw,
                    radius_cm=MUON_RADIUS_CM,
                    half_z_cm=MUON_HALF_Z_CM,
                    stop_reason="hit_muon_system",
                )
            else:
                continue

            objects.append(
                {
                    "type": ptype,
                    "trajectory": traj,
                    "color": color,
                    "stop_reason": stop_reason,
                    "reco": {
                        "pt_gev": _pt_systematics(pt_gev, 0.0),
                        "eta": eta_reco,
                        "phi": phi_reco,
                        "charge": int(q),
                    },
                }
            )

            reco_px += pt_gev * np.cos(phi_reco)
            reco_py += pt_gev * np.sin(phi_reco)

    if event["photon_n"] > 0:
        for pt, eta, phi in zip(event["photon_pt"], event["photon_eta"], event["photon_phi"]):
            pt_gev = float(pt) * MEV_TO_GEV
            eta = float(eta)
            phi = _wrap_phi(float(phi))
            direction = pt_eta_phi_to_xyz(pt_gev, eta, phi)

            full_traj = straight_trajectory(direction, length=PHOTON_LENGTH_CM, steps=90)
            traj, stop_reason = clip_trajectory_to_cylinder(
                full_traj,
                radius_cm=ECAL_RADIUS_CM,
                half_z_cm=ECAL_HALF_Z_CM,
                stop_reason="hit_ecal",
            )

            objects.append(
                {
                    "type": "photon",
                    "trajectory": traj,
                    "color": "#FFFF00",
                    "stop_reason": stop_reason,
                    "reco": {"pt_gev": _pt_systematics(pt_gev, 0.0), "eta": eta, "phi": phi},
                }
            )
            reco_px += pt_gev * np.cos(phi)
            reco_py += pt_gev * np.sin(phi)

    if event["tau_n"] > 0:
        for pt, eta, phi in zip(event["tau_pt"], event["tau_eta"], event["tau_phi"]):
            pt_gev = float(pt) * MEV_TO_GEV
            eta = float(eta)
            phi = _wrap_phi(float(phi))
            direction = pt_eta_phi_to_xyz(pt_gev, eta, phi)
            rng = _deterministic_rng(pt_gev, eta, phi, 15.0)

            tau_decay_len_cm = float(np.clip(rng.exponential(0.35) + 0.04, 0.04, 1.4))
            full_traj = short_trajectory(direction, length=tau_decay_len_cm, steps=20)
            traj, stop_reason = clip_trajectory_to_cylinder(
                full_traj,
                radius_cm=TRACKER_RADIUS_CM,
                half_z_cm=TRACKER_HALF_Z_CM,
                stop_reason="decay_displaced_vertex",
            )

            objects.append(
                {
                    "type": "tau",
                    "trajectory": traj,
                    "color": "#8d0081",
                    "stop_reason": stop_reason,
                    "reco": {"pt_gev": _pt_systematics(pt_gev, 0.0), "eta": eta, "phi": phi},
                }
            )
            reco_px += pt_gev * np.cos(phi)
            reco_py += pt_gev * np.sin(phi)

    if event["jet_n"] > 0:
        for pt, eta, phi in zip(event["jet_pt"], event["jet_eta"], event["jet_phi"]):
            pt_gev = float(pt) * MEV_TO_GEV
            eta = float(eta)
            phi = _wrap_phi(float(phi))
            direction = pt_eta_phi_to_xyz(pt_gev, eta, phi)

            full_traj = straight_trajectory(direction, length=JET_LENGTH_CM, steps=80)
            traj, stop_reason = clip_trajectory_to_cylinder(
                full_traj,
                radius_cm=HCAL_RADIUS_CM,
                half_z_cm=HCAL_HALF_Z_CM,
                stop_reason="hit_hcal",
            )
            objects.append(
                {
                    "type": "jet",
                    "trajectory": traj,
                    "color": "#ff0000",
                    "stop_reason": stop_reason,
                    "reco": {"pt_gev": _pt_systematics(pt_gev, 0.0), "eta": eta, "phi": phi},
                }
            )
            reco_px += pt_gev * np.cos(phi)
            reco_py += pt_gev * np.sin(phi)

    met_reco_px = -reco_px
    met_reco_py = -reco_py
    met_reco_gev = float(np.hypot(met_reco_px, met_reco_py))
    met_reco_phi = float(np.arctan2(met_reco_py, met_reco_px))

    input_met_gev = float(event.get("met", 0.0))
    input_met_phi = float(event.get("met_phi", 0.0))
    use_input_met = met_reco_gev <= 1e-6 and input_met_gev > 0.0
    met_draw_gev = input_met_gev if use_input_met else met_reco_gev
    met_draw_phi = input_met_phi if use_input_met else met_reco_phi

    if met_draw_gev > 0.0:
        direction = (np.cos(met_draw_phi), np.sin(met_draw_phi), 0.0)
        # MET representa a direção do momento faltante (partícula invisível),
        # então o vetor deve atravessar todo o detector e seguir além dele.
        min_escape_len = MUON_RADIUS_CM * 1.7
        met_length_cm = max(min_escape_len, met_draw_gev * MET_SCALE_CM_PER_GEV)
        traj = straight_trajectory(direction, length=met_length_cm, steps=80)
        stop_reason = "invisible_escape"
        objects.append(
            {
                "type": "met",
                "trajectory": traj,
                "color": "#00fbff",
                "stop_reason": stop_reason,
                "reco": {
                    "met_gev": {"nominal": met_draw_gev},
                    "phi": met_draw_phi,
                    "source": "input" if use_input_met else "reco",
                },
            }
        )

    summary = {
        "input_met_gev": input_met_gev,
        "reco_met_gev": met_reco_gev,
        "delta_met_gev": met_reco_gev - input_met_gev,
        "n_objects": len(objects),
    }
    return objects, summary
