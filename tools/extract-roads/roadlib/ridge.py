"""Frangi multi-scale ridge detection — the primary false-positive suppressor.

Roads are thin bright ridges (one large Hessian eigenvalue across the road, one
small along it); beaches are plateaus (both eigenvalues small in the interior).
Frangi vesselness scores exactly that structure, so it fires on lines and stays
near zero inside blobs.
"""
from __future__ import annotations

import cv2
import numpy as np
from skimage.filters import frangi

import config


def white_tophat(lab: np.ndarray) -> np.ndarray:
    """White top-hat of L* (0..255 scale): high on thin bright lines, ~0 on
    large bright regions and their boundaries."""
    lf = (lab[..., 0] / 100.0 * 255.0).astype(np.uint8)
    r = config.TOPHAT_SE_PX
    se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    return cv2.morphologyEx(lf, cv2.MORPH_TOPHAT, se).astype(np.float32)


def _norm_p99(a: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Scale by the 99th percentile inside the hex, not the global max.

    The global max is a single bright outlier; road ridges are ~0.5x the 99th
    percentile, so this maps real roads to ~[0.5,1] and flat terrain to ~0.
    """
    vals = a[mask]
    if vals.size == 0:
        return np.zeros_like(a)
    scale = float(np.percentile(vals, 99.0))
    if scale < 1e-9:
        return np.zeros_like(a)
    return np.clip(a / scale, 0.0, 1.0)


def ridge_strength(lab: np.ndarray, palette: dict, core_mask: np.ndarray) -> np.ndarray:
    """Combined bright-road + dirt-road ridge response, normalised to [0,1]."""
    sigmas = config.FRANGI_SIGMAS
    kw = dict(
        sigmas=sigmas,
        alpha=config.FRANGI_ALPHA,
        beta=config.FRANGI_BETA,
        black_ridges=False,
    )
    if config.FRANGI_GAMMA is not None:
        kw["gamma"] = config.FRANGI_GAMMA

    # Bright (paved) field: the L* channel.
    l_field = lab[..., 0] / 100.0
    r_paved = frangi(l_field, **kw)

    # Dirt field: high where close to the dirt colour (invert dE, clamp).
    from .color import delta_e

    de_dirt = delta_e(lab, palette["dirt"])
    dirt_field = np.clip(1.0 - de_dirt / 25.0, 0.0, 1.0)
    r_dirt = frangi(dirt_field, **kw)

    ridge = np.maximum(_norm_p99(r_paved, core_mask), _norm_p99(r_dirt, core_mask))
    ridge = np.where(core_mask, ridge, 0.0)
    return ridge
