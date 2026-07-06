import { describe, expect, it } from 'vitest';
import { solveFire } from './artillery';
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

describe('artillery — spotter fire solution (B4)', () => {
  it('adds colinear measurements', () => {
    const s = solveFire(100, 0, 50, 0);
    expect(s.distance).toBeCloseTo(150, 6);
    expect(s.azimuth).toBeCloseTo(0, 6);
  });

  it('solves the right triangle case', () => {
    // 100 m north then 100 m east -> 141.42 m at 45°.
    const s = solveFire(100, 0, 100, 90);
    expect(s.distance).toBeCloseTo(Math.SQRT2 * 100, 4);
    expect(s.azimuth).toBeCloseTo(45, 4);
  });

  it('normalizes azimuths across the 0° wrap', () => {
    // 100 m north then 100 m west -> 315°.
    const s = solveFire(100, 0, 100, 270);
    expect(s.azimuth).toBeCloseTo(315, 4);
  });
});

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
