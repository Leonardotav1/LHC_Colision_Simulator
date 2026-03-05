import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { initApp } from "@/simulator/runtime/simulatorRuntime.js";
import ParticleModal from "@/simulator/modal/ParticleModal.jsx";
import {
  resetFilters,
  setActiveTab,
  setHeatmapLayer,
  toggleShowSensors,
  toggleShowGrid,
  togglePlayRotation,
  togglePlayPhysics,
  toggleFilter,
} from "@/store/simulatorUiSlice.js";
import { openFilePicker, runSimulation, toggleFullScreen, uploadSelectedFile } from "@/simulator/runtime/simulatorRuntime.js";

const TAB_ITEMS = [
  { id: "transversal", label: "Tomografia" },
  { id: "compo", label: "Composicao" },
  { id: "stats", label: "Estatisticas" },
  { id: "heatmap", label: "Mapa (eta-phi)" },
];

const HUD_FILTERS = [
  { id: 0, label: "Muons", color: "#06b6d4" },
  { id: 1, label: "Eletrons", color: "#ef4444" },
  { id: 2, label: "Fotons", color: "#3b82f6" },
  { id: 3, label: "Hadrons", color: "#22c55e" },
  { id: 5, label: "Taus", color: "#d946ef" },
  { id: 4, label: "MET", color: "#f97316" },
];

const LEGEND_FILTERS = [
  { domId: "leg-mu", label: "Muons (mu)", color: "#06b6d4", typeId: 0, valueId: "val-mu" },
  { domId: "leg-el", label: "Eletrons (e-)", color: "#ef4444", typeId: 1, valueId: "val-el" },
  { domId: "leg-ph", label: "Fotons (gamma)", color: "#3b82f6", typeId: 2, valueId: "val-ph" },
  { domId: "leg-ha", label: "Hadrons (Jatos)", color: "#22c55e", typeId: 3, valueId: "val-ha" },
  { domId: "leg-tau", label: "Taus (tau)", color: "#d946ef", typeId: 5, valueId: "val-tau" },
  { domId: "leg-met", label: "MET", color: "#f97316", typeId: 4, valueId: "val-met" },
];

