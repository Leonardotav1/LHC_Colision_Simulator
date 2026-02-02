import numpy as np

# Converter coordenadas pt, eta, phi para x, y, z
def pt_eta_phi_to_xyz(pt, eta, phi, scale=1.0):
    px = pt * np.cos(phi)
    py = pt * np.sin(phi)
    pz = pt * np.sinh(eta)

    # Calcular a norma para normalização
    norm = np.sqrt(px**2 + py**2 + pz**2) + 1e-9

    # Retornar as coordenadas escaladas
    return (
        scale * px / norm,
        scale * py / norm,
        scale * pz / norm
    )