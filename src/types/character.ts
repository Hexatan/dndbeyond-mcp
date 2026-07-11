export interface DdbCharacter {
  id: number;
  readonlyUrl: string;
  name: string;
  race: DdbRace;
  classes: DdbClass[];
  background: DdbBackground;
  stats: DdbAbilityScore[];
  bonusStats: DdbAbilityScore[];
  overrideStats: DdbAbilityScore[];
  baseHitPoints: number;
  bonusHitPoints: number | null;
  overrideHitPoints: number | null;
  removedHitPoints: number;
  temporaryHitPoints: number;
  currentXp: number;
  alignmentId: number;
  lifestyleId: number;
  currencies: DdbCurrencies;
  spells: DdbSpellsContainer;
  classSpells?: Array<{
    characterClassId: number;
    spells: DdbSpell[];
  }>;
  inventory: DdbInventoryItem[];
  deathSaves: DdbDeathSaves;
  traits: DdbTraits;
  preferences: Record<string, unknown>;
  configuration: Record<string, unknown>;
  actions: Record<string, DdbAction[]>;
  modifiers: Record<string, DdbModifier[]>;
  campaign: { id: number; name: string } | null;
  feats: DdbFeat[];
  notes: DdbNotes;
  choices?: DdbChoices;
  level?: number;
  pactMagic?: {
    level: number;
    used: number;
    available: number;
  } | null;
  spellSlots?: Array<{
    level: number;
    used: number;
    available: number;
  }>;
  hitDiceUsed?: number;
  weightSpeeds?: DdbWeightSpeeds;
  speed?: DdbMovementSpeeds | number;
  speeds?: DdbMovementSpeeds;
  gender?: string | null;
  age?: number | string | null;
  height?: number | string | null;
  weight?: number | string | null;
  eyes?: string | null;
  hair?: string | null;
  skin?: string | null;
  faith?: string | null;
}

export interface DdbRace {
  fullName: string;
  baseRaceName: string;
  isHomebrew: boolean;
  racialTraits: DdbRacialTrait[];
  size?: string | null;
  sizeId?: number | null;
  weightSpeeds?: DdbWeightSpeeds;
  speed?: DdbMovementSpeeds | number;
}

export interface DdbClass {
  id: number;
  definition: {
    id: number;
    name: string;
    spellCastingAbilityId?: number | null;
    canCastSpells?: boolean;
    spellRules?: DdbSpellRules | null;
  };
  spellCastingAbilityId?: number | null;
  subclassDefinition: {
    id?: number;
    name: string;
    classFeatures: DdbClassFeature[];
    canCastSpells?: boolean;
  } | null;
  level: number;
  isStartingClass: boolean;
  classFeatures: DdbClassFeature[];
}

export interface DdbSpellRules {
  multiClassSpellSlotDivisor: number;
  multiClassSpellSlotRounding: number;
  levelSpellSlots: number[][];
}

export interface DdbMovementSpeeds {
  walk?: number | null;
  fly?: number | null;
  swim?: number | null;
  climb?: number | null;
  burrow?: number | null;
}

export interface DdbWeightSpeeds {
  normal?: DdbMovementSpeeds;
}

export interface DdbBackground {
  definition: {
    name: string;
    description: string;
    featureName: string | null;
    featureDescription: string | null;
    snippet: string | null;
    skillProficienciesDescription: string | null;
    toolProficienciesDescription: string | null;
    equipmentDescription: string | null;
  } | null;
}

export interface DdbAbilityScore {
  id: number; // 1=STR, 2=DEX, 3=CON, 4=INT, 5=WIS, 6=CHA
  value: number | null;
}

