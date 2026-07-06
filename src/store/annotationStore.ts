import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PointKind = 'friendly' | 'enemy' | 'danger';
export type ArrowKind = 'arrowFriendly' | 'arrowEnemy';
export type StrokeKind = 'drawFriendly' | 'drawEnemy';

export type Annotation =
  | { id: string; kind: PointKind; pos: [number, number] }
  | { id: string; kind: ArrowKind; from: [number, number]; to: [number, number] }
  | { id: string; kind: StrokeKind; points: [number, number][] }
  | { id: string; kind: 'text'; pos: [number, number]; text: string };

export type ToolId = 'pan' | PointKind | ArrowKind | StrokeKind | 'text' | 'erase';

interface AnnotationState {
  annotations: Annotation[];
  tool: ToolId;
  setTool: (tool: ToolId) => void;
  addPoint: (kind: PointKind, pos: [number, number]) => void;
  addArrow: (kind: ArrowKind, from: [number, number], to: [number, number]) => void;
  addStroke: (kind: StrokeKind, points: [number, number][]) => void;
  addText: (pos: [number, number], text: string) => void;
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
      addStroke: (kind, points) =>
        set((s) => ({
          annotations: [...s.annotations, { id: crypto.randomUUID(), kind, points }],
        })),
      addText: (pos, text) =>
        set((s) => ({
          annotations: [...s.annotations, { id: crypto.randomUUID(), kind: 'text', pos, text }],
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
