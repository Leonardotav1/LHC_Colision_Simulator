import Plotly from "plotly.js-dist-min";

export function createPlotlyRuntime({
  state,
  byId,
  pNames,
  pColors,
  pColorsDim,
  PARTICLE,
  filteredObjects,
  toggleParticleFilter,
  applyFiltersToEntireUI,
}) {
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
    const burnTraces = [];

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

    function firstCrossingPoint(xyMeters, rMin, rMax = Infinity) {
      for (let i = 0; i < xyMeters.length; i += 1) {
        const [x, y] = xyMeters[i];
        const r = Math.hypot(x, y);
        if (r >= rMin && r <= rMax) return { x, y };
      }
      return null;
    }

    function makeBurnSpot(cx, cy, baseRadius, color, alpha, pType) {
      const x = [];
      const y = [];
      const turns = 36;
      for (let i = 0; i <= turns; i += 1) {
        const t = (i / turns) * Math.PI * 2;
        const jitter = 0.78 + (Math.sin(t * 3.7 + cx * 1.3 + cy * 0.9) + 1.0) * 0.16;
        const r = baseRadius * jitter;
        x.push(cx + Math.cos(t) * r);
        y.push(cy + Math.sin(t) * r);
      }
      return {
        x,
        y,
        type: "scatter",
        mode: "lines",
        fill: "toself",
        fillcolor: `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},${alpha})`,
        line: { color: "rgba(255,255,255,0.12)", width: 1 },
        hoverinfo: "none",
        showlegend: false,
        meta: { pType },
      };
    }

    const maxTracks = Math.min(state.objects.length, 320);
    for (let i = 0; i < maxTracks; i += 1) {
      const o = state.objects[i];
      const xyMeters = [];
      const xs = [];
      const ys = [];
      const step = Math.max(1, Math.floor(o.trajectory.length / 80));
      for (let k = 0; k < o.trajectory.length; k += step) {
        const x = o.trajectory[k][0] / 100.0;
        const y = o.trajectory[k][1] / 100.0;
        xs.push(x);
        ys.push(y);
        xyMeters.push([x, y]);
      }
      if (!xs.length) continue;

      if (o.typeId === PARTICLE.ELECTRON || o.typeId === PARTICLE.PHOTON) {
        const impact = firstCrossingPoint(xyMeters, 1.45, 1.95) || { x: xs[xs.length - 1], y: ys[ys.length - 1] };
        burnTraces.push(makeBurnSpot(impact.x, impact.y, 0.15, pColors[o.typeId], 0.55, o.typeId));
        burnTraces.push(makeBurnSpot(impact.x, impact.y, 0.24, pColors[o.typeId], 0.22, o.typeId));
      } else if (o.typeId === PARTICLE.HADRON) {
        const impact = firstCrossingPoint(xyMeters, 2.0, 3.25) || { x: xs[xs.length - 1], y: ys[ys.length - 1] };
        burnTraces.push(makeBurnSpot(impact.x, impact.y, 0.23, pColors[o.typeId], 0.48, o.typeId));
        burnTraces.push(makeBurnSpot(impact.x, impact.y, 0.34, pColors[o.typeId], 0.22, o.typeId));
      } else if (o.typeId === PARTICLE.MUON) {
        [4.4, 5.3, 6.2].forEach((radius) => {
          const hit = firstCrossingPoint(xyMeters, radius, radius + 0.22);
          if (hit) burnTraces.push(makeBurnSpot(hit.x, hit.y, 0.11, pColors[o.typeId], 0.32, o.typeId));
        });
      } else if (o.typeId === PARTICLE.TAU) {
        const decay = firstCrossingPoint(xyMeters, 0.45, 1.1) || { x: xs[Math.min(xs.length - 1, 6)], y: ys[Math.min(ys.length - 1, 6)] };
        burnTraces.push(makeBurnSpot(decay.x, decay.y, 0.13, pColors[o.typeId], 0.45, o.typeId));
      }

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

    traces.unshift(...burnTraces);
    const trajectoryLegend = [
      { name: "Muon", typeId: PARTICLE.MUON, dash: "solid" },
      { name: "Eletron", typeId: PARTICLE.ELECTRON, dash: "solid" },
      { name: "Foton", typeId: PARTICLE.PHOTON, dash: "dash" },
      { name: "Hadron", typeId: PARTICLE.HADRON, dash: "solid" },
      { name: "Tau", typeId: PARTICLE.TAU, dash: "solid" },
      { name: "MET", typeId: PARTICLE.MET, dash: "dash" },
    ];
    trajectoryLegend.forEach((item) => {
      traces.push({
        x: [null],
        y: [null],
        type: "scatter",
        mode: "lines",
        name: item.name,
        line: { color: pColors[item.typeId], width: item.typeId === PARTICLE.MET ? 2.5 : 2, dash: item.dash },
        hoverinfo: "skip",
        showlegend: true,
      });
    });

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
      legend: { orientation: "v", x: 0.01, y: 0.99, xanchor: "left", yanchor: "top", bgcolor: "rgba(2,6,23,0.55)", bordercolor: "rgba(148,163,184,0.3)", borderwidth: 1, font: { color: "#cbd5e1", size: 10 } },
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
    return [{
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
      text: "MET (invisivel)",
      font: { color: "#f97316", size: 11, weight: "bold" },
      bgcolor: "rgba(0,0,0,0.6)",
      borderpad: 3,
    }];
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
      hovertemplate: "%{label}<br>Contagem: %{value}<br>%{percent}<extra></extra>",
    }], {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cbd5e1", size: 12 },
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
      const pt = Number(o.typeId === PARTICLE.MET ? o.reco?.met_gev?.nominal : o.reco?.pt_gev?.nominal ?? o.reco?.pt_gev);
      if (Number.isFinite(pt)) ptVals.push(pt);
      const eta = Number(o.reco?.eta);
      if (Number.isFinite(eta)) etaVals.push(eta);
    });

    Plotly.newPlot("ptDistPlot", [{
      x: ptVals,
      type: "histogram",
      nbinsx: 24,
      marker: { color: "rgba(56, 189, 248, 0.85)", line: { color: "rgba(0,0,0,0.5)", width: 1 } },
      hovertemplate: "pT: %{x:.2f} GeV<br>Contagem: %{y}<extra></extra>",
    }], {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cbd5e1", size: 12 },
      margin: { t: 10, b: 40, l: 40, r: 10 },
      bargap: 0.06,
      xaxis: { title: "Momento Transversal pT (GeV)", gridcolor: "rgba(255,255,255,0.05)" },
      yaxis: { title: "Contagem", gridcolor: "rgba(255,255,255,0.05)" },
    }, { displayModeBar: false, responsive: true });

    Plotly.newPlot("etaDistPlot", [{
      x: etaVals,
      type: "histogram",
      nbinsx: 24,
      marker: { color: "rgba(250, 204, 21, 0.85)", line: { color: "rgba(0,0,0,0.5)", width: 1 } },
      hovertemplate: "eta: %{x:.2f}<br>Contagem: %{y}<extra></extra>",
    }], {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cbd5e1", size: 12 },
      margin: { t: 10, b: 40, l: 40, r: 10 },
      bargap: 0.06,
      xaxis: { title: "Pseudorapidez (eta)", gridcolor: "rgba(255,255,255,0.05)" },
      yaxis: { title: "Contagem", gridcolor: "rgba(255,255,255,0.05)" },
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
      x: h.x,
      y: h.y,
      type: "histogram2dcontour",
      ncontours: 16,
      contours: { coloring: "heatmap", showlines: false },
      line: { smoothing: 0.8, width: 0 },
      colorscale: [[0.0, "rgba(0,0,0,0)"], [0.2, "#1e3a8a"], [0.4, "#38bdf8"], [0.7, "#facc15"], [1.0, "#ef4444"]],
      showscale: true,
      hovertemplate: "eta: %{x:.2f}<br>phi: %{y:.2f}<br>Densidade: %{z}<extra></extra>",
      colorbar: { title: "Energia (GeV)", tickfont: { color: "#94a3b8" }, titlefont: { color: "#38bdf8", size: 10 } },
    }], {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cbd5e1", size: 12 },
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
    if (typeof applyFiltersToEntireUI === "function") applyFiltersToEntireUI();
  }

  return {
    updateHeatmapDisplay,
    updatePlotVisibility,
    renderPlotly,
  };
}
