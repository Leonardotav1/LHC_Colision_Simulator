import { useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";
import "./ParticleModal.css";

function fmt(value, digits = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

export default function ParticleModal() {
  const [particle, setParticle] = useState(null);
  const [selectedPlot, setSelectedPlot] = useState("xy");
  const isOpen = Boolean(particle);

  const plotRef = useRef(null);
  const rightPanelRef = useRef(null);

  const modalData = useMemo(() => {
    if (!particle) return null;

    const reco = particle.reco || {};
    const pt = typeof reco.pt_gev === "number" ? reco.pt_gev : reco?.pt_gev?.nominal;
    const met = typeof reco.met_gev === "number" ? reco.met_gev : reco?.met_gev?.nominal;
    const pval = Number.isFinite(pt) ? pt : met;
    const traj = Array.isArray(particle.trajectory) ? particle.trajectory : [];

    return {
      type: String(particle.type || "N/A").toUpperCase(),
      pval,
      eta: reco.eta,
      phi: reco.phi,
      charge: Number.isFinite(Number(reco.charge)) ? String(reco.charge) : "N/A",
      stop: particle.stopReason || particle.stop_reason || "N/A",
      points: traj.length,
      x: traj.map((t) => t[0]),
      y: traj.map((t) => t[1]),
      z: traj.map((t) => t[2]),
      r: traj.map((t) => Math.hypot(t[0], t[1])),
      color: particle.color || "#38bdf8",
    };
  }, [particle]);

  useEffect(() => {
    const onOpen = (event) => {
      setSelectedPlot("xy");
      setParticle(event.detail || null);
    };
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

  useEffect(() => {
    if (!isOpen || !modalData) return;
    if (!plotRef.current) return;

    const baseLayout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cbd5e1", size: 11 },
      margin: { t: 75, l: 52, r: 24, b: 30 },
      autosize: true,
    };

    const cfg = {
      displaylogo: false,
      displayModeBar: "hover",
      responsive: true,
    };

    const isXY = selectedPlot === "xy";
    const traces = isXY
      ? [
          {
            x: modalData.x,
            y: modalData.y,
            type: "scatter",
            mode: "lines+markers",
            line: { color: modalData.color, width: 2.2 },
            marker: { color: modalData.color, size: 4 },
          },
        ]
      : [
          {
            x: modalData.z,
            y: modalData.r,
            type: "scatter",
            mode: "lines",
            line: { color: "#facc15", width: 2.2 },
          },
        ];

    const layout = isXY
      ? {
          ...baseLayout,
          title: { text: "Trajetoria Transversal (X-Y)", font: { color: "#7dd3fc", size: 13 } },
          xaxis: { title: "X [cm]", gridcolor: "rgba(56,189,248,0.12)", automargin: true },
          yaxis: { title: "Y [cm]", gridcolor: "rgba(56,189,248,0.12)", scaleanchor: "x", scaleratio: 1, automargin: true },
        }
      : {
          ...baseLayout,
          title: { text: "Perfil Longitudinal (Z-R)", font: { color: "#7dd3fc", size: 13 } },
          xaxis: { title: "Z [cm]", gridcolor: "rgba(56,189,248,0.12)", automargin: true },
          yaxis: { title: "R = sqrt(x^2+y^2) [cm]", gridcolor: "rgba(56,189,248,0.12)", automargin: true },
        };

    Plotly.newPlot(plotRef.current, traces, layout, cfg);

    const resizePlots = () => {
      if (!plotRef.current) return;
      Plotly.Plots.resize(plotRef.current);
    };

    requestAnimationFrame(resizePlots);
    const t = setTimeout(resizePlots, 180);
    window.addEventListener("resize", resizePlots);

    let observer = null;
    if (typeof ResizeObserver !== "undefined" && rightPanelRef.current) {
      observer = new ResizeObserver(resizePlots);
      observer.observe(rightPanelRef.current);
    }

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", resizePlots);
      if (observer) observer.disconnect();
      if (plotRef.current) Plotly.purge(plotRef.current);
    };
  }, [isOpen, modalData, selectedPlot]);

  return (
    <div id="particleModalOverlay" className={`particle-modal-overlay${isOpen ? " show" : ""}`} onClick={() => setParticle(null)}>
      <div className="particle-modal-card" role="dialog" aria-modal="true" aria-label="Detalhes da particula" onClick={(e) => e.stopPropagation()}>
        <div className="particle-modal-left">
          <div className="particle-modal-title-row">
            <div className="particle-modal-title">Detalhes da Particula</div>
            <button id="particleModalCloseBtn" className="particle-modal-close" type="button" onClick={() => setParticle(null)}>
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
        <div className="particle-modal-right" ref={rightPanelRef}>
          <div className="particle-plot-selector">
            <button
              type="button"
              className={`plot-select-btn ${selectedPlot === "xy" ? "active" : ""}`}
              onClick={() => setSelectedPlot("xy")}
            >
              Grafico X-Y
            </button>
            <button
              type="button"
              className={`plot-select-btn ${selectedPlot === "rz" ? "active" : ""}`}
              onClick={() => setSelectedPlot("rz")}
            >
              Grafico R-Z
            </button>
          </div>
          <div id="particlePlotMain" className="particle-plot particle-plot-main" ref={plotRef} />
        </div>
      </div>
    </div>
  );
}
