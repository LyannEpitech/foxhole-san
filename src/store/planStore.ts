import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dataset } from '../data';
import { resolve, type PlanResult } from '../engine/resolver';
import type { Faction } from '../types/domain';

interface PlanState {
  targetId: string | null;
  quantity: number;
  faction: Exclude<Faction, 'Both'>;
  result: PlanResult | null;
  error: string | null;
  setTarget: (targetId: string | null) => void;
  setQuantity: (quantity: number) => void;
  setFaction: (faction: Exclude<Faction, 'Both'>) => void;
}

function compute(
  targetId: string | null,
  quantity: number,
  faction: Exclude<Faction, 'Both'>,
): Pick<PlanState, 'result' | 'error'> {
  if (!targetId) return { result: null, error: null };
  try {
    return { result: resolve(dataset, targetId, quantity, faction), error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export const usePlanStore = create<PlanState>()(persist((set, get) => ({
  targetId: null,
  quantity: 1,
  faction: 'Colonial',
  result: null,
  error: null,

  setTarget: (targetId) => {
    const { quantity, faction } = get();
    set({ targetId, ...compute(targetId, quantity, faction) });
  },
  setQuantity: (quantity) => {
    const { targetId, faction } = get();
    set({ quantity, ...compute(targetId, quantity, faction) });
  },
  setFaction: (faction) => {
    const { targetId, quantity } = get();
    // If the current target is not available to the new faction, drop it.
    const item = targetId ? dataset.items.get(targetId) : undefined;
    const keep = !item || item.faction === 'Both' || item.faction === faction;
    const nextTarget = keep ? targetId : null;
    set({ faction, targetId: nextTarget, ...compute(nextTarget, quantity, faction) });
  },
}), {
  name: 'fsak-plan',
  partialize: (s) => ({ targetId: s.targetId, quantity: s.quantity, faction: s.faction }),
  onRehydrateStorage: () => (state) => {
    // Recompute the plan for the restored target on page load.
    if (state?.targetId) {
      Object.assign(state, compute(state.targetId, state.quantity, state.faction));
    }
  },
}));
