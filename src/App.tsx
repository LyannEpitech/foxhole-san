import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './components/LanguageToggle';
import { PlansMenu } from './components/PlansMenu';
import { dayOfWar, useWarStore } from './store/warStore';
import { AttackModule } from './modules/AttackModule';
import { DeployModule } from './modules/DeployModule';
import { LogisticsModule } from './modules/LogisticsModule';
import { ProductionModule } from './modules/ProductionModule';
import { usePlanStore } from './store/planStore';
import { useUiStore, type ModuleId } from './store/uiStore';

const MODULES: { id: ModuleId; icon: string }[] = [
  { id: 'production', icon: '🏭' },
  { id: 'deploy', icon: '🏗️' },
  { id: 'logistics', icon: '🚚' },
  { id: 'attack', icon: '⚔️' },
];

export default function App() {
  const { t } = useTranslation();
  const { active, setActive } = useUiStore();
  const { faction, setFaction } = usePlanStore();
  const { war, fetch: fetchWar } = useWarStore();

  useEffect(() => {
    void fetchWar();
  }, [fetchWar]);
  const day = war ? dayOfWar(war) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-none mx-auto px-4 pt-3">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-amber-400">{t('app.title')}</h1>
            <p className="text-xs text-slate-400">{t('app.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {war && (
              <span
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
                title={t('war.victoryTowns', { count: war.requiredVictoryTowns })}
              >
                ⚔ {t('war.chip', { number: war.warNumber })}
                {day !== null && <span className="text-slate-500"> · {t('war.day', { day })}</span>}
              </span>
            )}
            <PlansMenu />
            <select
              value={faction}
              onChange={(e) => setFaction(e.target.value as 'Colonial' | 'Warden')}
              className="bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-100"
              aria-label={t('target.faction')}
            >
              <option value="Colonial">{t('faction.Colonial')}</option>
              <option value="Warden">{t('faction.Warden')}</option>
            </select>
            <LanguageToggle />
          </div>
        </header>

        <nav className="flex gap-2 border-b border-slate-800 pb-px mt-2">
          {MODULES.map(({ id, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={
                active === id
                  ? 'px-4 py-2 rounded-t-lg bg-slate-800 border border-slate-700 border-b-transparent text-amber-300 font-semibold text-sm'
                  : 'px-4 py-2 rounded-t-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-sm'
              }
            >
              {icon} {t(`nav.${id}`)}
            </button>
          ))}
        </nav>
      </div>

      {/* Production scrolls as a page; the map planners take the full screen. */}
      {active === 'production' && (
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <ProductionModule />
        </div>
      )}
      {active === 'deploy' && <DeployModule />}
      {active === 'logistics' && <LogisticsModule />}
      {active === 'attack' && <AttackModule />}
    </div>
  );
}
