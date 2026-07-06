import { useTranslation } from 'react-i18next';
import type { MapIconKind } from '../data/mapIcons';
import { useMapDataStore } from '../store/mapDataStore';

const LAYERS: MapIconKind[] = ['town', 'industry', 'field', 'military'];

/** War API layer toggles + refresh chip, overlayable on any map. */
export function MapLayersControl() {
  const { t } = useTranslation();
  const {
    loading, progress, layers, toggleLayer, refresh,
    showControl, showLabels, toggleControl, toggleLabels,
  } = useMapDataStore();

  return (
    <div className="inline-flex flex-wrap items-center gap-2 bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
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
      <label className="flex items-center gap-1 text-xs text-slate-300">
        <input type="checkbox" checked={showControl} onChange={toggleControl} className="accent-amber-500" />
        {t('map.layer.control')}
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-300">
        <input type="checkbox" checked={showLabels} onChange={toggleLabels} className="accent-amber-500" />
        {t('map.layer.labels')}
      </label>
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
  );
}
