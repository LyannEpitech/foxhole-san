#!/usr/bin/env python3
"""Extract the road network from Foxhole hex map art into a GeoJSON.

    python extract_roads.py [--maps DIR] [--layout FILE] [--out DIR]
                            [--calibrate] [--tiers] [--hexes A,B,...]
                            [--date YYYY-MM-DD]

Outputs (under --out, default ./out):
    roads.geojson    the road network in world units
    qa/<Hex>.png     per-hex overlay (kept=magenta, rejected=red)
    metrics.json     per-hex + summary statistics
Copy out/roads.geojson to ../../public/roads.geojson once the overlays pass QA.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import config  # noqa: E402
from roadlib.calibrate import load_or_calibrate  # noqa: E402
from roadlib.geometry import load_hexes  # noqa: E402
from roadlib.pipeline import extract_hex  # noqa: E402
from roadlib.qa import render_overlay, write_metrics  # noqa: E402
from roadlib.seams import stitch, to_geojson  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--maps", default=os.path.join(HERE, "..", "..", "public", "maps"))
    ap.add_argument("--layout", default=os.path.join(HERE, "..", "..", "src", "data", "regionLayout.json"))
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    ap.add_argument("--calibrate", action="store_true", help="force palette recalibration")
    ap.add_argument("--tiers", action="store_true", help="emit paved/dirt classes")
    ap.add_argument("--hexes", default="", help="comma-separated subset of hex ids")
    ap.add_argument("--no-overlays", action="store_true")
    ap.add_argument("--date", default="", help="generatedAt stamp for the geojson")
    args = ap.parse_args()

    if args.tiers:
        config.TIERS = True

    os.makedirs(args.out, exist_ok=True)
    qa_dir = os.path.join(args.out, "qa")
    os.makedirs(qa_dir, exist_ok=True)

    palette_path = os.path.join(HERE, "calibration", "palette.json")
    palette = load_or_calibrate(args.maps, args.layout, palette_path, force=args.calibrate)
    print("palette:", json.dumps(palette))

    hexes = load_hexes(args.layout)
    wanted = set(filter(None, args.hexes.split(","))) if args.hexes else None
    hex_map = {h.id: h for h in hexes}

    results = []
    for h in hexes:
        if wanted and h.id not in wanted:
            continue
        png = os.path.join(args.maps, f"{h.id}.png")
        if not os.path.exists(png):
            print(f"  skip {h.id}: no {png}")
            continue
        rgba = np.array(Image.open(png).convert("RGBA"))
        overrides = config.REGION_OVERRIDES.get(h.id, {})
        saved = {k: getattr(config, k) for k in overrides}
        for k, v in overrides.items():
            setattr(config, k, v)
        try:
            res = extract_hex(h, rgba, palette)
        finally:
            for k, v in saved.items():
                setattr(config, k, v)
        results.append(res)
        if not args.no_overlays:
            render_overlay(rgba, res, os.path.join(qa_dir, f"{h.id}.png"))
        print(f"  {h.id:24s} edges={res.metrics.get('edges',0):4d} "
              f"len={res.metrics.get('length_world',0):9.0f}")

    snapped = stitch(results, hex_map)
    print(f"seam snaps: {snapped}")

    gj = to_geojson(results, args.date)
    gj_path = os.path.join(args.out, "roads.geojson")
    with open(gj_path, "w", encoding="utf-8") as fh:
        json.dump(gj, fh, separators=(",", ":"))
    size_kb = os.path.getsize(gj_path) / 1024
    print(f"wrote {gj_path}  ({len(gj['features'])} features, {size_kb:.0f} KB)")

    summary = write_metrics(results, args.out)
    print("total length km:", summary["total_length_km"])
    print("beach hexes (world len):", summary["beach_hexes"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
