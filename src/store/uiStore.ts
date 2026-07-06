import { create } from 'zustand';

export type ModuleId = 'production' | 'logistics' | 'attack';

interface UiState {
  active: ModuleId;
  setActive: (module: ModuleId) => void;
}

export const useUiStore = create<UiState>((set) => ({
  active: 'production',
  setActive: (active) => set({ active }),
}));
