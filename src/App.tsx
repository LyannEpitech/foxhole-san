import { useTranslation } from 'react-i18next';
import { BuildingList } from './components/BuildingList';
import { BuildSequence } from './components/BuildSequence';
import { LanguageToggle } from './components/LanguageToggle';
import { RequirementTree } from './components/RequirementTree';
import { ResourceTotals } from './components/ResourceTotals';
import { TargetSelector } from './components/TargetSelector';
import { usePlanStore } from './store/planStore';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function App() {
  const { t } = useTranslation();
  const { result, error } = usePlanStore();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">{t('app.title')}</h1>
            <p className="text-sm text-slate-400">{t('app.subtitle')}</p>
          </div>
          <LanguageToggle />
        </header>

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
          </div>
        )}
      </div>
    </div>
  );
}
