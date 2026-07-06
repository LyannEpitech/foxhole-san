import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MAP_ICONS, TEAM_COLORS, type MapIconKind } from '../data/mapIcons';
import { REGIONS, type Region } from '../data/regions';
import { useLocalized } from '../i18n';
import { useAnnotationStore, type ToolId } from '../store/annotationStore';
import { useMapDataStore } from '../store/mapDataStore';
import { HexMap, type ApiMarker, type MapMarker } from './HexMap';

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

const TOOL_ICONS: Record<Exclude<ToolId, never> | 'clear', React.ReactNode> = {
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

const LAYERS: MapIconKind[] = ['town', 'industry', 'field', 'military'];

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
  const localized = useLocalized();
  const { items, loading, progress, loadedAt, layers, toggleLayer, refresh } = useMapDataStore();
  const { annotations, tool, setTool, addPoint, addArrow, addStroke, addText, remove, clear } =
    useAnnotationStore();

  // Load live war data once per session.
  useEffect(() => {
    if (!loadedAt) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // War API flags bitmask (see clapfoot/warapi README).
  const FLAG_VICTORY_BASE = 0x01;
  const FLAG_SCORCHED = 0x10;

  // Project API items (bbox fractions) into world coordinates, with all
  // tooltip strings pre-localized.
  const apiMarkers: ApiMarker[] = useMemo(() => {
    const out: ApiMarker[] = [];
    for (const region of REGIONS) {
      const regionItems = items[region.id];
      if (!regionItems) continue;
      const xs = region.polygon.map((p) => p[0]);
      const ys = region.polygon.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const w = Math.max(...xs) - minX;
      const h = Math.max(...ys) - minY;
      for (const item of regionItems) {
        const def = MAP_ICONS[item.iconType];
        if (!def || !layers[def.kind]) continue;
        const badges: string[] = [];
        if (item.flags & FLAG_VICTORY_BASE) badges.push(t('map.tooltip.victory'));
        if (item.flags & FLAG_SCORCHED) badges.push(t('map.tooltip.scorched'));
        out.push({
          x: minX + item.x * w,
          y: minY + item.y * h,
          iconUrl: `${import.meta.env.BASE_URL}icons/${def.icon}.png`,
          ringColor: TEAM_COLORS[item.teamId] ?? TEAM_COLORS.NONE,
          label: localized(def.label),
          kindLabel: t(`map.layer.${def.kind}`),
          regionName: region.name,
          factionLabel:
            item.teamId === 'WARDENS'
              ? t('faction.Warden')
              : item.teamId === 'COLONIALS'
                ? t('faction.Colonial')
                : t('map.tooltip.neutral'),
          badges,
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, layers, localized, t]);

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
        <div className="inline-flex items-center gap-2 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
          {LAYERS.map((kind) => (
            <label key={kind} className="flex items-center gap-1 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={layers[kind]}
                onChange={() => toggleLayer(kind)}
                className="accent-amber-500"
              />
              {t(`map.layer.${kind}`)}
            </label>
          ))}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="h-7 px-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs disabled:opacity-50"
          >
            {loading && progress
              ? `${t('map.loading')} ${progress[0]}/${progress[1]}`
              : `⟳ ${t('map.refresh')}`}
          </button>
        </div>

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
