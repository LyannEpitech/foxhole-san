import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MAP_ICONS, TEAM_COLORS } from '../data/mapIcons';
import { REGIONS } from '../data/regions';
import { useLocalized } from '../i18n';
import { useMapDataStore } from '../store/mapDataStore';
import type { ApiMarker } from './HexMap';

/**
 * Live War API structures (towns, industry, resource fields, military)
 * projected into world coordinates, honoring the layer toggles.
 * Triggers one fetch per session on first use.
 */
export function useApiMarkers(): ApiMarker[] {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { items, loadedAt, layers, refresh } = useMapDataStore();

  useEffect(() => {
    if (!loadedAt) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const FLAG_VICTORY_BASE = 0x01;
  const FLAG_BUILD_SITE = 0x04;
  const FLAG_SCORCHED = 0x10;

  return useMemo(() => {
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
        if (item.flags & FLAG_BUILD_SITE) badges.push(t('map.tooltip.buildSite'));
        if (item.flags & FLAG_SCORCHED) badges.push(t('map.tooltip.scorched'));
        out.push({
          iconType: item.iconType,
          buildSite: (item.flags & FLAG_BUILD_SITE) !== 0,
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
     
  }, [items, layers, localized, t]);
}
