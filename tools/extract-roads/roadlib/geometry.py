"""Region geometry: layout loading and the pixel<->world projection.

The projection mirrors the app exactly (src/components/useApiMarkers.ts):
each hex PNG fills its polygon bounding box, so a pixel (px,py) maps to world
units via worldX = minX + (px/IMG_W)*(maxX-minX), and the inverse for masking.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass

import config


@dataclass
class Hex:
    id: str
    name: str
    polygon: list[tuple[float, float]]  # world units, y-down
    center: tuple[float, float]

    @property
    def min_x(self) -> float:
        return min(p[0] for p in self.polygon)

    @property
    def max_x(self) -> float:
        return max(p[0] for p in self.polygon)

    @property
    def min_y(self) -> float:
        return min(p[1] for p in self.polygon)

    @property
    def max_y(self) -> float:
        return max(p[1] for p in self.polygon)

    @property
    def world_w(self) -> float:
        return self.max_x - self.min_x

    @property
    def world_h(self) -> float:
        return self.max_y - self.min_y

    def px_to_world(self, px: float, py: float) -> tuple[float, float]:
        wx = self.min_x + (px / config.IMG_W) * self.world_w
        wy = self.min_y + (py / config.IMG_H) * self.world_h
        return wx, wy

    def world_to_px(self, wx: float, wy: float) -> tuple[float, float]:
        px = (wx - self.min_x) / self.world_w * config.IMG_W
        py = (wy - self.min_y) / self.world_h * config.IMG_H
        return px, py

    def polygon_px(self) -> list[tuple[float, float]]:
        return [self.world_to_px(x, y) for x, y in self.polygon]

    def world_per_px(self) -> float:
        """Average world units per pixel (x and y are near-isotropic)."""
        return 0.5 * (self.world_w / config.IMG_W + self.world_h / config.IMG_H)


def load_hexes(layout_path: str) -> list[Hex]:
    with open(layout_path, encoding="utf-8") as fh:
        raw = json.load(fh)
    return [
        Hex(
            id=r["id"],
            name=r["name"],
            polygon=[(float(p[0]), float(p[1])) for p in r["polygon"]],
            center=(float(r["center"][0]), float(r["center"][1])),
        )
        for r in raw
    ]


def _edges(poly: list[tuple[float, float]]):
    n = len(poly)
    for i in range(n):
        yield poly[i], poly[(i + 1) % n]


def _edge_key(a, b, q: float = 2.0):
    """Order-independent, quantised key for a polygon edge (shared borders)."""
    ax, ay = round(a[0] / q) * q, round(a[1] / q) * q
    bx, by = round(b[0] / q) * q, round(b[1] / q) * q
    p1, p2 = sorted([(ax, ay), (bx, by)])
    return (p1, p2)


def shared_borders(hexes: list[Hex]) -> dict[str, list[tuple]]:
    """Map each hex id -> list of world-space edges it shares with a neighbour."""
    by_edge: dict[tuple, list[str]] = {}
    edge_geom: dict[tuple, tuple] = {}
    for h in hexes:
        for a, b in _edges(h.polygon):
            k = _edge_key(a, b)
            by_edge.setdefault(k, []).append(h.id)
            edge_geom[k] = (a, b)
    out: dict[str, list[tuple]] = {h.id: [] for h in hexes}
    for k, ids in by_edge.items():
        if len(ids) >= 2:
            geom = edge_geom[k]
            for hid in ids:
                out[hid].append(geom)
    return out


def point_seg_dist(p, a, b) -> float:
    """Distance from point p to segment ab (world units)."""
    px, py = p
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)
