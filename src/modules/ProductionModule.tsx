import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AmmoCompatibility } from '../components/AmmoCompatibility';
import { BuildingList } from '../components/BuildingList';
import { RefineryCalculator } from '../components/RefineryCalculator';
import { dataset } from '../data';
import { useLocalized } from '../i18n';
import { downloadText, planToCsv, planToDiscordMarkdown } from '../lib/export';
import { refName } from '../lib/refs';
import { BuildSequence } from '../components/BuildSequence';
import { Panel } from '../components/Panel';
import { EnergyPanel, TimelinePanel } from '../components/PlanExtras';
import { ProductionGraph } from '../components/ProductionGraph';
import { RequirementTree } from '../components/RequirementTree';
import { ResourceTotals } from '../components/ResourceTotals';
import { TargetSelector } from '../components/TargetSelector';
import { usePlanStore } from '../store/planStore';
import { useUiStore } from '../store/uiStore';

export function ProductionModule() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { result, error, targetId, quantity, setTarget } = usePlanStore();
  const setActive = useUiStore((s) => s.setActive);
  const [copied, setCopied] = useState(false);

  // Label anything a plan references: items, resources or buildings.
  const label = (refId: string) => {
    const b = dataset.buildings.get(refId);
    return b ? localized(b.name) : localized(refName(refId));
  };
  const planTitle = targetId ? `${label(targetId)} × ${quantity}` : '';

  const copyDiscord = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(planToDiscordMarkdown(result, planTitle, label, t));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <TargetSelector />

      {targetId && <AmmoCompatibility targetId={targetId} onPick={setTarget} />}

      {result && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActive('deploy')}
            className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm"
          >
            🗺 {t('deploy.openInMap')}
          </button>
          <button
            type="button"
            onClick={() => void copyDiscord()}
            className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm"
          >
            {copied ? `✓ ${t('export.copied')}` : `📋 ${t('export.discord')}`}
          </button>
          <button
            type="button"
            onClick={() => downloadText('foxhole-plan.csv', planToCsv(result, label, t), 'text/csv')}
            className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm"
          >
            ⬇ {t('export.csv')}
          </button>
        </div>
      )}

      <details className="group bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200 list-none flex items-center gap-2">
          <span className="text-slate-500 transition-transform group-open:rotate-90">▸</span>
          ⏱ {t('refinery.title')}
        </summary>
        <div className="mt-3">
          <RefineryCalculator />
        </div>
      </details>

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-300 rounded-xl p-4 text-sm">
          <strong>{t('error.title')}:</strong> {error}
        </div>
      )}

      {!result && !error && (
        <p className="text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl p-8 text-center">
          {t('empty.hint')}
        </p>
      )}

      {result && (
        <Panel title={t('panels.flow')}>
          <ProductionGraph result={result} />
        </Panel>
      )}

      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={t('panels.tree')}>
            <RequirementTree root={result.tree} />
          </Panel>
          <Panel title={t('panels.totals')}>
            <ResourceTotals result={result} />
          </Panel>
          <Panel title={t('panels.buildings')}>
            <BuildingList result={result} />
          </Panel>
          <Panel title={t('panels.sequence')}>
            <BuildSequence result={result} />
          </Panel>
          <Panel title={t('panels.timeline')}>
            <TimelinePanel result={result} />
          </Panel>
          <Panel title={t('panels.energy')}>
            <EnergyPanel result={result} />
          </Panel>
        </div>
      )}
    </div>
  );
}
