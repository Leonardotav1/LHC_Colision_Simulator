# import numpy as np
# import math
# import random
# import plotly.graph_objs as go
# import plotly.utils
# import json
# import os

# from flask import Flask, render_template, jsonify, request
# from flask_cors import CORS # Importa o CORS

# # Dependências de ML e Dados
# import tensorflow as tf
# from tensorflow.keras.models import Sequential
# from tensorflow.keras.layers import Dense, Dropout
# from tensorflow.keras.utils import to_categorical
# from sklearn.model_selection import train_test_split
# from sklearn.preprocessing import StandardScaler, LabelEncoder
# import pandas as pd
# import uproot 

# # --- Configuração do App Flask ---
# app = Flask(__name__, template_folder='.')
# # ATIVA O CORS: Permite que o index.html fale com este servidor
# CORS(app) 
# app.config['UPLOAD_FOLDER'] = 'uploads'
# os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# # --------------------------
# # Constantes e Utilitários
# # --------------------------
# C_LIGHT = 0.299792458  # c em metros / ns
# B_FIELD = 3.8          # Tesla
# SEED = 42
# random.seed(SEED)
# np.random.seed(SEED)

# PARTICLE_TYPES = ['gamma', 'e', 'mu', 'pi', 'K', 'p']

# MASS_GEV = {
#     'gamma': 0.0, 'e': 0.000511, 'mu': 0.10566,
#     'pi': 0.13957, 'K': 0.49367, 'p': 0.93827
# }

# CHARGE = {
#     'gamma': 0, 'e': -1, 'mu': -1, 'pi': 1, 'K': 1, 'p': 1
# }

# TYPE_COLORS_PLOTLY = {
#     'gamma': 'yellow', 'e': 'cyan', 'mu': 'magenta',
#     'pi': 'orange', 'K': 'lime', 'p': 'red'
# }

# # --- Constantes da Simulação (NOVAS) ---
# T_COLLISION = 20.0 # (ns) Tempo que os prótons levam para colidir
# BEAM_START_Z = C_LIGHT * T_COLLISION # (m) Posição Z inicial dos prótons
# T_MAX_EVENT = 60.0 # (ns) Duração da simulação dos produtos
# T_TOTAL = T_COLLISION + T_MAX_EVENT # (ns) Duração total da animação

# # --------------------------
# # Simulação (Geração de Partículas)
# # --------------------------
# def sample_particles(n_particles=30, pt_min=0.2, pt_max=200.0):
#     """Gera uma lista de partículas (features) e tipos (labels)."""
#     types = PARTICLE_TYPES
#     probs = np.array([0.05, 0.1, 0.1, 0.6, 0.1, 0.05])
#     probs = probs / probs.sum()
    
#     features_list = []
#     labels_list = []
    
#     for _ in range(n_particles):
#         t = np.random.choice(types, p=probs)
#         mass = MASS_GEV[t]
        
#         q = CHARGE[t]
#         if t in ('pi', 'K') and random.random() < 0.5:
#             q = -q 
        
#         u = random.random()
#         alpha = 1.5
#         pt = pt_min * (pt_max / pt_min)**(u**(1 / alpha))
        
#         phi = random.uniform(0, 2 * math.pi)
#         eta = random.uniform(-2.5, 2.5)
        
#         cal_energy = pt * np.cosh(eta) * (1.0 + np.random.normal(0, 0.1)) 
#         tracker_hits = random.randint(3, 15) if q != 0 else 0
        
#         features = {'pt': pt, 'phi': phi, 'eta': eta, 'q': q, 'mass': mass, 'cal_energy': cal_energy, 'tracker_hits': tracker_hits}
#         features_list.append(features)
#         labels_list.append(t)
        
#     return features_list, labels_list

# def make_helix_trajectory(particle_features, vertex=(0.0, 0.0, 0.0), t_max=50.0, dt=0.5):
#     """Gera trajetória da hélice (do seu código)."""
#     pt = particle_features['pt']
#     phi0 = particle_features['phi']
#     eta = particle_features['eta']
#     q = particle_features['q']
#     m = particle_features['mass']

