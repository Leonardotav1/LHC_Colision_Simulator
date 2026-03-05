import Plotly from "plotly.js-dist-min";
import { API_BASE_URL } from "@/config/api.js";
import { createPlotlyRuntime } from "./plotlyRuntime.js";
import { buildThreeScene } from "./threeRuntime.js";
import { PARTICLE, PARTICLE_NAMES, PARTICLE_COLORS, PARTICLE_COLORS_DIM } from "../core/constants.js";
import { state, filteredObjects } from "../core/state.js";
import {
    byId,
    setText,
    syncEventInputBounds,
} from "../ui/uiHelpers.js";
import {
    parseObjects,
    recoValue,
    uploadRootFile,
    clearRootFiles,
    getActiveRootStats,
    simulateFromBackend,
} from "../services/backend.js";
import { toggleFilter } from "@/store/simulatorUiSlice.js";
import {
    clearBanner as clearBannerAction,
    hideLoading as hideLoadingAction,
    setFileLabel as setFileLabelAction,
    setRootAvailability as setRootAvailabilityAction,
    setStatus as setStatusAction,
    showBanner as showBannerAction,
    showLoading as showLoadingAction,
} from "@/store/appUiSlice.js";

// Runtime orchestrator that connects backend calls, Plotly rendering and Three.js scene updates.
const SERVER_URL = API_BASE_URL;
const pNames = PARTICLE_NAMES;
const pColors = PARTICLE_COLORS;
const pColorsDim = PARTICLE_COLORS_DIM;
// Shared reference to Redux store for runtime modules outside React tree.
let uiStoreRef = null;
let pendingUploadFile = null;
const ALL_FILTERS = [0, 1, 2, 3, 4, 5];
const RESIZE_PLOT_IDS = ["radarPlot", "pizzaPlotMini", "ptDistPlot", "etaDistPlot", "heatmapPlot", "particlePlotXY", "particlePlotRZ"];

function dispatchUi(action) {
    if (uiStoreRef && typeof uiStoreRef.dispatch === "function") {
        uiStoreRef.dispatch(action);
    }
}

function setUiStatus(text, color = "#facc15") {
    dispatchUi(setStatusAction({ text, color }));
}

function setUiFileLabel(name) {
    dispatchUi(setFileLabelAction(name));
}

function setUiRootAvailability(hasRootFile, message = "") {
    state.ui.hasRootFile = !!hasRootFile;
    dispatchUi(setRootAvailabilityAction({ hasRootFile, message }));
}

function showUiError(message) {
    dispatchUi(showBannerAction({ message, level: "error" }));
}

function clearUiBanner() {
    dispatchUi(clearBannerAction());
}

function showUiLoading(message = "Simulando...") {
    dispatchUi(showLoadingAction({ message }));
}

function hideUiLoading() {
    dispatchUi(hideLoadingAction());
}

function getUiStateSnapshot(ui) {
    return {
        activeTab: ui?.activeTab || "transversal",
        heatmapLayer: ui?.heatmapLayer || "ALL",
        activeFilters: Array.isArray(ui?.activeFilters) ? [...ui.activeFilters] : [...ALL_FILTERS],
        controls: { ...(ui?.controls || {}) },
    };
}

function arraysEqual(a, b) {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
}

