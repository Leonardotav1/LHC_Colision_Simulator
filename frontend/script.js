const SERVER_URL = "http://127.0.0.1:5000";

const PARTICLE = { MUON: 0, ELECTRON: 1, PHOTON: 2, HADRON: 3, MET: 4, TAU: 5 };
const pNames = ["Muons", "Eletrons", "Fotons", "Hadrons", "MET", "Taus"];
const pColors = ["#06b6d4", "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#d946ef"];
const pColorsDim = ["#023e4a", "#4a1010", "#102a5c", "#0a3d1b", "#522206", "#4a1352"];

const state = {
    activeFilters: [0, 1, 2, 3, 4, 5],
    currentHeatmapLayer: "ALL",
    objects: [],
    byType: [[], [], [], [], [], []],
    counts: [0, 0, 0, 0, 0, 0],
    meta: {},
    three: {
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        animationId: null,
        particles: [],
        grid: null,
        trackerGroup: null,
        playPhysics: true,
        playRotation: true,
    },
};

function byId(id) { return document.getElementById(id); }
function setText(id, value) { const el = byId(id); if (el) el.textContent = value; }
function formatFileNameForUi(fileName, maxLen = 28) {
    const name = String(fileName || "");
    if (!name || name.length <= maxLen) return name;
    const keepStart = 14;
    const keepEnd = 10;
    return `${name.slice(0, keepStart)}...${name.slice(-keepEnd)}`;
}
function setFileNameLabel(fileName) {
    const el = byId("fileNameLabel");
    if (!el) return;
    const full = String(fileName || "");
    el.textContent = formatFileNameForUi(full);
    el.title = full;
}
function showLoading(message = "Simulando...") {
    const overlay = byId("loadingOverlay");
    const text = byId("loadingText");
    if (text) text.textContent = message;
    if (overlay) overlay.classList.add("show");
}
function hideLoading() {
    const overlay = byId("loadingOverlay");
    if (overlay) overlay.classList.remove("show");
}
function syncEventInputBounds() {
    const totalEl = byId("totalEventosInput");
    const eventEl = byId("eventoInput");
    const numEl = byId("numInput");
    if (!totalEl || !eventEl || !numEl) return;

    const total = Number(totalEl.value || 0);
    if (!Number.isFinite(total) || total <= 0) return;

    let start = Number(eventEl.value || 1);
    if (!Number.isFinite(start)) start = 1;
    start = Math.max(1, Math.min(total, start));
    eventEl.value = String(start);
    eventEl.max = String(total);

    const remaining = Math.max(1, total - start + 1);
    numEl.max = String(remaining);
    let n = Number(numEl.value || 1);
    if (!Number.isFinite(n)) n = 1;
    n = Math.max(1, Math.min(remaining, n));
    numEl.value = String(n);
}

function showError(message) {
    const banner = byId("errorBanner");
    if (!banner) return;
    banner.textContent = message;
    banner.classList.add("show");
}

function clearError() {
    const banner = byId("errorBanner");
    if (!banner) return;
    banner.textContent = "";
    banner.classList.remove("show");
}

function setStatus(text, color = "#facc15") {
    const el = byId("statusLabel");
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
}

async function parseApiError(res, fallback) {
    let payload = null;
    try { payload = await res.json(); } catch (_) { payload = null; }
    throw new Error(payload?.error || `${fallback} (${res.status})`);
}

function mapType(rawType) {
    const t = String(rawType || "").toLowerCase();
    if (t === "muon") return PARTICLE.MUON;
    if (t === "electron") return PARTICLE.ELECTRON;
    if (t === "photon") return PARTICLE.PHOTON;
    if (t === "jet" || t === "hadron") return PARTICLE.HADRON;
    if (t === "met") return PARTICLE.MET;
    if (t === "tau") return PARTICLE.TAU;
    return null;
}

function recoValue(obj) {
    if (obj.typeId === PARTICLE.MET) {
        const m = obj.reco?.met_gev;
        return typeof m === "number" ? m : Number(m?.nominal ?? 0);
    }
    const p = obj.reco?.pt_gev;
    return typeof p === "number" ? p : Number(p?.nominal ?? 0);
}

