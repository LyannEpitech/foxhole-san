import { useEffect, useMemo, useState } from 'react';
import { REGIONS } from '../data/regions';
import { useMapDataStore } from '../store/mapDataStore';
import { useStaticStore } from '../store/staticStore';
import { useWarStore } from '../store/warStore';

/** Town-hall / relic-base icon types that define region ownership. */
const CONQUER_TYPES = new Set([45, 46, 47, 56, 57, 58]);

const TINTS: Record<string, string> = {
  WARDENS: 'rgba(37,99,235,0.20)',
  COLONIALS: 'rgba(22,163,74,0.20)',
};

/** B2 — per-region ownership tint from the majority of claimable bases. */
export function useRegionControl(enabled: boolean): Map<string, string> | undefined {
  const items = useMapDataStore((s) => s.items);
  return useMemo(() => {
    if (!enabled) return undefined;
    const tint = new Map<string, string>();
    for (const region of REGIONS) {
      const counts = { WARDENS: 0, COLONIALS: 0 };
      for (const it of items[region.id] ?? []) {
        if (!CONQUER_TYPES.has(it.iconType)) continue;
        if (it.teamId === 'WARDENS') counts.WARDENS++;
        else if (it.teamId === 'COLONIALS') counts.COLONIALS++;
      }
      if (counts.WARDENS === counts.COLONIALS) continue;
      tint.set(region.id, counts.WARDENS > counts.COLONIALS ? TINTS.WARDENS : TINTS.COLONIALS);
    }
    return tint;
  }, [enabled, items]);
}

export interface WorldLabel {
  x: number;
  y: number;
  text: string;
  major: boolean;
}

/** A2.1 — static town/field labels projected into world coordinates. */
export function useStaticLabels(enabled: boolean): WorldLabel[] | undefined {
  const war = useWarStore((s) => s.war);
  const fetchWarInfo = useWarStore((s) => s.fetch);
  const { labels, ensure } = useStaticStore();

  useEffect(() => {
    if (!enabled) return;
    void fetchWarInfo();
  }, [enabled, fetchWarInfo]);

  useEffect(() => {
    if (enabled && war) void ensure(war.warNumber);
  }, [enabled, war, ensure]);

  return useMemo(() => {
    if (!enabled) return undefined;
    const out: WorldLabel[] = [];
    for (const region of REGIONS) {
      const regionLabels = labels[region.id];
      if (!regionLabels) continue;
      const xs = region.polygon.map((p) => p[0]);
      const ys = region.polygon.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const w = Math.max(...xs) - minX;
      const h = Math.max(...ys) - minY;
      for (const l of regionLabels) {
        out.push({ x: minX + l.x * w, y: minY + l.y * h, text: l.text, major: l.major });
      }
    }
    return out;
  }, [enabled, labels]);
}

/** A polyline of a detected road, already in world coordinates. */
export interface RoadLine {
  points: [number, number][];
  /** Road class ("road", or "paved"/"dirt" if tiering is enabled). */
  cls: string;
  /** Mean ridge strength along the line (0..1); higher = more road-like. */
  confidence: number;
}

interface RoadGeoJSON {
  features: {
    geometry: { type: string; coordinates: number[][] };
    properties: { class?: string; confidence?: number };
  }[];
}

// Module-level cache so the (static) road network is fetched at most once.
let roadsCache: RoadLine[] | null = null;
let roadsPromise: Promise<RoadLine[]> | null = null;

function loadRoads(): Promise<RoadLine[]> {
  if (roadsCache) return Promise.resolve(roadsCache);
  if (!roadsPromise) {
    roadsPromise = fetch(`${import.meta.env.BASE_URL}roads.geojson`)
      .then((r) => (r.ok ? (r.json() as Promise<RoadGeoJSON>) : Promise.reject(r.status)))
      .then((gj) => {
        roadsCache = gj.features.map((f) => ({
          points: f.geometry.coordinates as [number, number][],
          cls: f.properties.class ?? 'road',
          confidence: f.properties.confidence ?? 1,
        }));
        return roadsCache;
      })
      .catch(() => {
        roadsPromise = null; // allow a later retry
        return [];
      });
  }
  return roadsPromise;
}

/**
 * Detected in-game road network (from tools/extract-roads), lazy-fetched from
 * public/roads.geojson the first time the layer is enabled. Coordinates are
 * already world units, so no projection is needed.
 */
export function useRoads(enabled: boolean): RoadLine[] | undefined {
  const [roads, setRoads] = useState<RoadLine[] | null>(roadsCache);
  useEffect(() => {
    if (!enabled || roads) return;
    let alive = true;
    void loadRoads().then((r) => alive && setRoads(r));
    return () => {
      alive = false;
    };
  }, [enabled, roads]);
  return enabled ? roads ?? undefined : undefined;
}

/** Overlay toggles shared by every map (persist-free, session state). */
export { TINTS as CONTROL_TINTS };
