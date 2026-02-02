import plotly.graph_objs as go
import plotly.utils
import json
import numpy as np

# PARAMETROS VISUAIS
T_COLLISION_FRAMES = 20
POST_COLLISION_FRAMES = 40
BEAM_Z = 8.0


def build_collision_figure(event_data):

    # Construção das frames da animação
    objects_with_traj = [
        obj for obj in event_data["objects"]
        if "trajectory" in obj and obj["trajectory"]
    ]

    # Verifica se há objetos com trajetória
    if not objects_with_traj:
        raise ValueError("Nenhum objeto possui trajectory para animar")

    # Parâmetros da animação
    n_products = len(objects_with_traj)
    max_steps = max(len(obj["trajectory"]) for obj in objects_with_traj)

    # Construção das frames
    frames = []

    # TRACES FIXOS (ORDEM IMPORTA)
    # 0 -> proton 1
    # 1 -> proton 2
    # 2 -> ponto da colisao
    # 3.. -> produtos

    base_traces = [
        go.Scatter3d(
            x=[0], y=[-BEAM_Z], z=[0],
            mode="markers",
            marker=dict(size=5, color="blue"),
            name="proton_1"
        ),
        go.Scatter3d(
            x=[0], y=[BEAM_Z], z=[0],
            mode="markers",
            marker=dict(size=5, color="red"),
            name="proton_2"
        ),
        go.Scatter3d(
            x=[0], y=[0], z=[0],
            mode="markers",
            marker=dict(size=4, color="white"),
            name="collision"
        )
    ]

    for obj in objects_with_traj:
        base_traces.append(go.Scatter3d(
            x=[],
            y=[],
            z=[],
            mode="lines",
            line=dict(
                color=obj.get("color", "white"),
                width=6 if obj.get("style") == "cone" else 5
            ),
            name=obj["type"]
        ))

    # FASE 1 – PROTONS SE APROXIMANDO

    for i in range(T_COLLISION_FRAMES):
        y_pos = BEAM_Z * (1 - i / T_COLLISION_FRAMES)

        data = []

        # proton 1
        data.append(dict(
            type="scatter3d",
            x=[0], y=[-y_pos], z=[0]
        ))

        # proton 2
        data.append(dict(
            type="scatter3d",
            x=[0], y=[y_pos], z=[0]
        ))

        # ponto da colisao (fixo, invisivel na pratica)
        data.append(dict(
            type="scatter3d",
            x=[0], y=[0], z=[0]
        ))

        # produtos ainda vazios
        for _ in range(n_products):
            data.append(dict(
                type="scatter3d",
                x=[], y=[], z=[]
            ))

        frames.append(go.Frame(data=data, name=f"pre_{i}"))

    # FASE 2 – PRODUTOS DA COLISAO

    for step in range(max_steps):
        data = []

        # protons parados no centro
        data.append(dict(type="scatter3d", x=[0], y=[0], z=[0]))
        data.append(dict(type="scatter3d", x=[0], y=[0], z=[0]))

        # ponto da colisao
        data.append(dict(type="scatter3d", x=[0], y=[0], z=[0]))

        # produtos evoluindo
        for obj in objects_with_traj:
            traj = obj["trajectory"]

            if step < len(traj):
                xs = [p[0] for p in traj[:step + 1]]
                ys = [p[1] for p in traj[:step + 1]]
                zs = [p[2] for p in traj[:step + 1]]
            else:
                       
                xs = [p[0] for p in traj]
                ys = [p[1] for p in traj]
                zs = [p[2] for p in traj]

            data.append(dict(
                type="scatter3d",
                x=xs,
                y=ys,
                z=zs
            ))

        frames.append(go.Frame(data=data, name=f"post_{step}"))

    # LAYOUT

    layout = go.Layout(
        title=f"Colisao Proton-Proton - {event_data['n_events']} eventos sobrepostos",
        scene=dict(
            xaxis=dict(range=[-10, 10], backgroundcolor="black"),
            yaxis=dict(range=[-10, 10], backgroundcolor="black"),
            zaxis=dict(range=[-10, 10], backgroundcolor="black"),
            aspectmode="cube"
        ),
        paper_bgcolor="black",
        font=dict(color="white"),
        showlegend=False,
        updatemenus=[{
            "type": "buttons",
            "direction": "left",
            "x": 0.05,
            "y": 0.95,
            "pad": {"r": 10, "t": 10},
            "bgcolor": "black",
            "bordercolor": "white",
            "font": {
                "color": "black",
                "size": 14
            },
            "buttons": [{
                "label": "Play",
                "method": "animate",
                "args": [None, {
                    "frame": {"duration": 40, "redraw": True},
                    "fromcurrent": True
                }]
            }]
        }]
    )

    fig = go.Figure(
        data=base_traces,
        frames=frames,
        layout=layout
    )

    return json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
