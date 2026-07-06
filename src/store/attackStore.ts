import { create } from 'zustand';
import type { Faction } from '../types/domain';

export interface LoadoutRow {
  itemId: string;
  perSoldier: number;
}

export interface SupportRow {
  itemId: string;
  qty: number;
}

const DEFAULT_LOADOUT: Record<Exclude<Faction, 'Both'>, LoadoutRow[]> = {
  Colonial: [
    { itemId: 'argenti-rii-rifle', perSoldier: 1 },
    { itemId: '762mm', perSoldier: 3 },
    { itemId: 'bomastone-grenade', perSoldier: 2 },
  ],
  Warden: [
    { itemId: 'no2-loughcaster', perSoldier: 1 },
    { itemId: '762mm', perSoldier: 3 },
    { itemId: 'a3-harpa-fragmentation-grenade', perSoldier: 2 },
  ],
};

interface AttackState {
  soldiers: number;
  loadout: LoadoutRow[];
  support: SupportRow[];
  /** Region under attack. */
  objectiveRegion: string | null;
  /** Region where the force assembles. */
  stagingRegion: string | null;
  setObjective: (regionId: string | null) => void;
  setStaging: (regionId: string | null) => void;
  setSoldiers: (n: number) => void;
  addLoadoutRow: () => void;
  updateLoadoutRow: (index: number, row: LoadoutRow) => void;
  removeLoadoutRow: (index: number) => void;
  addSupportRow: () => void;
  updateSupportRow: (index: number, row: SupportRow) => void;
  removeSupportRow: (index: number) => void;
  applyDefaultLoadout: (faction: Exclude<Faction, 'Both'>) => void;
}

export const useAttackStore = create<AttackState>((set) => ({
  soldiers: 10,
  loadout: DEFAULT_LOADOUT.Colonial,
  support: [],
  objectiveRegion: null,
  stagingRegion: null,

  setObjective: (objectiveRegion) => set({ objectiveRegion }),
  setStaging: (stagingRegion) => set({ stagingRegion }),
  setSoldiers: (soldiers) => set({ soldiers: Math.max(1, soldiers) }),

  addLoadoutRow: () => set((s) => ({ loadout: [...s.loadout, { itemId: '', perSoldier: 1 }] })),
  updateLoadoutRow: (index, row) =>
    set((s) => ({ loadout: s.loadout.map((r, i) => (i === index ? row : r)) })),
  removeLoadoutRow: (index) =>
    set((s) => ({ loadout: s.loadout.filter((_, i) => i !== index) })),

  addSupportRow: () => set((s) => ({ support: [...s.support, { itemId: '', qty: 1 }] })),
  updateSupportRow: (index, row) =>
    set((s) => ({ support: s.support.map((r, i) => (i === index ? row : r)) })),
  removeSupportRow: (index) =>
    set((s) => ({ support: s.support.filter((_, i) => i !== index) })),

  applyDefaultLoadout: (faction) => set({ loadout: DEFAULT_LOADOUT[faction] }),
}));
