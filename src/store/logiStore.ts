import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CargoRow } from '../lib/logistics';

interface LogiState {
  cargo: CargoRow[];
  vehicleItemId: string | null;
  waypoints: string[];
  addCargoRow: () => void;
  updateCargoRow: (index: number, row: CargoRow) => void;
  removeCargoRow: (index: number) => void;
  /** Replace the whole manifest (used by the attack module export). */
  setCargo: (rows: CargoRow[]) => void;
  setVehicle: (itemId: string | null) => void;
  addWaypoint: (regionId: string) => void;
  removeWaypoint: (index: number) => void;
  moveWaypoint: (index: number, delta: -1 | 1) => void;
}

export const useLogiStore = create<LogiState>()(persist((set) => ({
  cargo: [],
  vehicleItemId: null,
  waypoints: [],

  addCargoRow: () => set((s) => ({ cargo: [...s.cargo, { itemId: '', qty: 1 }] })),
  updateCargoRow: (index, row) =>
    set((s) => ({ cargo: s.cargo.map((r, i) => (i === index ? row : r)) })),
  removeCargoRow: (index) =>
    set((s) => ({ cargo: s.cargo.filter((_, i) => i !== index) })),
  setCargo: (rows) => set({ cargo: rows }),
  setVehicle: (vehicleItemId) => set({ vehicleItemId }),

  addWaypoint: (regionId) => set((s) => ({ waypoints: [...s.waypoints, regionId] })),
  removeWaypoint: (index) =>
    set((s) => ({ waypoints: s.waypoints.filter((_, i) => i !== index) })),
  moveWaypoint: (index, delta) =>
    set((s) => {
      const target = index + delta;
      if (target < 0 || target >= s.waypoints.length) return s;
      const waypoints = [...s.waypoints];
      [waypoints[index], waypoints[target]] = [waypoints[target], waypoints[index]];
      return { waypoints };
    }),
}), {
  name: 'fsak-logi',
  partialize: (s) => ({ cargo: s.cargo, vehicleItemId: s.vehicleItemId, waypoints: s.waypoints }),
}));
