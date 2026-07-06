import type { LocalizedString } from '../types/domain';

/** Broad marker families used for layer filtering. */
export type MapIconKind = 'town' | 'industry' | 'field' | 'military';

export interface MapIconDef {
  /** PNG basename under /icons (official warapi asset). */
  icon: string;
  kind: MapIconKind;
  label: LocalizedString;
}

// iconType -> official icon + category. Numbers follow the War API;
// the correspondence table mirrors attrib/foxhole-map-annotate (lib/warapi.js),
// restricted to icons actually shipped in clapfoot/warapi Images/MapIcons.
export const MAP_ICONS: Record<number, MapIconDef> = {
  // Industry
  11: { icon: 'MapIconMedical', kind: 'industry', label: { en: 'Hospital', fr: 'Hôpital' } },
  12: { icon: 'MapIconVehicle', kind: 'industry', label: { en: 'Vehicle Factory', fr: 'Usine de véhicules' } },
  15: { icon: 'MapIconWorkshop', kind: 'industry', label: { en: 'Workshop', fr: 'Atelier' } },
  16: { icon: 'MapIconManufacturing', kind: 'industry', label: { en: 'Manufacturing Plant', fr: 'Usine de fabrication' } },
  17: { icon: 'MapIconManufacturing', kind: 'industry', label: { en: 'Refinery', fr: 'Raffinerie' } },
  18: { icon: 'MapIconShipyard', kind: 'industry', label: { en: 'Shipyard', fr: 'Chantier naval' } },
  19: { icon: 'MapIconTechCenter', kind: 'industry', label: { en: 'Tech Center', fr: 'Centre technologique' } },
  33: { icon: 'MapIconStorageFacility', kind: 'industry', label: { en: 'Storage Depot', fr: 'Dépôt de stockage' } },
  34: { icon: 'MapIconFactory', kind: 'industry', label: { en: 'Factory', fr: 'Usine' } },
  36: { icon: 'MapIconAmmoFactory', kind: 'industry', label: { en: 'Ammo Factory', fr: 'Usine de munitions' } },
  39: { icon: 'MapIconConstructionYard', kind: 'industry', label: { en: 'Construction Yard', fr: 'Chantier de construction' } },
  51: { icon: 'MapIconMassProductionFactory', kind: 'industry', label: { en: 'Mass Production Factory', fr: 'Usine de production de masse' } },
  52: { icon: 'MapIconSeaport', kind: 'industry', label: { en: 'Seaport', fr: 'Port maritime' } },
  53: { icon: 'MapIconCoastalGun', kind: 'industry', label: { en: 'Coastal Gun', fr: 'Canon côtier' } },

  // Towns & bases
  27: { icon: 'MapIconKeep', kind: 'town', label: { en: 'Keep', fr: 'Donjon' } },
  28: { icon: 'MapIconObservationTower', kind: 'town', label: { en: 'Observation Tower', fr: "Tour d'observation" } },
  35: { icon: 'MapIconSafehouse', kind: 'town', label: { en: 'Safehouse', fr: 'Refuge' } },
  45: { icon: 'MapIconRelicBase', kind: 'town', label: { en: 'Small Relic Base', fr: 'Petite base relique' } },
  46: { icon: 'MapIconRelicBase', kind: 'town', label: { en: 'Medium Relic Base', fr: 'Base relique moyenne' } },
  47: { icon: 'MapIconRelicBase', kind: 'town', label: { en: 'Big Relic Base', fr: 'Grande base relique' } },
  56: { icon: 'MapIconTownBaseTier1', kind: 'town', label: { en: 'Town Hall (T1)', fr: 'Mairie (T1)' } },
  57: { icon: 'MapIconTownBaseTier2', kind: 'town', label: { en: 'Town Hall (T2)', fr: 'Mairie (T2)' } },
  58: { icon: 'MapIconTownBaseTier3', kind: 'town', label: { en: 'Town Hall (T3)', fr: 'Mairie (T3)' } },
  84: { icon: 'MapIconMortarHouse', kind: 'town', label: { en: 'Mortar House', fr: 'Maison mortier' } },

  // Military / special
  8: { icon: 'MapIconForwardBase1', kind: 'military', label: { en: 'Forward Base', fr: 'Base avancée' } },
  37: { icon: 'MapIconRocketSite', kind: 'military', label: { en: 'Rocket Site', fr: 'Site de lancement' } },
  59: { icon: 'MapIconStormCannon', kind: 'military', label: { en: 'Storm Cannon', fr: 'Canon tempête' } },
  60: { icon: 'MapIconIntelCenter', kind: 'military', label: { en: 'Intel Center', fr: 'Centre de renseignement' } },
  70: { icon: 'MapIconRocketTarget', kind: 'military', label: { en: 'Rocket Target', fr: 'Cible de fusée' } },
  71: { icon: 'MapIconRocketGroundZero', kind: 'military', label: { en: 'Rocket Ground Zero', fr: 'Point zéro' } },
  72: { icon: 'MapIconRocketSiteWithRocket', kind: 'military', label: { en: 'Rocket Site (armed)', fr: 'Site de lancement (armé)' } },
  83: { icon: 'MapIconWeatherStation', kind: 'military', label: { en: 'Weather Station', fr: 'Station météo' } },
  88: { icon: 'MapIconAircraftDepot', kind: 'military', label: { en: 'Aircraft Depot', fr: 'Dépôt aérien' } },
  89: { icon: 'MapIconAircraftFactory', kind: 'military', label: { en: 'Aircraft Factory', fr: "Usine d'avions" } },
  90: { icon: 'MapIconAircraftRadar', kind: 'military', label: { en: 'Aircraft Radar', fr: 'Radar aérien' } },
  91: { icon: 'MapIconAircraftRunwayT1', kind: 'military', label: { en: 'Runway (T1)', fr: "Piste d'atterrissage (T1)" } },
  92: { icon: 'MapIconAircraftRunwayT2', kind: 'military', label: { en: 'Runway (T2)', fr: "Piste d'atterrissage (T2)" } },

  // Resource fields & mines
  20: { icon: 'MapIconSalvage', kind: 'field', label: { en: 'Salvage Field', fr: 'Champ de ferraille' } },
  21: { icon: 'MapIconComponents', kind: 'field', label: { en: 'Component Field', fr: 'Champ de composants' } },
  22: { icon: 'MapIconFuel', kind: 'field', label: { en: 'Fuel Field', fr: 'Champ de carburant' } },
  23: { icon: 'MapIconSulfur', kind: 'field', label: { en: 'Sulfur Field', fr: 'Champ de soufre' } },
  32: { icon: 'MapIconSulfurMine', kind: 'field', label: { en: 'Sulfur Mine', fr: 'Mine de soufre' } },
  38: { icon: 'MapIconSalvageMine', kind: 'field', label: { en: 'Salvage Mine', fr: 'Mine de ferraille' } },
  40: { icon: 'MapIconComponentMine', kind: 'field', label: { en: 'Component Mine', fr: 'Mine de composants' } },
  61: { icon: 'MapIconCoal', kind: 'field', label: { en: 'Coal Field', fr: 'Champ de charbon' } },
  62: { icon: 'MapIconOilWell', kind: 'field', label: { en: 'Oil Field', fr: 'Champ de pétrole' } },
  75: { icon: 'MapIconFacilityMineOilRig', kind: 'field', label: { en: 'Oil Rig', fr: 'Plateforme pétrolière' } },
};

/** Faction ring colors for API markers. */
export const TEAM_COLORS: Record<string, string> = {
  WARDENS: '#2563eb',
  COLONIALS: '#16a34a',
  NONE: '#64748b',
};
