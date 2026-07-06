import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalized } from '../i18n';
import { artilleryForFaction, solveFire } from '../lib/artillery';
import { refName } from '../lib/refs';
import { usePlanStore } from '../store/planStore';

/**
 * B4 — spotter-style artillery calculator: gun→spotter and spotter→target
 * measurements combined into the gun firing solution, checked against the
 * selected piece's wiki range.
 */
export function ArtilleryCalculator() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const faction = usePlanStore((s) => s.faction);
  const pieces = artilleryForFaction(faction);

  const [gunId, setGunId] = useState(pieces[0]?.id ?? '');
  const [gsDist, setGsDist] = useState(150);
  const [gsAz, setGsAz] = useState(0);
  const [stDist, setStDist] = useState(80);
  const [stAz, setStAz] = useState(90);

  const piece = pieces.find((p) => p.id === gunId) ?? pieces[0];
  const sol = solveFire(gsDist, gsAz, stDist, stAz);
  const inRange = piece && sol.distance >= piece.min && sol.distance <= piece.max;

  const inputCls =
    'bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-100 w-24 text-sm';

  const num = (v: number, set: (n: number) => void, min = 0, max = 9999) => (
    <input
      type="number" min={min} max={max} value={v}
      onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
      className={inputCls}
    />
  );

  return (
    <div className="space-y-3 text-sm">
      <select
        value={piece?.id ?? ''}
        onChange={(e) => setGunId(e.target.value)}
        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100 text-sm"
      >
        {pieces.map((p) => (
          <option key={p.id} value={p.id}>
            {localized(refName(p.id))} ({p.min}–{p.max} m)
          </option>
        ))}
      </select>

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1.5 items-center">
        <span className="text-slate-400 text-xs">{t('arty.gunToSpotter')}</span>
        {num(gsDist, setGsDist)}
        {num(gsAz, setGsAz, 0, 360)}
        <span className="text-slate-400 text-xs">{t('arty.spotterToTarget')}</span>
        {num(stDist, setStDist)}
        {num(stAz, setStAz, 0, 360)}
        <span />
        <span className="text-[10px] text-slate-500 text-center">m</span>
        <span className="text-[10px] text-slate-500 text-center">°</span>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${
        inRange ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'
      }`}>
        <div className="flex justify-between">
          <span className="text-slate-300">{t('arty.solution')}</span>
          <span className="font-mono text-lg text-slate-100">
            {sol.distance.toFixed(1)} m · {sol.azimuth.toFixed(1)}°
          </span>
        </div>
        {piece && !inRange && (
          <p className="text-xs text-red-300 mt-1">
            {t('arty.outOfRange', { min: piece.min, max: piece.max })}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-500">{t('arty.note')}</p>
    </div>
  );
}