function parseObjects(fig) {
    const traces = Array.isArray(fig?.data) ? fig.data : [];
    return traces
        .filter((t) => t?.meta && Array.isArray(t.meta.trajectory) && t.meta.trajectory.length > 1)
        .map((t) => ({
            type: t.meta.type,
            typeId: mapType(t.meta.type),
            color: t.meta.color || "#ffffff",
            stopReason: t.meta.stop_reason || "unknown",
            trajectory: t.meta.trajectory,
            reco: t.meta.reco || {},
        }))
        .filter((o) => o.typeId !== null);
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

function filteredObjects() { return state.objects.filter((o) => state.activeFilters.includes(o.typeId)); }

function applyFiltersToEntireUI() {
    const allOn = state.activeFilters.length === 6;
    let html = "<span style=\"font-size:10px; color:#94a3b8; margin-right:5px;\">Exibindo:</span>";
    if (allOn) {
        html += "<span class=\"filter-badge\" style=\"background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.3);\">TODAS AS PARTICULAS + MET</span>";
    } else {
        state.activeFilters.forEach((id) => {
            html += `<span class="filter-badge" style="background:${pColors[id]}30; color:${pColors[id]}; border-color:${pColors[id]}80;">${pNames[id]}</span>`;
        });
    }
    byId("global-filter-bar").innerHTML = html;

    [0, 1, 2, 3, 4, 5].forEach((id) => {
        const btn = byId(`hud-btn-${id}`);
        if (btn) btn.classList.toggle("active", state.activeFilters.includes(id));
    });

    ["leg-mu", "leg-el", "leg-ph", "leg-ha", "leg-met", "leg-tau"].forEach((id, idx) => {
        const el = byId(id);
        if (el) el.classList.toggle("dimmed", !state.activeFilters.includes(idx));
    });

    if (byId("btnResetFilter")) byId("btnResetFilter").style.display = allOn ? "none" : "inline-block";
    if (byId("lblClickPizza")) byId("lblClickPizza").style.display = allOn ? "inline-block" : "none";
    if (byId("filt-alert")) byId("filt-alert").style.display = allOn ? "none" : "inline-block";
    setText("kpi-parts", String(filteredObjects().length));

    updatePlotVisibility();
    updateHeatmapDisplay();
    update3DVisibility();
}

function toggleParticleFilter(typeId) {
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

function resetParticleFilter() {
    state.activeFilters = [0, 1, 2, 3, 4, 5];
    applyFiltersToEntireUI();
}

function showTab(tabId, btnElement) {
    document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach((el) => el.classList.remove("active"));
    const tab = byId(`tab-${tabId}`);
    if (tab) tab.classList.add("active");
    if (btnElement) btnElement.classList.add("active");
    else {
        const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (btn) btn.classList.add("active");
    }
    window.dispatchEvent(new Event("resize"));
}

function toggleGrid() {
    const g = state.three.grid;
    if (!g) return;
    g.visible = !g.visible;
    byId("btn-grid")?.classList.toggle("inactive", !g.visible);
}

function toggleSensors() {
    const t = state.three.trackerGroup;
    if (!t) return;
    t.visible = !t.visible;
    byId("btn-sensors")?.classList.toggle("inactive", !t.visible);
}

function toggleRotation() {
    state.three.playRotation = !state.three.playRotation;
    const btn = byId("btn-pause");
    if (!btn) return;
    btn.innerHTML = state.three.playRotation ? "⏸ Rotação" : "▶ Rotação";
    btn.classList.toggle("inactive", !state.three.playRotation);
}

function toggleAnim() {
    state.three.playPhysics = !state.three.playPhysics;
    const btn = byId("btn-anim");
    if (!btn) return;
    btn.innerHTML = state.three.playPhysics ? "⏸ Física" : "▶ Física";
    btn.classList.toggle("inactive", !state.three.playPhysics);
}

function drawRadarPlot() {
    function makeWedgeSVG(rIn, rOut, aStart, aEnd, steps = 15) {
        let path = "";
        for (let i = 0; i <= steps; i += 1) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            path += i === 0 ? `M ${rOut * Math.cos(a)} ${rOut * Math.sin(a)}` : ` L ${rOut * Math.cos(a)} ${rOut * Math.sin(a)}`;
        }
        for (let i = steps; i >= 0; i -= 1) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            path += ` L ${rIn * Math.cos(a)} ${rIn * Math.sin(a)}`;
        }
        return `${path} Z`;
    }

    const shapes = [];
    const traces = [];

    for (const r of [0.1, 0.4, 0.7, 1.0, 1.3]) {
        shapes.push({ type: "circle", x0: -r, y0: -r, x1: r, y1: r, line: { color: "rgba(148, 163, 184, 0.2)", width: 1, dash: "dot" }, layer: "below" });
    }
    shapes.push({ type: "path", path: makeWedgeSVG(1.4, 1.9, 0, Math.PI * 2, 60), fillcolor: "rgba(16, 185, 129, 0.1)", line: { color: "rgba(16,185,129,0.5)", width: 1 }, layer: "below" });
    for (let a = 0; a < 360; a += 5) {
        const rad = a * (Math.PI / 180);
        shapes.push({ type: "line", x0: 1.4 * Math.cos(rad), y0: 1.4 * Math.sin(rad), x1: 1.9 * Math.cos(rad), y1: 1.9 * Math.sin(rad), line: { color: "rgba(16, 185, 129, 0.3)", width: 0.5 }, layer: "below" });
    }
    for (let a = 0; a < 360; a += 10) {
        shapes.push({ type: "path", path: makeWedgeSVG(2.0, 3.2, a * (Math.PI / 180), (a + 9.5) * (Math.PI / 180)), fillcolor: "rgba(245, 158, 11, 0.1)", line: { color: "rgba(245,158,11,0.5)", width: 1 }, layer: "below" });
    }
    shapes.push({ type: "path", path: makeWedgeSVG(3.4, 3.9, 0, Math.PI * 2, 60), fillcolor: "rgba(148, 163, 184, 0.1)", line: { color: "rgba(100,116,139,0.5)", width: 1 }, layer: "below" });
    const muonLayers = [[4.2, 4.6], [5.0, 5.5], [5.9, 6.4], [6.8, 7.3]];
    for (let y = 0; y < muonLayers.length; y += 1) {
        const [mIn, mOut] = muonLayers[y];
        for (let a = 0; a < 360; a += 30) {
            const a1 = (a + 1) * (Math.PI / 180);
            const a2 = (a + 29) * (Math.PI / 180);
            shapes.push({ type: "path", path: makeWedgeSVG(mIn, mOut, a1, a2), fillcolor: "rgba(239, 68, 68, 0.1)", line: { color: "rgba(220,38,38,0.5)", width: 1 }, layer: "below" });
        }
    }

    const maxTracks = Math.min(state.objects.length, 320);
    for (let i = 0; i < maxTracks; i += 1) {
        const o = state.objects[i];
        const xs = [];
        const ys = [];
        const step = Math.max(1, Math.floor(o.trajectory.length / 80));
        for (let k = 0; k < o.trajectory.length; k += step) {
            xs.push(o.trajectory[k][0] / 100.0);
            ys.push(o.trajectory[k][1] / 100.0);
        }
        if (!xs.length) continue;
        traces.push({
            x: xs,
            y: ys,
            mode: "lines",
            line: { color: pColors[o.typeId], width: o.typeId === PARTICLE.MET ? 2.5 : 2, dash: (o.typeId === PARTICLE.PHOTON || o.typeId === PARTICLE.MET) ? "dash" : "solid" },
            hoverinfo: "none",
            showlegend: false,
            meta: { pType: o.typeId },
        });
    }

    shapes.push({ type: "circle", x0: -7.3, y0: -7.3, x1: 7.3, y1: 7.3, fillcolor: "rgba(239,68,68,0.1)", xref: "x2", yref: "y2", line: { color: "rgba(239,68,68,0.5)", width: 1 }, layer: "below" });
    shapes.push({ type: "circle", x0: -3.2, y0: -3.2, x1: 3.2, y1: 3.2, fillcolor: "rgba(251,191,36,0.3)", xref: "x2", yref: "y2", line: { width: 0 }, layer: "below" });
    shapes.push({ type: "circle", x0: -1.9, y0: -1.9, x1: 1.9, y1: 1.9, fillcolor: "rgba(16,185,129,0.3)", xref: "x2", yref: "y2", line: { width: 0 }, layer: "below" });
    shapes.push({ type: "path", path: "M 0 0 L 8.5 0 A 8.5 8.5 0 0 1 0 8.5 Z", fillcolor: "rgba(255,255,255,0.2)", xref: "x2", yref: "y2", line: { color: "rgba(255,255,255,0.8)", width: 1 }, name: "miniWedge" });
    traces.push({ x: [4.5, -4.5, -4.5, 4.5], y: [4.5, 4.5, -4.5, -4.5], mode: "markers", marker: { size: 40, color: "rgba(0,0,0,0)" }, xaxis: "x2", yaxis: "y2", customdata: ["Q1", "Q2", "Q3", "Q4"], hoverinfo: "none", showlegend: false });

    const radarLayout = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { t: 40, l: 20, r: 20, b: 20 },
        dragmode: "pan",
        xaxis: { title: { text: "Escala (metros)", font: { color: "#94a3b8", size: 10 } }, range: [-2.5, 7.5], showgrid: true, gridcolor: "rgba(255,255,255,0.05)", side: "top", tickmode: "linear", dtick: 1, tickfont: { color: "#94a3b8" }, scaleanchor: "y", scaleratio: 1 },
        yaxis: { range: [-2.5, 7.5], showgrid: true, gridcolor: "rgba(255,255,255,0.05)", visible: false },
        xaxis2: { domain: [0.75, 1.0], range: [-8.5, 8.5], visible: false, fixedrange: true },
        yaxis2: { domain: [0.0, 0.25], range: [-8.5, 8.5], visible: false, fixedrange: true, scaleanchor: "x2", scaleratio: 1 },
        shapes,
        annotations: [],
    };

    Plotly.newPlot("radarPlot", traces, radarLayout, { displayModeBar: true, scrollZoom: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"], responsive: true }).then((gd) => {
        gd.on("plotly_click", (data) => {
            if (data.points[0].xaxis._id !== "x2") return;
            const quad = data.points[0].customdata;
            let xR = [-2.5, 7.5];
            let yR = [-2.5, 7.5];
            let wP = "M 0 0 L 8.5 0 A 8.5 8.5 0 0 1 0 8.5 Z";
            if (quad === "Q2") { xR = [-7.5, 2.5]; yR = [-2.5, 7.5]; wP = "M 0 0 L 0 8.5 A 8.5 8.5 0 0 1 -8.5 0 Z"; }
            if (quad === "Q3") { xR = [-7.5, 2.5]; yR = [-7.5, 2.5]; wP = "M 0 0 L -8.5 0 A 8.5 8.5 0 0 1 0 -8.5 Z"; }
            if (quad === "Q4") { xR = [-2.5, 7.5]; yR = [-7.5, 2.5]; wP = "M 0 0 L 0 -8.5 A 8.5 8.5 0 0 1 8.5 0 Z"; }
            const newShapes = [...shapes];
            newShapes[newShapes.length - 1].path = wP;
            Plotly.relayout("radarPlot", { "xaxis.range": xR, "yaxis.range": yR, shapes: newShapes });
        });
    });
}

