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
}

const TOOLS: { id: ToolId; glyph: string; color: string }[] = [
  { id: 'pan', glyph: '✋', color: 'text-slate-200' },
  { id: 'friendly', glyph: '⬤', color: 'text-sky-400' },
  { id: 'enemy', glyph: '✖', color: 'text-red-400' },
  { id: 'danger', glyph: '⚠', color: 'text-yellow-400' },
  { id: 'arrowFriendly', glyph: '↗', color: 'text-sky-400' },
  { id: 'arrowEnemy', glyph: '↗', color: 'text-red-400' },
  { id: 'erase', glyph: '⌫', color: 'text-slate-200' },
];

const LAYERS: MapIconKind[] = ['town', 'industry', 'field', 'military'];

/**
 * HexMap + shared planning chrome: annotation tool palette, War API layer
 * toggles and refresh. Used by the logistics and attack planners.
 */
export function PlanMap({ onRegionClick, highlighted, route, routeColor, markers }: Props) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { items, loading, progress, loadedAt, layers, toggleLayer, refresh } = useMapDataStore();
  const { annotations, tool, setTool, addPoint, addArrow, remove, clear } = useAnnotationStore();

  // Load live war data once per session.
  useEffect(() => {
    if (!loadedAt) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Project API items (bbox fractions) into world coordinates.
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
        out.push({
          x: minX + item.x * w,
          y: minY + item.y * h,
          iconUrl: `/icons/${def.icon}.png`,
          ringColor: TEAM_COLORS[item.teamId] ?? TEAM_COLORS.NONE,
          title: `${localized(def.label)} — ${region.name}`,
        });
      }
    }
    return out;
  }, [items, layers, localized]);

  const onAddPoint = (pos: [number, number]) => {
    if (tool === 'friendly' || tool === 'enemy' || tool === 'danger') addPoint(tool, pos);
  };
  const onAddArrow = (from: [number, number], to: [number, number]) => {
    if (tool === 'arrowFriendly' || tool === 'arrowEnemy') addArrow(tool, from, to);
  };

  return (
    <div>
      {/* Toolbar: annotation tools + layers + war data */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2 text-sm">
        <div className="flex items-center gap-1" role="toolbar">
          {TOOLS.map(({ id, glyph, color }) => (
            <button
              key={id}
              type="button"
              title={t(`map.tool.${id}`)}
              onClick={() => setTool(id)}
              className={`w-8 h-8 rounded-md border text-base leading-none ${color} ${
                tool === id
                  ? 'bg-slate-600 border-amber-400'
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {glyph}
            </button>
          ))}
          {annotations.length > 0 && (
            <button
              type="button"
              title={t('map.tool.clear')}
              onClick={clear}
              className="h-8 px-2 rounded-md border bg-slate-800 border-slate-700 hover:bg-slate-700 text-red-300 text-xs"
            >
              🗑 {t('map.tool.clear')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
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
            className="h-8 px-3 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs disabled:opacity-50"
          >
            {loading && progress
              ? `${t('map.loading')} ${progress[0]}/${progress[1]}`
              : `⟳ ${t('map.refresh')}`}
          </button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
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
          onEraseAnnotation={remove}
        />
      </div>
      <p className="text-xs text-slate-500 mt-1">{t('map.zoomHint')}</p>
    </div>
  );
}
