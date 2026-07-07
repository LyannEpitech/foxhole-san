import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export interface LoadoutPreset {
  name: string;
  loadout: LoadoutRow[];
  support: SupportRow[];
}

interface AttackState {
  soldiers: number;
  loadout: LoadoutRow[];
  support: SupportRow[];
  /** Named reusable loadout presets ("assault infantry", "tank line"…). */
  presets: LoadoutPreset[];
  savePreset: (name: string) => void;
  applyPreset: (name: string) => void;
  deletePreset: (name: string) => void;
  /** Region under attack. */
  objectiveRegion: string | null;
  /** Region where the force assembles. */
  stagingRegion: string | null;
  /** B4 — artillery gun/target positions in world coordinates. */
  artyGun: [number, number] | null;
  artyTarget: [number, number] | null;
  setObjective: (regionId: string | null) => void;
  setStaging: (regionId: string | null) => void;
  setArtyGun: (pos: [number, number] | null) => void;
  setArtyTarget: (pos: [number, number] | null) => void;
  setSoldiers: (n: number) => void;
  addLoadoutRow: () => void;
  updateLoadoutRow: (index: number, row: LoadoutRow) => void;
  removeLoadoutRow: (index: number) => void;
  addSupportRow: () => void;
  updateSupportRow: (index: number, row: SupportRow) => void;
  removeSupportRow: (index: number) => void;
  applyDefaultLoadout: (faction: Exclude<Faction, 'Both'>) => void;
}

export const useAttackStore = create<AttackState>()(persist((set) => ({
  soldiers: 10,
  loadout: DEFAULT_LOADOUT.Colonial,
  support: [],
  presets: [],
  objectiveRegion: null,
  stagingRegion: null,
  artyGun: null,
  artyTarget: null,

  savePreset: (name) =>
    set((s) => ({
      presets: [
        ...s.presets.filter((p) => p.name !== name),
        { name, loadout: s.loadout, support: s.support },
      ],
    })),
  applyPreset: (name) =>
    set((s) => {
      const p = s.presets.find((x) => x.name === name);
      return p ? { loadout: p.loadout, support: p.support } : s;
    }),
  deletePreset: (name) =>
    set((s) => ({ presets: s.presets.filter((p) => p.name !== name) })),

  setObjective: (objectiveRegion) => set({ objectiveRegion }),
  setStaging: (stagingRegion) => set({ stagingRegion }),
  setArtyGun: (artyGun) => set({ artyGun }),
  setArtyTarget: (artyTarget) => set({ artyTarget }),
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
}), {
  name: 'fsak-attack',
  partialize: (s) => ({
    soldiers: s.soldiers,
    loadout: s.loadout,
    support: s.support,
    presets: s.presets,
    objectiveRegion: s.objectiveRegion,
    stagingRegion: s.stagingRegion,
    artyGun: s.artyGun,
    artyTarget: s.artyTarget,
  }),
}));
