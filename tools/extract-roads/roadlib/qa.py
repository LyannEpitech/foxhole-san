"""QA artifacts: per-hex overlays (kept vs rejected) and metrics."""
from __future__ import annotations

import json
import os

import cv2
import numpy as np

import config
from .pipeline import HexResult


def render_overlay(rgba: np.ndarray, res: HexResult, out_path: str) -> None:
    """Kept roads in magenta, rejected road-coloured pixels in red."""
    base = cv2.cvtColor(rgba[..., :3].astype(np.uint8), cv2.COLOR_RGB2BGR)
    overlay = base.copy()

    if res.rejected_mask is not None and res.rejected_mask.any():
        overlay[res.rejected_mask] = (0, 0, 255)  # red (BGR)

    base = cv2.addWeighted(overlay, 0.45, base, 0.55, 0)

    for chain in res.kept_px:
        if len(chain) >= 2:
            pts = np.array(chain, np.int32).reshape(-1, 1, 2)
            cv2.polylines(base, [pts], False, (255, 0, 255), 2, cv2.LINE_AA)  # magenta

    cv2.imwrite(out_path, base)


def write_metrics(results: list[HexResult], out_dir: str) -> dict:
    per_hex = {}
    beach_flags = []
    for res in results:
        m = dict(res.metrics)
        m["length_km"] = round(m.get("length_world", 0.0) * config.KM_PER_UNIT, 3)
        per_hex[res.hex_id] = m
        if res.hex_id in config.BEACH_HEXES:
            beach_flags.append((res.hex_id, m.get("length_world", 0.0)))

    summary = {
        "total_features": sum(r.metrics.get("edges", 0) for r in results),
        "total_length_km": round(
            sum(r.metrics.get("length_world", 0.0) for r in results) * config.KM_PER_UNIT, 2
        ),
        "beach_hexes": {hid: round(v, 1) for hid, v in beach_flags},
        "per_hex": per_hex,
    }
    with open(os.path.join(out_dir, "metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)
    return summary
