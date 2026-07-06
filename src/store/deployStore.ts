import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeployState {
  /** Placed node positions in world coordinates, keyed by stable node key. */
  positions: Record<string, [number, number]>;
  /** Chosen transport per edge key: item id or a generic label key. */
  transports: Record<string, string>;
  /** Node key currently armed for placement (next map click places it). */
  placing: string | null;
  /** Edge key currently selected (transport panel). */
  selectedEdge: string | null;
  setPlacing: (key: string | null) => void;
  place: (key: string, pos: [number, number]) => void;
  removeNode: (key: string) => void;
  selectEdge: (key: string | null) => void;
  setTransport: (edgeKey: string, transport: string) => void;
  reset: () => void;
}

export const useDeployStore = create<DeployState>()(
  persist(
    (set) => ({
      positions: {},
      transports: {},
      placing: null,
      selectedEdge: null,
      setPlacing: (placing) => set({ placing, selectedEdge: null }),
      place: (key, pos) =>
        set((s) => ({ positions: { ...s.positions, [key]: pos }, placing: null })),
      removeNode: (key) =>
        set((s) => {
          const positions = { ...s.positions };
          delete positions[key];
          return { positions };
        }),
      selectEdge: (selectedEdge) => set({ selectedEdge, placing: null }),
      setTransport: (edgeKey, transport) =>
        set((s) => ({ transports: { ...s.transports, [edgeKey]: transport } })),
      reset: () => set({ positions: {}, transports: {}, placing: null, selectedEdge: null }),
    }),
    {
      name: 'fsak-deploy',
      partialize: (s) => ({ positions: s.positions, transports: s.transports }),
    },
  ),
);