function metAnnotation() {
    const metObj = state.byType?.[PARTICLE.MET]?.[0];
    if (!metObj || !state.activeFilters.includes(PARTICLE.MET)) return [];
    const phi = Number(metObj?.reco?.phi);
    if (!Number.isFinite(phi)) return [];
    const r = 8.1;
    const tx = Math.cos(phi) * r;
    const ty = Math.sin(phi) * r;
    return [
        {
            ax: 0,
            ay: 0,
            x: tx,
            y: ty,
            xref: "x",
            yref: "y",
            axref: "x",
            ayref: "y",
            showarrow: true,
            arrowhead: 2,
            arrowcolor: "#f97316",
            arrowwidth: 3,
            text: "MET (invisível)",
            font: { color: "#f97316", size: 11, weight: "bold" },
            bgcolor: "rgba(0,0,0,0.6)",
            borderpad: 3,
        },
    ];
}

function drawPiePlot() {
    Plotly.newPlot("pizzaPlotMini", [{
        values: state.counts,
        labels: pNames,
        type: "pie",
        hole: 0.65,
        sort: false,
        marker: { colors: pColors, line: { color: "rgba(0,0,0,0.5)", width: 2 } },
        textinfo: "percent",
        textposition: "inside",
        hoverinfo: "none",
    }], {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "#94a3b8" },
        margin: { t: 5, b: 5, l: 5, r: 5 },
        showlegend: false,
    }, { displayModeBar: false, responsive: true }).then((gd) => {
        gd.on("plotly_click", (data) => toggleParticleFilter(data.points[0].pointNumber));
    });
}

