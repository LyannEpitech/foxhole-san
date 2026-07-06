import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Region } from '../data/regions';
import { useAnnotationStore, type ToolId } from '../store/annotationStore';
import { useMapDataStore } from '../store/mapDataStore';
import { HexMap, type MapMarker } from './HexMap';
import { MapLayersControl } from './MapLayersControl';
import { useApiMarkers } from './useApiMarkers';
import { useRegionControl, useStaticLabels } from './useMapOverlays';

interface Props {
  onRegionClick?: (region: Region) => void;
  highlighted?: Map<string, string>;
  route?: string[];
  routeColor?: string;
  markers?: MapMarker[];
  /** Module-specific controls rendered under the tool palette overlay. */
  extraControls?: React.ReactNode;
}

/** Small 24x24 stroke icon used in the toolbar. */
function ToolIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const TOOL_ICONS: Record<Exclude<ToolId, never> | 'clear' | 'undo' | 'redo', React.ReactNode> = {
  pan: (
    <ToolIcon>
      <path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" />
    </ToolIcon>
  ),
  friendly: (
    <ToolIcon>
      <path d="M12 3l7 3v5c0 4.8-3.4 8.4-7 10-3.6-1.6-7-5.2-7-10V6z" />
    </ToolIcon>
  ),
  enemy: (
    <ToolIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8M16 8l-8 8" />
    </ToolIcon>
  ),
  danger: (
    <ToolIcon>
      <path d="M12 4l9 16H3z" />
      <path d="M12 11v4M12 17.6v.4" />
    </ToolIcon>
  ),
  arrowFriendly: (
    <ToolIcon>
      <path d="M5 19L17 7M17 7h-6M17 7v6" />
    </ToolIcon>
  ),
  arrowEnemy: (
    <ToolIcon>
      <path d="M5 19L17 7M17 7h-6M17 7v6" />
    </ToolIcon>
  ),
  drawFriendly: (
    <ToolIcon>
      <path d="M16.5 3.5l4 4L8 20l-5 1 1-5z" />
      <path d="M14 6l4 4" />
    </ToolIcon>
  ),
  drawEnemy: (
    <ToolIcon>
      <path d="M16.5 3.5l4 4L8 20l-5 1 1-5z" />
      <path d="M14 6l4 4" />
    </ToolIcon>
  ),
  text: (
    <ToolIcon>
      <path d="M5 6V4h14v2M12 4v16M9 20h6" />
    </ToolIcon>
  ),
  erase: (
    <ToolIcon>
      <path d="M15 4l6 6-9 9H7l-4-4a2 2 0 010-2.8z" />
      <path d="M10 9l5 5M21 19H11" />
    </ToolIcon>
  ),
  undo: (
    <ToolIcon>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </ToolIcon>
  ),
  redo: (
    <ToolIcon>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 000 12h3" />
    </ToolIcon>
  ),
  clear: (
    <ToolIcon>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
    </ToolIcon>
  ),
};

/** Toolbar layout: groups of tools separated visually. */
const TOOL_GROUPS: { id: ToolId; color: string }[][] = [
  [{ id: 'pan', color: 'text-slate-200' }],
  [
    { id: 'friendly', color: 'text-sky-400' },
    { id: 'enemy', color: 'text-red-400' },
    { id: 'danger', color: 'text-yellow-400' },
  ],
  [
    { id: 'arrowFriendly', color: 'text-sky-400' },
    { id: 'arrowEnemy', color: 'text-red-400' },
    { id: 'drawFriendly', color: 'text-sky-400' },
    { id: 'drawEnemy', color: 'text-red-400' },
    { id: 'text', color: 'text-slate-200' },
  ],
  [{ id: 'erase', color: 'text-slate-200' }],
];

/**
 * Fullscreen HexMap + planning chrome overlaid on the map: annotation tool
 * palette (top-left), War API layers and refresh (top-right), contextual
 * hints (bottom-left). Used by the logistics and attack planners.
 */
