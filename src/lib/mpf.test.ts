import { describe, expect, it } from 'vitest';
import { mpfCrateDiscount, mpfQuote } from './mpf';
import type { Item } from '../types/domain';

const name = (s: string) => ({ en: s, fr: s });
const rifle: Item = {
  id: 'rifle', name: name('Rifle'), category: 'smallArms', faction: 'Both',
  cost: { bmats: 100 }, amountProduced: 20, producedBy: 'factory', isMfpCraftable: true,
};
const tank: Item = {
  id: 'tank', name: name('Tank'), category: 'vehicles', faction: 'Both',
  cost: { rmats: 120 }, amountProduced: 3, producedBy: 'garage', isMfpCraftable: true,
};

describe('mpf — wiki-verified queue discount', () => {
  it('discount ramps 10..50% and caps at 50%', () => {
    expect([1, 2, 3, 4, 5, 9].map(mpfCrateDiscount)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.5]);
  });

  it('matches the wiki overall-discount examples', () => {
    // "38.8% for an order of 9 crates and 30% for an order of 5 crates"
    expect(mpfQuote(rifle, 9).discount).toBeCloseTo(0.3888, 3);
    expect(mpfQuote(tank, 5).discount).toBeCloseTo(0.3, 5);
  });

  it('splits large runs into capped orders (9 for items, 5 for vehicles)', () => {
    expect(mpfQuote(rifle, 21).orders).toEqual([9, 9, 3]);
    expect(mpfQuote(tank, 12).orders).toEqual([5, 5, 2]);
  });

  it('prices materials with the summed discount, rounded up once', () => {
    const q = mpfQuote(rifle, 5);
    expect(q.factoryCost).toEqual({ bmats: 500 });
    expect(q.mpfCost).toEqual({ bmats: 350 }); // 30% off
    expect(q.savings).toEqual({ bmats: 150 });
  });
});
