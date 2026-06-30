# Curtain Shades Phase 2 — Fabric & Color Catalog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Expand the curtain catalog from 5 fabrics + 8 flat color dots to 9 fabrics with realistic PBR material values and 6 curated color palettes with per-fabric recommendations.

**Architecture:** Pure data + render-helper changes in `index.html`. New fabrics reuse the existing `_buildCurtainMat` pipeline and only-verified PolyHaven texture ids. Colors gain a new grouped structure (`CURTAIN_COLOR_GROUPS`) rendered in the side panel; the existing flat `CURTAIN_COLORS` stays for the bottom bar. Spec: `docs/superpowers/specs/2026-06-30-curtain-shades-catalog-ui-design.md`.

**Tech Stack:** Three.js r128, single-file `index.html`, headless CDP probe against `localhost:5173` (dev-proxy → prod S3).

## Global Constraints

- Three.js **r128** only. Velvet/physical fabrics use `MeshPhysicalMaterial` with `mat.sheen = THREE.Color` (no `sheenColor`/`sheenRoughness`).
- All edits in `index.html`. `CURTAIN_FABRICS` ~line 1667; `CURTAIN_COLORS` ~line 1696; side-panel color render ~line 3483-3495; bottom-bar color render ~line 3154 (MUST keep working on flat `CURTAIN_COLORS`); `setCurtainFabric` ~line 3709; `_buildCurtainMat` ~line 3513 (do NOT change its logic — it already handles roughness/opacity/sheen/desaturate/repeat per preset).
- **New fabrics MUST reuse only these already-verified `polyId`s** (so textures can't 404): `rough_linen`, `fabric_pattern_05`, `velour_velvet`, `crepe_satin`, `crepe_georgette`. Differentiate fabrics by PBR fields (roughness/opacity/normalScale/envMapIntensity/physical), not by unique photos. Every fabric also keeps `normFallback`/`roughFallback` to the `cotton_fabric` maps like the existing presets.
- The diffuse map is ALWAYS desaturated in `_buildCurtainMat`, so the color chip is the true hue — fabric tints must come from PBR, not the map.
- `metalness` is 0 for every fabric.
- Each fabric preset keeps the existing field shape: `{ id, label, roughness, opacity, normalScale, envMapIntensity, swatch, polyId, normFallback, roughFallback }` plus optional `desaturateDiffuse`, `physical`, and the NEW `recommend` (array of hex strings).
- Fabric choice affects drape/sheer/pleated/roman (which use `_buildCurtainMat`); blinds use their own faux-wood `slatMat` and are unaffected — verify fabric on a `drape` shape.
- Commits gated on explicit user go-ahead. We are on branch `curtain-shades-phase2` (already created). Do not push.
- App renders on-demand: `renderer.render()` before any screenshot.

---

## Verification harness (shared)

**File:** `scratchpad/phase2-probe.mjs` (already created by the controller; do not modify). Usage: `node scratchpad/phase2-probe.mjs <fabricId>`. It selects `drape` shape + the given fabric on a mid color, waits for the material, and prints:
`MAT {"fabric","matType","roughness","opacity","transparent","hasMap","hasNormal","sheen"}` and `JS errors: ...`, plus writes `phase2-<fabricId>.png`.
For color-UI tasks, use `node scratchpad/phase2-probe.mjs ui` which prints `COLORUI {"groupLabels":[...],"chipCount":N,"recommendedMarked":N}` after opening the bedroom curtain panel.

(The controller validates this probe against current code before Task 1.)

---

## Task 1: Add 4 fabrics + per-fabric recommended colors

**Files:**
- Modify: `index.html` — `CURTAIN_FABRICS` array (~line 1667): append 4 entries before the closing `];`, and add a `recommend:[...]` field to all 9 presets.

**Interfaces:**
- Consumes: `_buildCurtainMat` (unchanged), `getPolyMaps`, the verified `polyId`s, `cotton_fabric` fallback paths (use the same `SB+'cotton_fabric/...'` strings the existing presets use).
- Produces: `CURTAIN_FABRICS` with 9 entries, each having a `recommend` array of hex strings drawn from the palettes in Task 2. Fabric ids: existing `linen,cotton,velvet,silk,voile` + new `cotton-blend,wool,jacquard,blackout`.

- [ ] **Step 1: Run the probe on an existing fabric to confirm BEFORE state**

Run: `node scratchpad/phase2-probe.mjs velvet`
Expected: `MAT` shows `matType:"MeshPhysicalMaterial"`, `roughness:0.85`, `hasMap:true`, `sheen` non-null; `JS errors: none`. (Confirms the probe + pipeline work.)

- [ ] **Step 2: Append the 4 new fabric presets**

In `CURTAIN_FABRICS`, immediately before the closing `];`, add (use the exact `SB+'cotton_fabric/...'` fallback strings already used by `linen`):

```js
  { id:'cotton-blend', label:'Cotton-blend', roughness:0.78, opacity:1.00, normalScale:0.85, envMapIntensity:0.32, swatch:'linear-gradient(135deg,#f0ece2,#d6d0c4)',
    polyId:'fabric_pattern_05',
    normFallback: [SB+'cotton_fabric/Normal.jpg', SB+'cotton_fabric/Normal.webp'],
    roughFallback:[SB+'cotton_fabric/Roughness.jpg',SB+'cotton_fabric/Roughness.webp'] },
  { id:'wool', label:'Wool', roughness:0.92, opacity:1.00, normalScale:1.20, envMapIntensity:0.28, swatch:'linear-gradient(135deg,#cbbfa8,#9c8e74)',
    polyId:'rough_linen',
    normFallback: [SB+'cotton_fabric/Normal.jpg', SB+'cotton_fabric/Normal.webp'],
    roughFallback:[SB+'cotton_fabric/Roughness.jpg',SB+'cotton_fabric/Roughness.webp'] },
  { id:'jacquard', label:'Jacquard', roughness:0.55, opacity:1.00, normalScale:1.40, envMapIntensity:0.42, swatch:'linear-gradient(135deg,#cdb98f,#9a7d4f)',
    polyId:'fabric_pattern_05',
    normFallback: [SB+'cotton_fabric/Normal.jpg', SB+'cotton_fabric/Normal.webp'],
    roughFallback:[SB+'cotton_fabric/Roughness.jpg',SB+'cotton_fabric/Roughness.webp'] },
  { id:'blackout', label:'Blackout', roughness:0.86, opacity:1.00, normalScale:0.50, envMapIntensity:0.25, swatch:'linear-gradient(135deg,#3a3733,#23211e)',
    polyId:'rough_linen',
    normFallback: [SB+'cotton_fabric/Normal.jpg', SB+'cotton_fabric/Normal.webp'],
    roughFallback:[SB+'cotton_fabric/Roughness.jpg',SB+'cotton_fabric/Roughness.webp'] },
```

- [ ] **Step 3: Add a `recommend` field to every preset**

Add (or merge into the existing object) a `recommend` array on each of the 9 presets. Exact values (hex from the Task 2 palettes; pairing per spec):

```
linen:        ['#EDE6D8','#D9CFC0','#B9C4A6','#D9B38C','#A89F90']
cotton:       ['#EDE6D8','#D9CFC0','#9AA9B0','#BFC9CE','#A89F90']
velvet:       ['#1F4E5F','#6A1B3A','#1C2733','#10403B','#402233']
silk:         ['#8C6A1F','#3B2A6B','#1F4E5F','#244B7A','#6A1B3A']
voile:        ['#FFFFFF','#F5F2EC','#DDE3E6','#EDE6D8']
cotton-blend: ['#EDE6D8','#D9CFC0','#9AA9B0','#A89F90']
wool:         ['#6E6960','#3A2C2A','#6B7B53','#7C4A21','#36454F']
jacquard:     ['#D9CFC0','#1F4E5F','#8C6A1F','#A89F90']
blackout:     ['#1C2733','#2B2B2B','#36454F','#3A2C2A']
```

- [ ] **Step 4: Verify each new fabric loads + applies correct PBR**

Run all four:
```
node scratchpad/phase2-probe.mjs cotton-blend
node scratchpad/phase2-probe.mjs wool
node scratchpad/phase2-probe.mjs jacquard
node scratchpad/phase2-probe.mjs blackout
```
Expected for each: `MAT` shows the matching `roughness` (0.78 / 0.92 / 0.55 / 0.86), `matType:"MeshStandardMaterial"`, `hasMap:true` (verified polyId resolved) OR (`hasMap:false` AND `hasNormal:true` if PolyHaven was unreachable — fallback weave still applied), `opacity:1`, `transparent:false`; `JS errors: none`. Open each `phase2-<fabric>.png` and confirm the curtain shows a distinct matte/textured fabric in the chosen color (no flat plastic, correct hue).

- [ ] **Step 5: Commit** (on user go-ahead)

```bash
git add index.html
git commit -m "feat(curtains): add wool, jacquard, blackout, cotton-blend fabrics + per-fabric recommended colors"
```

---

## Task 2: Curated color palettes (grouped) + grouped side-panel rendering

**Files:**
- Modify: `index.html` — add `CURTAIN_COLOR_GROUPS` after `CURTAIN_COLORS` (~line 1705); update `CURTAIN_COLORS` to the bestseller set; extract + rewrite the side-panel color render (~line 3483-3495) into a `renderCurtainColorGroups()` function.

**Interfaces:**
- Consumes: `curtainState.color`, `setCurtainColor`, `CURTAIN_COLOR_GROUPS`.
- Produces: `CURTAIN_COLOR_GROUPS` (array of `{group, colors:[{hex,label}]}`); a `renderCurtainColorGroups()` function that fills `#curtain-color-presets` with per-group label + swatch chips; callable from the config render and (Task 3) from `setCurtainFabric`. The bottom bar (line 3154) keeps using flat `CURTAIN_COLORS` unchanged.

- [ ] **Step 1: Add the palette data**

After the `CURTAIN_COLORS` array (line ~1705), add:

```js
// Curated palettes for the side panel (the flat CURTAIN_COLORS above stays for the bottom bar).
const CURTAIN_COLOR_GROUPS = [
  { group:'Neutrals', colors:[
    {hex:'#F5F2EC',label:'Ivory'},{hex:'#EDE6D8',label:'Cream'},{hex:'#D9CFC0',label:'Greige'},
    {hex:'#C2B6A3',label:'Oatmeal'},{hex:'#A89F90',label:'Taupe'},{hex:'#8C8377',label:'Mushroom'},
    {hex:'#6E6960',label:'Slate Grey'},{hex:'#FFFFFF',label:'White'} ]},
  { group:'Warm / Earth', colors:[
    {hex:'#E7D3B5',label:'Sand'},{hex:'#D9B38C',label:'Camel'},{hex:'#C68A5E',label:'Terracotta'},
    {hex:'#A9602F',label:'Rust'},{hex:'#7C4A21',label:'Cognac'},{hex:'#B08D57',label:'Ochre'},{hex:'#8A5A3B',label:'Clay'} ]},
  { group:'Cool / Blue-Grey', colors:[
    {hex:'#DDE3E6',label:'Mist'},{hex:'#BFC9CE',label:'Fog Blue'},{hex:'#9AA9B0',label:'Steel'},
    {hex:'#6F7E87',label:'Slate Blue'},{hex:'#4F606B',label:'Denim'},{hex:'#36454F',label:'Charcoal Blue'},{hex:'#283845',label:'Deep Slate'} ]},
  { group:'Greens', colors:[
    {hex:'#DCE3D2',label:'Pale Sage'},{hex:'#B9C4A6',label:'Sage'},{hex:'#8FA079',label:'Moss'},
    {hex:'#6B7B53',label:'Olive'},{hex:'#46583C',label:'Fern'},{hex:'#2E4034',label:'Forest'},{hex:'#7A8B6F',label:'Eucalyptus'} ]},
  { group:'Jewel', colors:[
    {hex:'#1F4E5F',label:'Teal'},{hex:'#10403B',label:'Emerald'},{hex:'#3B2A6B',label:'Amethyst'},
    {hex:'#6A1B3A',label:'Garnet'},{hex:'#7A2E2E',label:'Ruby'},{hex:'#8C6A1F',label:'Antique Gold'},{hex:'#244B7A',label:'Sapphire'} ]},
  { group:'Deep / Dark', colors:[
    {hex:'#2B2B2B',label:'Near Black'},{hex:'#1C2733',label:'Midnight Navy'},{hex:'#3A2C2A',label:'Espresso'},
    {hex:'#402233',label:'Aubergine'},{hex:'#28332B',label:'Deep Forest'},{hex:'#4A1F22',label:'Oxblood'},{hex:'#23252A',label:'Graphite'} ]},
];
```

- [ ] **Step 2: Update `CURTAIN_COLORS` to the bestseller set (for the bottom bar)**

Replace the contents of the existing `CURTAIN_COLORS` array with these 8 (keep the `{hex,label}` shape so line 3154 keeps working):

```js
const CURTAIN_COLORS = [
  { hex:'#EDE6D8', label:'Cream'   },
  { hex:'#D9CFC0', label:'Greige'  },
  { hex:'#A89F90', label:'Taupe'   },
  { hex:'#B9C4A6', label:'Sage'    },
  { hex:'#9AA9B0', label:'Steel'   },
  { hex:'#1F4E5F', label:'Teal'    },
  { hex:'#1C2733', label:'Navy'    },
  { hex:'#2B2B2B', label:'Charcoal'},
];
```

- [ ] **Step 3: Extract + rewrite the side-panel color render**

Replace the side-panel color block (the `const colorRow = document.getElementById('curtain-color-presets'); if (colorRow) { ... }` block, ~line 3483-3495) with a single call:

```js
  renderCurtainColorGroups();
```

Then add this new function immediately after the config-render function that contained that block (place it just below that function's closing `}`):

```js
// Renders the grouped colour palettes into the side panel. Highlights the active
// fabric's recommended colours (filled in by Task 3 via the `recommend` field).
function renderCurtainColorGroups() {
  const host = document.getElementById('curtain-color-presets');
  if (!host) return;
  host.innerHTML = '';
  const preset = CURTAIN_FABRICS.find(f => f.id === curtainState.fabric);
  const rec = new Set((preset && preset.recommend) ? preset.recommend.map(h => h.toUpperCase()) : []);
  CURTAIN_COLOR_GROUPS.forEach(g => {
    const lbl = document.createElement('div');
    lbl.className = 'curtain-color-group-label';
    lbl.textContent = g.group;
    host.appendChild(lbl);
    const rowEl = document.createElement('div');
    rowEl.className = 'curtain-color-group-row';
    g.colors.forEach(c => {
      const btn = document.createElement('button');
      const isRec = rec.has(c.hex.toUpperCase());
      btn.className = 'curtain-color-chip'
        + (c.hex.toLowerCase() === (curtainState.color || '').toLowerCase() ? ' active' : '')
        + (isRec ? ' recommended' : '');
      btn.id = 'cclr-' + c.hex.replace('#','');
      btn.title = c.label + (isRec ? ' · recommended' : '');
      btn.style.background = c.hex;
      btn.onclick = () => setCurtainColor(c.hex);
      rowEl.appendChild(btn);
    });
    host.appendChild(rowEl);
  });
}
```

- [ ] **Step 4: Add minimal CSS for the group label/row**

Find the `.curtain-color-presets{...}` CSS rule (~line 219) and add after it:

```css
.curtain-color-group-label{font-size:9px;font-weight:700;letter-spacing:.06em;color:var(--text-muted);text-transform:uppercase;margin:8px 0 4px}
.curtain-color-group-row{display:flex;gap:6px;flex-wrap:wrap}
```

- [ ] **Step 5: Verify the grouped palette renders**

Run: `node scratchpad/phase2-probe.mjs ui`
Expected: `COLORUI` shows `groupLabels` = the 6 group names in order, `chipCount` = 43 (8+7+7+7+7+7), `JS errors: none`. Open `phase2-ui.png` and confirm 6 labeled colour groups in the side panel and the bottom bar still shows its 8 bestseller chips.

- [ ] **Step 6: Commit** (on user go-ahead)

```bash
git add index.html
git commit -m "feat(curtains): curated color palette groups in side panel"
```

---

## Task 3: Highlight active fabric's recommended colors

**Files:**
- Modify: `index.html` — `setCurtainFabric` (~line 3709): re-render the colour groups so the recommended highlight tracks the selected fabric. Add a `.recommended` chip style.

**Interfaces:**
- Consumes: `renderCurtainColorGroups()` (Task 2), the `recommend` field on each preset (Task 1).
- Produces: a visible recommended-swatch indicator that updates when the fabric changes.

- [ ] **Step 1: Re-render colours on fabric change**

In `setCurtainFabric` (after the existing `document.querySelectorAll('[data-cfab]')...` line, before `_applyCurtainMaterial();`), add:

```js
  renderCurtainColorGroups(); // refresh recommended-colour highlight for the new fabric
```

- [ ] **Step 2: Add the recommended-chip style**

After the `.curtain-color-chip.active{...}` rule (~line 221), add:

```css
.curtain-color-chip.recommended{box-shadow:0 0 0 2px var(--bg-panel),0 0 0 3px #c9a227}
.curtain-color-chip.recommended.active{box-shadow:0 0 0 2px var(--bg-panel),0 0 0 3px var(--accent)}
```

- [ ] **Step 3: Verify the highlight tracks fabric selection**

Run: `node scratchpad/phase2-probe.mjs ui`
Expected: with the default fabric, `COLORUI.recommendedMarked` equals that fabric's `recommend` length. Then the probe switches to `velvet` and re-reads: `recommendedMarked` = 5 and the marked chips are the jewel/deep hexes. `JS errors: none`. Open `phase2-ui.png` and confirm gold-ringed recommended swatches appear and change with the fabric.

- [ ] **Step 4: Commit** (on user go-ahead)

```bash
git add index.html
git commit -m "feat(curtains): highlight recommended colors for the active fabric"
```

---

## Self-Review

**Spec coverage (Phase 2):**
- Fabrics 5→9 with research PBR values → Task 1. ✓
- Realistic materials via existing `_buildCurtainMat` (roughness/sheen/opacity/normal) → Task 1 data (logic unchanged). ✓
- 6 curated color palette groups with hex → Task 2. ✓
- Per-fabric recommended colors surfaced → Tasks 1 (data) + 3 (highlight). ✓
- Bestseller defaults → Task 2 (`CURTAIN_COLORS` bar set). ✓
- Voile transparency unchanged (already opacity 0.72 + sheer-shape 0.42 in `_buildCurtainMat`) — not regressed; new fabrics are all opaque. ✓

**Placeholder scan:** none — all data and code are concrete.

**Type consistency:** `renderCurtainColorGroups()` defined in Task 2, called in Task 2 (config render) and Task 3 (`setCurtainFabric`). `recommend` field added in Task 1, consumed in Task 2/3. `CURTAIN_COLOR_GROUPS` shape `{group, colors:[{hex,label}]}` matches the render. Bottom bar untouched (flat `CURTAIN_COLORS`).

**Out of scope (Phase 2):** style preview tiles, fabric cards, overall panel layout redesign (Phase 3).
