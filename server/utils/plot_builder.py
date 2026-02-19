import json
import numpy as np
import plotly.graph_objs as go
import plotly.utils
from simulations.constants import (
    BEAM_Z_CM,
    MIN_AXIS_LIMIT_CM,
    AXIS_PADDING,
    TRACKER_RADIUS_CM,
    TRACKER_HALF_Z_CM,
    CALO_RADIUS_CM,
    CALO_HALF_Z_CM,
    MUON_RADIUS_CM,
    MUON_HALF_Z_CM,
)

# VISUAL SETTINGS
T_COLLISION_FRAMES = 20


def _compute_axis_limit_cm(objects_with_traj, min_limit=MIN_AXIS_LIMIT_CM, padding=AXIS_PADDING):
    max_abs = 0.0
    for obj in objects_with_traj:
        for x, y, z in obj["trajectory"]:
            max_abs = max(max_abs, abs(x), abs(y), abs(z))
    return max(min_limit, max_abs * padding)


def _circle_trace(radius_cm, z_cm, color, name, dash="dot"):
    theta = np.linspace(0.0, 2.0 * np.pi, 100)
    x = radius_cm * np.cos(theta)
    y = radius_cm * np.sin(theta)
    z = np.full_like(theta, z_cm)
    return go.Scatter3d(
        x=x,
        y=y,
        z=z,
        mode="lines",
        line=dict(color=color, width=2, dash=dash),
        name=name,
        showlegend=False,
    )


def _detector_shell_traces():
    traces = []

    # Tracker shell
    traces.append(_circle_trace(TRACKER_RADIUS_CM, 0.0, "#4ea1ff", "tracker"))
    traces.append(_circle_trace(TRACKER_RADIUS_CM, TRACKER_HALF_Z_CM, "#4ea1ff", "tracker"))
    traces.append(_circle_trace(TRACKER_RADIUS_CM, -TRACKER_HALF_Z_CM, "#4ea1ff", "tracker"))

    # Calorimeter shell
    traces.append(_circle_trace(CALO_RADIUS_CM, 0.0, "#f6b93b", "calorimeter"))
    traces.append(_circle_trace(CALO_RADIUS_CM, CALO_HALF_Z_CM, "#f6b93b", "calorimeter"))
    traces.append(_circle_trace(CALO_RADIUS_CM, -CALO_HALF_Z_CM, "#f6b93b", "calorimeter"))

    # Muon shell
    traces.append(_circle_trace(MUON_RADIUS_CM, 0.0, "#9b59b6", "muon"))
    traces.append(_circle_trace(MUON_RADIUS_CM, MUON_HALF_Z_CM, "#9b59b6", "muon"))
    traces.append(_circle_trace(MUON_RADIUS_CM, -MUON_HALF_Z_CM, "#9b59b6", "muon"))

    return traces


def _build_title(event_data):
    summaries = event_data.get("event_summaries", [])
    if not summaries:
        return f"Colisao Proton-Proton - {event_data['n_events']} eventos sobrepostos"

    deltas = [s.get("delta_met_gev", 0.0) for s in summaries]
    avg_delta = float(np.mean(deltas))
    return (
        f"Colisao Proton-Proton - {event_data['n_events']} eventos | "
        f"<DeltaMET>={avg_delta:.2f} GeV"
    )


def build_collision_figure(event_data):
    # Build animation frames
    objects_with_traj = [
        obj for obj in event_data["objects"] if "trajectory" in obj and obj["trajectory"]
    ]

    if not objects_with_traj:
        raise ValueError("Nenhum objeto possui trajectory para animar")

    n_products = len(objects_with_traj)
    max_steps = max(len(obj["trajectory"]) for obj in objects_with_traj)
    axis_limit_cm = _compute_axis_limit_cm(objects_with_traj)

    frames = []

    # Dynamic traces first (animation relies on this order)
    base_traces = [
        go.Scatter3d(
            x=[0], y=[-BEAM_Z_CM], z=[0],
            mode="markers",
            marker=dict(size=5, color="blue"),
            name="proton_1",
        ),
        go.Scatter3d(
            x=[0], y=[BEAM_Z_CM], z=[0],
            mode="markers",
            marker=dict(size=5, color="red"),
            name="proton_2",
        ),
        go.Scatter3d(
            x=[0], y=[0], z=[0],
            mode="markers",
            marker=dict(size=4, color="white"),
            name="collision",
        ),
    ]

    for obj in objects_with_traj:
        base_traces.append(
            go.Scatter3d(
                x=[],
                y=[],
                z=[],
                mode="lines",
                line=dict(color=obj.get("color", "white"), width=5),
                name=obj["type"],
            )
        )

    # Static detector shells appended after dynamic traces
    base_traces.extend(_detector_shell_traces())

    # Phase 1: incoming beams
    for i in range(T_COLLISION_FRAMES):
        y_pos = BEAM_Z_CM * (1 - i / T_COLLISION_FRAMES)
        data = [
            dict(type="scatter3d", x=[0], y=[-y_pos], z=[0]),
            dict(type="scatter3d", x=[0], y=[y_pos], z=[0]),
            dict(type="scatter3d", x=[0], y=[0], z=[0]),
        ]

        for _ in range(n_products):
            data.append(dict(type="scatter3d", x=[], y=[], z=[]))

        frames.append(go.Frame(data=data, name=f"pre_{i}"))

    # Phase 2: collision products
    for step in range(max_steps):
        data = [
            dict(type="scatter3d", x=[0], y=[0], z=[0]),
            dict(type="scatter3d", x=[0], y=[0], z=[0]),
            dict(type="scatter3d", x=[0], y=[0], z=[0]),
        ]

        for obj in objects_with_traj:
            traj = obj["trajectory"]
            if step < len(traj):
                active = traj[: step + 1]
            else:
                active = traj

            xs = [p[0] for p in active]
            ys = [p[1] for p in active]
            zs = [p[2] for p in active]
            data.append(dict(type="scatter3d", x=xs, y=ys, z=zs))

        frames.append(go.Frame(data=data, name=f"post_{step}"))

    layout = go.Layout(
        title=_build_title(event_data),
        scene=dict(
            xaxis=dict(title="x [cm]", range=[-axis_limit_cm, axis_limit_cm], backgroundcolor="black"),
            yaxis=dict(title="y [cm]", range=[-axis_limit_cm, axis_limit_cm], backgroundcolor="black"),
            zaxis=dict(title="z [cm]", range=[-axis_limit_cm, axis_limit_cm], backgroundcolor="black"),
            aspectmode="cube",
        ),
        paper_bgcolor="black",
        font=dict(color="white"),
        showlegend=False,
        updatemenus=[
            {
                "type": "buttons",
                "direction": "left",
                "x": 0.05,
                "y": 0.95,
                "pad": {"r": 10, "t": 10},
                "bgcolor": "black",
                "bordercolor": "white",
                "font": {"color": "black", "size": 14},
                "buttons": [
                    {
                        "label": "Play",
                        "method": "animate",
                        "args": [None, {"frame": {"duration": 40, "redraw": True}, "fromcurrent": True}],
                    }
                ],
            }
        ],
    )

    fig = go.Figure(data=base_traces, frames=frames, layout=layout)
    return json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