export interface DdbCurrencies {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface DdbSpellsContainer {
  race: DdbSpell[] | null;
  class: DdbSpell[] | null;
  background: DdbSpell[] | null;
  item: DdbSpell[] | null;
  feat: DdbSpell[] | null;
}

export interface DdbSpell {
  id: number;
  entityTypeId?: number;
  definitionId?: number;
  definition: {
    id?: number;
    name: string;
    level: number;
    school: string;
    description: string;
    range: {
      origin: string;
      rangeValue: number | null;
      aoeType: string | null;
      aoeValue: number | null;
    } | null;
    duration: {
      durationInterval: number | null;
      durationUnit: string | null; // "Hour", "Minute", etc.
      durationType: string; // "Concentration" or "Time"
    } | null;
    activation: {
      activationTime: number;
      activationType: number; // 1=Action, 3=Bonus Action, 6=Reaction
    } | null;
    components: number[] | null; // 1=V, 2=S, 3=M
    componentsDescription: string | null;
    concentration: boolean;
    ritual: boolean;
    isLegacy?: boolean; // true = 2014 (legacy) content; false = 2024
    sourceId?: number;
  };
  prepared: boolean;
  alwaysPrepared: boolean;
  countsAsKnownSpell?: boolean;
  usesSpellSlot: boolean;
}

export interface DdbInventoryItem {
  id: number;
  entityTypeId?: number;
  isProficient?: boolean;
  isAttuned?: boolean;
  containerEntityId?: number | null;
  chargesUsed?: number | null;
  limitedUse?: DdbLimitedUse | null;
  definition: {
    name: string;
    description: string;
    type: string;
    rarity: string;
    weight: number;
    cost: number | null;
    isHomebrew: boolean;
    entityTypeId?: number;
    armorClass?: number | null;
    filterType?: string;
    subType?: string | null;
    bundleSize?: number | null;
    isConsumable?: boolean;
    canAttune?: boolean;
  };
  equipped: boolean;
  quantity: number;
}

export interface DdbDeathSaves {
  failCount: number | null;
  successCount: number | null;
  isStabilized: boolean;
}

export interface DdbTraits {
  personalityTraits: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  appearance: string | null;
}

export interface DdbLimitedUse {
  maxUses: number;
  numberUsed: number;
  resetType: number; // 1 = Short Rest, 2 = Long Rest
  resetTypeDescription?: string | null;
}

export interface DdbAction {
  id: number;
  entityTypeId: number;
  name: string;
  componentId: number;
  componentTypeId: number;
  limitedUse: DdbLimitedUse | null;
}

export interface DdbModifier {
  id: string | number;
  type: string;
  subType: string;
  value: number | null;
  friendlyTypeName: string;
  friendlySubtypeName: string;
  restriction?: string | null;
  componentId: number;
  componentTypeId: number;
}

export interface DdbFeat {
  definition: {
    id?: number;
    entityTypeId?: number;
    name: string;
    description: string;
    snippet: string | null;
    prerequisite: string | null;
  };
  componentId: number;
  componentTypeId: number;
}

export interface DdbClassFeature {
  // Class features nest under .definition; subclass features are flat
  definition?: {
    id?: number;
    name: string;
    requiredLevel: number;
    description: string;
    snippet: string | null;
  };
  // Flat fields (subclass features)
  id?: number;
  name?: string;
  requiredLevel?: number;
  description?: string;
}

export interface DdbChoiceOption {
  id: number;
  label: string;
  description?: string | null;
}

export interface DdbChoice {
  id: string;
  label?: string;
  componentId: number;
  componentTypeId: number;
  type: number;
  optionValue: number | null;
  optionIds?: number[];
  parentChoiceId?: string | number | null;
}

export interface DdbChoices {
  class?: DdbChoice[];
  feat?: DdbChoice[];
  choiceDefinitions?: Array<{
    id: string;
    options: DdbChoiceOption[];
  }>;
}

export interface DdbRacialTrait {
  definition: {
    name: string;
    description: string;
    snippet: string | null;
  };
}

export interface DdbNotes {
  personalPossessions: string | null;
  backstory: string | null;
  otherNotes: string | null;
  allies: string | null;
  organizations: string | null;
}

export interface CharacterSummary {
  id: number;
  name: string;
  race: string;
  classes: string;
  level: number;
  hp: { current: number; max: number; temp: number };
  ac: number;
  campaignName: string | null;
}
