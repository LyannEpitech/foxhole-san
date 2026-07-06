import type { LocalizedString } from '../types/domain';

/**
 * Ammunition fired only by non-craftable platforms (structures, rail cars)
 * that are not items in the dataset. Shown as plain text in the
 * compatibility card. Source: wiki "Users" sections, 2026-07-06.
 */
export const AMMO_STRUCTURE_USERS: Record<string, LocalizedString[]> = {
  '950-70b-anti-aircraft-shell': [
    { en: 'Heavy anti-aircraft emplacements', fr: 'Emplacements anti-aériens lourds' },
  ],
};
