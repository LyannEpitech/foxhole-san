import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanSnapshot } from '../lib/snapshot';

interface SnapshotState {
  saved: PlanSnapshot[];
  save: (snap: PlanSnapshot) => void;
  remove: (name: string) => void;
}

/** A5.1 — named plan snapshots kept in localStorage. */
export const useSnapshotStore = create<SnapshotState>()(
  persist(
    (set) => ({
      saved: [],
      save: (snap) =>
        set((s) => ({ saved: [...s.saved.filter((x) => x.name !== snap.name), snap] })),
      remove: (name) => set((s) => ({ saved: s.saved.filter((x) => x.name !== name) })),
    }),
    { name: 'fsak-snapshots' },
  ),
);