function objectsEqual(a, b) {
    return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

function sync3DSize() {
    const t = state.three;
    if (!(t.renderer && t.camera)) return;
    const c = byId("main3d");
    if (!c) return;
    t.renderer.setSize(c.clientWidth, c.clientHeight);
    t.camera.aspect = c.clientWidth / c.clientHeight;
    t.camera.updateProjectionMatrix();
}

function resizePlots() {
    RESIZE_PLOT_IDS.forEach((id) => {
        const el = byId(id);
        if (el && el.data) Plotly.Plots.resize(el);
    });
}

function handleWindowResize() {
    sync3DSize();
    resizePlots();
}

function setTotalEvents(total) {
    const totalEl = byId("totalEventosInput");
    if (!totalEl) return;
    const safeTotal = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
    totalEl.value = String(safeTotal);
    totalEl.readOnly = true;
    syncEventInputBounds();
}

// Emits event so React modal can render particle details.
function openParticleModal(particle) {
    if (!particle) return;
    window.dispatchEvent(new CustomEvent("particle-modal:open", { detail: particle }));
}

function updateBackendMeta(meta) {
    state.meta = meta || {};
    const b = Number(meta?.magnetic_field_t);
    if (Number.isFinite(b)) setText("kpi-b", `${b.toFixed(1)} Tesla`);

    const total = Number(meta?.total_events);
    if (Number.isFinite(total) && byId("totalEventosInput")) {
        byId("totalEventosInput").value = String(total);
        byId("totalEventosInput").readOnly = true;
    }

    const summaries = Array.isArray(meta?.event_summaries) ? meta.event_summaries : [];
    const nEvents = Number(meta?.n_events) || 0;
    const start = Number(meta?.start_event) || 0;
    const avgObjs = summaries.length ? summaries.reduce((a, s) => a + (Number(s?.n_objects) || 0), 0) / summaries.length : 0;
    const avgDelta = summaries.length ? summaries.reduce((a, s) => a + (Number(s?.delta_met_gev) || 0), 0) / summaries.length : 0;

    const end = nEvents > 0 ? start + nEvents - 1 : start;
    setText("kpiSimEvents", nEvents > 1 ? `${nEvents} (#${start}-${end})` : `${nEvents} (#${start})`);
    setText("kpiObjsAvg", avgObjs.toFixed(1));
    setText("kpiDeltaMet", `${avgDelta.toFixed(2)} GeV`);
    syncEventInputBounds();
}

function updateStateObjects(objects) {
    state.objects = objects;
    state.byType = [[], [], [], [], [], []];
    state.counts = [0, 0, 0, 0, 0, 0];
    objects.forEach((o) => {
        state.byType[o.typeId].push(o);
        state.counts[o.typeId] += 1;
    });

    byId("val-mu").textContent = state.counts[PARTICLE.MUON];
    byId("val-el").textContent = state.counts[PARTICLE.ELECTRON];
    byId("val-ph").textContent = state.counts[PARTICLE.PHOTON];
    byId("val-ha").textContent = state.counts[PARTICLE.HADRON];
    byId("val-met").textContent = state.counts[PARTICLE.MET];
    byId("val-tau").textContent = state.counts[PARTICLE.TAU];

    const met = state.byType[PARTICLE.MET].reduce((a, o) => a + recoValue(o), 0);
    setText("kpiMet", `${met.toFixed(2)} GeV`);
}

function applyFiltersToEntireUI() {
    // React owns visual state for filter badges, tab controls and legend toggles.
    setText("kpi-parts", String(filteredObjects().length));

    plotlyEngine.updatePlotVisibility();
    plotlyEngine.updateHeatmapDisplay();
    update3DVisibility();
}

function toggleParticleFilter(typeId) {
    if (uiStoreRef && typeof uiStoreRef.dispatch === "function") {
        uiStoreRef.dispatch(toggleFilter(typeId));
        return;
    }
    if (state.activeFilters.length === 6) state.activeFilters = [typeId];
    else {
        const idx = state.activeFilters.indexOf(typeId);
        if (idx > -1) {
            state.activeFilters.splice(idx, 1);
            if (!state.activeFilters.length) state.activeFilters = [0, 1, 2, 3, 4, 5];
        } else {
            state.activeFilters.push(typeId);
            if (state.activeFilters.length === 6) state.activeFilters = [0, 1, 2, 3, 4, 5];
        }
    }
    applyFiltersToEntireUI();
}

const plotlyEngine = createPlotlyRuntime({
    state,
    byId,
    pNames,
    pColors,
    pColorsDim,
    PARTICLE,
    filteredObjects,
    toggleParticleFilter,
    applyFiltersToEntireUI,
});


function build3DScene() {
    buildThreeScene({ state, byId, pColors, PARTICLE, openParticleModal, update3DVisibility });
}


function update3DVisibility() {
    const p = state.three.particles;
    if (!p || !p.length) return;
    p.forEach((x) => {
        const visible = state.activeFilters.includes(x.object.typeId);
        x.line.visible = visible;
        if (!visible) x.head.visible = false;
    });
}

export function toggleFullScreen() {
    const panel = byId("panel-3d");
    if (!document.fullscreenElement) panel.requestFullscreen().catch(() => null);
    else document.exitFullscreen();
}

export function openFilePicker() {
    byId("fileInput")?.click();
}

export async function uploadSelectedFile() {
    try {
        clearUiBanner();
        if (!pendingUploadFile) {
            throw new Error("Selecione um arquivo .root antes de fazer upload.");
        }
        await uploadArquivo(pendingUploadFile);
        const stats = await getActiveRootStats(SERVER_URL);
        setTotalEvents(stats.total_events);
        setUiRootAvailability(true);
        setUiStatus("UPLOAD OK", "#4ade80");
        pendingUploadFile = null;
        const input = byId("fileInput");
        if (input) input.value = "";
    } catch (e) {
        showUiError(e.message || "Erro no upload");
        setUiStatus("UPLOAD ERRO", "#ef4444");
    }
}

export function runSimulation() {
    return simularEvento().catch((e) => {
        console.error(e);
        const message = e.message || "Erro inesperado no backend.";
        showUiError(message);
        setUiStatus("ERRO BACKEND", "#ef4444");
    });
}

function changeHeatmapLayer(layer) {
    state.currentHeatmapLayer = layer;
    plotlyEngine.updateHeatmapDisplay();
}

function syncThreeControls(controls) {
    if (!controls) return;
    state.three.playPhysics = !!controls.playPhysics;
    state.three.playRotation = !!controls.playRotation;
    if (state.three.grid) state.three.grid.visible = !!controls.showGrid;
    if (state.three.trackerGroup) state.three.trackerGroup.visible = !!controls.showSensors;
}

async function handleFileInputChange() {
    const input = byId("fileInput");
    const file = input?.files?.[0] || null;
    pendingUploadFile = file;
    if (!file) {
        setUiStatus("AGUARDANDO ROOT", "#facc15");
        return;
    }
    setUiFileLabel(file.name);
    clearUiBanner();
    setUiStatus("ARQUIVO PRONTO PARA UPLOAD", "#38bdf8");
}

function applyUiState(ui, prevUi) {
    const current = getUiStateSnapshot(ui);
    if (!prevUi) {
        state.activeFilters = [...current.activeFilters];
        state.currentHeatmapLayer = current.heatmapLayer;
        syncThreeControls(current.controls);
        applyFiltersToEntireUI();
        return current;
    }

    if (!arraysEqual(current.activeFilters, prevUi.activeFilters)) {
        state.activeFilters = [...current.activeFilters];
        applyFiltersToEntireUI();
    }
    if (current.activeTab !== prevUi.activeTab) window.dispatchEvent(new Event("resize"));
    if (current.heatmapLayer !== prevUi.heatmapLayer) changeHeatmapLayer(current.heatmapLayer);
    if (!objectsEqual(current.controls, prevUi.controls)) syncThreeControls(current.controls);

    return current;
}

function subscribeUiStore(appStore) {
    if (!appStore || typeof appStore.subscribe !== "function" || typeof appStore.getState !== "function") return () => { };
    let prevUi = null;
    const apply = () => {
        const ui = appStore.getState()?.simulatorUi;
        if (!ui) return;
        prevUi = applyUiState(ui, prevUi);
    };
    apply();
    return appStore.subscribe(apply);
}


async function uploadArquivo(file) {
    if (!file) return;
    setUiStatus("ENVIANDO ROOT...");
    const data = await uploadRootFile(SERVER_URL, file);
    setUiFileLabel(data.filename || file.name);
    state.ui.activeFilename = data.filename || file.name || "";
}

async function simularEvento() {
    clearUiBanner();
    if (!state.ui.hasRootFile) {
        throw new Error("Nenhum arquivo ROOT carregado. Envie ou selecione um arquivo antes de simular.");
    }
    syncEventInputBounds();
    const start = Number(byId("eventoInput").value || 0);
    const num = Math.max(1, Number(byId("numInput").value || 1));
    if (!Number.isFinite(start) || start < 0) {
        throw new Error("Evento inicial invalido. Informe um numero inteiro maior ou igual a 0.");
    }
    if (!Number.isFinite(num) || num < 1) {
        throw new Error("Quantidade de eventos invalida. Informe um numero inteiro maior ou igual a 1.");
    }
    byId("eventLabel").textContent = `#${start}`;
    byId("eventRangeLabel").textContent = `N EVENTOS: ${num}`;
    setUiStatus("SIMULANDO...");
    showUiLoading(`Simulando ${num} evento(s)...`);
    try {
        const fig = await simulateFromBackend(SERVER_URL, start, num);
        updateBackendMeta(fig?.layout?.meta || {});
        const objects = parseObjects(fig);
        updateStateObjects(objects);
        plotlyEngine.renderPlotly();
        build3DScene();
        setUiStatus("SISTEMA ONLINE", "#4ade80");
    } finally {
        hideUiLoading();
    }
}

// Conecta os eventos da UI com as ações do runtime, como upload de arquivos, simulação de eventos e sincronização de estado entre Redux, Plotly e Three.js. 
function bindUIActions(appStore) {
    uiStoreRef = appStore || null;

    const onBeforeUnload = () => {
        clearRootFiles(SERVER_URL, true).catch(() => null);
    };


    window.addEventListener("beforeunload", onBeforeUnload);
    byId("fileInput")?.addEventListener("change", handleFileInputChange);
    byId("eventoInput")?.addEventListener("change", syncEventInputBounds);
    byId("numInput")?.addEventListener("change", syncEventInputBounds);
    window.addEventListener("resize", handleWindowResize);

    const unsubscribe = subscribeUiStore(appStore);

    return () => {
        uiStoreRef = null;
        window.removeEventListener("beforeunload", onBeforeUnload);
        byId("fileInput")?.removeEventListener("change", handleFileInputChange);
        byId("eventoInput")?.removeEventListener("change", syncEventInputBounds);
        byId("numInput")?.removeEventListener("change", syncEventInputBounds);
        window.removeEventListener("resize", handleWindowResize);
        if (typeof unsubscribe === "function") unsubscribe();
    };
}

// Inicializa o runtime da aplicação, configurando conexões com o backend, preparando o ambiente de visualização e sincronizando o estado da UI com Redux. 
export function initApp(appStore) {
    // Armazena referência ao store do Redux para permitir dispatch de ações a partir de módulos fora da árvore React, como o runtime de visualização.
    const unbindUI = bindUIActions(appStore);
    
    setUiRootAvailability(false, "Selecione um arquivo .root e clique em Upload para continuar.");
    setTotalEvents(0);
    setText("eventLabel", "#-");
    clearRootFiles(SERVER_URL).catch(() => null);
    const timer = setTimeout(async () => {
        setUiStatus("AGUARDANDO ROOT", "#facc15");
    }, 450);

    // Retorna uma função de limpeza para ser chamada na desmontagem do componente React.
    return () => {
        clearTimeout(timer);
        if (typeof unbindUI === "function") unbindUI();
    };
}
