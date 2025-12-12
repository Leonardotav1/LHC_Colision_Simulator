import math
import numpy as np
import plotly.graph_objs as go
import plotly.utils
import json

# parametros da simulacao
C_LIGHT = 0.299792458   # m / ns
B_FIELD = 3.8           # Tesla
T_COLLISION = 20.0      # ns - tempo até a colisao
T_MAX = 60.0            # ns - duracao apos colisao (para produtos)
DT = 0.5                # ns - passo temporal
BEAM_Z = C_LIGHT * T_COLLISION  # posicao inicial dos protons

TYPE_COLORS = {
    'gamma': 'yellow', 'e': 'cyan', 'mu': 'magenta',
    'pi': 'orange', 'K': 'lime', 'p': 'red'
}

def make_helix(px, py, pz, q, mass, phi0, vertex_z, t_max=T_MAX, dt=DT):
    # parametros simples para converter pt->raio e velocidade angular
    # px,py,pz em GeV, mass em GeV, q = -1,0,1
    pt = math.sqrt(px*px + py*py)
    p_mag = math.sqrt(px*px + py*py + pz*pz)
    E = math.sqrt(p_mag*p_mag + mass*mass)
    if E == 0:
        return np.array([0.0]), np.array([0.0]), np.array([0.0]), np.array([0.0])

    v_t = (pt / E) * C_LIGHT
    # raio R = pT / (0.3 * q * B) ; usar abs e sinal separado
    if q == 0 or pt < 1e-9:
        # particula neutra: linha reta
        times = np.arange(0.0, t_max + 1e-9, dt)
        v = (p_mag / E) * C_LIGHT
        ux = px / p_mag if p_mag>0 else 0
        uy = py / p_mag if p_mag>0 else 0
        uz = pz / p_mag if p_mag>0 else 0
        xs = ux * v * times
        ys = uy * v * times
        zs = vertex_z + uz * v * times
        return times, xs, ys, zs

    R = pt / (0.3 * abs(q) * B_FIELD)
    sign = 1 if q>0 else -1
    # centro do circulo
    cx = -sign * R * math.sin(phi0)
    cy = sign * R * math.cos(phi0)
    theta0 = math.atan2(-cy, -cx)
    omega = (v_t / R) if R>0 else 0.0

    times = np.arange(0.0, t_max + 1e-9, dt)
    xs = np.zeros_like(times)
    ys = np.zeros_like(times)
    zs = np.zeros_like(times)

    for i,t in enumerate(times):
        theta = theta0 + sign * omega * t
        xs[i] = cx + R * math.cos(theta)
        ys[i] = cy + R * math.sin(theta)
        s = R * (theta - theta0) * sign
        # avancamento em z proporcional a s * pz/pt
        zs[i] = vertex_z + (pz/pt) * s if pt>1e-9 else vertex_z

    return times, xs, ys, zs

def sample_products(n_products=30):
    # gera produtos com tipos, carga, massa, momento simples
    types = ['gamma','e','mu','pi','K','p']
    masses = {'gamma':0.0,'e':0.000511,'mu':0.10566,'pi':0.13957,'K':0.49367,'p':0.93827}
    charges = {'gamma':0,'e':-1,'mu':-1,'pi':1,'K':1,'p':1}
    products = []
    for i in range(n_products):
        t = np.random.choice(types, p=[0.05,0.15,0.1,0.5,0.1,0.1])
        mass = masses[t]
        q = charges[t]
        # pequenas chances de carga trocada pra pi/K
        if t in ('pi','K') and np.random.rand()<0.4:
            q = -q
        # gerar momento em GeV (pt, phi, eta->pz)
        pt = 0.1 + (200.0-0.1) * (np.random.rand()**1.5)
        phi = np.random.uniform(0,2*math.pi)
        eta = np.random.uniform(-2.5,2.5)
        px = pt * math.cos(phi)
        py = pt * math.sin(phi)
        pz = pt * math.sinh(eta)
        products.append({'type':t,'mass':mass,'q':q,'px':px,'py':py,'pz':pz,'phi0':phi})
    return products

