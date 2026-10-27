// 3D network lab: draws data/labs.json's zones, devices and links, and gives the app
// a small API to drive scenarios (select, mark state, animate traffic, focus the camera).
// The app (index.html) owns the questions and progress; this module only draws.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildDevice } from "./devices.js";
const PACKET_SPEED = 5; // units per second
const TWEEN_MS = 650;
export function mountLab(el, data, opts) {
    const col = (k) => new THREE.Color(opts.colors[k]);
    const pal = Object.fromEntries(Object.keys(opts.colors).map((k) => [k, col(k).getHex()]));
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.domElement.className = "lab-canvas";
    el.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 10, 6);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = 1.3;
    controls.minDistance = 3;
    controls.maxDistance = 40;
    controls.screenSpacePanning = false;
    const disposables = [];
    const track = (x) => (disposables.push(x), x);
    // Zones: tinted floor plates with an outline.
    const zoneMeshes = [];
    const zoneLabels = [];
    const plateMat = track(new THREE.MeshStandardMaterial({ color: pal.accent, transparent: true, opacity: 0.07, roughness: 1 }));
    const edgeMat = track(new THREE.LineBasicMaterial({ color: pal.border }));
    for (const z of data.zones) {
        const [x1, z1, x2, z2] = z.rect;
        const geo = track(new THREE.BoxGeometry(x2 - x1, 0.04, z2 - z1));
        const m = new THREE.Mesh(geo, plateMat);
        m.position.set((x1 + x2) / 2, -0.02, (z1 + z2) / 2);
        m.userData.zone = z.id;
        const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(geo)), edgeMat);
        edges.position.copy(m.position);
        scene.add(m, edges);
        zoneMeshes.push(m);
        const div = label("lab-zone", z.name);
        div.onclick = () => opts.onPick?.("zone", z.id);
        // Front-left corner, so zone names don't sit under the device labels.
        zoneLabels.push({ div, at: new THREE.Vector3(x1 + 0.12, 0, z2 - 0.12) });
    }
    const nodes = new Map();
    const hitMat = track(new THREE.MeshBasicMaterial({ visible: false }));
    const hitGeo = track(new THREE.SphereGeometry(0.75, 8, 6));
    const ringGeo = track(new THREE.RingGeometry(0.62, 0.74, 40));
    const selRing = new THREE.Mesh(track(new THREE.RingGeometry(0.8, 0.9, 40)), track(new THREE.MeshBasicMaterial({ color: pal.accent, side: THREE.DoubleSide })));
    selRing.rotation.x = -Math.PI / 2;
    selRing.visible = false;
    scene.add(selRing);
    const hits = [];
    for (const def of data.nodes) {
        const group = buildDevice(def.kind, pal);
        group.position.set(def.pos[0], 0, def.pos[1]);
        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.y = 0.45;
        hit.userData.node = def.id;
        group.add(hit);
        hits.push(hit);
        const ringMat = track(new THREE.MeshBasicMaterial({ color: pal.danger, side: THREE.DoubleSide, transparent: true }));
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        ring.visible = false;
        group.add(ring);
        scene.add(group);
        const div = label("lab-label", def.short);
        div.setAttribute("role", "button");
        div.setAttribute("aria-label", def.name);
        div.onclick = (e) => { e.stopPropagation(); opts.onPick?.("node", def.id); };
        nodes.set(def.id, { def, group, ring, ringMat, div, state: "normal", at: new THREE.Vector3(def.pos[0], 1.15, def.pos[1]) });
    }
    // Links: thin lines between devices, dimmed when either end is contained.
    const links = data.links.filter(([a, b]) => nodes.has(a) && nodes.has(b)).map(([a, b]) => {
        const mat = track(new THREE.LineBasicMaterial({ color: pal.muted, transparent: true, opacity: 0.55 }));
        const pa = nodes.get(a).group.position, pb = nodes.get(b).group.position;
        const geo = track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pa.x, 0.08, pa.z), new THREE.Vector3(pb.x, 0.08, pb.z)]));
        scene.add(new THREE.Line(geo, mat));
        return { a, b, mat };
    });
    function label(cls, text) {
        const d = document.createElement("div");
        d.className = cls;
        d.textContent = text;
        el.append(d);
        return d;
    }
    // Camera framing: fit the whole layout for the stage's aspect ratio.
    const xs = data.zones.flatMap((z) => [z.rect[0], z.rect[2]]).concat(data.nodes.map((n) => n.pos[0]));
    const zs = data.zones.flatMap((z) => [z.rect[1], z.rect[3]]).concat(data.nodes.map((n) => n.pos[1]));
    const center = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
    const span = { x: Math.max(...xs) - Math.min(...xs), z: Math.max(...zs) - Math.min(...zs) };
    const home = () => {
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const fitH = (span.z * 0.96 + 1.5) / 2 / Math.tan(vfov / 2);
        const fitW = (span.x + 1.5) / 2 / Math.tan(vfov / 2) / camera.aspect;
        const d = Math.max(fitH, fitW) * 1.08;
        // Steep angle: far rows stay legible on a portrait phone.
        return { target: center.clone(), pos: center.clone().add(new THREE.Vector3(0, d * 0.95, d * 0.32)) };
    };
    let focused = null;
    // Tweens for the camera.
    let tween = null;
    function moveTo(to) {
        tween?.done();
        return new Promise((done) => {
            tween = { from: { t: controls.target.clone(), p: camera.position.clone() }, to, t0: performance.now(), done };
        });
    }
    const packets = new Set();
    const packetGeo = track(new THREE.SphereGeometry(0.13, 16, 12));
    const toneMat = {
        bad: track(new THREE.MeshStandardMaterial({ color: pal.danger, emissive: pal.danger, emissiveIntensity: 1.5 })),
        ok: track(new THREE.MeshStandardMaterial({ color: pal.ok, emissive: pal.ok, emissiveIntensity: 1.5 })),
        accent: track(new THREE.MeshStandardMaterial({ color: pal.accent, emissive: pal.accent, emissiveIntensity: 1.5 })),
    };
    // Tap (not drag) to pick a device or zone.
    const ray = new THREE.Raycaster();
    let down = null;
    const canvas = renderer.domElement;
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 600) {
            down = null;
            return;
        }
        down = null;
        const r = canvas.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const n = ray.intersectObjects(hits, false)[0];
        if (n)
            return opts.onPick?.("node", n.object.userData.node);
        const z = ray.intersectObjects(zoneMeshes, false)[0];
        if (z)
            opts.onPick?.("zone", z.object.userData.zone);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    // Size to the container.
    let w = 0, h = 0;
    const resize = () => {
        const nw = el.clientWidth, nh = el.clientHeight;
        if (!nw || !nh || (nw === w && nh === h))
            return;
        w = nw;
        h = nh;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (!focused && !tween) {
            const hm = home();
            controls.target.copy(hm.target);
            camera.position.copy(hm.pos);
        }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const v = new THREE.Vector3();
    // Device labels go above the device; if that would cover a label already placed, try below it,
    // then higher up. Greedy, in data order, so the layout is stable from frame to frame.
    const placed = [];
    const toScreen = (p) => { v.copy(p).project(camera); return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, ok: v.z < 1 }; };
    const below = new THREE.Vector3();
    function placeNodeLabels() {
        placed.length = 0;
        for (const n of nodes.values()) {
            const top = toScreen(n.at), lw = n.div.offsetWidth, lh = n.div.offsetHeight;
            if (!top.ok) {
                n.div.style.display = "none";
                continue;
            }
            below.set(n.at.x, 0, n.at.z);
            const bot = toScreen(below);
            const tries = [{ x: top.x, y: top.y - lh }, { x: bot.x, y: bot.y + 2 }, { x: top.x, y: top.y - lh * 2 - 2 }];
            const hit = (r) => placed.some((q) => Math.abs(r.x - q.x) * 2 < (lw + q.w) && r.y < q.y + q.h && r.y + lh > q.y);
            const at = tries.find((r) => !hit(r)) ?? tries[0];
            placed.push({ x: at.x, y: at.y, w: lw, h: lh });
            n.div.style.display = "";
            n.div.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, 0)`;
        }
    }
    renderer.setAnimationLoop((now) => {
        if (tween) {
            const k = Math.min(1, (now - tween.t0) / TWEEN_MS), e = k * k * (3 - 2 * k);
            controls.target.lerpVectors(tween.from.t, tween.to.target, e);
            camera.position.lerpVectors(tween.from.p, tween.to.pos, e);
            if (k >= 1) {
                const d = tween.done;
                tween = null;
                d();
            }
        }
        for (const p of packets) {
            let s = ((now - p.t0) / 1000) * PACKET_SPEED, i = 0;
            while (i < p.lens.length && s > p.lens[i])
                s -= p.lens[i++];
            if (i >= p.lens.length) {
                scene.remove(p.mesh);
                packets.delete(p);
                p.done();
                continue;
            }
            const k = s / p.lens[i];
            p.mesh.position.lerpVectors(p.pts[i], p.pts[i + 1], k);
            p.mesh.position.y += Math.sin(k * Math.PI) * 0.35;
        }
        const pulse = 0.55 + 0.45 * Math.sin(now / 220);
        for (const n of nodes.values())
            if (n.state === "bad")
                n.ringMat.opacity = pulse;
        if (!tween)
            controls.update();
        renderer.render(scene, camera);
        placeNodeLabels();
        // Zone names are secondary: hide one rather than let a device label cover it (tapping the zone still works).
        zoneLabels.forEach((z) => {
            const p = toScreen(z.at), zw = z.div.offsetWidth, zh = z.div.offsetHeight;
            const covered = !p.ok || placed.some((q) => p.x < q.x + q.w / 2 && p.x + zw > q.x - q.w / 2 && p.y - zh < q.y + q.h && p.y > q.y);
            z.div.style.visibility = covered ? "hidden" : "";
            if (!covered)
                z.div.style.transform = `translate(${p.x}px, ${p.y}px) translate(0, -100%)`;
        });
    });
    const view = {
        select(id) {
            const n = id ? nodes.get(id) : null;
            selRing.visible = !!n;
            if (n)
                selRing.position.set(n.group.position.x, 0.03, n.group.position.z);
            nodes.forEach((x) => x.div.classList.toggle("sel", x === n));
        },
        setState(id, state) {
            const n = nodes.get(id);
            if (!n)
                return;
            n.state = state;
            n.ring.visible = state !== "normal";
            n.ringMat.color.set(state === "bad" ? pal.danger : pal.ok);
            n.ringMat.opacity = 1;
            n.div.classList.toggle("bad", state === "bad");
            n.div.classList.toggle("contained", state === "contained");
            links.forEach((l) => {
                const cut = nodes.get(l.a).state === "contained" || nodes.get(l.b).state === "contained";
                l.mat.opacity = cut ? 0.12 : 0.55;
            });
        },
        packet(path, tone = "bad") {
            const pts = path.map((id) => nodes.get(id)).filter((n) => !!n).map((n) => new THREE.Vector3(n.group.position.x, 0.5, n.group.position.z));
            if (pts.length < 2)
                return Promise.resolve();
            const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
            const mesh = new THREE.Mesh(packetGeo, toneMat[tone]);
            mesh.position.copy(pts[0]);
            scene.add(mesh);
            return new Promise((done) => packets.add({ pts, lens, total: lens.reduce((a, b) => a + b, 0), t0: performance.now(), mesh, done }));
        },
        focus(id) {
            const n = id ? nodes.get(id) : null;
            focused = n ? id : null;
            if (!n)
                return moveTo(home());
            const t = n.group.position.clone();
            return moveTo({ target: t, pos: t.clone().add(new THREE.Vector3(0, 4.2, 4.6)) });
        },
        reset() {
            nodes.forEach((_, id) => view.setState(id, "normal"));
            view.select(null);
            packets.forEach((p) => { scene.remove(p.mesh); p.done(); });
            packets.clear();
            void view.focus(null);
        },
        dispose() {
            renderer.setAnimationLoop(null);
            ro.disconnect();
            canvas.removeEventListener("pointerdown", onDown);
            canvas.removeEventListener("pointerup", onUp);
            tween?.done();
            packets.forEach((p) => p.done());
            controls.dispose();
            scene.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.geometry.dispose();
                    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
                }
            });
            disposables.forEach((d) => d.dispose());
            renderer.dispose();
            renderer.forceContextLoss(); // iOS caps live WebGL contexts; free this one now
            el.querySelectorAll(".lab-label, .lab-zone, .lab-canvas").forEach((x) => x.remove());
        },
    };
    return view;
}
