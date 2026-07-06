import type { LocalizedString } from '../types/domain';

/**
 * Ammunition fired only by non-craftable platforms (structures, rail cars,
 * large ships) that are not items in the dataset. Shown as plain text in
 * the compatibility card. Source: wiki "Users" sections, 2026-07-06.
 */
export const AMMO_STRUCTURE_USERS: Record<string, LocalizedString[]> = {
  '300mm': [
    { en: 'Storm Cannon (structure)', fr: 'Storm Cannon (structure)' },
    { en: 'Tempest Cannon RA-2 (emplacement)', fr: 'Tempest Cannon RA-2 (emplacement)' },
    { en: 'Long-Range Artillery Car (rail)', fr: "Wagon d'artillerie longue portée (rail)" },
  ],
  '250mm-fury-shell': [
    { en: '40-250 "Alekto" Heavy Cannon (not in dataset yet)', fr: '40-250 « Alekto » Heavy Cannon (pas encore dans le jeu de données)' },
  ],
  'quillback-torpedo': [
    { en: 'Submarines (Nakki, AC-b "Trident")', fr: 'Sous-marins (Nakki, AC-b « Trident »)' },
  ],
  '950-70b-anti-aircraft-shell': [
    { en: 'Heavy anti-aircraft emplacements', fr: 'Emplacements anti-aériens lourds' },
  ],
  'shatter-missle': [
    { en: 'Anti-aircraft missile launchers', fr: 'Lanceurs de missiles anti-aériens' },
  ],
  '120mm': [
    { en: 'Large ships (Blacksteele, Conqueror, Callahan, Titan, Trident)', fr: 'Grands navires (Blacksteele, Conqueror, Callahan, Titan, Trident)' },
  ],
  '150mm': [
    { en: 'Battleships (Callahan, Titan)', fr: 'Cuirassés (Callahan, Titan)' },
  ],
  '68mm': [
    { en: 'Large ships (Blacksteele, Conqueror, Titan, Nakki)', fr: 'Grands navires (Blacksteele, Conqueror, Titan, Nakki)' },
  ],
};
