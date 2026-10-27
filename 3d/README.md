# Sec-Pulse 3D

Procedural security-themed 3D models (padlock, shield, server rack, network globe) built with [three.js](https://threejs.org/) in TypeScript. Open `/3d/` on the Pages site. Drag to orbit, pinch or scroll to zoom, and **⬇ .glb** downloads the current model.

- `src/models.ts`: the models. Each `ModelDef` has a `build()` that returns a `THREE.Group` plus an optional per-frame `update(t)` for idle animation. Add a model by appending to `MODELS`.
- `src/main.ts`: scene, lighting, orbit controls, model picker, GLB export.
- `dist/`: compiled output, **committed** so Pages needs no build step. Rebuild after editing `src/`.
- three.js loads from jsDelivr through the import map in `index.html`. Keep its version the same as `three` in `package.json`.

```bash
cd 3d
npm install
npm run build    # or: npm run watch
```
