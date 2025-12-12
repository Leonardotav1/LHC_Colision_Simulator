import json

def build_plot_json(trajectories):
    plot_data = []

    for traj in trajectories:
        plot_data.append({
            "x": traj["x"],
            "y": traj["y"]
        })

    return json.dumps({
        "trajectories": plot_data
    })