function drawHistograms() {
    const ptVals = [];
    const etaVals = [];
    filteredObjects().forEach((o) => {
        if (o.typeId === PARTICLE.MET) return;
        const pt = recoValue(o);
        if (Number.isFinite(pt)) ptVals.push(pt);
        const eta = Number(o.reco?.eta);
        if (Number.isFinite(eta)) etaVals.push(eta);
    });

    Plotly.newPlot("ptDistPlot", [{ x: ptVals, type: "histogram", marker: { color: "rgba(56, 189, 248, 0.8)", line: { color: "rgba(0,0,0,0.5)", width: 1 } }, hoverinfo: "none" }], {
        paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#94a3b8" }, margin: { t: 10, b: 40, l: 40, r: 10 },
        xaxis: { title: "Momento Transversal pT (GeV)", gridcolor: "rgba(255,255,255,0.05)" }, yaxis: { title: "Contagem", gridcolor: "rgba(255,255,255,0.05)" },
    }, { displayModeBar: false, responsive: true });

    Plotly.newPlot("etaDistPlot", [{ x: etaVals, type: "histogram", marker: { color: "rgba(250, 204, 21, 0.8)", line: { color: "rgba(0,0,0,0.5)", width: 1 } }, hoverinfo: "none" }], {
        paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#94a3b8" }, margin: { t: 10, b: 40, l: 40, r: 10 },
        xaxis: { title: "Pseudorapidez (eta)", gridcolor: "rgba(255,255,255,0.05)" }, yaxis: { title: "Contagem", gridcolor: "rgba(255,255,255,0.05)" },
    }, { displayModeBar: false, responsive: true });
}

