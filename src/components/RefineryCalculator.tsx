import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { useLocalized } from '../i18n';
import { refName } from '../lib/refs';
import { formatDuration, formatReadyAt, toLocalInputValue } from './PlanExtras';

/**
 * B3 — Standalone refinery queue calculator: "N salvage → bmats, started at
 * HH:MM → ready at HH:MM", with parallel queues and an optional browser
 * notification when the queue completes (while the tab stays open).
 */
export function RefineryCalculator() {
  const { t, i18n } = useTranslation();
  const localized = useLocalized();

  const recipes = useMemo(
    () => dataset.recipes.filter((r) => r.buildingId === 'refinery' && r.timeSeconds > 0),
    [],
  );
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? '');
  const [rawQty, setRawQty] = useState(1000);
  const [queues, setQueues] = useState(1);
  const [start, setStart] = useState(() => new Date());
  const [notifyState, setNotifyState] = useState<'idle' | 'scheduled' | 'denied'>('idle');

  const recipe = recipes.find((r) => r.id === recipeId);
  const inputCls =
    'bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100';

  if (!recipe) return null;
  const input = recipe.inputs[0];
  const output = recipe.outputs[0];
  const batches = Math.floor(rawQty / input.qty);
  const produced = batches * output.qty;
  const seconds = (batches * recipe.timeSeconds) / Math.max(1, queues);
  const readyAt = new Date(start.getTime() + seconds * 1000);

  const scheduleNotification = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      setNotifyState('denied');
      return;
    }
    const ms = readyAt.getTime() - Date.now();
    window.setTimeout(() => {
      new Notification(t('refinery.notifTitle'), {
        body: t('refinery.notifBody', {
          qty: produced,
          name: localized(refName(output.refId)),
        }),
      });
    }, Math.max(0, ms));
    setNotifyState('scheduled');
  };

  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="flex flex-col gap-1 text-slate-300">
        {t('refinery.recipe')}
        <select
          value={recipeId}
          onChange={(e) => { setRecipeId(e.target.value); setNotifyState('idle'); }}
          className={inputCls}
        >
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {localized(refName(r.inputs[0].refId))} → {localized(refName(r.outputs[0].refId))}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-slate-300">
        {t('refinery.rawAmount')}
        <input
          type="number" min={1} value={rawQty}
          onChange={(e) => { setRawQty(Math.max(1, Number(e.target.value) || 1)); setNotifyState('idle'); }}
          className={`${inputCls} w-28`}
        />
      </label>
      <label className="flex flex-col gap-1 text-slate-300">
        {t('refinery.queues')}
        <input
          type="number" min={1} max={10} value={queues}
          onChange={(e) => { setQueues(Math.min(10, Math.max(1, Number(e.target.value) || 1))); setNotifyState('idle'); }}
          className={`${inputCls} w-20`}
        />
      </label>
      <label className="flex flex-col gap-1 text-slate-300">
        {t('timeline.start')}
        <input
          type="datetime-local"
          value={toLocalInputValue(start)}
          onChange={(e) => { if (e.target.value) { setStart(new Date(e.target.value)); setNotifyState('idle'); } }}
          className={inputCls}
        />
      </label>

      <div className="flex flex-col gap-1 min-w-44">
        <span className="text-xs text-slate-400">{t('refinery.result')}</span>
        <span>
          <span className="font-mono text-amber-300">{produced}</span>{' '}
          <span className="text-slate-200">{localized(refName(output.refId))}</span>
          <span className="text-slate-400"> · {formatDuration(seconds)} · </span>
          <span className="font-mono text-emerald-300">{formatReadyAt(readyAt, i18n.language)}</span>
        </span>
      </div>

      {'Notification' in window && (
        <button
          type="button"
          onClick={() => void scheduleNotification()}
          disabled={notifyState === 'scheduled'}
          className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs disabled:opacity-60"
          title={t('refinery.notifyHint')}
        >
          {notifyState === 'scheduled' ? `✓ ${t('refinery.notifyScheduled')}`
            : notifyState === 'denied' ? t('refinery.notifyDenied')
            : `🔔 ${t('refinery.notify')}`}
        </button>
      )}
    </div>
  );
}
