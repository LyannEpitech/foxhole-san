"""Cross-hex seam stitching + GeoJSON assembly.

Endpoints of border-touching edges from two different hexes that fall within a
world-space snap radius are moved to their shared midpoint, so the road network
is continuous across the 53 tiles.
"""
from __future__ import annotations

import math

import config
from .geometry import Hex, point_seg_dist, shared_borders
from .pipeline import Edge, HexResult


def _endpoint_tangent(pts, at_start: bool) -> float:
    if len(pts) < 2:
        return 0.0
    if at_start:
        a, b = pts[min(2, len(pts) - 1)], pts[0]
    else:
        a, b = pts[-1 - min(2, len(pts) - 1)], pts[-1]
    return math.atan2(b[1] - a[1], b[0] - a[0])


def _angle_ok(t1: float, t2: float) -> bool:
    d = abs((t1 - t2 + math.pi) % (2 * math.pi) - math.pi)
    d = min(d, math.pi - d)  # collinear if near 0 or near pi
    return math.degrees(d) <= config.SEAM_ANGLE_DEG


def stitch(results: list[HexResult], hexes: dict[str, Hex]) -> int:
    borders = shared_borders(list(hexes.values()))

    # Collect border endpoints: (result, edge, which_end, world_pt, tangent).
    eps = []
    for res in results:
        h = hexes[res.hex_id]
        band = config.BORDER_BAND_PX * h.world_per_px()
        my_borders = borders.get(res.hex_id, [])
        if not my_borders:
            continue
        for edge in res.edges:
            for which, pt in ((0, edge.pts[0]), (1, edge.pts[-1])):
                near = any(point_seg_dist(pt, a, b) <= band for a, b in my_borders)
                if near:
                    tan = _endpoint_tangent(edge.pts, which == 0)
                    eps.append([res.hex_id, edge, which, pt, tan])

    snapped = 0
    used = [False] * len(eps)
    for i in range(len(eps)):
        if used[i]:
            continue
        hid_i, edge_i, which_i, pt_i, tan_i = eps[i]
        snap_r = config.SEAM_SNAP_PX * hexes[hid_i].world_per_px()
        best_j, best_d = -1, snap_r
        for j in range(len(eps)):
            if used[j] or j == i:
                continue
            hid_j, edge_j, which_j, pt_j, tan_j = eps[j]
            if hid_j == hid_i:
                continue
            d = math.hypot(pt_i[0] - pt_j[0], pt_i[1] - pt_j[1])
            if d <= best_d and _angle_ok(tan_i, tan_j):
                best_j, best_d = j, d
        if best_j >= 0:
            hid_j, edge_j, which_j, pt_j, tan_j = eps[best_j]
            mx = (pt_i[0] + pt_j[0]) / 2.0
            my = (pt_i[1] + pt_j[1]) / 2.0
            _set_endpoint(edge_i, which_i, (mx, my))
            _set_endpoint(edge_j, which_j, (mx, my))
            edge_i.touches_border = True
            edge_j.touches_border = True
            edge_i._crosses = True
            edge_j._crosses = True
            used[i] = used[best_j] = True
            snapped += 1
    return snapped


def _set_endpoint(edge: Edge, which: int, pt):
    if which == 0:
        edge.pts[0] = pt
    else:
        edge.pts[-1] = pt


def _edge_class(edge: Edge) -> str:
    if not config.TIERS:
        return "road"
    return "paved" if edge.paved_frac >= config.TIER_PAVED_VOTE else "dirt"


def to_geojson(results: list[HexResult], generated_at: str) -> dict:
    features = []
    for res in results:
        for edge in res.edges:
            coords = [[int(round(x)), int(round(y))] for x, y in edge.pts]
            # drop degenerate lines produced by snapping
            dedup = [coords[0]]
            for c in coords[1:]:
                if c != dedup[-1]:
                    dedup.append(c)
            if len(dedup) < 2:
                continue
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": dedup},
                "properties": {
                    "region": res.hex_id,
                    "class": _edge_class(edge),
                    "confidence": edge.confidence,
                    "crossesBorder": bool(getattr(edge, "_crosses", False)),
                },
            })
    return {
        "type": "FeatureCollection",
        "properties": {
            "crs": "foxhole-world-units",
            "note": "Coordinates are Foxhole world units (y-down), NOT lon/lat. "
                    "Do not feed to WGS84 tooling.",
            "kmPerUnit": config.KM_PER_UNIT,
            "generatedBy": "tools/extract-roads",
            "generatedAt": generated_at,
            "params": {
                "deltaEPaved": config.DE_ROAD_PAVED,
                "deltaEDirt": config.DE_ROAD_DIRT,
                "frangiSigmas": config.FRANGI_SIGMAS,
                "frangiT": config.FRANGI_T,
                "tophatT": config.TOPHAT_T,
                "dpEpsilon": config.DP_EPSILON_PX,
                "tiers": config.TIERS,
            },
        },
        "features": features,
    }
