import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { REGIONS } from '../data/regions';
import type { MapIconKind } from '../data/mapIcons';
import { fetchAllDynamic, type ApiMapItem } from '../lib/warapi';

interface MapDataState {
  /** regionId -> live map items from the War API. */
  items: Record<string, ApiMapItem[]>;
  loading: boolean;
  progress: [number, number] | null;
  loadedAt: number | null;
  error: string | null;
  /** Which marker families are displayed. */
  layers: Record<MapIconKind, boolean>;
  toggleLayer: (kind: MapIconKind) => void;
  /** B2/A2.1 — region ownership tint and static town labels. */
  showControl: boolean;
  showLabels: boolean;
  toggleControl: () => void;
  toggleLabels: () => void;
  /** Detected in-game road network overlay (public/roads.geojson). */
  showRoads: boolean;
  toggleRoads: () => void;
  /** Fetch all regions (no-op while already loading). */
  refresh: () => Promise<void>;
}

export const useMapDataStore = create<MapDataState>()(persist((set, get) => ({
  items: {},
  loading: false,
  progress: null,
  loadedAt: null,
  error: null,
  layers: { town: true, industry: true, field: true, military: true },
  showControl: false,
  showLabels: true,
  showRoads: false,

  toggleLayer: (kind) =>
    set((s) => ({ layers: { ...s.layers, [kind]: !s.layers[kind] } })),
  toggleControl: () => set((s) => ({ showControl: !s.showControl })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleRoads: () => set((s) => ({ showRoads: !s.showRoads })),

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, progress: [0, REGIONS.length], error: null });
    try {
      const items = await fetchAllDynamic(
        REGIONS.map((r) => r.id),
        (done, total) => set({ progress: [done, total] }),
      );
      set({ items, loadedAt: Date.now(), loading: false, progress: null });
    } catch (e) {
      set({
        loading: false,
        progress: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
}), {
  // B6 — keep the last war snapshot so the map still shows structures
  // offline (PWA); refreshed on the next successful fetch.
  name: 'fsak-mapdata',
  partialize: (s) => ({ items: s.items, loadedAt: s.loadedAt }),
}));
