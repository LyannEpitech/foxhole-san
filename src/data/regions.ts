// Region (hex) list, fetched from the official War API on 2026-07-06:
// GET https://war-service-live.foxholeservices.com/api/worldconquest/maps
// Display names are derived from the ids; proper nouns with apostrophes are
// fixed via OVERRIDES.

export const REGION_IDS = [
  'TheFingersHex', 'KuuraStrandHex', 'TempestIslandHex', 'MarbanHollow',
  'GutterHex', 'EndlessShoreHex', 'TyrantFoothillsHex', 'WrestaHex',
  'WestgateHex', 'MooringCountyHex', 'MorgensCrossingHex', 'LochMorHex',
  'RedRiverHex', 'HowlCountyHex', 'ClahstraHex', 'TerminusHex',
  'LinnMercyHex', 'PipersEnclaveHex', 'ClansheadValleyHex', 'GodcroftsHex',
  'FishermansRowHex', 'UmbralWildwoodHex', 'CallahansPassageHex', 'LykosIsleHex',
  'KingsCageHex', 'SableportHex', 'GreatMarchHex', 'ViperPitHex',
  'BasinSionnachHex', 'StemaLandingHex', 'HeartlandsHex', 'DeadLandsHex',
  'OarbreakerHex', 'AcrithiaHex', 'WeatheredExpanseHex', 'ReaversPassHex',
  'StonecradleHex', 'PariPeakHex', 'AllodsBightHex', 'KalokaiHex',
  'OriginHex', 'OlavisWakeHex', 'SpeakingWoodsHex', 'ShackledChasmHex',
  'NevishLineHex', 'CallumsCapeHex', 'ReachingTrailHex', 'StlicanShelfHex',
  'PalantineBermHex', 'AshFieldsHex', 'FarranacCoastHex', 'DrownedValeHex',
  'OnyxHex',
] as const;

export type RegionId = (typeof REGION_IDS)[number];

const OVERRIDES: Partial<Record<RegionId, string>> = {
  DeadLandsHex: 'Deadlands',
  CallahansPassageHex: "Callahan's Passage",
  CallumsCapeHex: "Callum's Cape",
  FishermansRowHex: "Fisherman's Row",
  AllodsBightHex: "Allod's Bight",
  MorgensCrossingHex: "Morgen's Crossing",
  ReaversPassHex: "Reaver's Pass",
  KingsCageHex: "King's Cage",
  PipersEnclaveHex: "Piper's Enclave",
  LinnMercyHex: 'The Linn of Mercy',
};

function prettify(id: string): string {
  return id
    .replace(/Hex$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

export interface Region {
  id: RegionId;
  name: string;
}

export const REGIONS: Region[] = [...REGION_IDS]
  .map((id) => ({ id, name: OVERRIDES[id] ?? prettify(id) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function regionName(id: string): string {
  return REGIONS.find((r) => r.id === id)?.name ?? id;
}
