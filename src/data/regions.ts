// World map regions (hexes) with their in-world polygons.
// Geometry source: attrib/foxhole-map-annotate `public/static.json`
// (same 53 hexes as GET /api/worldconquest/maps on the official War API,
// fetched 2026-07-06). Y axis is flipped to match SVG coordinates.
import layout from './regionLayout.json';

export interface Region {
  id: string;
  name: string;
  /** Hex outline in world units, SVG orientation (y down). */
  polygon: [number, number][];
  center: [number, number];
}

export const REGIONS: Region[] = layout as Region[];

const byId = new Map(REGIONS.map((r) => [r.id, r]));

export function regionName(id: string): string {
  return byId.get(id)?.name ?? id;
}

export function getRegion(id: string): Region | undefined {
  return byId.get(id);
}

/** Bounding box of the whole world map: [minX, minY, width, height]. */
export const WORLD_BOUNDS: [number, number, number, number] = (() => {
  const xs = REGIONS.flatMap((r) => r.polygon.map((p) => p[0]));
  const ys = REGIONS.flatMap((r) => r.polygon.map((p) => p[1]));
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY];
})();
