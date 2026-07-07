# extract-roads

Offline tool that derives the in-game **road network** from the 53 hex map PNGs
(`public/maps/*.png`) and writes it as a GeoJSON the app renders as the "Routes"
layer. Run-once, commit-the-output — the heavy CV dependencies never touch the
web bundle (same pattern as `tools/integrate-vendor.mjs`).

## Why this method

Foxhole map art is rendered by the game with a **fixed, deterministic palette**,
so classical computer vision beats deep learning here (no illumination variance,
no training data, fully reproducible). The pipeline optimizes **precision over
recall**: it is fine to miss a faint track, not fine to draw a road across a
beach. Two ideas carry the reliability:

1. **Frangi ridge filter** — roads are thin bright *ridges*; sandy blobs are
   *plateaus*. Multi-scale Hessian vesselness fires on lines and stays ~0 inside
   blobs.
2. **White top-hat** — a thin-bright-line detector that suppresses large bright
   regions *and their step-edge boundaries* (sandy-patch outlines, coastlines)
   that Frangi alone partly lights up. A pixel must be **both** a ridge **and** a
   top-hat line, in a **road colour** (CIELAB ΔE), and **not** near water.

## Install & run

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python extract_roads.py --date $(date +%F)
```

Outputs under `out/`:
- `roads.geojson` — the network in **world units** (see below)
- `qa/<Hex>.png` — per-hex overlay: kept roads **magenta**, rejected
  road-coloured pixels **red**
- `metrics.json` — per-hex + summary stats, incl. a `beach_hexes` watchlist

Review the 53 overlays. Acceptance bar: **no visible road-on-beach segment**.
When happy, publish it to the app:

```bash
cp out/roads.geojson ../../public/roads.geojson
```

### Useful flags
- `--hexes DeadLandsHex,FarranacCoastHex` — process a subset (fast iteration)
- `--calibrate` — force palette recalibration (writes `calibration/palette.json`)
- `--tiers` — emit `paved`/`dirt` classes instead of a single `road` class
- `--no-overlays` — skip QA images (faster)

## Tuning

All thresholds live in `config.py`, with per-region overrides in
`REGION_OVERRIDES` (e.g. tighten a sandy hex without hurting the rest). Typical
loop: run → inspect `out/qa/*.png` → adjust → re-run. The pipeline is
deterministic, so re-running the same params yields byte-identical output.

## Calibration

`calibration/palette.json` holds the CIELAB centroids for `paved/dirt/water/
sand/terrain`. It is **auto-derived** (no manual pixel-picking) from luminance
percentiles + ridge response on six representative hexes — see
`roadlib/calibrate.py`. Delete the file (or pass `--calibrate`) to regenerate.

## Output coordinates

Coordinates are **Foxhole world units** (the same Cartesian space the app SVG
renders in, y-down), *not* WGS84 lon/lat. This lets the app draw each road as a
raw `<polyline>` with no reprojection. `kmPerUnit = 2.2/2042` (mirrors
`src/lib/logistics.ts`) is stored in the collection `properties` for distance
conversion. Do **not** feed this file to lon/lat GIS tooling (turf, Leaflet).

## Pipeline stages (per hex)

1. **Mask** — alpha + polygon (from `regionLayout.json`), eroded 6px core.
2. **Colour** — CIELAB ΔE road mask, water hard-veto (dilated), negative-class
   veto, blob-interior subtraction.
3. **Ridge ∩ top-hat** — `road_color & (frangi > FRANGI_T) & (tophat > TOPHAT_T)`.
4. **Morphology** — close small gaps, drop small components.
5. **Vectorise** — skeletonize → `sknw` graph → spur/length prune →
   Douglas–Peucker simplify → per-edge `confidence` (mean ridge).
6. **Georeference** — pixel → world units.
7. **Seams** (global) — snap road endpoints across shared hex borders so the
   network is continuous across the 53 tiles.

## Known limitations

- Low-contrast roads inside bright sandy zones (bright line on bright sand) are
  intentionally under-detected — the precision-first tradeoff.
- Dense urban grids and fine dark-speckle terrain can produce a few short false
  segments; raise `MIN_ROAD_LEN_PX` or add a `REGION_OVERRIDES` entry.
- Deep-learning (D-LinkNet/U-Net) would only be warranted if the palette became
  non-deterministic; stages 5–7 would stay, swapping only stages 2–3.