export function PlanMap({
  onRegionClick,
  highlighted,
  route,
  routeColor,
  markers,
  extraControls,
}: Props) {
  const { t } = useTranslation();
  const { annotations, tool, setTool, addPoint, addArrow, addStroke, addText, remove, clear,
    undo, redo, past, future } = useAnnotationStore();
  const apiMarkers = useApiMarkers();
  const { showControl, showLabels } = useMapDataStore();
  const regionTint = useRegionControl(showControl);
  const staticLabels = useStaticLabels(showLabels);

  // A2.2 — Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) for annotation undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const onAddPoint = (pos: [number, number]) => {
    if (tool === 'friendly' || tool === 'enemy' || tool === 'danger') addPoint(tool, pos);
  };
  const onAddArrow = (from: [number, number], to: [number, number]) => {
    if (tool === 'arrowFriendly' || tool === 'arrowEnemy') addArrow(tool, from, to);
  };
  const onAddStroke = (points: [number, number][]) => {
    if (tool === 'drawFriendly' || tool === 'drawEnemy') addStroke(tool, points);
  };

  return (
    <div className="absolute inset-0 bg-slate-950">
      <HexMap
        onRegionClick={onRegionClick}
        highlighted={highlighted}
        route={route}
        routeColor={routeColor}
        markers={markers}
        apiMarkers={apiMarkers}
        annotations={annotations}
        tool={tool}
        onAddPoint={onAddPoint}
        onAddArrow={onAddArrow}
        onAddStroke={onAddStroke}
        onAddText={addText}
        onEraseAnnotation={remove}
        textPlaceholder={t('map.textPlaceholder')}
        regionTint={regionTint}
        staticLabels={staticLabels}
      />

      {/* Top-left overlay: tool palette + module controls */}
      <div className="absolute top-2 left-2 z-10 space-y-2">
        <div className="flex flex-wrap items-center gap-2" role="toolbar">
          {TOOL_GROUPS.map((group, gi) => (
            <div
              key={gi}
              className="flex items-center gap-1 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg"
            >
              {group.map(({ id, color }) => (
                <button
                  key={id}
                  type="button"
                  title={t(`map.tool.${id}`)}
                  aria-label={t(`map.tool.${id}`)}
                  onClick={() => setTool(id)}
                  className={`w-9 h-9 flex items-center justify-center rounded-md ${color} ${
                    tool === id
                      ? 'bg-amber-500/20 ring-2 ring-amber-400'
                      : 'hover:bg-slate-700'
                  }`}
                >
                  {TOOL_ICONS[id]}
                </button>
              ))}
            </div>
          ))}
          {(past.length > 0 || future.length > 0) && (
            <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg">
              <button
                type="button"
                title={`${t('map.tool.undo')} (Ctrl+Z)`}
                onClick={undo}
                disabled={past.length === 0}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-200 hover:bg-slate-700 disabled:opacity-30"
              >
                {TOOL_ICONS.undo}
              </button>
              <button
                type="button"
                title={`${t('map.tool.redo')} (Ctrl+Y)`}
                onClick={redo}
                disabled={future.length === 0}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-200 hover:bg-slate-700 disabled:opacity-30"
              >
                {TOOL_ICONS.redo}
              </button>
            </div>
          )}
          {annotations.length > 0 && (
            <button
              type="button"
              title={t('map.tool.clear')}
              onClick={clear}
              className="h-9 px-2 flex items-center gap-1 rounded-lg border bg-slate-900/85 backdrop-blur border-slate-700 hover:bg-slate-700 text-red-300 text-xs shadow-lg"
            >
              {TOOL_ICONS.clear}
              {t('map.tool.clear')}
            </button>
          )}
        </div>
        {extraControls}

        {/* Layers + war data (in the left stack so the drawer never hides it) */}
        <MapLayersControl />

        {tool !== 'pan' && (
          <p className="inline-block text-xs text-amber-300 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-md px-2 py-1">
            {t(`map.tool.${tool}`)} — {t(`map.hint.${tool}`)}
          </p>
        )}
      </div>

      {/* Bottom-left hint */}
      <p className="absolute bottom-2 left-2 z-10 text-xs text-slate-400 bg-slate-900/80 backdrop-blur rounded-md px-2 py-1 max-w-md">
        {t('map.zoomHint')}
      </p>
    </div>
  );
}
