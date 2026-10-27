import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MODELS, type Model, type ModelDef } from "./models.js";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const picker = document.querySelector<HTMLDivElement>("#picker")!;
const exportBtn = document.querySelector<HTMLButtonElement>("#export")!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(3, 5, 4);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.2));

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 1, 7);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.minDistance = 3;
controls.maxDistance = 14;

let current: { def: ModelDef; model: Model } | null = null;

function dispose(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    }
  });
}

function show(def: ModelDef): void {
  if (current) {
    scene.remove(current.model.object);
    dispose(current.model.object);
  }
  current = { def, model: def.build() };
  scene.add(current.model.object);
  picker.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === def.id)));
  try { localStorage.setItem("sp_3d_model", def.id); } catch { /* storage blocked */ }
}

for (const def of MODELS) {
  const b = document.createElement("button");
  b.textContent = def.name;
  b.dataset.id = def.id;
  b.addEventListener("click", () => show(def));
  picker.append(b);
}

exportBtn.addEventListener("click", async () => {
  if (!current) return;
  const glb = await new GLTFExporter().parseAsync(current.model.object, { binary: true });
  const url = URL.createObjectURL(new Blob([glb as ArrayBuffer], { type: "model/gltf-binary" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${current.def.id}.glb` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function resize(): void {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

let saved: string | null = null;
try { saved = localStorage.getItem("sp_3d_model"); } catch { /* storage blocked */ }
show(MODELS.find((m) => m.id === saved) ?? MODELS[0]);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  resize();
  current?.model.update?.(clock.getElapsedTime());
  controls.update();
  renderer.render(scene, camera);
});
