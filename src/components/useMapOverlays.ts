import { useEffect, useMemo } from 'react';
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

/** Overlay toggles shared by every map (persist-free, session state). */
export { TINTS as CONTROL_TINTS };
