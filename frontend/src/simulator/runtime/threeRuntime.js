import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Builds and runs the complete Three.js detector scene and particle animation loop.
export function buildThreeScene({ state, byId, pColors, PARTICLE, openParticleModal, update3DVisibility }) {
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

    const controls = new OrbitControls(camera, renderer.domElement);
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

    // Helper to create detector cylindrical ring sectors.
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

    // Runtime registry for animated track lines and moving heads.
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
        head.userData = { particle: o };
        scene.add(head);
        particles.push({ object: o, pts: pts.slice(0, 400), idx: 0, line, head, completed: false });
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    renderer.domElement.addEventListener("pointerdown", (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const clickable = particles
            .filter((p) => p.head && p.head.visible)
            .map((p) => p.head);
        if (!clickable.length) return;
        const hits = raycaster.intersectObjects(clickable, false);
        if (!hits.length) return;
        const particle = hits[0]?.object?.userData?.particle;
        if (!particle) return;
        openParticleModal(particle);
    });

    let phase = "BEAMS";
    let beamZ = 40;
    let wait = 0;

    // Resets animated trajectories before each replay cycle.
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

    // Main render loop: beams phase -> track phase -> wait phase.
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