#     px = pt * math.cos(phi0)
#     py = pt * math.sin(phi0)
#     pz = pt * math.sinh(eta)
#     p_mag = math.sqrt(px**2 + py**2 + pz**2)
#     E = math.sqrt(p_mag**2 + m**2)

#     if E == 0: return np.array([0]), np.array([0]), np.array([0]), np.array([0]), {'type': 'unknown'}

#     v_t = (pt / E) * C_LIGHT
#     R = (pt / (0.3 * abs(q) * B_FIELD)) if q != 0 else np.inf

#     cx, cy, theta0 = None, None, 0.0
#     if np.isfinite(R):
#         cx = -q * R * math.sin(phi0)
#         cy = q * R * math.cos(phi0)
#         theta0 = math.atan2(-cy, -cx)

#     omega = (v_t / R) if (np.isfinite(R) and R > 0) else 0.0
#     sign = 1 if q >= 0 else -1

#     times = np.arange(0.0, t_max + 1e-9, dt)
#     xs, ys, zs = np.zeros_like(times), np.zeros_like(times), np.zeros_like(times)

#     for i, t in enumerate(times):
#         if np.isfinite(R):
#             theta = theta0 + sign * omega * t
#             xs[i] = cx + R * math.cos(theta)
#             ys[i] = cy + R * math.sin(theta)
#             s = R * (theta - theta0) * sign
#             # Garante que pz/pt seja seguro
#             z_move = ((pz / pt) * s) if pt > 1e-6 else (pz / p_mag) * (v_t / pt * pt if pt > 1e-6 else v_t) * t
#             zs[i] = vertex[2] + z_move
#         else:
#             v = (p_mag / E) * C_LIGHT
#             ux = px / p_mag if p_mag > 0 else 0
#             uy = py / p_mag if p_mag > 0 else 0
#             uz = pz / p_mag if p_mag > 0 else 0
#             xs[i] = vertex[0] + ux * v * t
#             ys[i] = vertex[1] + uy * v * t
#             zs[i] = vertex[2] + uz * v * t
            
#     particle_type = next((k for k, v in MASS_GEV.items() if math.isclose(v, m)), 'unknown')
#     info = {'pt': pt, 'q': q, 'type': particle_type}
#     return times, xs, ys, zs, info

# def build_pp_event_trajectories(n_particles=40, t_max=60.0, dt=0.5):
#     """Cria trajetórias para os *produtos* da colisão."""
#     particles, types = sample_particles(n_particles)
#     trajectories = []
#     for idx, (p, t) in enumerate(zip(particles, types)):
#         vtx = (np.random.normal(0, 1e-4), np.random.normal(0, 1e-4), np.random.normal(0, 1e-3))
#         times, xs, ys, zs, info = make_helix_trajectory(p, vertex=vtx, t_max=t_max, dt=dt)
#         info['type'] = t 
#         trajectories.append({'times': times, 'x': xs, 'y': ys, 'z': zs, 'info': info, 'id': idx})
#     return trajectories

# # --------------------------
# # Lógica da Rede Neural
# # (Exatamente como antes)
# # --------------------------
# def generate_training_data(n_events=1000, particles_per_event=10):
#     """Gera dados sintéticos para treinar a NN."""
#     print(f"Gerando {n_events * particles_per_event} amostras de partículas...")
#     all_features = []
#     all_labels = []
    
#     for _ in range(n_events):
#         features_list, labels_list = sample_particles(n_particles=particles_per_event)
#         for f in features_list:
#             all_features.append([f['pt'], f['eta'], f['phi'], f['q'], f['cal_energy'], f['tracker_hits']])
#         all_labels.extend(labels_list)
        
#     return pd.DataFrame(all_features, columns=['pt', 'eta', 'phi', 'q', 'cal_energy', 'tracker_hits']), pd.Series(all_labels, name='type')

# def create_nn_model(input_dim, num_classes):
#     """Define a arquitetura do modelo Keras."""
#     model = Sequential()
#     model.add(Dense(64, input_dim=input_dim, activation='relu'))
#     model.add(Dropout(0.3))
#     model.add(Dense(32, activation='relu'))
#     model.add(Dropout(0.3))
#     model.add(Dense(num_classes, activation='softmax'))
    
