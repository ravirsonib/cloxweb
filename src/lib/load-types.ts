/**
 * Load-type parents + sub-menu options.
 * Source: docs/product/vehicle-type-average-pricing.md § CLOX — Load Types
 * (client may change sub-items later).
 */

export type LoadTypeBadgeTone = 'neutral' | 'warn' | 'info';

export type LoadTypeSubtypeMeta = {
  code: string;
  nameKey: string;
  defaultName: string;
};

export type LoadTypeParentMeta = {
  code: string;
  nameKey: string;
  defaultName: string;
  descKey: string;
  defaultDesc: string;
  badgeTone: LoadTypeBadgeTone;
  requiresDoc?: boolean;
  subtypes: readonly LoadTypeSubtypeMeta[];
};

function sub(
  parent: string,
  code: string,
  nameKey: string,
  defaultName: string,
): LoadTypeSubtypeMeta {
  return {
    code: `${parent}:${code}`,
    nameKey,
    defaultName,
  };
}

/** Parent load types with expandible sub-menus. */
export const CLOX_LOAD_TYPES: readonly LoadTypeParentMeta[] = [
  {
    code: 'GENERAL',
    nameKey: 'loadTypes.general',
    defaultName: 'General Freight',
    descKey: 'loadTypes.generalDesc',
    defaultDesc: 'Cartons, pallets, retail stock, FMCG, general merchandise.',
    badgeTone: 'neutral',
    subtypes: [
      sub('GENERAL', 'CARTONS', 'loadTypes.sub.general.cartons', 'Cartons'),
      sub('GENERAL', 'PALLETISED', 'loadTypes.sub.general.palletised', 'Palletised goods'),
      sub('GENERAL', 'RETAIL_STOCK', 'loadTypes.sub.general.retailStock', 'Retail stock'),
      sub('GENERAL', 'FMCG', 'loadTypes.sub.general.fmcg', 'FMCG'),
    ],
  },
  {
    code: 'DG',
    nameKey: 'loadTypes.dg',
    defaultName: 'Dangerous Goods (DG)',
    descKey: 'loadTypes.dgDesc',
    defaultDesc: 'Flammables, toxics, batteries, gas, chemicals (SDS document required).',
    badgeTone: 'warn',
    requiresDoc: true,
    subtypes: [
      sub('DG', 'FLAMMABLE', 'loadTypes.sub.dg.flammable', 'Flammable liquids/solids'),
      sub('DG', 'CORROSIVES', 'loadTypes.sub.dg.corrosives', 'Corrosives'),
      sub('DG', 'TOXICS', 'loadTypes.sub.dg.toxics', 'Toxics'),
      sub('DG', 'AEROSOLS', 'loadTypes.sub.dg.aerosols', 'Aerosols'),
      sub('DG', 'BATTERIES', 'loadTypes.sub.dg.batteries', 'Batteries'),
      sub('DG', 'GAS_CYLINDERS', 'loadTypes.sub.dg.gasCylinders', 'Gas cylinders'),
      sub('DG', 'CHEMICALS', 'loadTypes.sub.dg.chemicals', 'Chemicals'),
    ],
  },
  {
    code: 'LIQUID',
    nameKey: 'loadTypes.liquid',
    defaultName: 'Liquid / Bulk Liquid',
    descKey: 'loadTypes.liquidDesc',
    defaultDesc: 'Drums, IBCs, oils, bulk liquids (spill containment required).',
    badgeTone: 'info',
    subtypes: [
      sub('LIQUID', 'DRUMS', 'loadTypes.sub.liquid.drums', 'Drums'),
      sub('LIQUID', 'IBCS', 'loadTypes.sub.liquid.ibcs', 'IBCs'),
      sub('LIQUID', 'TANKER', 'loadTypes.sub.liquid.tanker', 'Tanker'),
      sub('LIQUID', 'OILS', 'loadTypes.sub.liquid.oils', 'Oils'),
      sub('LIQUID', 'PAINTS', 'loadTypes.sub.liquid.paints', 'Paints'),
      sub('LIQUID', 'FOOD_GRADE', 'loadTypes.sub.liquid.foodGrade', 'Food-grade liquids'),
    ],
  },
  {
    code: 'OVERSIZE',
    nameKey: 'loadTypes.oversize',
    defaultName: 'Oversize / Over-dimension',
    descKey: 'loadTypes.oversizeDesc',
    defaultDesc: 'Long steel, pipes, beams (flatbed & permit warnings apply).',
    badgeTone: 'warn',
    subtypes: [
      sub('OVERSIZE', 'LONG_STEEL', 'loadTypes.sub.oversize.longSteel', 'Long steel'),
      sub('OVERSIZE', 'PIPES', 'loadTypes.sub.oversize.pipes', 'Pipes'),
      sub('OVERSIZE', 'BEAMS', 'loadTypes.sub.oversize.beams', 'Beams'),
      sub('OVERSIZE', 'STRUCTURAL_STEEL', 'loadTypes.sub.oversize.structuralSteel', 'Structural steel'),
      sub('OVERSIZE', 'PRECAST', 'loadTypes.sub.oversize.precast', 'Precast'),
      sub('OVERSIZE', 'LARGE_EQUIPMENT', 'loadTypes.sub.oversize.largeEquipment', 'Large equipment'),
    ],
  },
  {
    code: 'STEEL',
    nameKey: 'loadTypes.steel',
    defaultName: 'Steel / Metal',
    descKey: 'loadTypes.steelDesc',
    defaultDesc: 'Coils, rebar, metal sheets (chains & NHVR restraints required).',
    badgeTone: 'neutral',
    subtypes: [
      sub('STEEL', 'COILS', 'loadTypes.sub.steel.coils', 'Coils'),
      sub('STEEL', 'PLATES', 'loadTypes.sub.steel.plates', 'Plates'),
      sub('STEEL', 'REBAR', 'loadTypes.sub.steel.rebar', 'Rebar'),
      sub('STEEL', 'ALUMINIUM', 'loadTypes.sub.steel.aluminium', 'Aluminium'),
      sub('STEEL', 'SHEETS', 'loadTypes.sub.steel.sheets', 'Sheets'),
    ],
  },
  {
    code: 'REEFER',
    nameKey: 'loadTypes.reefer',
    defaultName: 'Temperature Controlled (Reefer)',
    descKey: 'loadTypes.reeferDesc',
    defaultDesc: 'Chilled, frozen, perishable food, pharma (refrigerated unit required).',
    badgeTone: 'info',
    subtypes: [
      sub('REEFER', 'CHILLED', 'loadTypes.sub.reefer.chilled', 'Chilled'),
      sub('REEFER', 'FROZEN', 'loadTypes.sub.reefer.frozen', 'Frozen'),
      sub('REEFER', 'PERISHABLE_FOOD', 'loadTypes.sub.reefer.perishableFood', 'Perishable food'),
      sub('REEFER', 'PHARMACEUTICALS', 'loadTypes.sub.reefer.pharmaceuticals', 'Pharmaceuticals'),
    ],
  },
  {
    code: 'HEAVY_MACHINERY',
    nameKey: 'loadTypes.heavyMachinery',
    defaultName: 'Machinery / Heavy Equipment',
    descKey: 'loadTypes.heavyMachineryDesc',
    defaultDesc: 'Engines, mining & industrial gear, ramps & high-capacity transport.',
    badgeTone: 'neutral',
    subtypes: [
      sub('HEAVY_MACHINERY', 'MACHINERY', 'loadTypes.sub.heavy.machinery', 'Machinery'),
      sub('HEAVY_MACHINERY', 'ENGINES', 'loadTypes.sub.heavy.engines', 'Engines'),
      sub(
        'HEAVY_MACHINERY',
        'INDUSTRIAL_MINING',
        'loadTypes.sub.heavy.industrialMining',
        'Industrial / mining equipment',
      ),
    ],
  },
  {
    code: 'VEHICLES_PLANT',
    nameKey: 'loadTypes.vehiclesPlant',
    defaultName: 'Vehicles / Plant',
    descKey: 'loadTypes.vehiclesPlantDesc',
    defaultDesc: 'Cars, excavators, forklifts, tractors, tilt-tray/ramps required.',
    badgeTone: 'neutral',
    subtypes: [
      sub('VEHICLES_PLANT', 'FORKLIFTS', 'loadTypes.sub.vehicles.forklifts', 'Forklifts'),
      sub('VEHICLES_PLANT', 'EXCAVATORS', 'loadTypes.sub.vehicles.excavators', 'Excavators'),
      sub('VEHICLES_PLANT', 'SKID_STEERS', 'loadTypes.sub.vehicles.skidSteers', 'Skid steers'),
      sub('VEHICLES_PLANT', 'CARS', 'loadTypes.sub.vehicles.cars', 'Cars'),
      sub('VEHICLES_PLANT', 'TRACTORS', 'loadTypes.sub.vehicles.tractors', 'Tractors'),
      sub(
        'VEHICLES_PLANT',
        'AGRICULTURAL',
        'loadTypes.sub.vehicles.agricultural',
        'Agricultural equipment',
      ),
    ],
  },
  {
    code: 'CONTAINERS',
    nameKey: 'loadTypes.containers',
    defaultName: 'Containers (Port / Wharf)',
    descKey: 'loadTypes.containersDesc',
    defaultDesc: '20ft/40ft shipping containers (wharf access required).',
    badgeTone: 'info',
    subtypes: [
      sub('CONTAINERS', 'FT20', 'loadTypes.sub.containers.ft20', '20ft'),
      sub('CONTAINERS', 'FT40', 'loadTypes.sub.containers.ft40', '40ft'),
      sub('CONTAINERS', 'EMPTY', 'loadTypes.sub.containers.empty', 'Empty'),
      sub('CONTAINERS', 'REEFER', 'loadTypes.sub.containers.reefer', 'Reefer'),
    ],
  },
  {
    code: 'TIMBER',
    nameKey: 'loadTypes.timber',
    defaultName: 'Timber / Building Materials',
    descKey: 'loadTypes.timberDesc',
    defaultDesc: 'Timber packs, plywood, gyprock, bricks, roofing.',
    badgeTone: 'neutral',
    subtypes: [
      sub('TIMBER', 'TIMBER_PACKS', 'loadTypes.sub.timber.timberPacks', 'Timber packs'),
      sub('TIMBER', 'PLYWOOD', 'loadTypes.sub.timber.plywood', 'Plywood'),
      sub('TIMBER', 'GYPROCK', 'loadTypes.sub.timber.gyprock', 'Gyprock'),
      sub('TIMBER', 'BRICKS', 'loadTypes.sub.timber.bricks', 'Bricks'),
      sub('TIMBER', 'ROOFING', 'loadTypes.sub.timber.roofing', 'Roofing'),
    ],
  },
  {
    code: 'HIGH_VALUE',
    nameKey: 'loadTypes.highValue',
    defaultName: 'High-Value / Sensitive',
    descKey: 'loadTypes.highValueDesc',
    defaultDesc: 'Electronics, medical gear, high-security sensitive freight.',
    badgeTone: 'warn',
    subtypes: [
      sub('HIGH_VALUE', 'ELECTRONICS', 'loadTypes.sub.highValue.electronics', 'Electronics'),
      sub('HIGH_VALUE', 'MEDICAL', 'loadTypes.sub.highValue.medical', 'Medical equipment'),
      sub(
        'HIGH_VALUE',
        'FRAGILE_MACHINERY',
        'loadTypes.sub.highValue.fragileMachinery',
        'Fragile machinery',
      ),
      sub('HIGH_VALUE', 'CONTROLLED', 'loadTypes.sub.highValue.controlled', 'Controlled goods'),
    ],
  },
  {
    code: 'WASTE',
    nameKey: 'loadTypes.waste',
    defaultName: 'Waste / Recycling',
    descKey: 'loadTypes.wasteDesc',
    defaultDesc: 'Industrial/construction waste, scrap, EPA compliance applies.',
    badgeTone: 'neutral',
    subtypes: [
      sub('WASTE', 'INDUSTRIAL', 'loadTypes.sub.waste.industrial', 'Industrial'),
      sub('WASTE', 'MEDICAL', 'loadTypes.sub.waste.medical', 'Medical'),
      sub('WASTE', 'CONSTRUCTION', 'loadTypes.sub.waste.construction', 'Construction waste'),
      sub('WASTE', 'RECYCLABLES', 'loadTypes.sub.waste.recyclables', 'Recyclables'),
    ],
  },
] as const;