// Botao de toggle reutilizável para os controles de exibição e animação.
function ToggleButton({ id, active, onClick, activeLabel, inactiveLabel, title }) {
  return (
    <button className={`btn-fs ${active ? "" : "inactive"}`} id={id} onClick={onClick} title={title}>
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

// Componente raiz da interface do simulador.
export default function App() {
  // Hooks do React-Redux para acessar o estado global da UI e despachar ações a partir de callbacks e efeitos.
  const dispatch = useDispatch();

  // Acessa o store do Redux para ler o estado da UI e permitir dispatch de ações a partir de callbacks e efeitos.
  const appStore = useStore();

  const simulatorUi = useSelector((s) => s.simulatorUi);
  const appUi = useSelector((s) => s.appUi);

  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  // Inicializa o runtime imperativo (Three + Plotly + backend bridge) e registra cleanup no unmount.
  useEffect(() => {
    const cleanup = initApp(appStore);
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [appStore]);

  // Mantem o estado React sincronizado com a API Fullscreen do navegador.
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Forca resize quando o usuario troca de aba, para Plotly recalcular dimensoes corretamente.
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [simulatorUi.activeTab]);

  const isFilterActive = useCallback((typeId) => simulatorUi.activeFilters.includes(typeId), [simulatorUi.activeFilters]);
  const allFiltersEnabled = simulatorUi.activeFilters.length === 6;
  const activeFilterLabels = useMemo(() => HUD_FILTERS.filter((item) => isFilterActive(item.id)), [isFilterActive]);

  return (
    <>
      <div id="glass-tooltip" className="glass-tooltip" />
      <div id="loadingOverlay" className={`loading-overlay ${appUi.loadingVisible ? "show" : ""}`}>
        <div className="loading-spinner" />
        <div id="loadingText" className="loading-text">
          {appUi.loadingMessage}
        </div>
      </div>
      <div id="errorBanner" className={`error-banner ${appUi.bannerVisible ? "show" : ""} ${appUi.bannerLevel || ""}`}>
        {appUi.bannerMessage}
      </div>

      <div className="top-navbar">
        <div className="brand">
          Simulador <span>LHC</span>
        </div>
        <div className="file-info">
          <span className="label">ARQUIVO:</span>
          <span className="val" id="fileNameLabel" title={appUi.fileNameFull || appUi.fileName}>
            {appUi.fileName}
          </span>
          <span className="separator">|</span>
          <span className="label">EVENTO:</span>
          <span className="val" id="eventLabel">
            #0
          </span>
        </div>
        <div className="nav-controls">
          <input type="file" id="fileInput" style={{ display: "none" }} />
          <button className="btn" id="fileBtn" onClick={openFilePicker}>
            Selecionar Arquivo
          </button>
          <button className="btn" id="uploadBtn" onClick={uploadSelectedFile}>
            Upload
          </button>
          <div className="v-sep" />
          <div className="event-selector" title="Quantos eventos o arquivo possui">
            <span>TOTAL</span>
            <input type="number" id="totalEventosInput" defaultValue="0" readOnly />
          </div>
          <div className="event-selector" title="Qual evento inicial simular">
            <span>EVENTO</span>
            <input type="number" id="eventoInput" defaultValue="0" min="0" disabled={!appUi.hasRootFile} />
          </div>
          <div className="event-selector" title="Quantidade de eventos a simular">
            <span>N EVENTOS</span>
            <input type="number" id="numInput" defaultValue="1" min="1" disabled={!appUi.hasRootFile} />
          </div>
          <button className="btn" id="simMainBtn" onClick={runSimulation} disabled={!appUi.hasRootFile}>
            Simular
          </button>
          <select id="rootFileSelect" style={{ display: "none" }} />
          <span id="eventRangeLabel" style={{ display: "none" }} />
        </div>
      </div>

      <div className="container">
        <div className="col-main panel panel-flex-grow" id="panel-3d">
          <div className="panel-header">
            <span>Camara de Colisao 3D (Ref. CMS Detector)</span>
            <div className="btn-fs-group">
              <span id="filt-alert" className="filt-alert" style={{ display: allFiltersEnabled ? "none" : "inline-block" }}>
                FILTRO ATIVADO
              </span>
              <span id="statusLabel" className="status-label">
                <span style={{ color: appUi.statusColor }}>{appUi.statusText}</span>
              </span>
              <ToggleButton id="btn-anim" active={simulatorUi.controls.playPhysics} onClick={() => dispatch(togglePlayPhysics())} activeLabel="|| Fisica" inactiveLabel="? Fisica" />
              <ToggleButton id="btn-pause" active={simulatorUi.controls.playRotation} onClick={() => dispatch(togglePlayRotation())} activeLabel="|| Rotacao" inactiveLabel="? Rotacao" />
              <ToggleButton id="btn-grid" active={simulatorUi.controls.showGrid} onClick={() => dispatch(toggleShowGrid())} activeLabel="|| Malha" inactiveLabel="Malha" />
              <ToggleButton id="btn-sensors" active={simulatorUi.controls.showSensors} onClick={() => dispatch(toggleShowSensors())} activeLabel="Sensores" inactiveLabel="Sensores" />
              <div className="v-sep-mini" />
              <button className="btn-fs" id="btn-fs-toggle" onClick={toggleFullScreen}>
                {isFullscreen ? "Sair" : "Tela Cheia"}
              </button>
            </div>
          </div>
          <div id="main3d" className="plot-container" />

          <div className="hud-panel" id="fs-hud" style={{ display: isFullscreen ? "flex" : "none" }}>
            <span className="hud-title">FILTROS (ROOT DATA):</span>
            {HUD_FILTERS.map((item) => (
              <button
                key={item.id}
                className={`hud-btn ${isFilterActive(item.id) ? "active" : ""}`}
                id={`hud-btn-${item.id}`}
                style={{ "--c": item.color }}
                onClick={() => dispatch(toggleFilter(item.id))}
              >
                {item.label}
              </button>
            ))}
            <div className="v-sep-mini" />
            <button className="hud-btn" id="btnResetHud" style={{ "--c": "#94a3b8" }} onClick={() => dispatch(resetFilters())}>
              Mostrar Todas
            </button>
          </div>
        </div>

        <div className="col-side">
          <div className="global-filter-bar" id="global-filter-bar">
            <span style={{ fontSize: "10px", color: "#94a3b8", marginRight: "3px" }}>Exibindo:</span>
            {allFiltersEnabled ? (
              <span className="filter-badge" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.35)" }}>
                Todas as particulas
              </span>
            ) : (
              activeFilterLabels.map((item) => (
                <span key={item.id} className="filter-badge" style={{ background: `${item.color}30`, color: item.color, borderColor: `${item.color}80` }}>
                  {item.label}
                </span>
              ))
            )}
          </div>

          <div className="tabs-menu">
            {TAB_ITEMS.map((tab) => (
              <button key={tab.id} className={`tab-btn ${simulatorUi.activeTab === tab.id ? "active" : ""}`} data-tab={tab.id} onClick={() => dispatch(setActiveTab(tab.id))}>
                {tab.label}
              </button>
            ))}
          </div>

          <div id="tab-transversal" className={`tab-content panel ${simulatorUi.activeTab === "transversal" ? "active" : ""}`}>
            <div className="panel-header">
              <span>Tomografia Transversal e MET (R-phi)</span>
              <span className="tip-right">ARRASTE P/ MOVER</span>
            </div>
            <div id="radarPlot" className="plot-container" />
          </div>

          <div id="tab-compo" className={`tab-content panel ${simulatorUi.activeTab === "compo" ? "active" : ""}`}>
            <div className="panel-header">
              <span>Composicao e Balanco (MET)</span>
              <button id="btnResetFilter" className="btn-filter" onClick={() => dispatch(resetFilters())} style={{ display: allFiltersEnabled ? "none" : "inline-block" }}>
                Mostrar Todas
              </button>
              <span id="lblClickPizza" style={{ display: allFiltersEnabled ? "inline-block" : "none" }}>
                CLIQUE NA PIZZA OU LEGENDA
              </span>
            </div>
            <div className="legend-list">
              {LEGEND_FILTERS.map((item) => (
                <div key={item.domId} className={`leg-item ${isFilterActive(item.typeId) ? "" : "dimmed"}`} id={item.domId} onClick={() => dispatch(toggleFilter(item.typeId))}>
                  <div>
                    <span className="dot" style={{ background: item.color }} />
                    {item.label}
                  </div>
                  <div className="kpi-val" id={item.valueId}>
                    0
                  </div>
                </div>
              ))}
            </div>
            <div className="plot-container mini">
              <div id="pizzaPlotMini" />
            </div>
          </div>

          <div id="tab-stats" className={`tab-content panel ${simulatorUi.activeTab === "stats" ? "active" : ""}`}>
            <div className="panel-header">Dados Vitais Globais</div>
            <div className="kpi-row">
              <div className="kpi-label">Energia C.M. (sqrt(s))</div>
              <div className="kpi-val">13.6 TeV</div>
            </div>
            <div className="kpi-row">
              <div className="kpi-label">Campo Magnetico (B)</div>
              <div className="kpi-val" id="kpi-b">
                3.8 Tesla
              </div>
            </div>
            <div className="kpi-row">
              <div className="kpi-label">Particulas em Exibicao</div>
              <div className="kpi-val" id="kpi-parts">
                0
              </div>
            </div>
            <div id="ptDistPlot" className="plot-container short" />
            <div id="etaDistPlot" className="plot-container short" />
          </div>

          <div id="tab-heatmap" className={`tab-content panel ${simulatorUi.activeTab === "heatmap" ? "active" : ""}`}>
            <div className="panel-header">
              <span>Leitura dos Calorimetros</span>
              <div className="layer-group">
                <button id="btn-hm-all" className={`layer-btn ${simulatorUi.heatmapLayer === "ALL" ? "active" : ""}`} onClick={() => dispatch(setHeatmapLayer("ALL"))}>
                  TODAS
                </button>
                <button id="btn-hm-ecal" className={`layer-btn ${simulatorUi.heatmapLayer === "ECAL" ? "active" : ""}`} onClick={() => dispatch(setHeatmapLayer("ECAL"))}>
                  ECAL
                </button>
                <button id="btn-hm-hcal" className={`layer-btn ${simulatorUi.heatmapLayer === "HCAL" ? "active" : ""}`} onClick={() => dispatch(setHeatmapLayer("HCAL"))}>
                  HCAL
                </button>
              </div>
            </div>
            <div id="heatmapPlot" className="plot-container" />
          </div>
        </div>
      </div>

      <ParticleModal />
    </>
  );
}
