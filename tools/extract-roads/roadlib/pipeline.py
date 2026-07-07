"""Per-hex road extraction: mask -> colour -> ridge -> binarize -> vectorise."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import cv2
import numpy as np
import sknw
from skimage.morphology import (
    remove_small_objects,
    skeletonize,
)

import config
from .color import road_and_water_masks, to_lab
from .geometry import Hex
from .ridge import ridge_strength, white_tophat


@dataclass
class Edge:
    """A vectorised road segment in world units."""
    pts: list[tuple[float, float]]        # world coords
    confidence: float
    paved_frac: float
    touches_border: bool = False


@dataclass
class HexResult:
    hex_id: str
    edges: list[Edge] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)
    # Debug rasters for QA (pixel space).
    kept_px: list = field(default_factory=list)      # list of [(x,y),...] chains
    rejected_mask: np.ndarray | None = None


def build_masks(h: Hex, rgba: np.ndarray):
    """Return (core_mask, full_mask, dist_to_border) all in pixel space."""
    alpha = rgba[..., 3] > 250
    poly = np.array([[int(round(x)), int(round(y))] for x, y in h.polygon_px()], np.int32)
    poly_mask = np.zeros((config.IMG_H, config.IMG_W), np.uint8)
    cv2.fillPoly(poly_mask, [poly], 1)
    full = (poly_mask.astype(bool)) & alpha
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    core = cv2.erode(full.astype(np.uint8), k, iterations=config.SEAM_ERODE_PX).astype(bool)
    dist = cv2.distanceTransform(full.astype(np.uint8), cv2.DIST_L2, 5)
    return core, full, dist


def blob_veto(road_color: np.ndarray) -> np.ndarray:
    """Subtract the solid interior of large light blobs (beaches)."""
    m = road_color.astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    remove = np.zeros_like(m, bool)
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        w = stats[i, cv2.CC_STAT_WIDTH]
        hh = stats[i, cv2.CC_STAT_HEIGHT]
        fill = area / max(1, w * hh)
        if area > config.BLOB_AREA_PX and fill > config.BLOB_FILL_RATIO:
            remove |= labels == i
    if remove.any():
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        interior = cv2.erode(remove.astype(np.uint8), k,
                             iterations=config.BLOB_INTERIOR_ERODE_PX).astype(bool)
        return road_color & ~interior
    return road_color


def _angle(dx: float, dy: float) -> float:
    return math.atan2(dy, dx)


def _tangent(pts: np.ndarray, at_start: bool) -> float:
    """Tangent angle at an endpoint of a pixel chain (pts is Nx2 [y,x])."""
    n = len(pts)
    if n < 2:
        return 0.0
    k = min(5, n - 1)
    if at_start:
        p0, p1 = pts[k], pts[0]
    else:
        p0, p1 = pts[-1 - k], pts[-1]
    return _angle(p1[1] - p0[1], p1[0] - p0[0])


def extract_hex(h: Hex, rgba: np.ndarray, palette: dict) -> HexResult:
    res = HexResult(hex_id=h.id)
    core, full, dist = build_masks(h, rgba)

    lab = to_lab(rgba[..., :3])
    road_color, water, paved_hint = road_and_water_masks(lab, palette, core)

    # Suppress a band around water so coastlines/river edges aren't traced.
    if config.WATER_DILATE_PX > 0 and water.any():
        wk = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (2 * config.WATER_DILATE_PX + 1, 2 * config.WATER_DILATE_PX + 1),
        )
        wd = cv2.dilate(water.astype(np.uint8), wk, iterations=1).astype(bool)
        road_color = road_color & ~wd
    road_color = blob_veto(road_color)

    # A road pixel must be BOTH a Frangi ridge AND a thin bright top-hat line.
    ridge = ridge_strength(lab, palette, core)
    tophat = white_tophat(lab)
    strength = ridge  # used for per-edge confidence
    candidate = road_color & (ridge > config.FRANGI_T) & (tophat > config.TOPHAT_T)

    binary = candidate
    if config.GAP_CLOSE_PX > 0:
        k = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (2 * config.GAP_CLOSE_PX + 1, 2 * config.GAP_CLOSE_PX + 1),
        )
        binary = cv2.morphologyEx(binary.astype(np.uint8), cv2.MORPH_CLOSE, k).astype(bool)
        binary = binary & core
    binary = remove_small_objects(binary, min_size=config.MIN_COMPONENT_AREA_PX)

    res.metrics = {
        "color_px": int(road_color.sum()),
        "binary_px": int(binary.sum()),
    }

    skel = skeletonize(binary)
    res.metrics["skeleton_px"] = int(skel.sum())
    if skel.sum() == 0:
        res.rejected_mask = road_color & ~binary
        res.metrics.update(edges=0, length_world=0.0)
        return res

    graph = sknw.build_sknw(skel, multi=False)
    edges = _graph_to_edges(graph, h, dist, strength, paved_hint)

    # rejected = road-coloured pixels that did not survive to a kept edge
    res.rejected_mask = road_color & ~binary
    res.edges = edges
    res.kept_px = _edges_px(graph)
    res.metrics.update(
        edges=len(edges),
        length_world=round(sum(_chain_len_world(e.pts) for e in edges), 1),
    )
    return res


def _edges_px(graph):
    out = []
    for s, e in graph.edges():
        pts = graph[s][e]["pts"]  # Nx2 [y,x]
        out.append([(int(x), int(y)) for y, x in pts])
    return out


def _chain_len_px(pts_yx: np.ndarray) -> float:
    d = np.diff(pts_yx.astype(np.float64), axis=0)
    return float(np.hypot(d[:, 0], d[:, 1]).sum())


def _chain_len_world(pts_world) -> float:
    total = 0.0
    for a, b in zip(pts_world, pts_world[1:]):
        total += math.hypot(b[0] - a[0], b[1] - a[1])
    return total


def _graph_to_edges(graph, h: Hex, dist, strength, paved_hint) -> list[Edge]:
    import networkx as nx
    from shapely.geometry import LineString

    deg = dict(graph.degree())
    band = config.BORDER_BAND_PX

    def node_border(nid) -> bool:
        y, x = graph.nodes[nid]["o"]
        yi, xi = int(round(y)), int(round(x))
        if 0 <= yi < dist.shape[0] and 0 <= xi < dist.shape[1]:
            return dist[yi, xi] < band
        return True

    # Spur pruning: drop short dead-end edges not anchored at a border.
    to_remove = []
    for s, e in graph.edges():
        pts = graph[s][e]["pts"]
        length = _chain_len_px(pts)
        dead_end = deg.get(s, 0) == 1 or deg.get(e, 0) == 1
        border = node_border(s) or node_border(e)
        if dead_end and length < config.SPUR_LEN_PX and not border:
            to_remove.append((s, e))
        elif length < config.MIN_ROAD_LEN_PX and (deg.get(s, 0) == 1 and deg.get(e, 0) == 1) and not border:
            to_remove.append((s, e))
    for s, e in to_remove:
        if graph.has_edge(s, e):
            graph.remove_edge(s, e)

    edges: list[Edge] = []
    for s, e in list(graph.edges()):
        pts = graph[s][e]["pts"]  # Nx2 [y,x]
        if len(pts) < 2:
            continue
        line = LineString([(float(x), float(y)) for y, x in pts])
        simp = line.simplify(config.DP_EPSILON_PX, preserve_topology=False)
        coords_px = list(simp.coords)
        if len(coords_px) < 2:
            continue
        # length filter after simplification
        plen = sum(
            math.hypot(coords_px[i + 1][0] - coords_px[i][0],
                       coords_px[i + 1][1] - coords_px[i][1])
            for i in range(len(coords_px) - 1)
        )
        if plen < config.MIN_EDGE_LEN_PX:
            continue

        # confidence + paved fraction sampled along the original chain
        ys = np.clip(pts[:, 0].astype(int), 0, strength.shape[0] - 1)
        xs = np.clip(pts[:, 1].astype(int), 0, strength.shape[1] - 1)
        conf = float(strength[ys, xs].mean())
        paved_frac = float(paved_hint[ys, xs].mean())
        if conf < config.CONF_MIN_EMIT:
            continue

        world = [h.px_to_world(x, y) for x, y in coords_px]
        touches = node_border(s) or node_border(e)
        edges.append(Edge(pts=world, confidence=round(conf, 3),
                          paved_frac=round(paved_frac, 3), touches_border=touches))
    return edges
