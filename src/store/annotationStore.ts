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

const HISTORY_LIMIT = 50;

interface AnnotationState {
  annotations: Annotation[];
  /** Undo/redo stacks (session-only, not persisted). */
  past: Annotation[][];
  future: Annotation[][];
  tool: ToolId;
  setTool: (tool: ToolId) => void;
  addPoint: (kind: PointKind, pos: [number, number]) => void;
  addArrow: (kind: ArrowKind, from: [number, number], to: [number, number]) => void;
  addStroke: (kind: StrokeKind, points: [number, number][]) => void;
  addText: (pos: [number, number], text: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}

/** Record the current annotations in the past stack and apply the change. */
function commit(s: AnnotationState, annotations: Annotation[]) {
  return {
    annotations,
    past: [...s.past.slice(-(HISTORY_LIMIT - 1)), s.annotations],
    future: [],
  };
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set) => ({
      annotations: [],
      past: [],
      future: [],
      tool: 'pan',
      setTool: (tool) => set({ tool }),
      addPoint: (kind, pos) =>
        set((s) => commit(s, [...s.annotations, { id: crypto.randomUUID(), kind, pos }])),
      addArrow: (kind, from, to) =>
        set((s) => commit(s, [...s.annotations, { id: crypto.randomUUID(), kind, from, to }])),
      addStroke: (kind, points) =>
        set((s) => commit(s, [...s.annotations, { id: crypto.randomUUID(), kind, points }])),
      addText: (pos, text) =>
        set((s) => commit(s, [...s.annotations, { id: crypto.randomUUID(), kind: 'text', pos, text }])),
      remove: (id) =>
        set((s) => commit(s, s.annotations.filter((a) => a.id !== id))),
      clear: () => set((s) => commit(s, [])),
      undo: () =>
        set((s) => {
          if (s.past.length === 0) return s;
          const past = [...s.past];
          const annotations = past.pop()!;
          return { annotations, past, future: [s.annotations, ...s.future].slice(0, HISTORY_LIMIT) };
        }),
      redo: () =>
        set((s) => {
          if (s.future.length === 0) return s;
          const [annotations, ...future] = s.future;
          return { annotations, future, past: [...s.past.slice(-(HISTORY_LIMIT - 1)), s.annotations] };
        }),
    }),
    {
      name: 'fsak-annotations',
      partialize: (s) => ({ annotations: s.annotations }),
    },
  ),
);
