import { dataset } from '../data';
import type { LocalizedString, MaterialCost } from '../types/domain';

/** Localized display name of a Resource or Item id. */
export function refName(refId: string): LocalizedString {
  const named = dataset.resources.get(refId) ?? dataset.items.get(refId);
  return named?.name ?? { en: refId, fr: refId };
}

/** MaterialCost -> [refId, qty] entries, skipping empty keys. */
export function costEntries(cost: MaterialCost): [string, number][] {
  return Object.entries(cost).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
  );
}