function heatmapDataForLayer() {
    const x = [];
    const y = [];
    filteredObjects().forEach((o) => {
        const eta = Number(o.reco?.eta);
        const phi = Number(o.reco?.phi);
        if (!Number.isFinite(eta) || !Number.isFinite(phi)) return;
        const inEcal = o.typeId === PARTICLE.ELECTRON || o.typeId === PARTICLE.PHOTON;
        const inHcal = o.typeId === PARTICLE.HADRON;
        if (state.currentHeatmapLayer === "ECAL" && !inEcal) return;
        if (state.currentHeatmapLayer === "HCAL" && !inHcal) return;
        x.push(eta);
        y.push(phi);
    });
    return x.length ? { x, y } : { x: [-10], y: [-10] };
}

function drawHeatmap() {
    const h = heatmapDataForLayer();
    Plotly.newPlot("heatmapPlot", [{
        x: h.x, y: h.y, type: "histogram2dcontour", hoverinfo: "none",
        colorscale: [[0.0, "rgba(0,0,0,0)"], [0.2, "#1e3a8a"], [0.4, "#38bdf8"], [0.7, "#facc15"], [1.0, "#ef4444"]],
        showscale: true, colorbar: { title: "Energia<br>(rel)", tickfont: { color: "#94a3b8" }, titlefont: { color: "#38bdf8", size: 10 } },
    }], {
        paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#94a3b8" },
        margin: { t: 20, l: 60, r: 10, b: 60 },
        xaxis: { title: "Pseudorapidez (eta)", gridcolor: "rgba(255,255,255,0.05)", range: [-3, 3] },
        yaxis: { title: "Angulo Azimutal (phi)", gridcolor: "rgba(255,255,255,0.05)", range: [-3.14, 3.14] },
    }, { displayModeBar: false, responsive: true });
}

function updateHeatmapDisplay() {
    const plot = byId("heatmapPlot");
    if (!plot || !plot.data) return;
    const h = heatmapDataForLayer();
    Plotly.restyle("heatmapPlot", { x: [h.x], y: [h.y] });
}

function updatePlotVisibility() {
    const radar = byId("radarPlot");
    if (radar && radar.data) {
        const visible = radar.data.map((t) => {
            if (t.meta && t.meta.pType !== undefined) return state.activeFilters.includes(t.meta.pType);
            return true;
        });
        Plotly.restyle("radarPlot", { visible });
        Plotly.relayout("radarPlot", { annotations: metAnnotation() });
    }
    const pie = byId("pizzaPlotMini");
    if (pie && pie.data) {
        const colors = [0, 1, 2, 3, 4, 5].map((i) => (state.activeFilters.includes(i) ? pColors[i] : pColorsDim[i]));
        Plotly.restyle("pizzaPlotMini", { "marker.colors": [colors] });
    }
    drawHistograms();
}

function renderPlotly() {
    drawRadarPlot();
    drawPiePlot();
    drawHistograms();
    drawHeatmap();
    applyFiltersToEntireUI();
}

function desenharPlotly() {
    renderPlotly();
}

