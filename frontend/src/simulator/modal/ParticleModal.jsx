import { useEffect, useMemo, useState } from "react";
import Plotly from "plotly.js-dist-min";
import "./ParticleModal.css";

// Formata um valor numérico para exibição, limitando a um número específico de dígitos decimais.
function fmt(value, digits = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

// Componente React para exibir um modal com detalhes de uma partícula, incluindo gráficos de sua trajetória.
export default function ParticleModal() {
  // O estado 'particle' armazena os dados da partícula atualmente exibida no modal. Quando 'particle' é null, o modal está fechado.
  const [particle, setParticle] = useState(null);
  const isOpen = Boolean(particle);

  // useMemo é usado para calcular os dados formatados do modal a partir dos dados brutos da partícula. 
  const modalData = useMemo(() => {
    if (!particle) return null;

    // reco é um objeto que pode conter as informações de reconstrução da partícula, como pT, MET, eta, phi e carga.
    const reco = particle.reco || {};
    const pt = typeof reco.pt_gev === "number" ? reco.pt_gev : reco?.pt_gev?.nominal;
    const met = typeof reco.met_gev === "number" ? reco.met_gev : reco?.met_gev?.nominal;

    const pval = Number.isFinite(pt) ? pt : met;
    const traj = Array.isArray(particle.trajectory) ? particle.trajectory : [];

    // Retorna um objeto com os dados formatados para exibição no modal, incluindo o tipo da partícula, pT/MET, eta, phi, carga, motivo de parada e os pontos da trajetória.
    return {
      type: String(particle.type || "N/A").toUpperCase(), // Tipo da partícula
      pval, // Valor de pT ou MET, dependendo do que estiver disponível
      eta: reco.eta, // Pseudorapidez
      phi: reco.phi, // Ângulo azimutal
      charge: Number.isFinite(Number(reco.charge)) ? String(reco.charge) : "N/A", // Carga elétrica
      stop: particle.stopReason || particle.stop_reason || "N/A", // Motivo de parada da partícula
      points: traj.length, // Número de pontos na trajetória
      x: traj.map((t) => t[0]), // Coordenada X da trajetória
      y: traj.map((t) => t[1]), // Coordenada Y da trajetória
      z: traj.map((t) => t[2]), // Coordenada Z da trajetória
      r: traj.map((t) => Math.hypot(t[0], t[1])), // Distância radial R = sqrt(x^2 + y^2)
      color: particle.color || "#38bdf8", // Cor para os gráficos, usando a cor da partícula ou um valor padrão
    };
  }, [particle]);

  // Configura os event listeners para abrir e fechar o modal, bem como para fechar com a tecla Escape.
  useEffect(() => {
    const onOpen = (event) => setParticle(event.detail || null);

    const onClose = () => setParticle(null);

    const onEsc = (event) => {
      if (event.key === "Escape") setParticle(null);
    };

    window.addEventListener("particle-modal:open", onOpen);
    window.addEventListener("particle-modal:close", onClose);
    document.addEventListener("keydown", onEsc);

    return () => {
      window.removeEventListener("particle-modal:open", onOpen);
      window.removeEventListener("particle-modal:close", onClose);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Renderiza os gráficos da trajetória da partícula usando Plotly sempre que o modal é aberto ou os dados da partícula são atualizados.
  useEffect(() => {
    if (!isOpen || !modalData) return;

    const baseLayout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cbd5e1", size: 11 },
      margin: { t: 34, l: 52, r: 24, b: 48 },
    };

    // O gráfico X-Y mostra a trajetória transversal da partícula, onde X e Y são as coordenadas no plano perpendicular ao eixo do feixe.
    Plotly.newPlot(
      "particlePlotXY",
      [{
        x: modalData.x,
        y: modalData.y,
        type: "scatter",
        mode: "lines+markers",
        line: { color: modalData.color, width: 2.2 },
        marker: { color: modalData.color, size: 4 },
      }],
      {
        ...baseLayout,
        title: { text: "Trajetoria Transversal (X-Y)", font: { color: "#7dd3fc", size: 13 } },
        xaxis: { title: "X [cm]", gridcolor: "rgba(56,189,248,0.12)", automargin: true },
        yaxis: { title: "Y [cm]", gridcolor: "rgba(56,189,248,0.12)", scaleanchor: "x", scaleratio: 1, automargin: true },
      },
      { displaylogo: false, responsive: true },
    );
  
    // O gráfico R-Z mostra o perfil longitudinal da partícula, onde R é a distância radial (sqrt(x^2 + y^2)) e Z é a coordenada ao longo do eixo do feixe.
    Plotly.newPlot(
      "particlePlotRZ",
      [{
        x: modalData.z,
        y: modalData.r,
        type: "scatter",
        mode: "lines",
        line: { color: "#facc15", width: 2.2 },
      }],
      {
        ...baseLayout,
        title: { text: "Perfil Longitudinal (Z-R)", font: { color: "#7dd3fc", size: 13 } },
        xaxis: { title: "Z [cm]", gridcolor: "rgba(56,189,248,0.12)", automargin: true },
        yaxis: { title: "R = sqrt(x^2+y^2) [cm]", gridcolor: "rgba(56,189,248,0.12)", automargin: true },
      },
      { displaylogo: false, responsive: true },
    );

    // Garantir que os gráficos sejam redimensionados corretamente após a renderização, especialmente em casos onde o modal pode ter sido aberto ou redimensionado recentemente.
    requestAnimationFrame(() => {
      Plotly.Plots.resize("particlePlotXY");
      Plotly.Plots.resize("particlePlotRZ");
    });

    // Adicionalmente, um timeout é usado para garantir que os gráficos sejam redimensionados.
    const t = setTimeout(() => {
      Plotly.Plots.resize("particlePlotXY");
      Plotly.Plots.resize("particlePlotRZ");
    }, 120);

    return () => clearTimeout(t);
  }, [isOpen, modalData]);

  return (
    <div
      id="particleModalOverlay"
      className={`particle-modal-overlay${isOpen ? " show" : ""}`}
      onClick={() => setParticle(null)}
    >
      <div
        className="particle-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da particula"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="particle-modal-left">
          <div className="particle-modal-title-row">
            <div className="particle-modal-title">Detalhes da Particula</div>
            <button
              id="particleModalCloseBtn"
              className="particle-modal-close"
              type="button"
              onClick={() => setParticle(null)}
            >
              Fechar
            </button>
          </div>
          <div className="particle-kpi">
            <div className="label">Tipo</div>
            <div id="pmType" className="value">{modalData ? modalData.type : "N/A"}</div>
          </div>
          <div className="particle-kpi">
            <div className="label">pT / MET (GeV)</div>
            <div id="pmPt" className="value">{modalData ? fmt(modalData.pval, 4) : "N/A"}</div>
          </div>
          <div className="particle-kpi">
            <div className="label">Pseudorapidez (eta)</div>
            <div id="pmEta" className="value">{modalData ? fmt(modalData.eta, 4) : "N/A"}</div>
          </div>
          <div className="particle-kpi">
            <div className="label">Angulo (phi)</div>
            <div id="pmPhi" className="value">{modalData ? fmt(modalData.phi, 4) : "N/A"}</div>
          </div>
          <div className="particle-table">
            <div className="row"><span>Carga</span><span id="pmCharge">{modalData ? modalData.charge : "N/A"}</span></div>
            <div className="row"><span>Stop reason</span><span id="pmStop">{modalData ? modalData.stop : "N/A"}</span></div>
            <div className="row"><span>Pontos da trajetoria</span><span id="pmPoints">{modalData ? modalData.points : "N/A"}</span></div>
          </div>
        </div>
        <div className="particle-modal-right">
          <div id="particlePlotXY" className="particle-plot" />
          <div id="particlePlotRZ" className="particle-plot" />
        </div>
      </div>
    </div>
  );
}
