import type { LocalizedString } from '../types/domain';

/**
 * Ammunition fired only by non-craftable platforms (structures, rail cars)
 * that are not items in the dataset. Shown as plain text in the
 * compatibility card. Source: wiki "Users" sections, 2026-07-06.
 */
export const AMMO_STRUCTURE_USERS: Record<string, LocalizedString[]> = {
  '300mm': [
    { en: 'Tempest Cannon RA-2 (rail long-range artillery car)', fr: "Tempest Cannon RA-2 (wagon d'artillerie ferroviaire)" },
  ],
  '250mm-fury-shell': [
    { en: '40-250 "Alekto" Heavy Cannon (not in dataset yet)', fr: '40-250 « Alekto » Heavy Cannon (pas encore dans le jeu de données)' },
  ],
  '950-70b-anti-aircraft-shell': [
    { en: 'Heavy anti-aircraft emplacements', fr: 'Emplacements anti-aériens lourds' },
  ],
};
