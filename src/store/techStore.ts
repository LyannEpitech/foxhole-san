import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TechState {
  /** War the checkboxes belong to — reset automatically on a new war. */
  warNumber: number | null;
  unlocked: Record<string, boolean>;
  toggle: (techId: string) => void;
  /** Align with the live war number, wiping progress when it changes. */
  syncWar: (warNumber: number) => void;
}

/** B5 — per-war faction tech tracker (manual checkboxes). */
export const useTechStore = create<TechState>()(
  persist(
    (set) => ({
      warNumber: null,
      unlocked: {},
      toggle: (techId) =>
        set((s) => ({ unlocked: { ...s.unlocked, [techId]: !s.unlocked[techId] } })),
      syncWar: (warNumber) =>
        set((s) => (s.warNumber === warNumber ? s : { warNumber, unlocked: {} })),
    }),
    { name: 'fsak-tech' },
  ),
);
