// Procedural security-themed models. Each one is built from three.js
// primitives (no external assets), so it can be exported as a .glb.
import * as THREE from "three";
const metal = (color, roughness = 0.35) => new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness });
const glow = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 });
function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
}
function padlock() {
    const g = new THREE.Group();
    g.name = "Padlock";
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(2, 1.6, 0.25), {
        depth: 0.8, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4,
    });
    bodyGeo.center();
    const body = new THREE.Mesh(bodyGeo, metal(0xd4a017, 0.3));
    body.name = "Body";
    g.add(body);
    // Shackle: half torus on top of two straight legs.
    const shackle = new THREE.Group();
    shackle.name = "Shackle";
    const steel = metal(0xc0c6cc, 0.2);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 24, 48, Math.PI), steel);
    arc.position.y = 1.35;
    const legGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.6, 24);
    const left = new THREE.Mesh(legGeo, steel);
    const right = new THREE.Mesh(legGeo, steel);
    left.position.set(-0.62, 1.05, 0);
    right.position.set(0.62, 1.05, 0);
    shackle.add(arc, left, right);
    g.add(shackle);
    // Keyhole: a circle plus a tapered slot, slightly proud of the face.
    const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const front = 0.49;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 32), dark);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(0, 0.12, front);
    const slot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.42, 4, 1), dark);
    slot.position.set(0, -0.15, front);
    slot.scale.z = 0.12;
    g.add(hole, slot);
    g.position.y = -0.4;
    return {
        object: g,
        // Shackle pops open and shut.
        update: (t) => {
            const open = Math.max(0, Math.sin(t * 1.2)) ** 4;
            shackle.position.y = open * 0.45;
            shackle.rotation.y = open * 0.6;
        },
    };
}
function shield() {
    const g = new THREE.Group();
    g.name = "Shield";
    const s = new THREE.Shape();
    s.moveTo(0, 1.4);
    s.bezierCurveTo(0.5, 1.15, 0.9, 1.15, 1.2, 1.2);
    s.bezierCurveTo(1.25, 0.2, 0.9, -0.8, 0, -1.5);
    s.bezierCurveTo(-0.9, -0.8, -1.25, 0.2, -1.2, 1.2);
    s.bezierCurveTo(-0.9, 1.15, -0.5, 1.15, 0, 1.4);
    const geo = new THREE.ExtrudeGeometry(s, {
        depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 6, curveSegments: 32,
    });
    geo.center();
    const plate = new THREE.Mesh(geo, metal(0x1f4fa8, 0.4));
    plate.name = "Plate";
    g.add(plate);
    // Check mark built from two boxes, glowing green.
    const tick = new THREE.Group();
    tick.name = "Check";
    const mat = glow(0x2ecc71);
    const short = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.12), mat);
    short.position.set(-0.28, -0.05, 0);
    short.rotation.z = -Math.PI / 4;
    const long = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 0.12), mat);
    long.position.set(0.24, 0.12, 0);
    long.rotation.z = Math.PI / 4;
    tick.add(short, long);
    tick.position.z = 0.3;
    g.add(tick);
    return {
        object: g,
        update: (t) => {
            mat.emissiveIntensity = 1.1 + Math.sin(t * 2.5) * 0.6;
        },
    };
}
function serverRack() {
    const g = new THREE.Group();
    g.name = "ServerRack";
    const W = 1.6, H = 3, D = 1.4, units = 8;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ color: 0x22262b, metalness: 0.6, roughness: 0.5 }));
    frame.name = "Frame";
    g.add(frame);
    const bladeMat = metal(0x3a4048, 0.45);
    const leds = [];
    const unitH = (H - 0.3) / units;
    for (let i = 0; i < units; i++) {
        const y = -H / 2 + 0.15 + unitH * (i + 0.5);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, unitH * 0.82, 0.06), bladeMat);
        blade.position.set(0, y, D / 2 + 0.01);
        blade.name = `Unit${i + 1}`;
        g.add(blade);
        for (let j = 0; j < 3; j++) {
            const led = glow(j === 2 ? 0xff9f1a : 0x33ff88);
            leds.push(led);
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), led);
            dot.position.set(W / 2 - 0.25 - j * 0.12, y, D / 2 + 0.06);
            g.add(dot);
        }
        // Vent slots.
        for (let k = 0; k < 5; k++) {
            const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, unitH * 0.5, 0.02), new THREE.MeshStandardMaterial({ color: 0x0b0c0e }));
            vent.position.set(-W / 2 + 0.25 + k * 0.14, y, D / 2 + 0.05);
            g.add(vent);
        }
    }
    // Deterministic per-LED phase so blinking looks random but is stable.
    const phase = leds.map((_, i) => (Math.sin(i * 12.9898) * 43758.5453) % 1);
    return {
        object: g,
        update: (t) => {
            leds.forEach((m, i) => {
                m.emissiveIntensity = Math.sin(t * (3 + phase[i] * 6) + phase[i] * 10) > 0.2 ? 2 : 0.15;
            });
        },
    };
}
function networkGlobe() {
    const g = new THREE.Group();
    g.name = "NetworkGlobe";
    const R = 1.4;
    const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.98, 48, 32), new THREE.MeshStandardMaterial({ color: 0x0a1a2f, roughness: 0.8, transparent: true, opacity: 0.9 }));
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 3), new THREE.MeshBasicMaterial({ color: 0x2a7fff, wireframe: true, transparent: true, opacity: 0.35 }));
    g.add(core, wire);
    // Nodes spread on a Fibonacci sphere.
    const n = 14;
    const nodes = [];
    const nodeMat = glow(0x5ad1ff);
    const alertMat = glow(0xff3b3b);
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const a = i * Math.PI * (3 - Math.sqrt(5));
        const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(R);
        nodes.push(p);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), i === 5 ? alertMat : nodeMat);
        dot.position.copy(p);
        g.add(dot);
    }
    // Arcs between neighbouring nodes, lifted off the surface.
    const arcs = [];
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.6 });
    for (let i = 0; i < n; i++) {
        const a = nodes[i], b = nodes[(i * 5 + 3) % n];
        if (a.equals(b))
            continue;
        const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.35);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        arcs.push(curve);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.012, 6), arcMat));
    }
    // Packets that travel along the arcs.
    const packets = arcs.map(() => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), glow(0xffffff));
        g.add(m);
        return m;
    });
    return {
        object: g,
        update: (t) => {
            g.rotation.y = t * 0.15;
            packets.forEach((m, i) => m.position.copy(arcs[i].getPoint((t * 0.35 + i / arcs.length) % 1)));
            alertMat.emissiveIntensity = 1 + Math.abs(Math.sin(t * 4)) * 2;
        },
    };
}
export const MODELS = [
    { id: "padlock", name: "Padlock", build: padlock },
    { id: "shield", name: "Shield", build: shield },
    { id: "rack", name: "Server rack", build: serverRack },
    { id: "globe", name: "Network globe", build: networkGlobe },
];
