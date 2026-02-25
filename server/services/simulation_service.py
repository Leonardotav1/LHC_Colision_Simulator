import numpy as np
from simulations.constants import (
    B_FIELD_T,
    MEV_TO_GEV,
    M_TO_CM,
    PHOTON_LENGTH_CM,
    TAU_LENGTH_CM,
    JET_LENGTH_CM,
    MET_SCALE_CM_PER_GEV,
    TRACKER_RADIUS_CM,
    TRACKER_HALF_Z_CM,
    CALO_RADIUS_CM,
    CALO_HALF_Z_CM,
)
from utils.kinemacts import pt_eta_phi_to_xyz
from utils.trajectories import (
    helical_trajectory,
    straight_trajectory,
    short_trajectory,
    clip_trajectory_to_cylinder,
    trim_trajectory_to_detector,
)
from utils.root_reader import read_root_file

# Função auxiliar para envolver phi no intervalo [-pi, pi], aprox [-3.1416, 3.1416].
def _wrap_phi(phi):
    return float((phi + np.pi) % (2.0 * np.pi) - np.pi)

# Função auxiliar para aplicar sistemática de pt (aqui apenas retorna o valor nominal, sem variação).
def _pt_systematics(pt_gev, frac):
    return {"nominal": float(pt_gev)}


# Função principal para construir a simulação a partir do arquivo ROOT.
def build_simulation_from_root(file_path, start_event=0, n_events=1):
    # Le o arquivo ROOT e obtem o DataFrame dos eventos.
    df = read_root_file(file_path)

    # Define o intervalo de eventos a serem processados.
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

    print("Eventos no arquivo:", total_events)
    print("Simulando eventos:", start_event, "ate", end_event - 1)

    # Lista para armazenar todos os objetos gerados.
    all_objects = []
    event_summaries = []

    # Processa cada evento no intervalo especificado.
    for i in range(start_event, end_event):
        event = df.iloc[i]
        objs, summary = build_objects_from_event(event)
        all_objects.extend(objs)
        event_summaries.append(summary)

    print("Total de objetos gerados:", len(all_objects))

    return {
        "start_event": start_event,
        "n_events": end_event - start_event,
        "total_events": total_events,
        "objects": all_objects,
        "event_summaries": event_summaries,
    }


