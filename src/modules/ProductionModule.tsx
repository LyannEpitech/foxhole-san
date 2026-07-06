import { useTranslation } from 'react-i18next';
import { BuildingList } from '../components/BuildingList';
import { BuildSequence } from '../components/BuildSequence';
import { Panel } from '../components/Panel';
import { EnergyPanel, TimelinePanel } from '../components/PlanExtras';
import { ProductionGraph } from '../components/ProductionGraph';
import { RequirementTree } from '../components/RequirementTree';
import { ResourceTotals } from '../components/ResourceTotals';
import { TargetSelector } from '../components/TargetSelector';
import { usePlanStore } from '../store/planStore';

export function ProductionModule() {
  const { t } = useTranslation();
  const { result, error } = usePlanStore();

  return (
    <div className="space-y-4">
      <TargetSelector />

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
