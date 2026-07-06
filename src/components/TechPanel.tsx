import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { useLocalized } from '../i18n';
import { useTechStore } from '../store/techStore';
import { useWarStore } from '../store/warStore';
import type { TechRequirement } from '../types/domain';

/** B5 — manual per-war tech checkboxes, gathered from every prerequisite
    the dataset references (buildings and structure items). */
export function TechPanel() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { warNumber, unlocked, toggle, syncWar } = useTechStore();
  const war = useWarStore((s) => s.war);

  useEffect(() => {
    if (war) syncWar(war.warNumber);
  }, [war, syncWar]);

  const techs = useMemo(() => {
    const byId = new Map<string, TechRequirement>();
    for (const b of dataset.buildings.values()) {
      for (const req of b.prerequisites) byId.set(req.techId, req);
    }
    for (const item of dataset.items.values()) {
      if (item.techRequirement) byId.set(item.techRequirement.techId, item.techRequirement);
    }
    return [...byId.values()];
  }, []);

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-slate-500">
        {t('tech.hint')}
        {warNumber !== null && ` (${t('war.chip', { number: warNumber })})`}
      </p>
      {techs.map((req) => (
        <label
          key={req.techId}
          className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-md px-3 py-1.5 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={!!unlocked[req.techId]}
            onChange={() => toggle(req.techId)}
            className="accent-emerald-400"
          />
          <span className={unlocked[req.techId] ? 'text-emerald-200' : 'text-slate-200'}>
            {localized(req.name)}
          </span>
        </label>
      ))}
    </div>
  );
}