function build3DScene() {
    const t = state.three;
    const container = byId("main3d");
    if (t.animationId) cancelAnimationFrame(t.animationId);
    if (t.renderer) t.renderer.dispose();
    container.innerHTML = "";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(20, 15, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.autoRotate = t.playRotation;
    controls.autoRotateSpeed = 0.5;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    scene.add(new THREE.PointLight(0xffffff, 2, 30));

    const grid = new THREE.GridHelper(140, 90, 0x1e293b, 0x0f172a);
    scene.add(grid);

    const detector = new THREE.Group();
    scene.add(detector);

    function criarCamadaDetector(rI, rE, depth, cor, op = 1.0) {
        const s = new THREE.Shape();
        const solidStart = 4 * Math.PI / 3;
        const solidEnd = Math.PI / 2 + 2 * Math.PI;
        s.absarc(0, 0, rE, solidStart, solidEnd, false);
        s.lineTo(rI * Math.cos(solidEnd), rI * Math.sin(solidEnd));
        s.absarc(0, 0, rI, solidEnd, solidStart, true);
        const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: cor, transparent: true, opacity: op, side: THREE.DoubleSide, specular: 0x222222, shininess: 15 }));
    }

    const geom = state.meta?.geometry_cm || {};
    const muonRcm = Number(geom.muon_radius) || 730;
    const scale = 12.7 / muonRcm;

    const beampipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 120, 32), new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true, transparent: true, opacity: 0.3 }));
    beampipe.rotation.x = Math.PI / 2;
    detector.add(beampipe);

    const trackerGroup = new THREE.Group();
    const radiiTracker = [[0.8, 1.18], [1.22, 1.68], [1.72, 2.25]];
    for (let r = 0; r < radiiTracker.length; r += 1) {
        const layer = criarCamadaDetector(radiiTracker[r][0], radiiTracker[r][1], 50, 0x1b6070, 1.0);
        trackerGroup.add(layer);
        const matModule = new THREE.MeshBasicMaterial({ color: radiiTracker[r][0] < 1.5 ? 0x267a42 : 0x9e8011 });
        const modGeo = radiiTracker[r][0] < 1.5 ? new THREE.BoxGeometry(0.2, 0.05, 0.4) : new THREE.BoxGeometry(0.4, 0.05, 0.6);
        for (let a = 240 * (Math.PI / 180); a <= (90 + 360) * (Math.PI / 180); a += radiiTracker[r][0] < 1.5 ? 0.04 : 0.025) {
            const m = new THREE.Mesh(modGeo, matModule);
            const aR = a + (Math.random() - 0.5) * 0.01;
            const zPos = (Math.random() - 0.5) * 48;
            m.position.set(radiiTracker[r][0] * Math.cos(aR), radiiTracker[r][0] * Math.sin(aR), zPos);
            m.lookAt(0, 0, zPos);
            trackerGroup.add(m);
        }
    }
    detector.add(trackerGroup);

    const ecalLayer = criarCamadaDetector(2.35, 3.65, 30, 0x166b35, 1.0);
    detector.add(ecalLayer);
    const ecalCells = new THREE.Group();
    ecalCells.position.z = -14;
    detector.add(ecalCells);
    const cellGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const cellMat = new THREE.MeshPhongMaterial({ color: 0x166b35, transparent: false, opacity: 1, shininess: 80, specular: 0x333333 });
    for (let a = 240 * (Math.PI / 180); a <= (90 + 360) * (Math.PI / 180); a += 0.04) {
        const r = 3.2;
        for (let z = -13.5; z < 13.5; z += 0.3) {
            const m = new THREE.Mesh(cellGeo, cellMat);
            m.position.set(r * Math.cos(a), r * Math.sin(a), z);
            m.lookAt(0, 0, z);
            ecalCells.add(m);
        }
    }

    const hcalLayer = criarCamadaDetector(3.85, 6.0, 40, 0x994a10, 1.0);
    detector.add(hcalLayer);
    const hcalSegments = new THREE.Group();
    hcalSegments.position.z = -19;
    detector.add(hcalSegments);
    const segGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const segMat = new THREE.MeshPhongMaterial({ color: 0x994a10, transparent: false, opacity: 1, shininess: 40 });
    for (let a = 240 * (Math.PI / 180); a <= (90 + 360) * (Math.PI / 180); a += 0.15) {
        const r = 5.0;
        for (let z = -18; z < 18; z += 1.0) {
            const m = new THREE.Mesh(segGeo, segMat);
            m.position.set(r * Math.cos(a), r * Math.sin(a), z);
            m.lookAt(0, 0, z);
            hcalSegments.add(m);
        }
    }

    const magnetLayer = criarCamadaDetector(6.2, 7.3, 50, 0x151d2a, 1.0);
    detector.add(magnetLayer);
    const ironR = [[7.5, 8.5], [8.9, 9.9], [10.3, 11.3], [11.7, 12.7]];
    for (let r = 0; r < ironR.length; r += 1) detector.add(criarCamadaDetector(ironR[r][0], ironR[r][1], 60, 0x0b111f, 0.95));

    const matMuon1 = new THREE.MeshPhongMaterial({ color: 0x873e3e, transparent: false, opacity: 1 });
    const matMuon2 = new THREE.MeshPhongMaterial({ color: 0x7a2e2e, transparent: false, opacity: 1 });
    const muonLayerR = [[8.6, 8.8], [10.0, 10.2], [11.4, 11.6]];
    for (let r = 0; r < muonLayerR.length; r += 1) {
        const mIn = muonLayerR[r][0];
        const mOut = muonLayerR[r][1];
        detector.add(criarCamadaDetector(mIn, mOut, 60, r % 2 ? 0x873e3e : 0x7a2e2e, 1.0));
        for (let a = 240 * (Math.PI / 180); a <= (90 + 360) * (Math.PI / 180); a += 0.15) {
            const rAvg = (mIn + mOut) / 2;
            for (let z = -28; z < 28; z += 2.0) {
                const mGeo = new THREE.BoxGeometry(0.4, 0.4, 1.5);
                const m = new THREE.Mesh(mGeo, r % 2 ? matMuon1 : matMuon2);
                m.position.set(rAvg * Math.cos(a), rAvg * Math.sin(a), z);
                m.lookAt(0, 0, z);
                detector.add(m);
            }
        }
    }

    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 6, 8);
    beamGeo.rotateX(Math.PI / 2);
    const beam1 = new THREE.Mesh(beamGeo, beamMat);
    const beam2 = new THREE.Mesh(beamGeo, beamMat);
    scene.add(beam1, beam2);

    const particles = [];
    const lineMaterialFor = (typeId) => {
        const color = Number(`0x${pColors[typeId].replace("#", "")}`);
        if (typeId === PARTICLE.MET) return new THREE.LineDashedMaterial({ color, dashSize: 0.5, gapSize: 0.3 });
        return new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1.0 });
    };

    state.objects.forEach((o) => {
        const pts = o.trajectory.map((p) => new THREE.Vector3(p[0] * scale, p[1] * scale, p[2] * scale));
        if (pts.length < 2) return;
        const arr = new Float32Array(Math.min(pts.length, 400) * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
        g.setDrawRange(0, 0);
        const line = new THREE.Line(g, lineMaterialFor(o.typeId));
        if (o.typeId === PARTICLE.MET) line.computeLineDistances();
        scene.add(line);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 14), new THREE.MeshBasicMaterial({ color: Number(`0x${pColors[o.typeId].replace("#", "")}`), transparent: true, opacity: 0.8 }));
        head.visible = false;
        scene.add(head);
        particles.push({ object: o, pts: pts.slice(0, 400), idx: 0, line, head, completed: false });
    });

    let phase = "BEAMS";
    let beamZ = 40;
    let wait = 0;

    function restartTracks() {
        particles.forEach((p) => {
            p.idx = 0;
            p.completed = false;
            p.head.visible = false;
            p.line.geometry.attributes.position.array.fill(0);
            p.line.geometry.setDrawRange(0, 0);
            p.line.geometry.attributes.position.needsUpdate = true;
            p.line.visible = state.activeFilters.includes(p.object.typeId);
        });
    }

    function animate() {
        t.animationId = requestAnimationFrame(animate);
        if (t.playPhysics) {
            if (phase === "BEAMS") {
                beamZ -= 0.8;
                beam1.position.set(0, 0, beamZ);
                beam2.position.set(0, 0, -beamZ);
                beam1.visible = true;
                beam2.visible = true;
                if (beamZ <= 0) {
                    phase = "TRACKS";
                    beam1.visible = false;
                    beam2.visible = false;
                    restartTracks();
                }
            } else if (phase === "TRACKS") {
                let moving = false;
                particles.forEach((p) => {
                    const visible = state.activeFilters.includes(p.object.typeId);
                    p.line.visible = visible;
                    if (!visible || p.completed) return;
                    const step = p.object.typeId === PARTICLE.MUON ? 2 : 3;
                    p.idx = Math.min(p.idx + step, p.pts.length - 1);
                    const arr = p.line.geometry.attributes.position.array;
                    for (let i = 0; i <= p.idx; i += 1) {
                        arr[i * 3] = p.pts[i].x;
                        arr[i * 3 + 1] = p.pts[i].y;
                        arr[i * 3 + 2] = p.pts[i].z;
                    }
                    p.line.geometry.setDrawRange(0, p.idx + 1);
                    p.line.geometry.attributes.position.needsUpdate = true;
                    p.head.position.copy(p.pts[p.idx]);
                    p.head.visible = visible;
                    moving = true;
                    if (p.idx >= p.pts.length - 1) p.completed = true;
                });
                if (!moving) {
                    phase = "WAIT";
                    wait = 0;
                }
            } else if (phase === "WAIT") {
                wait += 1;
                if (wait > 120) {
                    phase = "BEAMS";
                    beamZ = 40;
                    beampipe.material.opacity = 0.3;
                }
            }
        }
        controls.autoRotate = t.playRotation;
        controls.update();
        renderer.render(scene, camera);
    }

    t.scene = scene;
    t.camera = camera;
    t.renderer = renderer;
    t.controls = controls;
    t.grid = grid;
    t.trackerGroup = trackerGroup;
    t.particles = particles;
    update3DVisibility();
    animate();
}