#     model.compile(loss='categorical_crossentropy',
#                   optimizer='adam',
#                   metrics=['accuracy'])
#     return model

# global_model = None
# global_scaler = None
# global_encoder = None

# def train_nn_model():
#     """Função completa de treinamento."""
#     global global_model, global_scaler, global_encoder
    
#     X_df, y_df = generate_training_data(n_events=2000, particles_per_event=20)
    
#     global_encoder = LabelEncoder()
#     y_encoded = global_encoder.fit_transform(y_df)
#     y_categorical = to_categorical(y_encoded)
#     num_classes = len(global_encoder.classes_)
    
#     global_scaler = StandardScaler()
#     X_scaled = global_scaler.fit_transform(X_df)
    
#     X_train, X_test, y_train, y_test = train_test_split(
#         X_scaled, y_categorical, test_size=0.2, random_state=SEED
#     )
    
#     input_dim = X_train.shape[1]
#     global_model = create_nn_model(input_dim, num_classes)
    
#     print("Iniciando treinamento da NN...")
#     history = global_model.fit(
#         X_train, y_train,
#         epochs=30,
#         batch_size=128,
#         validation_split=0.1,
#         verbose=0 
#     )
#     print("Treinamento concluído.")
    
#     loss, accuracy = global_model.evaluate(X_test, y_test, verbose=0)
#     print(f"Acurácia no set de teste: {accuracy * 100:.2f}%")
    
#     return {
#         'accuracy': accuracy,
#         'loss': loss,
#         'final_val_loss': history.history['val_loss'][-1],
#         'final_val_accuracy': history.history['val_accuracy'][-1],
#         'classes': list(global_encoder.classes_)
#     }

# # --------------------------
# # Rotas do Servidor Flask
# # --------------------------

# @app.route('/')
# def index():
#     """Serve a página HTML principal."""
#     # Esta função agora é a responsável por enviar o index.html
#     return render_template('index.html')

# @app.route('/train', methods=['POST'])
# def train_endpoint():
#     """Endpoint para iniciar o treinamento da NN."""
#     try:
#         results = train_nn_model()
#         return jsonify(results)
#     except Exception as e:
#         print(f"Erro no treinamento: {e}")
#         return jsonify({'error': str(e)}), 500

# @app.route('/simulate', methods=['POST'])
# def simulate_endpoint():
#     """Endpoint para rodar a simulação e retornar o JSON do Plotly."""
#     try:
#         n_particles = request.json.get('n_particles', 40)
#         dt = 0.5 # Intervalo de tempo dos frames
        
#         # 1. Simular os *produtos* da colisão (começam em T_COLLISION)
#         trajs_products = build_pp_event_trajectories(n_particles=n_particles, t_max=T_MAX_EVENT, dt=dt)
        
#         # 2. Construir frames do Plotly
#         times = np.arange(0.0, T_TOTAL + 1e-9, dt)
#         frames = []
        
#         # --- LÓGICA ATUALIZADA PARA MOSTRAR PRÓTONS ---
        
#         for fi, t in enumerate(times):
#             frame_traces = []
            
#             # Parte 1: Animar os Prótons Iniciais (antes de T_COLLISION)
#             if t <= T_COLLISION:
#                 current_z = (t / T_COLLISION) * BEAM_START_Z
                
#                 # Próton 1 (vindo de -Z)
#                 frame_traces.append(go.Scatter3d(
#                     x=[0], y=[0], z=[-BEAM_START_Z + current_z],
#                     mode='lines+markers',
#                     line=dict(color='red', width=3),
#                     marker=dict(size=3),
#                     name='Próton 1'
#                 ))
#                 # Próton 2 (vindo de +Z)
#                 frame_traces.append(go.Scatter3d(
#                     x=[0], y=[0], z=[BEAM_START_Z - current_z],
#                     mode='lines+markers',
#                     line=dict(color='red', width=3),
#                     marker=dict(size=3),
#                     name='Próton 2'
#                 ))
            
