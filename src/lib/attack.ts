import type { Dataset } from '../data';
import type { PlanTarget } from '../engine/resolver';
import type { LoadoutRow, SupportRow } from '../store/attackStore';
import type { Faction } from '../types/domain';

/**
 * Aggregate an operation (per-soldier loadout x headcount + support lines)
 * into production targets. Rows with unknown items, wrong-faction items or
 * non-positive quantities are skipped; duplicates are merged.
 */
export function aggregateAttackTargets(
  data: Dataset,
  faction: Faction,
  soldiers: number,
  loadout: LoadoutRow[],
  support: SupportRow[],
): PlanTarget[] {
  const totals = new Map<string, number>();
  const add = (itemId: string, qty: number) => {
    if (qty <= 0) return;
    const item = data.items.get(itemId);
    if (!item) return;
    if (item.faction !== 'Both' && item.faction !== faction) return;
    totals.set(itemId, (totals.get(itemId) ?? 0) + qty);
  };

  for (const row of loadout) add(row.itemId, row.perSoldier * soldiers);
  for (const row of support) add(row.itemId, row.qty);

  return [...totals.entries()].map(([refId, qty]) => ({ refId, qty }));
}
