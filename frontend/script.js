const SERVER_URL = "http://127.0.0.1:5000";
let controls = null;
let renderer = null;
let animationId = null;
let isRotating = true;

function setStatus(text, color = "#facc15") {
    const el = document.getElementById("statusLabel");
    el.textContent = text;
    el.style.color = color;
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

    // Configura o layout comum para os gráficos, definindo as cores de fundo, a cor e o tamanho da fonte, e as margens. O layout é usado como base para os gráficos de radar, pizza e heatmap, garantindo uma aparência consistente entre eles.
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

    // Cria as traces para o gráfico de radar, mapeando os objetos para um formato adequado para a visualização. 
    // Para cada objeto, extrai as coordenadas x e y da trajetória (se disponível) e configura as propriedades de estilo, como cor e largura da linha. 
    // As traces são configuradas para serem do tipo "scatter" com modo "lines", e o hoverinfo é desativado para evitar informações de tooltip ao passar o mouse sobre as linhas.
    const polarTraces = objects.slice(0, 80).map((o) => {
        const x = (o.trajectory || []).map((p) => p[0]);
        const y = (o.trajectory || []).map((p) => p[1]);
        return {
            x,
            y,
            mode: "lines",
            line: {
                color: o.color || "#ffffff",
                width: 1
            },
            type: "scatter",
            hoverinfo: "skip",
            showlegend: false
        };
    });

    polarTraces.push({
        x: [0],
        y: [0],
        mode: "markers",
        marker: {
            color: "#fff",
            size: 4
        },
        showlegend: false,
        hoverinfo: "skip"
    });

    Plotly.newPlot("radarPlot", polarTraces,
        {
            ...layout,
            margin: {
                t: 10,
                l: 10,
                r: 10,
                b: 10
            },
            xaxis: {
                visible: false,
                scaleanchor: "y"
            },
            yaxis: {
                visible: false
            }
        },
        { displayModeBar: false },
        
    );

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
        ncontours: 14,
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
        colorbar: {
            title: { text: "GeV", side: "left", font: { color: "#38bdf8", size: 13 } },
            orientation: "h",
            x: 0.3,
            xanchor: "center",
            y: -0.32,
            yanchor: "top",
            len: 1,
            thickness: 10,
            tickfont: { color: "#7dd3fc", size: 11 },
            outlinecolor: "#1e3a8a",
            outlinewidth: 1
        },
        hovertemplate: "x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.0f}<extra></extra>",
        showscale: true
    }],
        {
            ...layout,
            margin: { t: 6, l: 45, r: 12, b: 65 },
            plot_bgcolor: "rgba(6,18,46,0.65)",
            xaxis: {
                title: "Pseudorapidez (η)",
                gridcolor: "rgba(56,189,248,0.12)",
                zeroline: true,
                zerolinecolor: "rgba(255,255,255,0.20)",
                range: [-3.5, 3.5]
            },
            yaxis: {
                title: "Ângulo (φ)",
                gridcolor: "rgba(56,189,248,0.12)",
                zeroline: true,
                zerolinecolor: "rgba(255,255,255,0.20)",
                range: [-4.5, 4.5]
            }
        },
        { displayModeBar: false }
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
    const tubeLen = 60;
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
    setStatus("UPLOAD...");
    const body = new FormData(); body.append("file", file);
    const res = await fetch(`${SERVER_URL}/upload/`, { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `upload ${res.status}`);
    document.getElementById("fileNameLabel").textContent = data.filename || file.name;
}

// Função para simular evento, obter dados do backend e atualizar visualizações
async function simularEvento() {
    // variavel para obter o número do evento inicial a partir do input, com valor padrão 0
    const start = Number(document.getElementById("eventoInput").value || 0);

    // variavel para obter o número de eventos a serem simulados a partir do input, garantindo que seja pelo menos 1
    const num = Math.max(1, Number(document.getElementById("numInput").value || 1));

    // atualiza os labels na interface para refletir o evento inicial e o número de eventos, e define o status para "SIMULANDO..."
    document.getElementById("eventLabel").textContent = `#${start}`;
    document.getElementById("eventRangeLabel").textContent = `N EVENTOS: ${num}`;
    setStatus("SIMULANDO...");

    // faz uma requisição POST para o endpoint /simulate/ do backend, enviando o evento inicial e o número de eventos como JSON no corpo da requisição.
    const res = await fetch(`${SERVER_URL}/simulate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_event: start, num_events: num })
    });

    if (!res.ok) throw new Error(`simulate ${res.status}`);

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
        setStatus("ERRO BACKEND", "#ef4444");
    }
}

document.getElementById("fileBtn").addEventListener("click", () => document.getElementById("fileInput").click());
document.getElementById("uploadBtn").addEventListener("click", async () => {
    try { await uploadArquivo(); setStatus("UPLOAD OK", "#4ade80"); } catch (e) { console.error(e); setStatus("UPLOAD ERRO", "#ef4444"); }
});
document.getElementById("simBtn").addEventListener("click", carregarDoBackend);
document.getElementById("rotBtn").addEventListener("click", toggleRotation);
window.onload = () => setTimeout(carregarDoBackend, 600);
