import { create } from 'zustand';

export type ModuleId = 'production' | 'deploy' | 'logistics' | 'attack';

interface UiState {
  active: ModuleId;
  setActive: (module: ModuleId) => void;
}

export const useUiStore = create<UiState>((set) => ({
  active: 'production',
  setActive: (active) => set({ active }),
}));
