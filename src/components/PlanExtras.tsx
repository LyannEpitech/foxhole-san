import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { DIESEL_POWER_PLANT } from '../data/power';
import type { PlanSummary } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { costEntries, refName } from '../lib/refs';

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m}min ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** ⏱ Per-building production queue durations + makespan. */
export function TimelinePanel({ result }: { result: PlanSummary }) {
  const { t } = useTranslation();
  const localized = useLocalized();

  if (result.buildingTimes.length === 0) {
    return <p className="text-sm text-slate-500">{t('timeline.none')}</p>;
  }
  const makespan = result.buildingTimes.reduce((max, bt) => Math.max(max, bt.seconds), 0);

  return (
    <div className="space-y-2 text-sm">
      {result.buildingTimes.map((bt) => {
        const building = dataset.buildings.get(bt.buildingId);
        return (
          <div key={bt.buildingId} className="flex justify-between gap-4">
            <span className="text-slate-200">
              {building ? localized(building.name) : bt.buildingId}
            </span>
            <span className="font-mono text-amber-300">{formatDuration(bt.seconds)}</span>
          </div>
        );
      })}
      <div className="flex justify-between gap-4 border-t border-slate-700 pt-2">
        <span className="text-slate-300">{t('timeline.makespan')}</span>
        <span className="font-mono text-amber-300">{formatDuration(makespan)}</span>
      </div>
      {result.timesIncomplete && (
        <p className="text-xs text-yellow-400/80">⚠ {t('timeline.incomplete')}</p>
      )}
    </div>
  );
}

/** ⚡ Grid load, generators and diesel for facility chains. */
export function EnergyPanel({ result }: { result: PlanSummary }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const power = result.power;

  if (!power) {
    return <p className="text-sm text-slate-500">{t('energy.none')}</p>;
  }

  const rows: [string, string][] = [
    [t('energy.load'), `${power.totalMW} MW`],
    [
      t('energy.plants'),
      `${power.plants} × ${localized(DIESEL_POWER_PLANT.name)} (${costEntries(power.plantCost)
        .map(([refId, qty]) => `${qty} ${localized(refName(refId))}`)
        .join(' + ')})`,
    ],
    [t('energy.fuelRate'), `${Math.round(power.fuelLitersPerHour)} L/h`],
  ];
  if (power.durationHours !== null) {
    rows.push([t('energy.duration'), formatDuration(power.durationHours * 3600)]);
  }
  if (power.fuelLitersTotal !== null) {
    rows.push([t('energy.fuelTotal'), `${power.fuelLitersTotal} L`]);
  }
  if (power.fuelSalvage !== null) {
    rows.push([t('energy.fuelSalvage'), `${power.fuelSalvage}`]);
  }

  return (
    <div className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <span className="text-slate-300">{label}</span>
          <span className="font-mono text-amber-300 text-right">{value}</span>
        </div>
      ))}
      <p className="text-xs text-slate-500">{t('energy.note')}</p>
    </div>
  );
}
