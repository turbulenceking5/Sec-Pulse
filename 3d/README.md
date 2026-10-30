# Sec-Pulse 3D

TypeScript source for the app's **3D network labs** (Learn → 🌐 3D network labs), drawn with [three.js](https://threejs.org/). Full documentation: [context/labs.md](../context/labs.md).

- `src/lab.ts`: scene, camera, labels, picking, packet animation; exports `mountLab()`.
- `src/devices.ts`: device meshes built from primitives.
- `dist/`: compiled output, **committed**, because GitHub Pages serves it with no build step. Rebuild after editing `src/`.
- `vendor/`: three.js 0.170.0 and OrbitControls (MIT, see `vendor/LICENSE`), served same-origin so labs work offline after first use. `index.html`'s import map points `three` here.

```bash
cd 3d
npm install
npm run build     # or: npm run watch
npm run vendor    # after changing the three version
```