export const CLOX_LOAD_TYPE_CODES = CLOX_LOAD_TYPES.map((t) => t.code);

export function subtypeParentCode(subtypeCode: string): string {
  return subtypeCode.split(':')[0] ?? '';
}

/**
 * Clamp legacy multi-select jobs to the current rule:
 * at most one non-DG parent, optional DG.
 */
export function normalizeLoadTypesSelection(types: readonly string[]): string[] {
  const hasDg = types.includes('DG');
  const nonDg = types.filter((c) => c !== 'DG');
  if (nonDg.length === 0) {
    return hasDg ? ['DG'] : ['GENERAL'];
  }
  return hasDg ? [nonDg[0]!, 'DG'] : [nonDg[0]!];
}

/** Max one non-DG parent; DG may combine with that single parent. */
export function nextLoadTypesOnParentToggle(
  current: readonly string[],
  code: string,
  selecting: boolean,
): string[] {
  if (!selecting) {
    const next = current.filter((c) => c !== code);
    return next.length === 0 ? ['GENERAL'] : next;
  }
  if (code === 'DG') {
    return current.includes('DG') ? [...current] : [...current, 'DG'];
  }
  const hasDg = current.includes('DG');
  return hasDg ? [code, 'DG'] : [code];
}

/** Drop subtypes whose parent is no longer selected. */
export function pruneLoadTypeSubtypes(
  parents: readonly string[],
  subtypes: readonly string[],
): string[] {
  const allowed = new Set(parents);
  return subtypes.filter((s) => allowed.has(subtypeParentCode(s)));
}

