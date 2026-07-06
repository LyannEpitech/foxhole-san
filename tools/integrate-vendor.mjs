#!/usr/bin/env node
/**
 * Integrate the foxholeplanner game-data extract into the app dataset.
 * Idempotent: safe to re-run after refreshing the vendor extract.
 *
 *   node tools/integrate-vendor.mjs
 *
 * Adds missing resources, facility buildings, recipes and items (factory
 * crates, facility vehicles, aircraft, trains), reconciles legacy names,
 * and prints a transparency report of everything it skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data');
const load = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const save = (f, v) => fs.writeFileSync(path.join(D, f), JSON.stringify(v, null, 1));

const vendor = load('vendor/foxholeplanner-extract.json');
const items = load('items.json');
const resources = load('resources.json');
const buildings = load('buildings.json');
const recipes = load('recipes.json');

const slug = (s) => s.toLowerCase().replace(/['"’“”.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const fuzz = (s) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const io = (refId, qty) => ({ refId, qty });

// --------------------------------------------------------------------------
// Vendor codeName -> our resource id (materials & liquids)
// --------------------------------------------------------------------------
const CODE2ID = {
  metal: 'salvage', cloth: 'bmats', wood: 'rmats', explosive: 'emats', heavyexplosive: 'hemats',
  components: 'components', sulfur: 'sulfur', coal: 'coal', raremetal: 'rare-metal',
  facilitymaterials1: 'cmats', facilitymaterials2: 'pcmats', facilitymaterials3: 'scmats',
  facilitymaterials4: 'amats1', facilitymaterials5: 'amats2', facilitymaterials6: 'amats3',
  facilitymaterials7: 'amats4', facilitymaterials8: 'amats5',
  facilitymaterials9: 'ralloys', facilitymaterials10: 'unstable-substances', facilitymaterials11: 'thermal-shielding',
  facilitycoal1: 'coke', facilityoil1: 'heavy-oil', facilityoil2: 'enriched-oil',
  facilitycomponents1: 'damaged-components',
  oil: 'oil', water: 'water', petrol: 'petrol', diesel: 'diesel', gravel: 'gravel',
  concretematerials: 'concrete-materials', flameammo: 'flame-ammo', maintenancesupplies: 'maintenance-supplies',
  aluminum: 'aluminum-alloy', aluminuma: 'aluminum', iron: 'iron-alloy', irona: 'iron', copper: 'copper-alloy', coppera: 'copper',
  groundmaterials: 'gravel',
  shippart1: 'naval-hull-segments', shippart2: 'naval-shell-plating', shippart3: 'naval-turbine-components',
  fortconstructionpart: 'fort-construction-parts', fortstructurepart: 'fort-structure-parts',
  fortlrartillerypart: 'storm-cannon-parts', fortintelcenterpart: 'intel-center-parts',
  fortweatherstationpart: 'weather-station-parts', fortgarrisonstationpart: 'underground-fortress-parts',
  fortlargeradarpart: 'aircraft-radar-parts',
};

// Resources to make sure exist (id, en, fr, kind)
const NEW_RESOURCES = [
  ['oil', 'Oil (L)', 'Pétrole (L)', 'raw'],
  ['water', 'Water (L)', 'Eau (L)', 'raw'],
  ['gravel', 'Gravel', 'Gravier', 'raw'],
  ['aluminum', 'Aluminum', 'Aluminium', 'raw'],
  ['iron', 'Iron', 'Fer', 'raw'],
  ['copper', 'Copper', 'Cuivre', 'raw'],
  ['damaged-components', 'Damaged Components', 'Composants endommagés', 'raw'],
  ['enriched-oil', 'Enriched Oil (L)', 'Pétrole enrichi (L)', 'refined'],
  ['unstable-substances', 'Unstable Substances', 'Substances instables', 'refined'],
  ['concrete-materials', 'Concrete Materials', 'Matériaux en béton', 'refined'],
  ['flame-ammo', 'Flame Ammo', 'Munitions incendiaires', 'refined'],
  ['maintenance-supplies', 'Maintenance Supplies', 'Fournitures de maintenance', 'refined'],
  ['aluminum-alloy', 'Aluminum Alloy', 'Alliage d’aluminium', 'refined'],
  ['iron-alloy', 'Iron Alloy', 'Alliage de fer', 'refined'],
  ['copper-alloy', 'Copper Alloy', 'Alliage de cuivre', 'refined'],
];

// Production buildings to model: vendor key -> our building
const BUILDINGS = {
  'Materials Factory': 'materials-factory',
  'Metalworks Factory': 'metalworks',
  'Coal Refinery': 'coal-refinery',
  'Small Assembly Station': 'small-assembly-station',
  'Large Assembly Station': 'large-assembly-station',
  'Ammunition Factory': 'ammunition-factory',
  'Dry Dock': 'dry-dock',
  'Oil Refinery': 'oil-refinery',
  'Concrete Mixer': 'concrete-mixer',
  'Infantry Kit Factory': 'infantry-kit-factory',
  'Aircraft Maintenance Factory': 'aircraft-maintenance-factory',
  'Offshore Platform': 'offshore-platform',
};
const NEW_BUILDINGS = [
  ['oil-refinery', 'Oil Refinery', 'Raffinerie de pétrole'],
  ['concrete-mixer', 'Concrete Mixer', 'Bétonnière'],
  ['infantry-kit-factory', 'Infantry Kit Factory', 'Usine d’équipement d’infanterie'],
  ['aircraft-maintenance-factory', 'Aircraft Maintenance Factory', 'Usine de maintenance aéronautique'],
  ['offshore-platform', 'Offshore Platform', 'Plateforme offshore'],
];

// Legacy name fixes: our old name -> vendor (game) name
const RENAMES = [
  ['Liason Transmitter', 'Liaison Transmitter'],
  ['Shatter Missle', 'Shatter Missile'],
  ['E6881-B Hullbreaker Mine', 'E681-B Hullbreaker Mine'],
  ['Mortar Shrapnel Shell', 'Shrapnel Mortar Shell'],
  ['Mortar Flare Shell', 'Flare Mortar Shell'],
  ['Abisme AT-99', 'Abisme AT-99 Mine'],
  ['Rocket Booster', 'A0E-9 Rocket Booster'],
];

// Not craftable / noise — deliberately excluded
const EXCLUDE_NAME = /^(Damaged |Wreckage$|Crate$|Critically Wounded|Excavation|Relic Materials$|Reserve Power$|Rare Materials$)|\(Canned\)$/;
const EXCLUDE_CODE = /^crate:/;
// Codes knowingly unmapped (inputs of recipes we skip anyway)
const SKIP_CODES = new Set(['construction']);

// Categories for new factory-crate items that the heuristics can't guess
const MANUAL_CATEGORY = {
  'Mark II Raidbreaker': 'heavyArms', 'Model-7 “Evie”': 'heavyArms', '912 Shrike Rounds': 'heavyArms',
  'Legion Vexillum': 'utilities', 'War Ensign': 'utilities', 'Pipe': 'utilities', 'Hammer': 'utilities',
  'Liaison Transmitter': 'utilities', 'E680-S Rudder Lock': 'utilities', 'Unexploded Ordnance': 'heavyArms',
  'Ferro 879': 'smallArms', 'Ahti Model 2': 'smallArms',
};

// Extra weapon->ammo links unlocked by this batch
const AMMO_LINKS = [
  ['40-250 “Alekto” Heavy Cannon', ['250mm "Fury" Shell', '250mm "Purity" Shell']],
  ['Tempest Cannon RA-2', ['300mm']],
  ['Huber Starbreaker 94.5mm', ['94.5mm']],
  ['Balfour Stockade 75mm', ['75mm']],
  ['O-75b "Ares"', ['75mm']],
  ['Flood Juggernaut Mk. VII', ['75mm']],
];

// --------------------------------------------------------------------------
const report = { renamed: [], resources: [], buildings: [], crateItems: [], recipeItems: [], recipes: 0, skipped: [], altRoutes: [], unknownCodes: new Set() };

// 0. purge previously integrated noise
for (let i = items.length - 1; i >= 0; i--) {
  if (EXCLUDE_NAME.test(items[i].name.en)) {
    report.skipped.push('purged: ' + items[i].name.en);
    items.splice(i, 1);
  }
}

// 1. renames (and fix ammo references)
for (const [oldName, newName] of RENAMES) {
  const it = items.find((i) => i.name.en === oldName);
  if (!it) continue;
  const clash = items.find((i) => i.name.en === newName);
  if (clash) items.splice(items.indexOf(it), 1);
  else { it.name = { en: newName, fr: newName }; }
  for (const other of items) {
    if (other.ammo?.includes(oldName)) other.ammo = other.ammo.map((a) => (a === oldName ? newName : a));
  }
  report.renamed.push(`${oldName} -> ${newName}${clash ? ' (merged)' : ''}`);
}

// 2. resources
for (const [id, en, fr, kind] of NEW_RESOURCES) {
  if (!resources.find((r) => r.id === id)) { resources.push({ id, name: { en, fr }, kind }); report.resources.push(id); }
}

// 3. buildings
const vendorBuildingByName = Object.fromEntries(Object.values(vendor.buildings).map((b) => [b.name, b]));
const costFromVendor = (cost) => {
  const out = {};
  for (const [c, q] of Object.entries(cost ?? {})) {
    const id = CODE2ID[c];
    if (!id) return null;
    out[id] = q;
  }
  return out;
};
for (const [id, en, fr] of NEW_BUILDINGS) {
  if (buildings.find((b) => b.id === id)) continue;
  const vb = vendorBuildingByName[en];
  const cost = costFromVendor(vb?.cost) ?? {};
  buildings.push({ id, name: { en, fr }, kind: 'MaterialsFactory', constructionCost: cost, powerRequired: Math.abs(vb?.power ?? 0) || undefined, prerequisites: [] });
  report.buildings.push(id);
}

// helpers over current state
const itemByFuzz = () => new Map(items.map((i) => [fuzz(i.name.en), i]));
const resById = new Set(resources.map((r) => r.id));
const recipeOutputs = new Set(recipes.flatMap((r) => r.outputs.map((o) => o.refId)));

const factionOf = (code, vres) => {
  const f = vres?.faction;
  if (Array.isArray(f)) { const s = f.filter((x) => x !== 'neutral'); if (s.length === 1) return s[0] === 'warden' ? 'Warden' : 'Colonial'; return 'Both'; }
  if (/w$/.test(code)) return 'Warden';
  if (/c$/.test(code)) return 'Colonial';
  return 'Both';
};

const categoryOf = (code, name, buildingId) => {
  if (MANUAL_CATEGORY[name]) return MANUAL_CATEGORY[name];
  if (/^aircraft(?!part)/.test(code)) return 'aircraft';
  if (/^aircraftpart/.test(code)) return 'aircraft';
  if (/^(train|smalltrain)/.test(code)) return 'trains';
  if (/^largeship/.test(code)) return 'naval';
  if (/uniform|fatigues|battledress|raiment|lorica|vesture|harness|ruck|garb|attire|peacoat|regalia|breastplate|vest\b/i.test(name)) return 'uniforms';
  if (/torpedo|mine\b|shell|rocket|missile|\d+mm|\d+\.\d+mm|^\.44|^rpg$|rounds|ammo/i.test(name)) return 'heavyArms';
  if (/rifle|gun\b|pistol|revolver|carbine|smg|shotgun/i.test(name)) return 'smallArms';
  if (buildingId === 'infantry-kit-factory') return 'supplies';
  return 'vehicles';
};

// 4. factory-crate items missing from the dataset
const CRATE_KEYS = { cloth: 'bmats', wood: 'rmats', explosive: 'emats', heavyexplosive: 'hemats' };
{
  const byFuzz = itemByFuzz();
  for (const [code, r] of Object.entries(vendor.resources)) {
    if (!r.name || !r.crateCost || !r.crateQuantity) continue;
    if (EXCLUDE_CODE.test(code) || EXCLUDE_NAME.test(r.name)) continue;
    if (CODE2ID[code]) continue; // materials, not items
    if (!Object.keys(r.crateCost).every((k) => CRATE_KEYS[k])) continue;
    if (byFuzz.has(fuzz(r.name))) continue;
    const cost = {};
    for (const [k, v] of Object.entries(r.crateCost)) cost[CRATE_KEYS[k]] = v;
    const item = {
      id: slug(r.name), name: { en: r.name, fr: r.name },
      category: categoryOf(code, r.name, 'factory'), faction: factionOf(code, r),
      cost, amountProduced: r.crateQuantity, producedBy: 'factory',
    };
    items.push(item);
    byFuzz.set(fuzz(r.name), item);
    report.crateItems.push(r.name);
  }
}

// 5. facility recipes + their output items (vehicles, aircraft, trains…)
const translate = (obj) => {
  const out = [];
  for (const [code, v] of Object.entries(obj ?? {})) {
    const qty = typeof v === 'object' ? v.quantity : v;
    if (EXCLUDE_CODE.test(code)) return null;
    let refId = CODE2ID[code];
    if (!refId) {
      const vres = vendor.resources[code];
      const hit = vres && itemByFuzz().get(fuzz(vres.name));
      if (hit) refId = hit.id;
    }
    if (!refId) { if (!SKIP_CODES.has(code)) report.unknownCodes.add(code); return null; }
    out.push(io(refId, qty));
  }
  return out;
};

for (const vb of Object.values(vendor.buildings)) {
  const buildingId = BUILDINGS[vb.name];
  if (!buildingId) continue;
  const prods = [
    ...(vb.production ?? []),
    ...Object.values(vb.upgrades ?? {}).flatMap((u) => u.production ?? []),
  ];
  for (const p of prods) {
    const outCodes = Object.keys(p.output ?? {});
    if (outCodes.length !== 1) { report.skipped.push('multi-output: ' + outCodes.join('+')); continue; }
    const code = outCodes[0];
    if (EXCLUDE_CODE.test(code)) { report.skipped.push(code); continue; }
    const vres = vendor.resources[code];

    // Output is a material we model -> recipe only (if not already producible)
    if (CODE2ID[code]) {
      const refId = CODE2ID[code];
      // Raw resources are always gathering leaves — a recycling recipe
      // producing them would never be used by the resolver.
      if (resources.find((r) => r.id === refId)?.kind === 'raw') continue;
      if (!resById.has(refId) || recipeOutputs.has(refId)) continue;
      const inputs = translate(p.input);
      if (!inputs || inputs.length === 0) continue;
      const outQty = typeof p.output[code] === 'object' ? p.output[code].quantity : p.output[code];
      recipes.push({ id: `v-${buildingId}-${refId}`, buildingId, inputs, outputs: [io(refId, outQty)], timeSeconds: p.time ?? 0 });
      recipeOutputs.add(refId); report.recipes++;
      continue;
    }

    if (!vres?.name || EXCLUDE_NAME.test(vres.name)) { if (vres?.name) report.skipped.push(vres.name); continue; }

    // Output is an item
    const byFuzz = itemByFuzz();
    let item = byFuzz.get(fuzz(vres.name));
    if (item && Object.keys(item.cost).length > 0) { report.altRoutes.push(vres.name); continue; }
    const inputs = translate(p.input);
    if (!inputs || inputs.length === 0) { report.skipped.push('untranslatable inputs: ' + vres.name); continue; }
    if (!item) {
      item = {
        id: slug(vres.name), name: { en: vres.name, fr: vres.name },
        category: categoryOf(code, vres.name, buildingId), faction: factionOf(code, vres),
        cost: {}, amountProduced: 1, producedBy: buildingId,
      };
      items.push(item);
      report.recipeItems.push(`${vres.name} @ ${buildingId}`);
    }
    if (!recipeOutputs.has(item.id)) {
      const outQty = typeof p.output[code] === 'object' ? p.output[code].quantity : p.output[code];
      recipes.push({ id: `v-${buildingId}-${item.id}`, buildingId, inputs, outputs: [io(item.id, outQty)], timeSeconds: p.time ?? 0 });
      recipeOutputs.add(item.id); report.recipes++;
    }
  }
}

// 6. ammo links
for (const [name, ammo] of AMMO_LINKS) {
  const it = items.find((i) => fuzz(i.name.en) === fuzz(name));
  if (it) it.ammo = ammo;
  else report.skipped.push('ammo link target missing: ' + name);
}

save('items.json', items);
save('resources.json', resources);
save('buildings.json', buildings);
save('recipes.json', recipes);

console.log('=== integrate-vendor report ===');
console.log('renamed:', report.renamed);
console.log('resources added:', report.resources.join(', ') || 'none');
console.log('buildings added:', report.buildings.join(', ') || 'none');
console.log('factory-crate items added (' + report.crateItems.length + '):', report.crateItems.join(' | '));
console.log('recipe-built items added (' + report.recipeItems.length + '):', report.recipeItems.join(' | '));
console.log('recipes added:', report.recipes);
console.log('alt production routes kept on factory (' + report.altRoutes.length + '):', [...new Set(report.altRoutes)].join(' | '));
console.log('skipped:', [...new Set(report.skipped)].join(' | ') || 'none');
console.log('UNKNOWN CODES:', [...report.unknownCodes].join(', ') || 'none');
console.log('totals — items:', items.length, 'resources:', resources.length, 'buildings:', buildings.length, 'recipes:', recipes.length);
