"""CIELAB colour segmentation: road masks, water veto, negative-class veto."""
from __future__ import annotations

import numpy as np
from skimage.color import rgb2lab

import config


def to_lab(rgb_u8: np.ndarray) -> np.ndarray:
    """RGB uint8 (H,W,3) -> CIELAB float (H,W,3), D65."""
    return rgb2lab(rgb_u8.astype(np.float64) / 255.0)


def delta_e(lab: np.ndarray, centroid) -> np.ndarray:
    """CIE76 (Euclidean) dE between every pixel and a LAB centroid."""
    c = np.asarray(centroid, dtype=np.float64)
    return np.sqrt(((lab - c) ** 2).sum(axis=-1))


def road_and_water_masks(lab: np.ndarray, palette: dict, core_mask: np.ndarray):
    """Return (road_color_mask, water_mask, paved_hint) booleans over core_mask.

    paved_hint marks pixels closer to the paved centroid than the dirt one,
    used later for optional tier voting.
    """
    de_paved = delta_e(lab, palette["paved"])
    de_dirt = delta_e(lab, palette["dirt"])
    de_water = delta_e(lab, palette["water"])
    de_sand = delta_e(lab, palette["sand"])
    de_terrain = delta_e(lab, palette["terrain"])

    road = ((de_paved < config.DE_ROAD_PAVED) | (de_dirt < config.DE_ROAD_DIRT))

    # Relative negative-class veto: nearest confuser clearly closer than road.
    de_road = np.minimum(de_paved, de_dirt)
    de_neg = np.minimum(de_sand, de_terrain)
    neg_veto = de_neg < (de_road - config.NEG_VETO_MARGIN)
    road = road & ~neg_veto

    water = de_water < config.DE_WATER

    road = road & core_mask & ~water
    paved_hint = de_paved <= de_dirt
    return road, (water & core_mask), paved_hint
