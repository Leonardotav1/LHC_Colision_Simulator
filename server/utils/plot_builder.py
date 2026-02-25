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
DETECTOR_OPACITY = 0.08


def _compute_axis_limit_cm(objects_with_traj, min_limit=MIN_AXIS_LIMIT_CM, padding=AXIS_PADDING):
    max_abs = 0.0
    for obj in objects_with_traj:
        for x, y, z in obj["trajectory"]:
            max_abs = max(max_abs, abs(x), abs(y), abs(z))
    return max(min_limit, max_abs * padding)


def _cylinder_surface_trace(radius_cm, half_z_cm, color, name, opacity=DETECTOR_OPACITY):
    theta = np.linspace(0.0, 2.0 * np.pi, 80)
    z = np.linspace(-half_z_cm, half_z_cm, 2)
    theta_grid, z_grid = np.meshgrid(theta, z)
    x = radius_cm * np.cos(theta_grid)
    y = radius_cm * np.sin(theta_grid)

    return go.Surface(
        x=x,
        y=y,
        z=z_grid,
        surfacecolor=np.zeros_like(x),
        colorscale=[[0, color], [1, color]],
        showscale=False,
        opacity=opacity,
        name=name,
        hoverinfo="skip",
        showlegend=False,
        lighting=dict(ambient=0.9, diffuse=0.3, specular=0.15, roughness=0.9),
        lightposition=dict(x=100, y=0, z=200),
    )


def _detector_shell_traces():
    traces = []

    # Keep a subtle inner shell to preserve detector context without clutter
    traces.append(_cylinder_surface_trace(CALO_RADIUS_CM, CALO_HALF_Z_CM, "#8aa5c2", "calorimeter", opacity=0.06))

    return traces


def _tunnel_shell_trace(axis_limit_cm):
    radius_cm = axis_limit_cm * 0.98
    half_z_cm = axis_limit_cm * 0.98
    return _cylinder_surface_trace(
        radius_cm=radius_cm,
        half_z_cm=half_z_cm,
        color="#5f7898",
        name="tunnel",
        opacity=0.18,
    )


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
            x=[0, 0], y=[-BEAM_Z_CM, 0], z=[0, 0],
            mode="lines+markers",
            line=dict(color="#4ea1ff", width=6),
            marker=dict(size=4, color="#4ea1ff"),
            name="proton_1",
            showlegend=False,
        ),
        go.Scatter3d(
            x=[0, 0], y=[BEAM_Z_CM, 0], z=[0, 0],
            mode="lines+markers",
            line=dict(color="#ff6b6b", width=6),
            marker=dict(size=4, color="#ff6b6b"),
            name="proton_2",
            showlegend=False,
        ),
        go.Scatter3d(
            x=[0], y=[0], z=[0],
            mode="markers",
            marker=dict(size=5, color="white"),
            name="collision",
            showlegend=False,
        ),
    ]

    for idx, obj in enumerate(objects_with_traj):
        base_traces.append(
            go.Scatter3d(
                x=[],
                y=[],
                z=[],
                mode="lines",
                line=dict(color=obj.get("color", "white"), width=8),
                name=obj["type"],
                meta={
                    "particle_index": idx,
                    "type": obj.get("type"),
                    "color": obj.get("color"),
                    "stop_reason": obj.get("stop_reason"),
                    "reco": obj.get("reco", {}),
                    "trajectory": obj.get("trajectory", []),
                },
            )
        )

    # Static shells appended after dynamic traces
    base_traces.append(_tunnel_shell_trace(axis_limit_cm))
    base_traces.extend(_detector_shell_traces())

    # Phase 1: incoming beams
    for i in range(T_COLLISION_FRAMES):
        y_pos = BEAM_Z_CM * (1 - i / T_COLLISION_FRAMES)
        data = [
            dict(type="scatter3d", x=[0, 0], y=[-y_pos, 0], z=[0, 0]),
            dict(type="scatter3d", x=[0, 0], y=[y_pos, 0], z=[0, 0]),
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
            xaxis=dict(
                title="x [cm]",
                range=[-axis_limit_cm, axis_limit_cm],
                showgrid=False,
                zeroline=False,
                showbackground=False,
            ),
            yaxis=dict(
                title="y [cm]",
                range=[-axis_limit_cm, axis_limit_cm],
                showgrid=False,
                zeroline=False,
                showbackground=False,
            ),
            zaxis=dict(
                title="z [cm]",
                range=[-axis_limit_cm, axis_limit_cm],
                showgrid=False,
                zeroline=False,
                showbackground=False,
            ),
            aspectmode="cube",
            bgcolor="rgb(233,241,249)",
            camera=dict(eye=dict(x=1.45, y=0.18, z=0.22)),
        ),
        paper_bgcolor="rgb(225,236,247)",
        plot_bgcolor="rgb(225,236,247)",
        font=dict(color="#1f2d3d"),
        showlegend=False,
        updatemenus=[
            {
                "type": "buttons",
                "direction": "left",
                "x": 0.05,
                "y": 0.95,
                "pad": {"r": 10, "t": 10},
                "bgcolor": "#d7e6f4",
                "bordercolor": "#6e85a1",
                "font": {"color": "#1f2d3d", "size": 13},
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
