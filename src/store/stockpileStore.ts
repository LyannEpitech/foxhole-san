import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** In-game stockpile reservations expire after 50 hours. */
export const STOCKPILE_TTL_MS = 50 * 3600 * 1000;

export interface Stockpile {
  id: string;
  name: string;
  regionId: string | null;
  /** Reservation expiry (null = untracked). */
  expiresAt: number | null;
  items: Record<string, number>;
}

interface StockpileState {
  stockpiles: Stockpile[];
  add: (name: string) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  setRegion: (id: string, regionId: string | null) => void;
  setItem: (id: string, refId: string, qty: number) => void;
  /** Reset the 50 h reservation timer (as after an in-game refresh). */
  refreshTimer: (id: string) => void;
}

/** B1 — manual stockpile tracker with expiry timers. */
export const useStockpileStore = create<StockpileState>()(
  persist(
    (set) => ({
      stockpiles: [],
      add: (name) =>
        set((s) => ({
          stockpiles: [
            ...s.stockpiles,
            {
              id: crypto.randomUUID(),
              name,
              regionId: null,
              expiresAt: Date.now() + STOCKPILE_TTL_MS,
              items: {},
            },
          ],
        })),
      remove: (id) => set((s) => ({ stockpiles: s.stockpiles.filter((p) => p.id !== id) })),
      rename: (id, name) =>
        set((s) => ({ stockpiles: s.stockpiles.map((p) => (p.id === id ? { ...p, name } : p)) })),
      setRegion: (id, regionId) =>
        set((s) => ({ stockpiles: s.stockpiles.map((p) => (p.id === id ? { ...p, regionId } : p)) })),
      setItem: (id, refId, qty) =>
        set((s) => ({
          stockpiles: s.stockpiles.map((p) => {
            if (p.id !== id) return p;
            const items = { ...p.items };
            if (qty > 0) items[refId] = qty;
            else delete items[refId];
            return { ...p, items };
          }),
        })),
      refreshTimer: (id) =>
        set((s) => ({
          stockpiles: s.stockpiles.map((p) =>
            p.id === id ? { ...p, expiresAt: Date.now() + STOCKPILE_TTL_MS } : p,
          ),
        })),
    }),
    { name: 'fsak-stockpiles' },
  ),
);

/** Sum of every stockpile's contents, for plan-stock deduction. */
export function aggregateStockpiles(stockpiles: Stockpile[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of stockpiles) {
    for (const [refId, qty] of Object.entries(p.items)) {
      out[refId] = (out[refId] ?? 0) + qty;
    }
  }
  return out;
}
