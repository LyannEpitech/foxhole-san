import type { Item, MaterialCost } from '../types/domain';

// Wiki-verified (Mass Production Factory, 2026-07-07): crate #1 gets -10%,
// #2 -20%, #3 -30%, #4 -40%, #5 and beyond -50%. Orders cap at 9 crates for
// items and 5 for vehicles/structures. Checks out against the wiki's own
// examples: 9 crates -> 38.8% overall, 5 crates -> 30%.
export const MPF_MAX_CRATES_ITEMS = 9;
export const MPF_MAX_CRATES_VEHICLES = 5;

const VEHICLE_LIKE = new Set(['vehicles', 'naval', 'aircraft', 'trains', 'shippables']);

export function mpfMaxCrates(item: Item): number {
  return VEHICLE_LIKE.has(item.category) ? MPF_MAX_CRATES_VEHICLES : MPF_MAX_CRATES_ITEMS;
}

/** Discount fraction for the 1-based crate position in an MPF order. */
export function mpfCrateDiscount(position: number): number {
  // Integer tenths to stay float-exact (0.3, not 0.30000000000000004).
  return Math.min(5, position) / 10;
}

export interface MpfQuote {
  crates: number;
  orders: number[];
  /** Full factory price for the same crates. */
  factoryCost: MaterialCost;
  /** Discounted MPF price (per-material, rounded up at the end). */
  mpfCost: MaterialCost;
  savings: MaterialCost;
  /** Overall discount fraction (0..0.5). */
  discount: number;
}

/**
 * A1.3/B7 — price `crates` crates of an item at the MPF: crates are split
 * into successive orders (capped per category), each crate position gets
 * the queue discount.
 */
export function mpfQuote(item: Item, crates: number): MpfQuote {
  const cap = mpfMaxCrates(item);
  const orders: number[] = [];
  for (let left = crates; left > 0; left -= cap) orders.push(Math.min(cap, left));

  // Paid fraction in integer tenths, so 100 bmats x 5 crates is exactly 350.
  let paidTenths = 0;
  for (const size of orders) {
    for (let i = 1; i <= size; i++) paidTenths += 10 - Math.min(5, i);
  }

  const factoryCost: MaterialCost = {};
  const mpfCost: MaterialCost = {};
  const savings: MaterialCost = {};
  for (const [mat, per] of Object.entries(item.cost)) {
    if (typeof per !== 'number') continue;
    const key = mat as keyof MaterialCost;
    factoryCost[key] = per * crates;
    mpfCost[key] = Math.ceil((per * paidTenths) / 10);
    savings[key] = factoryCost[key]! - mpfCost[key]!;
  }
  const discount = crates > 0 ? 1 - paidTenths / (10 * crates) : 0;
  return { crates, orders, factoryCost, mpfCost, savings, discount };
}
