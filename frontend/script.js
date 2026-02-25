const SERVER_URL = "http://127.0.0.1:5000";
let controls = null;
let renderer = null;
let animationId = null;
let isRotating = true;
let isSiliconVisible = true;
let siliconGroupRef = null;

function showError(message) {
    const banner = document.getElementById("errorBanner");
    if (!banner) return;
    banner.textContent = message;
    banner.classList.add("show");
}

function clearError() {
    const banner = document.getElementById("errorBanner");
    if (!banner) return;
    banner.textContent = "";
    banner.classList.remove("show");
}

async function parseApiError(res, fallbackMessage) {
    let payload = null;
    try {
        payload = await res.json();
    } catch (_) {
        payload = null;
    }
    const message = payload?.error || `${fallbackMessage} (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.code = payload?.error_code || null;
    throw err;
}

function setStatus(text, color = "#facc15") {
    const el = document.getElementById("statusLabel");
    el.textContent = text;
    el.style.color = color;
}

function updateSiliconButton() {
    const btn = document.getElementById("siliconBtn");
    if (!btn) return;
    btn.textContent = isSiliconVisible ? "Placas Si: ON" : "Placas Si: OFF";
    btn.style.color = isSiliconVisible ? "#38bdf8" : "#facc15";
    btn.style.borderColor = isSiliconVisible ? "#38bdf8" : "#facc15";
}

function toggleSiliconPlates() {
    isSiliconVisible = !isSiliconVisible;
    if (siliconGroupRef) siliconGroupRef.visible = isSiliconVisible;
    updateSiliconButton();
}

function setFileNameLabel(filename) {
    const el = document.getElementById("fileNameLabel");
    if (!el) return;
    const text = filename || "aguardando ROOT...";
    el.textContent = text;
    el.title = text;
}

function toggleRotation() {
    isRotating = !isRotating;
    if (controls) controls.autoRotate = isRotating;

    const btn = document.getElementById("rotBtn");
    if (btn) btn.textContent = isRotating ? "Pausar Rotacao" : "Retomar Rotacao";
}

// Função para extrair informações relevantes dos dados recebidos do backend, filtrando e mapeando os objetos de interesse (partículas) para um formato mais utilizável na aplicação.
function parseObjects(fig) {
    return (fig?.data || [])
    // Filtra os objetos que possuem a propriedade "meta" e cuja "meta.trajectory" é um array, garantindo que apenas os objetos relevantes para a visualização das trajetórias sejam processados.
        .filter((t) => t?.meta && Array.isArray(t.meta.trajectory))
        // Mapeia os objetos filtrados para um formato mais simples, extraindo as propriedades "type", "color", "trajectory" e "reco" (se disponível) de cada objeto, e retornando um novo array de objetos com essas informações.
        .map((t) => ({
            type: t.meta.type,
            color: t.meta.color,
            trajectory: t.meta.trajectory,
            reco: t.meta.reco || {}
        }));
}

// Função para obter o valor de MET ou pt_gev de um objeto, dependendo do tipo do objeto. Se o tipo for "met", retorna o valor de "met_gev"; caso contrário, retorna o valor de "pt_gev". A função também lida com casos em que os valores podem ser objetos com uma propriedade "nominal" ou podem ser números diretamente.
function recoValue(obj) {
    if (obj.type === "met") {
        const m = obj.reco?.met_gev;
        return typeof m === "number" ? m : (m?.nominal ?? null);
    }
    const p = obj.reco?.pt_gev;
    return typeof p === "number" ? p : (p?.nominal ?? null);
}

// Função para atualizar as estatísticas de contagem de partículas e o valor total de MET, e para atualizar os elementos HTML correspondentes com essas informações.
function updateStats(objects) {
    // Inicializa um objeto de contagem para cada tipo de partícula (muon, electron, photon, tau, jet, met) com valor inicial 0.
    const c = {
        muon: 0,
        electron: 0,
        photon: 0,
        tau: 0,
        jet: 0,
        met: 0
    };

    // Variável para acumular o valor total de MET, que será calculado somando os valores de MET de cada objeto do tipo "met" encontrado na lista de objetos. O valor é inicializado como 0 e será atualizado durante a iteração sobre os objetos.
    let metVal = 0;
    // Itera sobre a lista de objetos, verificando o tipo de cada um e incrementando a contagem correspondente no objeto de contagem.
    for (const o of objects) {
        if (c[o.type] !== undefined) c[o.type] += 1;
        if (o.type === "met") metVal += (recoValue(o) || 0);
    }

    // Atualiza o conteúdo de elementos HTML específicos para exibir as contagens de cada tipo de partícula e o valor total de MET. Os elementos são identificados por seus IDs, e o texto é atualizado com os valores correspondentes.
    document.getElementById("cMuon").textContent = c.muon;
    document.getElementById("cEle").textContent = c.electron;
    document.getElementById("cPho").textContent = c.photon;
    document.getElementById("cTau").textContent = c.tau;
    document.getElementById("cJet").textContent = c.jet;
    document.getElementById("cMet").textContent = c.met;
    document.getElementById("kpiActives").textContent = c.muon + c.electron + c.photon + c.tau + c.jet;
    document.getElementById("kpiMet").textContent = `${metVal.toFixed(2)} GeV`;
    return c;
}

// Função para desenhar os gráficos de radar, pizza e heatmap usando a biblioteca Plotly, com base nos objetos e contagens fornecidos. 
// A função configura o layout dos gráficos, cria as traces para cada tipo de gráfico e os renderiza nos elementos HTML correspondentes.
function drawPlots(objects, counts) {

    const layout = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: {
            color: "#0065f3",
            size: 10
        },
        margin: {
            t: 10,
            b: 30,
            l: 30,
            r: 10
        }
    };

    const styleByType = {
        muon: { color: "#01ae18", name: "Muons" },
        electron: { color: "#0800ff", name: "Eletrons" },
        photon: { color: "#ffff00", name: "Fotons" },
        tau: { color: "#8d0081", name: "Tau" },
        jet: { color: "#ff0000", name: "Jatos" },
        met: { color: "#00fbff", name: "MET" }
    };

    const maxRxy = Math.max(0, ...objects.flatMap((o) => (o.trajectory || []).map((p) => Math.hypot(p[0], p[1]))));
    const radarExtent = Math.min(15, Math.max(6, maxRxy * 1.25 || 6));
    const legendSeen = new Set();
    const polarTraces = [];

    for (const o of objects.slice(0, 120)) {
        const traj = o.trajectory || [];
        if (traj.length < 2) continue;
        const x = traj.map((p) => p[0]);
        const y = traj.map((p) => p[1]);
        const particleStyle = styleByType[o.type] || { color: o.color || "#ffffff", name: o.type || "Particula" };
        const isMet = o.type === "met";
        const key = o.type || "other";

        polarTraces.push({
            x,
            y,
            mode: "lines",
            type: "scatter",
            name: particleStyle.name,
            legendgroup: key,
            showlegend: !legendSeen.has(key),
            line: {
                color: particleStyle.color,
                width: isMet ? 2.4 : 1.4,
                dash: isMet ? "dashdot" : "solid"
            },
            opacity: o.type === "jet" ? 0.72 : 0.92,
            hovertemplate: particleStyle.name + "<br>x: %{x:.2f} cm<br>y: %{y:.2f} cm<extra></extra>"
        });
        legendSeen.add(key);
    }

    polarTraces.push({
        x: [0],
        y: [0],
        mode: "markers",
        type: "scatter",
        marker: {
            color: "#ffffff",
            size: 5,
            symbol: "cross"
        },
        showlegend: false,
        hoverinfo: "skip"
    });

    Plotly.newPlot("radarPlot", polarTraces, {
        ...layout,
        dragmode: "pan",
        margin: { t: 10, l: 10, r: 10, b: 62 },
        showlegend: true,
        legend: {
            orientation: "h",
            x: 0.5,
            xanchor: "center",
            y: -0.12,
            yanchor: "top",
            font: { color: "#94a3b8", size: 10 },
            bgcolor: "rgba(0,0,0,0)"
        },
        xaxis: {
            visible: false,
            range: [-radarExtent, radarExtent],
            scaleanchor: "y",
            scaleratio: 1
        },
        yaxis: {
            visible: false,
            range: [-radarExtent, radarExtent]
        },
        shapes: [
            { type: "line", x0: -radarExtent, y0: 0, x1: radarExtent, y1: 0, line: { color: "rgba(148,163,184,0.20)", width: 1 } },
            { type: "line", x0: 0, y0: -radarExtent, x1: 0, y1: radarExtent, line: { color: "rgba(148,163,184,0.20)", width: 1 } },
            { type: "circle", x0: -radarExtent * 0.22, y0: -radarExtent * 0.22, x1: radarExtent * 0.22, y1: radarExtent * 0.22, line: { color: "#334155", width: 1, dash: "dot" } },
            { type: "circle", x0: -radarExtent * 0.56, y0: -radarExtent * 0.56, x1: radarExtent * 0.56, y1: radarExtent * 0.56, line: { color: "rgba(56,189,248,0.55)", width: 1 } },
            { type: "circle", x0: -radarExtent * 0.90, y0: -radarExtent * 0.90, x1: radarExtent * 0.90, y1: radarExtent * 0.90, line: { color: "#0f172a", width: 3 } }
        ]
    }, {
        displayModeBar: true,
        responsive: true,
        scrollZoom: true,
        modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "hoverClosestCartesian", "hoverCompareCartesian"],
        displaylogo: false
    });

    Plotly.newPlot("pizzaPlotMini", [{
        values: [
            counts.muon,
            counts.electron,
            counts.photon,
            counts.tau,
            counts.jet,
            counts.met
        ],
        labels: [
            "Muon",
            "Eletron",
            "Foton",
            "Tau",
            "Jet",
            "MET"
        ],
        type: "pie", hole: 0.65,
        marker: {
            colors: ["#01ae18", "#0800ff", "#ffff00", "#8d0081", "#ff0000", "#00fbff"]
        },
        textinfo: "percent"
    }],
        {
            ...layout,
            margin: { t: 8, b: 8, l: 8, r: 8 },
            showlegend: false
        },
        { displayModeBar: false }
    );

    const eta = [], phi = [];
    for (const o of objects) {
        const e = o.reco?.eta;
        const p = o.reco?.phi;
        if (Number.isFinite(e) && Number.isFinite(p)) { eta.push(e); phi.push(p); }
    }

    Plotly.newPlot("heatmapPlot", [{
        x: eta,
        y: phi,
        type: "histogram2dcontour",
        ncontours: 20,
        colorscale: [
            [0.00, "#1b2a6b"],
            [0.18, "#1c4fa3"],
            [0.35, "#2f86d6"],
            [0.52, "#49c3f3"],
            [0.70, "#8fd15b"],
            [0.84, "#f2cd2e"],
            [0.93, "#f59f1e"],
            [1.00, "#ef4444"]
        ],
        contours: { showlines: false, coloring: "fill" },
        line: { width: 0.5, color: "rgba(255,255,255,0.15)" },
        zsmooth: "best",
        colorbar: {
            title: { text: "GeV", side: "left", font: { color: "#38bdf8", size: 13 } },
            orientation: "h",
            x: 0.5,
            xanchor: "center",
            y: -0.33,
            yanchor: "top",
            len: 0.82,
            thickness: 11,
            tickfont: { color: "#7dd3fc", size: 11 },
            outlinecolor: "#1e3a8a",
            outlinewidth: 1
        },
        hovertemplate: "x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.0f}<extra></extra>",
        showscale: true
    }],
        {
            ...layout,
            margin: { t: 8, l: 60, r: 16, b: 86 },
            plot_bgcolor: "rgba(6,18,46,0.65)",
            xaxis: {
                title: { text: "Pseudorapidez (eta)", standoff: 18 },
                automargin: true,
                gridcolor: "rgba(56,189,248,0.12)",
                zeroline: true,
                zerolinecolor: "rgba(255,255,255,0.20)",
                range: [-4.2, 4.2]
            },
            yaxis: {
                title: { text: "Angulo (phi)", standoff: 14 },
                automargin: true,
                gridcolor: "rgba(56,189,248,0.12)",
                zeroline: true,
                zerolinecolor: "rgba(255,255,255,0.20)",
                range: [-5.0, 5.0]
            }
        },
        {
            displayModeBar: true,
            responsive: true,
            scrollZoom: true,
            modeBarButtonsToRemove: ["select2d", "lasso2d", "hoverClosestCartesian", "hoverCompareCartesian"],
            displaylogo: false
        }
    );
}


function toHex(c) { return Number(String(c || "#ffffff").replace("#", "0x")); }

function draw3D(objects) {
    const container = document.getElementById("main3d");
    if (animationId) cancelAnimationFrame(animationId);
    if (renderer) renderer.dispose();
    container.innerHTML = "";

    // Criação da cena e configurações inicias da mesma
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1121);
    const width = container.clientWidth || 800, height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 220);
    camera.position.set(1, 20, 15);

    // Configurações do renderizador e controles de órbita
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Configurações dos controles de órbita
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.autoRotate = isRotating;
    controls.autoRotateSpeed = 0.1;
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.minDistance = 2.5;
    controls.maxDistance = 35;

    // Adicionando luzes e grid para melhor visualização
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const direcionalight = new THREE.DirectionalLight(0xffffff, 0.8); direcionalight.position.set(10, 20, 10); scene.add(direcionalight);
    scene.add(new THREE.PointLight(0xffffff, 1.2, 30));
    scene.add(new THREE.GridHelper(50, 50, 0x1e293b, 0x0f172a));

    // Definindo dimensões do tubo e características para ajuste das trajetórias
    const tubeLen = 40;
    const half = tubeLen / 2;
    const tuboRaioInterno = 3.0;
    const margemInterna = 0.15;

    // Função para criar camadas do tubo com diferentes raios, cores e opacidades
    function criarCamada(rI, rE, cor, op, wire = false) {
        const shape = new THREE.Shape();
        const sA = Math.PI * 0.75;
        const eA = Math.PI * 2.25;
        shape.absarc(0, 0, rE, sA, eA, false);
        shape.lineTo(rI * Math.cos(eA), rI * Math.sin(eA));
        shape.absarc(0, 0, rI, eA, sA, true);
        shape.lineTo(rE * Math.cos(sA), rE * Math.sin(sA));

        const geo = new THREE.ExtrudeGeometry(shape, { depth: tubeLen, bevelEnabled: false, curveSegments: 32 });
        geo.translate(0, 0, -tubeLen / 2);
        const mat = new THREE.MeshPhongMaterial({
            color: cor,
            transparent: true,
            opacity: op,
            wireframe: wire,
            side: THREE.DoubleSide,
            shininess: 50
        });
        return new THREE.Mesh(geo, mat);
    }

    // Adicionando camadas do tubo e um cilindro transparente para delimitar o espaço interno
    const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, tubeLen, 16),
        new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true, transparent: true, opacity: 0.3 })
    );
    pipe.rotation.x = Math.PI / 2;
    scene.add(pipe);
    scene.add(criarCamada(3.0, 4.0, 0x1e293b, 0.95, false));
    scene.add(criarCamada(4.5, 5.5, 0x0f172a, 1.0, false));

    // Emissores brancos nas pontas do tubo.
    const emitterGeo = new THREE.CylinderGeometry(0.5, 0.5, 3, 16);
    emitterGeo.rotateX(Math.PI / 2);
    const emitterMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 110 });
    const emitterFront = new THREE.Mesh(emitterGeo, emitterMat);
    const emitterBack = new THREE.Mesh(emitterGeo, emitterMat);
    emitterFront.position.set(0, 0, (tubeLen / 2) - 1);
    emitterBack.position.set(0, 0, (-tubeLen / 2) + 1);
    scene.add(emitterFront);
    scene.add(emitterBack);

    // Placas de silicio (duas camadas) no interior do detector.
    const siliconGroup = new THREE.Group();
    const siliconYellowMat = new THREE.MeshPhongMaterial({ color: 0xfacc15, side: THREE.DoubleSide, shininess: 100 });
    const siliconGreenMat = new THREE.MeshPhongMaterial({ color: 0x4ade80, side: THREE.DoubleSide, shininess: 55 });
    for (let i = 0; i < 150; i++) {
        let theta = Math.random() * Math.PI * 2;
        if (theta > Math.PI / 4 && theta < (3 * Math.PI) / 4) continue;
        const zPos = (Math.random() - 0.5) * Math.min(25, tubeLen - 4);

        if (i % 2 === 0) {
            const r = 0.8 + Math.random() * 0.7;
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.6), siliconYellowMat);
            plate.position.set(r * Math.cos(theta), r * Math.sin(theta), zPos);
            plate.lookAt(0, 0, zPos);
            siliconGroup.add(plate);
        } else {
            const r = 1.8 + Math.random() * 0.7;
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), siliconGreenMat);
            plate.position.set(r * Math.cos(theta), r * Math.sin(theta), zPos);
            plate.lookAt(0, 0, zPos);
            siliconGroup.add(plate);
        }
    }
    siliconGroup.visible = isSiliconVisible;
    scene.add(siliconGroup);
    siliconGroupRef = siliconGroup;

    const particleGeo = new THREE.SphereGeometry(0.22, 20, 20);
    const particleMatA = new THREE.MeshPhongMaterial({ color: 0x38bdf8, emissive: 0x0a5f7a, shininess: 90 });
    const particleMatB = new THREE.MeshPhongMaterial({ color: 0xf472b6, emissive: 0x742347, shininess: 90 });
    const particleA = new THREE.Mesh(particleGeo, particleMatA);
    const particleB = new THREE.Mesh(particleGeo, particleMatB);
    particleA.position.set(0, 0, 18);
    particleB.position.set(0, 0, -18);
    scene.add(particleA);
    scene.add(particleB);

    const impactCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 })
    );
    impactCore.visible = false;
    scene.add(impactCore);

    const coords = objects.flatMap((o) => o.trajectory || []);
    const maxR = Math.max(1, ...coords.map((p) => Math.hypot(p[0], p[1])));
    const maxZ = Math.max(1, ...coords.map((p) => Math.abs(p[2])));
    const limiteRadial = Math.max(0.1, tuboRaioInterno - margemInterna);
    const scale = Math.min(limiteRadial / maxR, (half - 0.8) / maxZ, 1.0);

    const targets = [];
    const anim = [];
    for (const o of objects) {
        const pts = (o.trajectory || []).map((p) => new THREE.Vector3(p[0] * scale, p[1] * scale, p[2] * scale));
        if (pts.length < 2) continue;
        const color = toHex(o.color);
        const trajGeometry = new THREE.BufferGeometry().setFromPoints(pts);
        trajGeometry.setDrawRange(0, 1);
        const trajLine = new THREE.Line(trajGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
        trajLine.visible = false;
        scene.add(trajLine);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshBasicMaterial({ color }));
        head.position.copy(pts[0]);
        head.visible = false;
        scene.add(head);
        targets.push(head);
        anim.push({ head, line: trajLine, pts, idx: 0, step: Math.max(1, Math.floor(pts.length / 120)) });
    }

    container.onpointerdown = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new THREE.Raycaster(); ray.setFromCamera(mouse, camera);
        if (ray.intersectObjects(targets).length > 0) window.open("painel-individual.html", "_blank");
    };

    let fase = "COLLISAO";
    const collisionSpeed = 0.3;
    let impactFrames = 0;
    const impactDuration = 24;

    const loop = () => {
        animationId = requestAnimationFrame(loop);

        if (fase === "COLLISAO") {
            setStatus("COLISAO EM CURSO...", "#facc15");
            particleA.position.z -= collisionSpeed;
            particleB.position.z += collisionSpeed;
            if (particleA.position.z <= 0.3) {
                fase = "IMPACTO";
                particleA.visible = false;
                particleB.visible = false;
                impactCore.visible = true;
                impactCore.material.opacity = 0.95;
                impactCore.scale.set(1, 1, 1);
                impactFrames = 0;
                setStatus("IMPACTO DETECTADO", "#ef4444");
            }
        } else if (fase === "IMPACTO") {
            impactFrames += 1;
            const t = impactFrames / impactDuration;
            impactCore.scale.set(1 + t * 5, 1 + t * 5, 1 + t * 5);
            impactCore.material.opacity = Math.max(0, 1 - t);

            if (impactFrames >= impactDuration) {
                impactCore.visible = false;
                fase = "TRAJETORIAS";
                for (const a of anim) {
                    a.line.visible = true;
                    a.head.visible = true;
                    a.head.position.copy(a.pts[0]);
                    a.idx = 0;
                    a.line.geometry.setDrawRange(0, 1);
                }
                setStatus("TRAJETORIAS ATIVAS", "#4ade80");
            }
        } else {
            for (const a of anim) {
                a.idx = Math.min(a.idx + a.step, a.pts.length - 1);
                a.line.geometry.setDrawRange(0, a.idx + 1);
                a.head.position.copy(a.pts[a.idx]);
            }
        }

        controls.update(); renderer.render(scene, camera);
    };
    loop();
}

async function uploadArquivo() {
    const input = document.getElementById("fileInput");
    const file = input.files?.[0];
    if (!file) return;
    setStatus("ENVIANDO ROOT...");
    const body = new FormData(); body.append("file", file);
    const res = await fetch(`${SERVER_URL}/upload/`, { method: "POST", body });
    if (!res.ok) await parseApiError(res, "Falha no upload");
    const data = await res.json();
    setFileNameLabel(data.filename || file.name);
    input.value = "";
    await carregarArquivosRoot();
    await carregarRootAtivo();
}

async function carregarArquivosRoot() {
    const select = document.getElementById("rootFileSelect");
    if (!select) return;
    const res = await fetch(`${SERVER_URL}/upload/files`);
    if (!res.ok) await parseApiError(res, "Falha ao listar arquivos ROOT");
    const data = await res.json();
    const files = Array.isArray(data.files) ? data.files : [];
    const active = data.active_filename || "";
    select.innerHTML = "";
    if (files.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "-- sem arquivos --";
        select.appendChild(opt);
        return;
    }
    for (const f of files) {
        const opt = document.createElement("option");
        opt.value = f.filename;
        opt.textContent = f.filename;
        if (f.filename === active) opt.selected = true;
        select.appendChild(opt);
    }
}

async function carregarRootAtivo() {
    const res = await fetch(`${SERVER_URL}/upload/active`);
    if (!res.ok) await parseApiError(res, "Falha ao obter ROOT ativo");
    const data = await res.json();
    if (data?.active_filename) {
        setFileNameLabel(data.active_filename);
    }
}

async function aplicarRootSelecionado() {
    const select = document.getElementById("rootFileSelect");
    const filename = select?.value;
    if (!filename) return;
    setStatus("ALTERANDO ROOT...");
    const res = await fetch(`${SERVER_URL}/upload/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
    });
    if (!res.ok) await parseApiError(res, "Falha ao selecionar ROOT");
    const data = await res.json();
    setFileNameLabel(data.active_filename || filename);
    setStatus("ROOT ATIVO: " + (data.active_filename || filename), "#4ade80");
    await carregarDoBackend();
}