# Funcao auxiliar para construir objetos a partir de um evento.
def build_objects_from_event(event):
    # Lista para armazenar os objetos do evento.
    objects = []

    # Build reco-like MET from visible objects (without extra noise)
    reco_px = 0.0
    reco_py = 0.0

    # LEPTONS RECONSTRUIDOS
    if event["lep_n"] > 0:
        for pt, eta, phi, ltype, q in zip(
            event["lep_pt"],
            event["lep_eta"],
            event["lep_phi"],
            event["lep_type"],
            event["lep_charge"],
        ):
            # Assume pt em MeV no ntuple e converte para GeV.
            pt_gev = float(pt) * MEV_TO_GEV
            pt_reco = pt_gev
            eta_reco = float(eta)
            phi_reco = _wrap_phi(float(phi))

            direction = pt_eta_phi_to_xyz(pt_reco, eta_reco, phi_reco)

            q_abs = max(abs(q), 1e-9)
            # R[m] = pT[GeV] / (0.3 * |q| * B[T])
            radius_m = pt_reco / (0.3 * q_abs * B_FIELD_T)
            radius_cm = float(np.clip(radius_m * M_TO_CM, 20.0, 1000.0))

            # Approximate axial pitch from eta.
            pitch_per_turn_cm = float(np.clip(radius_cm * abs(np.sinh(eta_reco)) * 0.5, 8.0, 500.0))

            traj_raw = helical_trajectory(
                direction,
                charge=q,
                radius=radius_cm,
                pitch_per_turn=pitch_per_turn_cm,
                turns=4.0,
                steps=140,
            )
            traj, stop_reason = trim_trajectory_to_detector(traj_raw)

            if ltype == 11:
                ptype = "electron"
                color = "#0800ff"
            elif ltype == 13:
                ptype = "muon"
                color = "#01ae18"
            else:
                continue

            objects.append(
                {
                    "type": ptype,
                    "trajectory": traj,
                    "color": color,
                    "stop_reason": stop_reason,
                    "reco": {
                        "pt_gev": _pt_systematics(pt_reco, 0.0),
                        "eta": float(eta_reco),
                        "phi": float(phi_reco),
                        "charge": int(q),
                    },
                }
            )

            reco_px += pt_reco * np.cos(phi_reco)
            reco_py += pt_reco * np.sin(phi_reco)

    # FOTONS
    if event["photon_n"] > 0:
        for pt, eta, phi in zip(
            event["photon_pt"],
            event["photon_eta"],
            event["photon_phi"],
        ):
            pt_gev = float(pt) * MEV_TO_GEV
            pt_reco = pt_gev
            direction = pt_eta_phi_to_xyz(pt_reco, eta, phi)

            # Limit photon trajectories at the calorimeter envelope.
            full_traj = straight_trajectory(direction, length=PHOTON_LENGTH_CM, steps=90)
            traj, stop_reason = clip_trajectory_to_cylinder(
                full_traj,
                radius_cm=CALO_RADIUS_CM,
                half_z_cm=CALO_HALF_Z_CM,
                stop_reason="hit_calo",
            )

            objects.append(
                {
                    "type": "photon",
                    "trajectory": traj,
                    "color": "#FFFF00",
                    "stop_reason": stop_reason,
                    "reco": {"pt_gev": _pt_systematics(pt_reco, 0.0), "eta": float(eta), "phi": float(phi)},
                }
            )

            reco_px += pt_reco * np.cos(phi)
            reco_py += pt_reco * np.sin(phi)

    # TAUS
    if event["tau_n"] > 0:
        for pt, eta, phi in zip(
            event["tau_pt"],
            event["tau_eta"],
            event["tau_phi"],
        ):
            pt_gev = float(pt) * MEV_TO_GEV
            direction = pt_eta_phi_to_xyz(pt_gev, eta, phi)

            full_traj = short_trajectory(direction, length=TAU_LENGTH_CM, steps=30)
            traj, stop_reason = clip_trajectory_to_cylinder(
                full_traj,
                radius_cm=TRACKER_RADIUS_CM,
                half_z_cm=TRACKER_HALF_Z_CM,
                stop_reason="hit_tracker",
            )

            objects.append(
                {
                    "type": "tau",
                    "trajectory": traj,
                    "color": "#8d0081",
                    "stop_reason": stop_reason,
                    "reco": {"pt_gev": _pt_systematics(pt_gev, 0.0), "eta": float(eta), "phi": float(phi)},
                }
            )

            reco_px += pt_gev * np.cos(phi)
            reco_py += pt_gev * np.sin(phi)

    # JETS
    if event["jet_n"] > 0:
        for pt, eta, phi in zip(
            event["jet_pt"],
            event["jet_eta"],
            event["jet_phi"],
        ):
            pt_gev = float(pt) * MEV_TO_GEV
            pt_reco = pt_gev
            direction = pt_eta_phi_to_xyz(pt_reco, eta, phi)

            full_traj = straight_trajectory(direction, length=JET_LENGTH_CM, steps=80)
            traj, stop_reason = clip_trajectory_to_cylinder(
                full_traj,
                radius_cm=CALO_RADIUS_CM,
                half_z_cm=CALO_HALF_Z_CM,
                stop_reason="hit_calo",
            )

            objects.append(
                {
                    "type": "jet",
                    "trajectory": traj,
                    "color": "#ff0000",
                    "stop_reason": stop_reason,
                    "reco": {"pt_gev": _pt_systematics(pt_reco, 0.0), "eta": float(eta), "phi": float(phi)},
                }
            )

            reco_px += pt_reco * np.cos(phi)
            reco_py += pt_reco * np.sin(phi)

    # MET reconstructed from visible reco objects.
    # If reco MET is ~zero, fallback to MET stored in the ROOT event.
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
        traj = straight_trajectory(direction, length=met_draw_gev * MET_SCALE_CM_PER_GEV, steps=70)
        traj, stop_reason = clip_trajectory_to_cylinder(
            traj,
            radius_cm=CALO_RADIUS_CM,
            half_z_cm=CALO_HALF_Z_CM,
            stop_reason="hit_calo",
        )

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
