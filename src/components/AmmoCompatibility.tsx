import { useTranslation } from 'react-i18next';
import { ammoOf, dataset, usedBy } from '../data';
import { AMMO_STRUCTURE_USERS } from '../data/ammoExtra';
import { useLocalized } from '../i18n';

function Chips({
  label,
  ids,
  onPick,
}: {
  label: string;
  ids: string[];
  onPick: (id: string) => void;
}) {
  const localized = useLocalized();
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          className="text-xs px-2 py-1 rounded-md bg-slate-700/70 border border-slate-600
            text-amber-200 hover:bg-slate-600 hover:border-amber-400"
        >
          {localized(dataset.items.get(id)!.name)}
        </button>
      ))}
    </div>
  );
}

/**
 * Weapon <-> ammunition compatibility for the selected target:
 * a weapon lists the ammo it fires; an ammo lists the weapons firing it.
 * Chips are clickable to jump to that item's production plan.
 */
export function AmmoCompatibility({
  targetId,
  onPick,
}: {
  targetId: string;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const fires = ammoOf.get(targetId);
  const firedBy = usedBy.get(targetId);
  const structureUsers = AMMO_STRUCTURE_USERS[targetId];
  if (!fires && !firedBy && !structureUsers) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 space-y-2">
      {fires && <Chips label={`🔫 ${t('ammo.fires')}`} ids={fires} onPick={onPick} />}
      {(firedBy || structureUsers) && (
        <div className="flex flex-wrap items-baseline gap-2">
          {firedBy && <Chips label={`🎯 ${t('ammo.usedBy')}`} ids={firedBy} onPick={onPick} />}
          {structureUsers && (
            <>
              {!firedBy && <span className="text-xs text-slate-400">🎯 {t('ammo.usedBy')}</span>}
              {structureUsers.map((name) => (
                <span
                  key={name.en}
                  className="text-xs px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400"
                >
                  {localized(name)}
                </span>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