// Função para simular evento, obter dados do backend e atualizar visualizações
async function simularEvento() {
    clearError();
    // variavel para obter o número do evento inicial a partir do input, com valor padrão 0
    const start = Number(document.getElementById("eventoInput").value || 0);

    // variavel para obter o número de eventos a serem simulados a partir do input, garantindo que seja pelo menos 1
    const num = Math.max(1, Number(document.getElementById("numInput").value || 1));

    // atualiza os labels na interface para refletir o evento inicial e o número de eventos, e define o status para "SIMULANDO..."
    const eventLabel = document.getElementById("eventLabel");
    const eventRangeLabel = document.getElementById("eventRangeLabel");
    if (eventLabel) eventLabel.textContent = `#${start}`;
    if (eventRangeLabel) eventRangeLabel.textContent = `N EVENTOS: ${num}`;
    setStatus("SIMULANDO...");

    // faz uma requisição POST para o endpoint /simulate/ do backend, enviando o evento inicial e o número de eventos como JSON no corpo da requisição.
    const res = await fetch(`${SERVER_URL}/simulate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_event: start, num_events: num })
    });

    if (!res.ok) await parseApiError(res, "Falha ao simular evento");

    const fig = JSON.parse(await res.text());
    const objects = parseObjects(fig);
    const counts = updateStats(objects);
    drawPlots(objects, counts);
    draw3D(objects);
}

async function carregarDoBackend() {
    try {
        await simularEvento();
        setStatus("SISTEMA ONLINE", "#4ade80");
    } catch (e) {
        console.error(e);
        showError(e.message || "Erro inesperado no backend.");
        setStatus("ERRO BACKEND", "#ef4444");
    }
}

document.getElementById("fileBtn").addEventListener("click", () => document.getElementById("fileInput").click());
document.getElementById("fileInput").addEventListener("change", async () => {
    try {
        clearError();
        await uploadArquivo();
        setStatus("UPLOAD OK", "#4ade80");
    } catch (e) {
        console.error(e);
        showError(e.message || "Erro no upload.");
        setStatus("UPLOAD ERRO", "#ef4444");
    }
});
document.getElementById("rootFileSelect").addEventListener("change", async () => {
    try {
        clearError();
        await aplicarRootSelecionado();
    } catch (e) {
        console.error(e);
        showError(e.message || "Erro ao trocar arquivo ROOT.");
        setStatus("ERRO AO TROCAR ROOT", "#ef4444");
    }
});
document.getElementById("simBtn").addEventListener("click", carregarDoBackend);
document.getElementById("siliconBtn").addEventListener("click", toggleSiliconPlates);
document.getElementById("rotBtn").addEventListener("click", toggleRotation);
window.onload = () => setTimeout(async () => {
    try {
        await carregarArquivosRoot();
        await carregarRootAtivo();
    } catch (e) {
        console.error(e);
        showError(e.message || "Falha ao inicializar arquivos ROOT.");
    }
    updateSiliconButton();
    await carregarDoBackend();
}, 600);
