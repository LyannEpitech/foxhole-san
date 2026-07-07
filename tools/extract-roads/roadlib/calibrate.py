"""Deterministic auto-calibration of the CIELAB palette.

No GUI / manual clicking: seeds for each class are found from image statistics
(luminance percentiles + Frangi ridge response), so calibration is reproducible.
- paved   = bright AND linear (high L, high ridge)
- dirt    = mid-bright AND linear (mid L, high ridge)
- water   = blue (negative b*)
- sand    = bright AND NOT linear, inside large blobs (the paved confuser)
- terrain = median ground (mid L, low ridge)
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np
from PIL import Image
from skimage.filters import frangi

import config
from .color import to_lab
from .geometry import Hex, load_hexes

CALIB_HEXES = [
    "DeadLandsHex", "GreatMarchHex", "HeartlandsHex",
    "FarranacCoastHex", "EndlessShoreHex", "MooringCountyHex",
]


def _core_mask(h: Hex, rgba: np.ndarray) -> np.ndarray:
    alpha = rgba[..., 3] > 250
    poly = np.array([[int(round(x)), int(round(y))] for x, y in h.polygon_px()], np.int32)
    m = np.zeros((config.IMG_H, config.IMG_W), np.uint8)
    cv2.fillPoly(m, [poly], 1)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    return (cv2.erode(m, k, iterations=config.SEAM_ERODE_PX).astype(bool)) & alpha


def _load_rgba(maps_dir: str, hex_id: str) -> np.ndarray:
    path = os.path.join(maps_dir, f"{hex_id}.png")
    return np.array(Image.open(path).convert("RGBA"))


def calibrate(maps_dir: str, layout_path: str) -> dict:
    hexes = {h.id: h for h in load_hexes(layout_path)}
    seeds = {c: [] for c in ("paved", "dirt", "water", "sand", "terrain")}

    for hid in CALIB_HEXES:
        if hid not in hexes:
            continue
        rgba = _load_rgba(maps_dir, hexes[hid].id)
        core = _core_mask(hexes[hid], rgba)
        lab = to_lab(rgba[..., :3])
        L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
        ridge = frangi(L / 100.0, sigmas=config.FRANGI_SIGMAS,
                       alpha=config.FRANGI_ALPHA, beta=config.FRANGI_BETA,
                       black_ridges=False)

        cm = core & (b > -3)                      # non-water land
        water = core & (b < -8) & (L < 80)
        if cm.sum() < 500:
            continue

        Lc = L[cm]
        l_hi = np.percentile(Lc, 92)
        l_mid_lo, l_mid_hi = np.percentile(Lc, 45), np.percentile(Lc, 75)
        l_med = np.percentile(Lc, 50)
        r = ridge[cm]
        r_hi = np.percentile(r[r > 0], 70) if (r > 0).any() else 0.0

        bright = cm & (L >= l_hi)
        linear = cm & (ridge >= max(r_hi, 1e-6))

        paved = bright & linear
        dirt = cm & (L >= l_mid_lo) & (L <= l_mid_hi) & linear
        terrain = cm & (L >= l_med - 4) & (L <= l_med + 4) & (ridge < r_hi * 0.3)

        # sand = bright blobs (bright, low ridge, inside a large filled component)
        bmask = (bright & (ridge < r_hi * 0.3)).astype(np.uint8)
        n, lbl, stats, _ = cv2.connectedComponentsWithStats(bmask, connectivity=8)
        sand = np.zeros_like(bmask, bool)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] > config.BLOB_AREA_PX:
                sand |= lbl == i

        for name, mask in (("paved", paved), ("dirt", dirt),
                           ("water", water), ("sand", sand), ("terrain", terrain)):
            if mask.sum() > 0:
                seeds[name].append(lab[mask])

    palette = {}
    for name, chunks in seeds.items():
        if chunks:
            allpx = np.concatenate(chunks, axis=0)
            palette[name] = [round(float(v), 2) for v in allpx.mean(axis=0)]
        else:
            palette[name] = config.FALLBACK_PALETTE[name]
    return palette


def load_or_calibrate(maps_dir: str, layout_path: str, palette_path: str,
                      force: bool = False) -> dict:
    if not force and os.path.exists(palette_path):
        with open(palette_path, encoding="utf-8") as fh:
            return json.load(fh)
    palette = calibrate(maps_dir, layout_path)
    os.makedirs(os.path.dirname(palette_path), exist_ok=True)
    with open(palette_path, "w", encoding="utf-8") as fh:
        json.dump(palette, fh, indent=2)
    return palette
