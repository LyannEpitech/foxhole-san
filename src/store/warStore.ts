import { create } from 'zustand';
import { fetchWar, type WarInfo } from '../lib/warapi';

interface WarState {
  war: WarInfo | null;
  fetched: boolean;
  fetch: () => Promise<void>;
}

/** B2 — current war metadata, fetched once per session. */
export const useWarStore = create<WarState>((set, get) => ({
  war: null,
  fetched: false,
  fetch: async () => {
    if (get().fetched) return;
    set({ fetched: true });
    try {
      set({ war: await fetchWar() });
    } catch {
      // Offline / API down: the header chip simply stays hidden.
    }
  },
}));

/** 1-based day of war derived from the conquest start time. */
export function dayOfWar(war: WarInfo): number | null {
  if (!war.conquestStartTime) return null;
  return Math.floor((Date.now() - war.conquestStartTime) / 86_400_000) + 1;
}
