# LHC Collision Simulator Frontend (Vite + React)

Frontend web SPA do simulador, organizado para React/Vite com motor de simulação em módulo próprio.

## Estrutura

- `src/App.jsx`: shell da UI (layout e elementos DOM do dashboard).
- `src/features/simulator/index.js`: motor principal (integração backend, Plotly, Three.js e eventos da UI).
- `src/features/simulator/constants.js`: constantes de partículas e paleta.
- `src/config/api.js`: configuração da URL da API via variável de ambiente.
- `src/styles.css`: tema e estilos globais.

## Configuração

1. Copie `.env.example` para `.env`:
   - `VITE_API_URL=http://127.0.0.1:5000`
2. Instale dependências:
   - `npm install`
3. Rode em desenvolvimento:
   - `npm run dev`

## Build

- `npm run build`
- `npm run preview`