#             # Parte 2: Mostrar Produtos da Colisão (depois de T_COLLISION)
#             if t > T_COLLISION:
#                 # Mostrar os traços dos prótons originais (agora parados no centro)
#                 frame_traces.append(go.Scatter3d(x=[0], y=[0], z=[-BEAM_START_Z], mode='lines', line=dict(color='red', width=1), name='Próton 1 (traço)'))
#                 frame_traces.append(go.Scatter3d(x=[0], y=[0], z=[BEAM_START_Z], mode='lines', line=dict(color='red', width=1), name='Próton 2 (traço)'))

#                 # Calcular o tempo relativo para os produtos
#                 t_product = t - T_COLLISION
                
#                 for traj in trajs_products:
#                     # Encontra o último índice <= t_product
#                     idx = np.searchsorted(traj['times'], t_product, side='right') - 1
#                     if idx < 0: continue
                    
#                     typ = traj['info']['type']
#                     color = TYPE_COLORS_PLOTLY.get(typ, 'white')
#                     width = 2.5 if traj['info']['pt'] > 10 else 1.5
                    
#                     frame_traces.append(go.Scatter3d(
#                         x=traj['x'][:idx+1], y=traj['y'][:idx+1], z=traj['z'][:idx+1],
#                         mode='lines',
#                         line=dict(color=color, width=width),
#                         opacity=0.9,
#                         name=typ # Nome para hover
#                     ))
#             frames.append(go.Frame(data=frame_traces, name=str(fi)))
            
#         # 3. Adicionar Geometria do Detector (Estilo da Imagem)
#         init_data = frames[0].data if len(frames) > 0 else []
        
#         def get_cylinder(r, z_len, opacity=0.1, color='gray'):
#             z = np.linspace(-z_len/2, z_len/2, 20)
#             theta = np.linspace(0, 2*np.pi, 40)
#             theta_grid, z_grid = np.meshgrid(theta, z)
#             x_grid = r * np.cos(theta_grid)
#             y_grid = r * np.sin(theta_grid)
#             return go.Surface(
#                 x=x_grid, y=y_grid, z=z_grid,
#                 colorscale=[[0, color], [1, color]],
#                 showscale=False,
#                 opacity=opacity,
#                 hoverinfo='none'
#             )
        
#         # "Cano" cortado (Beam Pipe) - como na imagem
#         beam_pipe_r = 0.05 # 5 cm
#         beam_pipe_len = BEAM_START_Z * 2.1 # 
#         theta_cut = np.linspace(0, 2*np.pi * 0.8, 40) # 80% do cano
#         z_cut = np.linspace(-beam_pipe_len/2, beam_pipe_len/2, 20)
#         theta_grid_cut, z_grid_cut = np.meshgrid(theta_cut, z_cut)
#         x_grid_cut = beam_pipe_r * np.cos(theta_grid_cut)
#         y_grid_cut = beam_pipe_r * np.sin(theta_grid_cut)
#         init_data.append(go.Surface(
#             x=x_grid_cut, y=y_grid_cut, z=z_grid_cut,
#             colorscale=[[0, 'yellow'], [1, 'yellow']], # Cor Amarela (Tracker Interno)
#             showscale=False, opacity=0.3, hoverinfo='none', name='Beam Pipe'
#         ))

#         # Camadas do Detector (como na imagem)
#         init_data.append(get_cylinder(r=1.2, z_len=8.0, opacity=0.1, color='blue')) # Tracker (Azul)
#         init_data.append(get_cylinder(r=2.0, z_len=10.0, opacity=0.1, color='cyan')) # ECAL (Verde/Ciano)
#         init_data.append(get_cylinder(r=3.5, z_len=12.0, opacity=0.1, color='red')) # HCAL (Vermelho)
#         init_data.append(get_cylinder(r=4.5, z_len=12.0, opacity=0.1, color='blue')) # Muon (Azul Escuro)