function desenharThreeJS() {
    build3DScene();
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

function toggleFullScreen() {
    const panel = byId("panel-3d");
    if (!document.fullscreenElement) panel.requestFullscreen().catch(() => null);
    else document.exitFullscreen();
}

function changeHeatmapLayer(layer) {
    state.currentHeatmapLayer = layer;
    ["all", "ecal", "hcal"].forEach((k) => byId(`btn-hm-${k}`).classList.remove("active"));
    byId(`btn-hm-${layer.toLowerCase()}`).classList.add("active");
    updateHeatmapDisplay();
}

function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        const tab = btn.dataset.tab;
        if (!tab) return;
        btn.addEventListener("click", () => showTab(tab, btn));
    });
}

function bindUIActions() {
    setupTabs();
    document.addEventListener("fullscreenchange", () => {
        byId("btn-fs-toggle").textContent = document.fullscreenElement ? "Sair" : "Tela Cheia";
        byId("fs-hud").style.display = document.fullscreenElement ? "flex" : "none";
    });

    byId("fileInput")?.addEventListener("change", async () => {
        try {
            clearError();
            await uploadArquivo();
            setStatus("UPLOAD OK", "#4ade80");
        } catch (e) {
            showError(e.message || "Erro no upload");
            setStatus("UPLOAD ERRO", "#ef4444");
        }
    });

    byId("rootFileSelect")?.addEventListener("change", async () => {
        try {
            clearError();
            await aplicarRootSelecionado();
        } catch (e) {
            showError(e.message || "Erro ao selecionar ROOT");
            setStatus("ERRO ROOT", "#ef4444");
        }
    });
    byId("eventoInput")?.addEventListener("change", syncEventInputBounds);
    byId("numInput")?.addEventListener("change", syncEventInputBounds);

    window.addEventListener("resize", () => {
        const t = state.three;
        if (t.renderer && t.camera) {
            const c = byId("main3d");
            t.renderer.setSize(c.clientWidth, c.clientHeight);
            t.camera.aspect = c.clientWidth / c.clientHeight;
            t.camera.updateProjectionMatrix();
        }
        ["radarPlot", "pizzaPlotMini", "ptDistPlot", "etaDistPlot", "heatmapPlot"].forEach((id) => {
            const el = byId(id);
            if (el && el.data) Plotly.Plots.resize(el);
        });
    });
}

