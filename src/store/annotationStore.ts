import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PointKind = 'friendly' | 'enemy' | 'danger';
export type ArrowKind = 'arrowFriendly' | 'arrowEnemy';

export type Annotation =
  | { id: string; kind: PointKind; pos: [number, number] }
  | { id: string; kind: ArrowKind; from: [number, number]; to: [number, number] };

export type ToolId = 'pan' | PointKind | ArrowKind | 'erase';

interface AnnotationState {
  annotations: Annotation[];
  tool: ToolId;
  setTool: (tool: ToolId) => void;
  addPoint: (kind: PointKind, pos: [number, number]) => void;
  addArrow: (kind: ArrowKind, from: [number, number], to: [number, number]) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set) => ({
      annotations: [],
      tool: 'pan',
      setTool: (tool) => set({ tool }),
      addPoint: (kind, pos) =>
        set((s) => ({
          annotations: [...s.annotations, { id: crypto.randomUUID(), kind, pos }],
        })),
      addArrow: (kind, from, to) =>
        set((s) => ({
          annotations: [...s.annotations, { id: crypto.randomUUID(), kind, from, to }],
        })),
      remove: (id) =>
        set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),
      clear: () => set({ annotations: [] }),
    }),
    {
      name: 'fsak-annotations',
      partialize: (s) => ({ annotations: s.annotations }),
    },
  ),
);