#         # 4. Layout
#         layout_range_z = BEAM_START_Z * 1.1
#         layout_range_xy = layout_range_z / 1.5
#         layout = go.Layout(
#             title="Simulação de Evento de Colisão (Detector View)",
#             scene=dict(
#                 xaxis=dict(title='x [m]', range=[-layout_range_xy, layout_range_xy], backgroundcolor='black', color='white', gridcolor='gray', zerolinecolor='gray'),
#                 yaxis=dict(title='y [m]', range=[-layout_range_xy, layout_range_xy], backgroundcolor='black', color='white', gridcolor='gray', zerolinecolor='gray'),
#                 zaxis=dict(title='z [m]', range=[-layout_range_z, layout_range_z], backgroundcolor='black', color='white', gridcolor='gray', zerolinecolor='gray'),
#                 aspectmode='manual', aspectratio=dict(x=1, y=1, z=1.5)
#             ),
#             paper_bgcolor='black',
#             plot_bgcolor='black',
#             font=dict(color='white'),
#             updatemenus=[dict(
#                 type='buttons', showactive=False, bgcolor='gray', font=dict(color='black'),
#                 buttons=[
#                     dict(label='Play',
#                          method='animate',
#                          args=[None, {"frame": {"duration": 50, "redraw": True},
#                                       "fromcurrent": True, "transition": {"duration": 0}}]),
#                     dict(label='Pause',
#                          method='animate',
#                          args=[[None], {"frame": {"duration": 0, "redraw": False},
#                                         "mode":"immediate", "transition": {"duration": 0}}])
#                 ],
#                 x=0.1, y=0,
#             )],
#             sliders=[{
#                 'steps': [{'args': [[f.name], {'frame': {'duration': 0, 'redraw': True}, 'mode': 'immediate'}],
#                            'label': str(i), 'method': 'animate'} for i, f in enumerate(frames)],
#                 'currentvalue': {'prefix': 'Frame: ', 'visible': True},
#                 'bgcolor': 'gray', 'activebgcolor': 'red', 'font': dict(color='white'),
#                 'x': 0.1, 'y': -0.1, 'len': 0.9
#             }]
#         )
        
#         # 5. Criar Figura e Converter para JSON
#         fig = go.Figure(data=init_data, frames=frames, layout=layout)
#         fig.update_layout(showlegend=False)
#         fig_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        
#         return fig_json
    
#     except Exception as e:
#         print(f"Erro na simulação: {e}")
#         import traceback
#         traceback.print_exc()
#         return jsonify({'error': str(e)}), 500


# @app.route('/upload', methods=['POST'])
# def upload_root_file():
#     """Endpoint para upload de arquivos ROOT."""
#     if 'rootFile' not in request.files:
#         return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
#     file = request.files['rootFile']
#     if file.filename == '':
#         return jsonify({'error': 'Nome de arquivo vazio'}), 400
        
#     if file and file.filename.endswith('.root'):
#         try:
#             filename = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
#             file.save(filename)
            
#             with uproot.open(filename) as f:
#                 trees = list(f.keys(filter_classname=lambda cn: cn == "TTree"))
#                 if not trees:
#                     return jsonify({'error': 'Arquivo ROOT não contém TTrees.'}), 400
                
#                 tree_name = trees[0].split(';')[0]
#                 tree = f[tree_name]
#                 df = tree.arrays(library='pd', entry_stop='10') 
                
#                 print(f"Arquivo ROOT '{filename}' lido com sucesso.")
#                 print("Primeiras 10 entradas:")
#                 print(df.head())
            
#             return jsonify({
#                 'message': f'Arquivo "{filename}" salvo com sucesso!',
#                 'tree_name': tree_name,
#                 'columns': list(df.columns),
#                 'num_entries': len(tree)
#             })

#         except Exception as e:
#             print(f"Erro ao processar arquivo ROOT: {e}")
#             return jsonify({'error': f'Erro ao processar arquivo ROOT: {e}'}), 500
#     else:
#         return jsonify({'error': 'Formato de arquivo inválido. Envie .root'}), 400


from core.app import creat_app

app = creat_app()

# --- Ponto de entrada ---
if __name__ == '__main__':
    print("==========================================================")
    print("Iniciando servidor Flask...")
    print("Para ver a aplicação, abra este link no seu NAVEGADOR:")
    print(f"   >>> http://127.0.0.1:5000 <<<")
    print("==========================================================")
    app.run(debug=True, port=5000)