def build_collision_figure(n_products=40):
    # gera frames: antes da colisao (feixes) e depois (produtos animados)
    times_total = np.arange(0.0, T_COLLISION + T_MAX + 1e-9, DT)
    frames = []
    # precompute product trajs (com tempo contado a partir de colisao)
    products = sample_products(n_products)
    product_trajs = []
    for p in products:
        times, xs, ys, zs = make_helix(p['px'], p['py'], p['pz'], p['q'], p['mass'], p['phi0'], vertex_z=0.0, t_max=T_MAX, dt=DT)
        product_trajs.append({'times':times,'x':xs,'y':ys,'z':zs,'info':p})

    # layout static geometry: beam pipe e cilindros do detector
    def get_cylinder(r, z_len, opacity=0.08, color='gray'):
        z = np.linspace(-z_len/2, z_len/2, 20)
        theta = np.linspace(0, 2*np.pi, 40)
        theta_grid, z_grid = np.meshgrid(theta, z)
        x_grid = r * np.cos(theta_grid)
        y_grid = r * np.sin(theta_grid)
        return go.Surface(x=x_grid, y=y_grid, z=z_grid, colorscale=[[0,color],[1,color]], showscale=False, opacity=opacity, hoverinfo='none')

    init_traces = []
    # adiciona detector cilindrico
    init_traces.append(get_cylinder(r=1.2, z_len=8.0, opacity=0.06, color='blue'))  # tracker
    init_traces.append(get_cylinder(r=2.5, z_len=10.0, opacity=0.05, color='cyan'))  # ecal

    # Criar frames
    for frame_idx, t in enumerate(times_total):
        traces = []
        # antes da colisao: anima dois protons indo em -z e +z
        if t <= T_COLLISION:
            current_z = (t / T_COLLISION) * BEAM_Z
            # proton 1 (de -z para 0)
            traces.append(go.Scatter3d(x=[0], y=[0], z=[-BEAM_Z + current_z], mode='markers', marker=dict(size=4,color='red'), name='proton1'))
            # proton 2 (de +z para 0)
            traces.append(go.Scatter3d(x=[0], y=[0], z=[BEAM_Z - current_z], mode='markers', marker=dict(size=4,color='red'), name='proton2'))
        else:
            # depois da colisao: manter traço dos feixes na posicao inicial (opcional)
            traces.append(go.Scatter3d(x=[0], y=[0], z=[-BEAM_Z], mode='lines', line=dict(color='red', width=1), name='proton1_trace'))
            traces.append(go.Scatter3d(x=[0], y=[0], z=[BEAM_Z], mode='lines', line=dict(color='red', width=1), name='proton2_trace'))

            # mostrar produtos ate o tempo t - T_COLLISION
            t_prod = t - T_COLLISION
            for traj in product_trajs:
                # pegar indice do tempo correspondente
                idx = np.searchsorted(traj['times'], t_prod, side='right') - 1
                if idx < 0:
                    continue
                info = traj['info']
                color = TYPE_COLORS.get(info['type'], 'white')
                width = 2.5 if np.linalg.norm([info['px'],info['py']])>10 else 1.5
                traces.append(go.Scatter3d(
                    x=traj['x'][:idx+1].tolist(),
                    y=traj['y'][:idx+1].tolist(),
                    z=traj['z'][:idx+1].tolist(),
                    mode='lines',
                    line=dict(color=color, width=width),
                    name=info['type'],
                    opacity=0.9
                ))

        # incluir traços estaticos do detector so no primeiro frame (serao parte de data inicial)
        frames.append(go.Frame(data=traces, name=str(frame_idx)))

    # figura inicial: usar apenas o primeiro frame traces + geometria
    data0 = frames[0].data if len(frames)>0 else []
    data0 = list(data0) + init_traces

    layout_range_z = BEAM_Z * 1.1
    layout_range_xy = layout_range_z / 1.5
    layout = go.Layout(
        title="Simulacao colisao 3D",
        scene=dict(
            xaxis=dict(title='x [m]', range=[-layout_range_xy, layout_range_xy], backgroundcolor='black', color='white'),
            yaxis=dict(title='y [m]', range=[-layout_range_xy, layout_range_xy], backgroundcolor='black', color='white'),
            zaxis=dict(title='z [m]', range=[-layout_range_z, layout_range_z], backgroundcolor='black', color='white'),
            aspectmode='manual', aspectratio=dict(x=1,y=1,z=1.5)
        ),
        paper_bgcolor='black',
        plot_bgcolor='black',
        font=dict(color='white'),
        updatemenus=[dict(type='buttons', showactive=False,
                          buttons=[dict(label='Play', method='animate', args=[None, {"frame":{"duration":50,"redraw":True},"fromcurrent":True,"transition":{"duration":0}}]),
                                   dict(label='Pause', method='animate', args=[[None], {"frame":{"duration":0,"redraw":False},"mode":"immediate","transition":{"duration":0}}])],
                          x=0.1, y=0)]
    )

    fig = go.Figure(data=data0, frames=frames, layout=layout)
    fig.update_layout(showlegend=False)
    return json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