/**
 * After parent selection changes: keep valid subtypes, and if a parent has a
 * sub-menu but none selected, auto-pick its first subtype.
 */
export function ensureDefaultSubtypesForParents(
  parents: readonly string[],
  subtypes: readonly string[],
): string[] {
  const next = pruneLoadTypeSubtypes(parents, subtypes);
  for (const code of parents) {
    const parent = parentByCode(code);
    if (!parent || parent.subtypes.length === 0) continue;
    const hasAny = next.some((s) => subtypeParentCode(s) === code);
    if (!hasAny) {
      next.push(parent.subtypes[0]!.code);
    }
  }
  return next;
}

export function nextLoadTypeSubtypesOnToggle(
  current: readonly string[],
  subtypeCode: string,
  selecting: boolean,
): string[] {
  if (selecting) {
    return current.includes(subtypeCode) ? [...current] : [...current, subtypeCode];
  }
  return current.filter((c) => c !== subtypeCode);
}

/** Parents that expose subtypes but have none selected (block next step). */
export function parentsMissingRequiredSubtype(
  parents: readonly string[],
  subtypes: readonly string[],
): string[] {
  return parents.filter((code) => {
    const parent = parentByCode(code);
    if (!parent || parent.subtypes.length === 0) return false;
    return !subtypes.some((s) => subtypeParentCode(s) === code);
  });
}

export function parentByCode(code: string): LoadTypeParentMeta | undefined {
  return CLOX_LOAD_TYPES.find((t) => t.code === code);
}
