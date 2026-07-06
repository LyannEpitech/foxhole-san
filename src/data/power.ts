import type { LocalizedString, MaterialCost } from '../types/domain';

/**
 * Diesel Power Plant — wiki-verified 2026-07-06:
 * 150 bmats to build, outputs 5 MW burning 25 L of diesel per 45 s
 * (= 2000 L/h at full load; consumption scales with grid load).
 */
export const DIESEL_POWER_PLANT: {
  name: LocalizedString;
  constructionCost: MaterialCost;
  outputMW: number;
  fuelLitersPerHour: number;
} = {
  name: { en: 'Diesel Power Plant', fr: 'Centrale au diesel' },
  constructionCost: { bmats: 150 },
  outputMW: 5,
  fuelLitersPerHour: (25 / 45) * 3600,
};
