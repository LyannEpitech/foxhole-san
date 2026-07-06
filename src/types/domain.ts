/** Faction ownership of an item or building. */
export type Faction = 'Colonial' | 'Warden' | 'Both';

/** A user-facing string localized in both supported languages. */
export interface LocalizedString {
  en: string;
  fr: string;
}

/** Raw resources are mined/scrapped in the world; refined ones come out of a Refinery. */
export type ResourceKind = 'raw' | 'refined';

export interface Resource {
  id: string;
  name: LocalizedString;
  kind: ResourceKind;
}

/** Cost expressed in the four standard refined materials. */
export interface MaterialCost {
  bmats?: number;
  rmats?: number;
  emats?: number;
  hemats?: number;
}

/** A tech / world prerequisite (e.g. Town Base "Industry" upgrade). */
export interface TechRequirement {
  techId: string;
  name: LocalizedString;
}

export type BuildingKind =
  | 'Refinery'
  | 'Factory'
  | 'MassProductionFactory'
  | 'MaterialsFactory'
  | 'AssemblyStation';

export interface Building {
  id: string;
  name: LocalizedString;
  kind: BuildingKind;
  /** Cost to (re)build the structure. */
  constructionCost: MaterialCost;
  /** Power draw in MW, when relevant (facility buildings). */
  powerRequired?: number;
  prerequisites: TechRequirement[];
}

/** One input or output of a recipe. `refId` points to a Resource or an Item. */
export interface RecipeIO {
  refId: string;
  qty: number;
}

export interface Recipe {
  id: string;
  buildingId: string;
  inputs: RecipeIO[];
  outputs: RecipeIO[];
  timeSeconds: number;
}

export type ItemCategory =
  | 'smallArms'
  | 'heavyArms'
  | 'utilities'
  | 'medical'
  | 'supplies'
  | 'shippables'
  | 'vehicles'
  | 'uniforms';

/** Transport capacity of a vehicle item (crates in its inventory). */
export interface VehicleSpec {
  itemId: string;
  capacityCrates: number;
}

export interface Item {
  id: string;
  name: LocalizedString;
  category: ItemCategory;
  faction: Faction;
  /** Cost of one production order (one crate). */
  cost: MaterialCost;
  /** Units produced per order (crate size). */
  amountProduced: number;
  /** Building where the item is produced. */
  producedBy: string;
  techRequirement?: TechRequirement;
  isMfpCraftable?: boolean;
  /** Factory time for one order/crate, in seconds (wiki-verified). */
  craftTimeSeconds?: number;
}
