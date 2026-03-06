# LHC Collision Simulator

Simulador de colisões inspirado no detector CMS, com:
- `frontend` em React + Vite + Redux + Three.js + Plotly
- `server` em Flask para leitura de arquivos ROOT e geração dos dados de simulação

## Estrutura do projeto

- `frontend/`: interface web (upload, simulação, visualizações 2D/3D)
- `server/`: API Flask (`/upload/*` e `/simulate/`)
- `server/uploads/`: arquivos `.root` enviados (arquivo ativo)
- `venv/`: ambiente virtual Python local (já presente no projeto)

## Pré-requisitos

- Node.js 18+ (recomendado 20+)
- Python 3.10+ (recomendado 3.11+)
- npm

## Como rodar o projeto

## 1) Subir o backend (Flask)

No PowerShell, na raiz do projeto:

```powershell
cd server
..\venv\Scripts\python.exe main.py
```

Servidor esperado: `http://127.0.0.1:5000`

Se faltar dependência Python, instale:

```powershell
..\venv\Scripts\python.exe -m pip install flask flask-cors numpy pandas uproot plotly werkzeug
```

## 2) Subir o frontend (React)

Em outro terminal, na raiz do projeto:

```powershell
cd frontend
npm install
npm run dev
```

Frontend esperado: `http://127.0.0.1:5173`

## 3) Configuração da URL da API (opcional)

O frontend usa por padrão `http://127.0.0.1:5000` em `frontend/src/config/api.js`.

Se quiser alterar:

1. Crie/edite `frontend/.env`
2. Defina:

```env
VITE_API_URL=http://127.0.0.1:5000
```

## Fluxo correto de uso na interface

1. Clique em `Selecionar Arquivo` e escolha um `.root`.
2. Clique em `Upload`.
3. Aguarde status `UPLOAD OK`.
4. Defina:
- `EVENTO` (começa em `0`)
- `N EVENTOS`
5. Clique em `Simular`.
6. Explore as abas e filtros.

Observações importantes:
- O evento inicial é **zero-based** (`0` até `total-1`).
- A quantidade de `jet` simulada segue os dados do ROOT (sem jets artificiais extras).

## Endpoints principais da API

- `POST /upload/` envia arquivo ROOT
- `GET /upload/stats` total de eventos do ROOT ativo
- `POST /upload/clear` limpa uploads
- `POST /simulate/` executa simulação para `start_event` e `num_events`

## Build de produção (frontend)

```powershell
cd frontend
npm run build
```

Saída em `frontend/dist/`.