async function uploadArquivo() {
    const input = byId("fileInput");
    const file = input.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    setStatus("ENVIANDO ROOT...");
    const res = await fetch(`${SERVER_URL}/upload/`, { method: "POST", body });
    if (!res.ok) await parseApiError(res, "Falha no upload");
    const data = await res.json();
    setFileNameLabel(data.filename || file.name);
    input.value = "";
    await carregarArquivosRoot();
    await carregarRootAtivo();
}

async function carregarArquivosRoot() {
    const select = byId("rootFileSelect");
    const res = await fetch(`${SERVER_URL}/upload/files`);
    if (!res.ok) await parseApiError(res, "Falha ao listar arquivos ROOT");
    const data = await res.json();
    const files = Array.isArray(data.files) ? data.files : [];
    const active = data.active_filename || "";
    select.innerHTML = "";
    if (!files.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "-- sem arquivos --";
        select.appendChild(opt);
        return;
    }
    files.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.filename;
        opt.textContent = f.filename;
        if (f.filename === active) opt.selected = true;
        select.appendChild(opt);
    });
}

async function carregarRootAtivo() {
    const res = await fetch(`${SERVER_URL}/upload/active`);
    if (!res.ok) await parseApiError(res, "Falha ao obter ROOT ativo");
    const data = await res.json();
    if (data?.active_filename) setFileNameLabel(data.active_filename);
}

async function aplicarRootSelecionado() {
    const filename = byId("rootFileSelect").value;
    if (!filename) return;
    setStatus("ALTERANDO ROOT...");
    const res = await fetch(`${SERVER_URL}/upload/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
    });
    if (!res.ok) await parseApiError(res, "Falha ao selecionar ROOT");
    const data = await res.json();
    setFileNameLabel(data.active_filename || filename);
    await carregarDoBackend();
}

async function simularEvento() {
    clearError();
    syncEventInputBounds();
    const start = Number(byId("eventoInput").value || 1);
    const num = Math.max(1, Number(byId("numInput").value || 1));
    byId("eventLabel").textContent = `#${start}`;
    byId("eventRangeLabel").textContent = `N EVENTOS: ${num}`;
    setStatus("SIMULANDO...");
    showLoading(`Simulando ${num} evento(s)...`);
    try {
        const res = await fetch(`${SERVER_URL}/simulate/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start_event: start, num_events: num }),
        });
        if (!res.ok) await parseApiError(res, "Falha ao simular evento");
        const fig = JSON.parse(await res.text());
        updateBackendMeta(fig?.layout?.meta || {});
        const objects = parseObjects(fig);
        updateStateObjects(objects);
        renderPlotly();
        build3DScene();
        setStatus("SISTEMA ONLINE", "#4ade80");
    } finally {
        hideLoading();
    }
}

async function carregarDoBackend() {
    try {
        await simularEvento();
    } catch (e) {
        console.error(e);
        showError(e.message || "Erro inesperado no backend.");
        setStatus("ERRO BACKEND", "#ef4444");
    }
}

window.onload = () => {
    bindUIActions();
    setTimeout(async () => {
        try {
            await carregarArquivosRoot();
            await carregarRootAtivo();
        } catch (e) {
            console.error(e);
            showError(e.message || "Falha ao inicializar arquivos ROOT.");
        }
        await carregarDoBackend();
    }, 450);
};
