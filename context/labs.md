# 3D network labs

Learn → **🌐 3D network labs**. A small office network drawn in 3D with three.js. **Explore** shows what each device does, which logs it gives an analyst and which lessons cover it. **Incidents** play an attack out on the network step by step, and you answer as the analyst: tap the device you'd check or contain, or pick the right call. It's there because a lot of CySA+ (and the job) is knowing *where* to look and *where* to act, which flat multiple choice doesn't train.

## How it fits together

| Piece | What it does |
|---|---|
| `data/labs.json` | Hand-written content: zones, devices, links, scenarios. Loaded at boot (`loadLabs()`); if it fails, the Learn button stays hidden and boot retries when the app returns to the foreground. |
| `3d/src/lab.ts` → `3d/dist/lab.js` | Draws the network and exposes `mountLab(el, data, {colors, onPick})` → `{select, setState, packet, focus, reset, dispose}`. It only draws: no questions, storage or XP. |
| `3d/src/devices.ts` → `3d/dist/devices.js` | One mesh builder per device `kind`, made from primitives (no asset files). |
| `3d/vendor/` | three.js 0.170.0 (`three.module.min.js`, `OrbitControls.js`, MIT licence), served from the repo, so it's same-origin, cached by the service worker and works offline after the first lab. |
| `index.html` | An import map in `<head>` maps `three` and `three/addons/` to `3d/vendor/`. `openLabs()` (list), `openLab(id)` (explore or a scenario), `exploreLab()`, `runLab()`, `mountLabView()`. `import('./3d/dist/lab.js')` runs only when a lab opens, so the 170 KB (gzipped) of three.js never slows the app's start. |

- **The 3D view is optional.** If the module can't load (offline the first time) or WebGL is off, `mountLabView()` shows a message and every lab still works from the device dropdown (`deviceSelect()`), which is always shown under pick questions anyway.
- **One WebGL context at a time.** `openSheet()` and `closeSheet()` call `closeLabView()`, which disposes the scene and calls `forceContextLoss()` (iOS caps live contexts). Any new way of leaving a lab must go through one of those.
- **Pinned view.** `.lab-stage` is `position: sticky` under the sheet header (its `top` is set from the header's height when the lab opens), so the network stays visible while the panel scrolls and the after-answer animation (for example containment) is seen. Each step scrolls the sheet back to the top.
- **Labels** are HTML elements positioned over the canvas each frame. A device label goes above its device, or below it if that would cover a label already placed, or higher up (greedy, in data order). Zone names are hidden when a device label would cover them. Colours come from the theme tokens (`labColors()`), read once per mount.
- **Picking**: a tap (under 8 px of movement, under 600 ms) raycasts invisible hit spheres around each device, then the zone floors. Tapping a label does the same. Drags rotate, pinch zooms (OrbitControls).

## Progress, XP and stats
- Each scenario step is a question with `qid` `lab:<scenario id>#<step index>` and the scenario's `domain` (or the step's own). Answers go through `recordAnswer()`, so they count toward `sp_qstats`, `sp_qhist`, the streak, XP (+10/+3, once per step per day) and the "answer 10 questions" quest. Review mistakes ignores `lab:` ids (they aren't in `POOL()`).
- Finishing a scenario stores `sp_labs[id] = {best, t, date}` and logs a round with `type: "lab"` and `lab: id` in `sp_quizHistory` (+10 XP round bonus). The labs list shows ✓ and the best score.
- Achievement 🌐 **Network defender**: finish every scenario (any score).
- **Scenario ids and step order are permanent**, like other question ids: `sp_qhist` and `sp_labs` are keyed by them. Fix wording in place; add steps at the end.

## `labs.json` schema

```jsonc
{
  "zones": [{"id": "dmz", "name": "DMZ", "rect": [x1, z1, x2, z2], "desc": "shown when the zone is tapped"}],
  "nodes": [{
    "id": "web", "name": "Public web server", "short": "Web",  // short = the 3D label, keep it to ~10 characters
    "kind": "server",       // internet | attacker | cloud | mail | firewall | vpn | server | db | workstation | laptop | console
    "zone": "dmz",          // optional: devices between zones (firewalls) have none
    "pos": [x, z],
    "role": "what it is and why it matters",
    "logs": "what an analyst gets from it",
    "lessons": ["2.3"]      // lesson ids, shown as links
  }],
  "links": [["fw", "web"]],  // drawn as lines; dimmed when either end is contained
  "scenarios": [{
    "id": "sqli", "title": "…", "domain": 2, "lessons": ["2.3"],  // lessons also get a "Practise in 3D" button
    "intro": "shown before Start",
    "steps": [{
      "story": "what the analyst sees",
      "show": [actions],    // played before the question
      "type": "pick",       // tap a device: "answer" is a node id (or an array of acceptable ids)
      "q": "…", "answer": "web", "explain": "…",
      "after": [actions]    // played after answering (right or wrong)
    }, {
      "type": "choice", "options": ["exactly", "four", "distinct", "options"], "answer": 0  // shuffled at render time
    }]
  }]
}
```

Actions run in order: `{"packet": [node ids], "tone": "bad"|"ok"|"accent"}` animates traffic along the path (waits for it to arrive); `{"state": {"id": "bad"|"contained"|"normal"}}` marks devices (pulsing red ring / green ring and 🔒); `{"focus": "id"}` or `{"focus": null}` moves the camera.

## Rules
- **Layout**: the stage is wider than tall on a phone (about 356 × 280 px), so keep the network wide and shallow (currently x −6.2…6.2, z −6…5.2) and devices at least ~1.6 units apart in a row, or their labels collide. Check the smoke test's `shots/lab-*.png`.
- **Pick questions need one defensible device.** If two devices could reasonably be right (both firewalls can enforce DMZ-to-server traffic), list both in `answer` or ask a different question.
- **Accuracy and style** follow [study-content.md](study-content.md): Australian English, scenario-based, plausible distractors, explanations that say why the tempting answer is wrong. Australian facts used here (NDB 30-day assessment; Cyber Security Act 2024 ransomware payment report to ASD within 72h for turnover over $3M; ReportCyber) are in study-content's accuracy table; re-check them there when editing.
- **Generic only** (the repo is public): `example.com`/`examp1e.com` domains, documentation or private IP ranges, generic device names, no vendors or employer details. See [opsec.md](opsec.md).
- The smoke test validates that every pick answer and animation names a real device and every choice has 4 distinct options, then plays the first scenario.

## Changing the 3D code
Edit `3d/src/*.ts`, then rebuild and commit `3d/dist/` (Pages serves the compiled files; there's no build step there):

```bash
cd 3d && npm install && npm run build
```

`npm run vendor` re-copies three.js from `node_modules` into `3d/vendor/` after a version change; keep `three` and `@types/three` in `3d/package.json` on the same version.
