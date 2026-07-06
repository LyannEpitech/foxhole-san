import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { REGIONS } from '../data/regions';
import { fetchRegionStatic, type StaticLabel } from '../lib/warapi';

interface StaticState {
  /** War number the cache was built for (labels change once per war). */
  warNumber: number | null;
  labels: Record<string, StaticLabel[]>;
  loading: boolean;
  /** Fetch all 53 regions' labels unless the cache is already fresh. */
  ensure: (warNumber: number) => Promise<void>;
}

/** A2.1 — static town/field names, cached in localStorage per war. */
export const useStaticStore = create<StaticState>()(
  persist(
    (set, get) => ({
      warNumber: null,
      labels: {},
      loading: false,
      ensure: async (warNumber) => {
        const s = get();
        if (s.loading || (s.warNumber === warNumber && Object.keys(s.labels).length > 0)) return;
        set({ loading: true });
        const labels: Record<string, StaticLabel[]> = {};
        const queue = REGIONS.map((r) => r.id);
        await Promise.all(
          Array.from({ length: 8 }, async () => {
            for (;;) {
              const id = queue.shift();
              if (!id) return;
              try {
                labels[id] = await fetchRegionStatic(id);
              } catch {
                labels[id] = [];
              }
            }
          }),
        );
        set({ warNumber, labels, loading: false });
      },
    }),
    { name: 'fsak-static', partialize: (s) => ({ warNumber: s.warNumber, labels: s.labels }) },
  ),
);
