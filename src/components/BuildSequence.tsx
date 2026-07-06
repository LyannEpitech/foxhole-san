import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import { useTechStore } from '../store/techStore';
import type { PlanStep, PlanSummary } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { refName } from '../lib/refs';

const BADGE: Record<PlanStep['type'], string> = {
  tech: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  build: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  produce: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

export function BuildSequence({ result }: { result: PlanSummary }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const unlocked = useTechStore((s) => s.unlocked);

  const label = (step: PlanStep): string => {
    switch (step.type) {
      case 'tech': {
        const req = result.prerequisites.find((p) => p.techId === step.techId);
        return req ? localized(req.name) : step.techId;
      }
      case 'build': {
        const b = dataset.buildings.get(step.buildingId);
        return b ? localized(b.name) : step.buildingId;
      }
      case 'produce': {
        const building = dataset.buildings.get(step.buildingId);
        return `${localized(refName(step.refId))} — ${t('sequence.produceDetail', {
          produced: step.produced,
          batches: step.batches,
          building: building ? localized(building.name) : step.buildingId,
        })}`;
      }
    }
  };

  return (
    <ol className="space-y-2 text-sm">
      {result.sequence.map((step, i) => (
        <li key={i} className="flex items-baseline gap-2">
          <span className="font-mono text-slate-500 w-6 text-right shrink-0">{i + 1}.</span>
          <span
            className={`shrink-0 text-xs px-2 py-0.5 rounded border ${BADGE[step.type]}`}
          >
            {t(`sequence.step.${step.type}`)}
          </span>
          <span className="text-slate-200">{label(step)}</span>
          {step.type === 'tech' &&
            (unlocked[step.techId] ? (
              <span className="text-emerald-400 text-xs">✓ {t('tech.unlocked')}</span>
            ) : (
              <span className="text-yellow-400/90 text-xs">⚠ {t('tech.locked')}</span>
            ))}
        </li>
      ))}
    </ol>
  );
}
