import { create } from 'zustand';
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
  /** Fetch all regions (no-op while already loading). */
  refresh: () => Promise<void>;
}

export const useMapDataStore = create<MapDataState>((set, get) => ({
  items: {},
  loading: false,
  progress: null,
  loadedAt: null,
  error: null,
  layers: { town: true, industry: true, field: true, military: true },
  showControl: false,
  showLabels: true,

  toggleLayer: (kind) =>
    set((s) => ({ layers: { ...s.layers, [kind]: !s.layers[kind] } })),
  toggleControl: () => set((s) => ({ showControl: !s.showControl })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),

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
}));
