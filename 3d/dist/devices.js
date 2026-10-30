// Device meshes for the network lab, built from primitives (no asset files).
// Each one sits on y = 0, roughly 1 unit wide, so the layout in labs.json stays readable.
import * as THREE from "three";
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25, ...o });
const glow = (color, i = 1.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });
function box(w, h, d, m, x = 0, y = 0, z = 0) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    return b;
}
function screenOn(g, w, h, y, color, tilt = 0) {
    const frame = box(w, h, 0.06, std(0x1b1f27));
    const glass = box(w * 0.88, h * 0.82, 0.01, glow(color, 0.6), 0, 0, 0.035);
    const s = new THREE.Group();
    s.add(frame, glass);
    s.position.y = y;
    s.rotation.x = tilt;
    g.add(s);
}
function rack(g, p, h, units, led) {
    g.add(box(0.7, h, 0.7, std(0x2a2f38, { metalness: 0.5 }), 0, h / 2));
    for (let i = 0; i < units; i++) {
        const y = 0.12 + (h - 0.2) * (i + 0.5) / units;
        g.add(box(0.6, (h - 0.2) / units * 0.7, 0.02, std(0x3b424d), 0, y, 0.36));
        g.add(box(0.05, 0.05, 0.02, glow(i % 3 === 2 ? p.warn : led), 0.22, y, 0.38));
    }
}
export function buildDevice(kind, p) {
    const g = new THREE.Group();
    switch (kind) {
        case "internet": {
            const r = 0.55;
            const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.96, 32, 20), std(p.surface, { transparent: true, opacity: 0.9 }));
            const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), new THREE.MeshBasicMaterial({ color: p.accent, wireframe: true }));
            core.position.y = wire.position.y = r + 0.05;
            g.add(core, wire);
            break;
        }
        case "attacker": {
            g.add(box(0.8, 0.05, 0.55, std(0x15171c), 0, 0.03));
            screenOn(g, 0.8, 0.5, 0.3, p.danger, -0.25);
            break;
        }
        case "cloud": {
            const m = std(0xdfe7f2, { roughness: 0.9, metalness: 0 });
            [[0, 0.45, 0, 0.32], [-0.32, 0.32, 0, 0.24], [0.32, 0.32, 0, 0.26], [0.1, 0.3, 0.18, 0.22]]
                .forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); s.position.set(x, y, z); g.add(s); });
            break;
        }
        case "mail": {
            rack(g, p, 0.7, 3, p.ok);
            // Envelope on top.
            const env = std(0xf2f4f7, { metalness: 0 });
            g.add(box(0.5, 0.02, 0.34, env, 0, 0.74));
            const flap = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.17, 3), std(p.accent));
            flap.rotation.set(Math.PI / 2, 0, Math.PI);
            flap.scale.z = 0.05;
            flap.position.set(0, 0.76, -0.08);
            g.add(flap);
            break;
        }
        case "firewall": {
            // A short brick wall.
            const brick = std(0xc8572e, { roughness: 0.8, metalness: 0 });
            for (let row = 0; row < 4; row++) {
                const off = row % 2 ? 0.14 : 0;
                for (let i = -2; i <= 2; i++) {
                    const x = i * 0.28 + off;
                    if (Math.abs(x) > 0.6)
                        continue;
                    g.add(box(0.26, 0.14, 0.3, brick, x, 0.08 + row * 0.16));
                }
            }
            break;
        }
        case "vpn": {
            g.add(box(0.8, 0.22, 0.5, std(0x2a2f38, { metalness: 0.5 }), 0, 0.11));
            g.add(box(0.06, 0.04, 0.02, glow(p.ok), 0.3, 0.13, 0.26));
            // Padlock on top.
            const gold = std(0xd4a017, { metalness: 0.8, roughness: 0.3 });
            g.add(box(0.3, 0.24, 0.12, gold, 0, 0.36));
            const sh = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 10, 20, Math.PI), std(0xc0c6cc, { metalness: 0.9, roughness: 0.2 }));
            sh.position.y = 0.48;
            g.add(sh);
            break;
        }
        case "server":
            rack(g, p, 1.0, 5, p.ok);
            break;
        case "db": {
            const m = std(0x4a6fa5, { metalness: 0.4 });
            for (let i = 0; i < 3; i++) {
                const c = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 28), m);
                c.position.y = 0.12 + i * 0.26;
                g.add(c);
                const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.012, 6, 28), glow(p.accent, 0.5));
                band.rotation.x = Math.PI / 2;
                band.position.y = 0.24 + i * 0.26;
                g.add(band);
            }
            break;
        }
        case "workstation": {
            g.add(box(0.12, 0.3, 0.12, std(0x2a2f38), 0, 0.15));
            g.add(box(0.36, 0.03, 0.26, std(0x2a2f38), 0, 0.015));
            screenOn(g, 0.8, 0.5, 0.55, p.accent);
            g.add(box(0.6, 0.03, 0.2, std(0x3b424d), 0, 0.015, 0.36));
            break;
        }
        case "laptop": {
            g.add(box(0.75, 0.05, 0.5, std(0x9aa3ad, { metalness: 0.7 }), 0, 0.03));
            const s = new THREE.Group();
            s.position.set(0, 0.05, -0.24);
            const lid = new THREE.Group();
            lid.rotation.x = -0.3;
            screenOn(lid, 0.75, 0.48, 0.24, p.accent);
            s.add(lid);
            g.add(s);
            break;
        }
        case "console": {
            // Wide monitor with a bar chart: the SIEM / EDR console.
            g.add(box(0.12, 0.35, 0.12, std(0x2a2f38), 0, 0.175));
            screenOn(g, 1.1, 0.6, 0.62, p.surface);
            [0.25, 0.4, 0.18, 0.5, 0.32].forEach((h, i) => g.add(box(0.12, h * 0.8, 0.01, glow(i === 3 ? p.warn : p.accent, 0.8), -0.36 + i * 0.18, 0.4 + h * 0.4, 0.05)));
            break;
        }
    }
    g.traverse((o) => { o.castShadow = false; });
    return g;
}
