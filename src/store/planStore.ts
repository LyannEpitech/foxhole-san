import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dataset } from '../data';
import { resolveMany, type MultiPlanResult, type PlanTarget } from '../engine/resolver';
import type { Faction } from '../types/domain';

interface PlanState {
  /** A1.1 — the production order: several targets at once. */
  targets: PlanTarget[];
  faction: Exclude<Faction, 'Both'>;
  /** A1.2 — declared on-hand stock, deducted before computing batches. */
  stock: Record<string, number>;
  result: MultiPlanResult | null;
  error: string | null;
  addTarget: (refId: string) => void;
  updateTarget: (index: number, target: PlanTarget) => void;
  removeTarget: (index: number) => void;
  setTargets: (targets: PlanTarget[]) => void;
  setFaction: (faction: Exclude<Faction, 'Both'>) => void;
  setStock: (refId: string, qty: number) => void;
  removeStock: (refId: string) => void;
}

function compute(
  targets: PlanTarget[],
  faction: Exclude<Faction, 'Both'>,
  stock: Record<string, number>,
): Pick<PlanState, 'result' | 'error'> {
  const valid = targets.filter((t) => t.refId && t.qty > 0);
  if (valid.length === 0) return { result: null, error: null };
  try {
    return { result: resolveMany(dataset, valid, faction, { stock }), error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Drop targets that the new faction cannot produce. */
function factionFilter(targets: PlanTarget[], faction: Exclude<Faction, 'Both'>): PlanTarget[] {
  return targets.filter((t) => {
    const item = dataset.items.get(t.refId);
    return !item || item.faction === 'Both' || item.faction === faction;
  });
}

export const usePlanStore = create<PlanState>()(persist((set, get) => ({
  targets: [],
  faction: 'Colonial',
  stock: {},
  result: null,
  error: null,

  addTarget: (refId) => {
    const { targets, faction, stock } = get();
    const next = [...targets, { refId, qty: 1 }];
    set({ targets: next, ...compute(next, faction, stock) });
  },
  updateTarget: (index, target) => {
    const { targets, faction, stock } = get();
    const next = targets.map((t, i) => (i === index ? target : t));
    set({ targets: next, ...compute(next, faction, stock) });
  },
  removeTarget: (index) => {
    const { targets, faction, stock } = get();
    const next = targets.filter((_, i) => i !== index);
    set({ targets: next, ...compute(next, faction, stock) });
  },
  setTargets: (targets) => {
    const { faction, stock } = get();
    const next = factionFilter(targets, faction);
    set({ targets: next, ...compute(next, faction, stock) });
  },
  setFaction: (faction) => {
    const { targets, stock } = get();
    const next = factionFilter(targets, faction);
    set({ faction, targets: next, ...compute(next, faction, stock) });
  },
  setStock: (refId, qty) => {
    const { targets, faction, stock } = get();
    const next = { ...stock };
    if (qty > 0) next[refId] = qty;
    else delete next[refId];
    set({ stock: next, ...compute(targets, faction, next) });
  },
  removeStock: (refId) => {
    const { targets, faction, stock } = get();
    const next = { ...stock };
    delete next[refId];
    set({ stock: next, ...compute(targets, faction, next) });
  },
}), {
  name: 'fsak-plan',
  version: 2,
  partialize: (s) => ({ targets: s.targets, faction: s.faction, stock: s.stock }),
  migrate: (persisted: unknown, version) => {
    // v1 stored a single { targetId, quantity, faction }.
    if (version < 2 && persisted && typeof persisted === 'object') {
      const p = persisted as { targetId?: string | null; quantity?: number; faction?: string };
      return {
        targets: p.targetId ? [{ refId: p.targetId, qty: p.quantity ?? 1 }] : [],
        faction: p.faction === 'Warden' ? 'Warden' : 'Colonial',
        stock: {},
      };
    }
    return persisted;
  },
  onRehydrateStorage: () => (state) => {
    if (state && state.targets.length > 0) {
      Object.assign(state, compute(state.targets, state.faction, state.stock));
    }
  },
}));
