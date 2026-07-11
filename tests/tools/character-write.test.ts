import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCharacter,
  addCharacterSpell,
  addCharacterSpells,
  setCharacterSpellsPrepared,
  listClassFeatureChoices,
  listClassSpells,
  listSubclasses,
  removeCharacterSpell,
  resolveChoices,
  setSubclass,
  setClassFeatureChoice,
  setCharacterAppearance,
  setCharacterPreferences,
  setCharacterSourceCategories,
  updateCurrency,
  updateDeathSaves,
  updateHp,
  updateSpellSlots,
  useAbility,
} from "../../src/tools/character.js";
import type { DdbClient } from "../../src/api/client.js";
import type { DdbCharacter } from "../../src/types/character.js";

const mockCharacter: DdbCharacter = {
  id: 123,
  readonlyUrl: "https://example.com",
  name: "Test Character",
  race: { fullName: "Human", baseRaceName: "Human", isHomebrew: false },
  classes: [
    {
      id: 1,
      definition: { name: "Fighter" },
      subclassDefinition: null,
      level: 5,
      isStartingClass: true,
    },
  ],
  level: 5,
  background: { definition: null },
  stats: [
    { id: 1, value: 16 },
    { id: 2, value: 14 },
    { id: 3, value: 15 },
    { id: 4, value: 10 },
    { id: 5, value: 12 },
    { id: 6, value: 8 },
  ],
  bonusStats: [],
  overrideStats: [],
  modifiers: {
    race: [],
    class: [],
    background: [],
    item: [],
    feat: [],
    condition: [],
  },
  baseHitPoints: 40,
  bonusHitPoints: 5,
  overrideHitPoints: null,
  removedHitPoints: 10,
  temporaryHitPoints: 0,
  currentXp: 6500,
  alignmentId: 1,
  lifestyleId: 1,
  currencies: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 },
  spells: {
    race: [],
    class: [],
    background: [],
    item: [],
    feat: [],
  },
  inventory: [],
  deathSaves: { failCount: 0, successCount: 0, isStabilized: false },
  traits: {
    personalityTraits: null,
    ideals: null,
    bonds: null,
    flaws: null,
    appearance: null,
  },
  preferences: {},
  configuration: {},
  campaign: null,
};

// Character with actions for useAbility tests
const mockCharacterWithActions: DdbCharacter = {
  ...mockCharacter,
  actions: {
    class: [
      {
        id: 100,
        entityTypeId: 200,
        name: "Action Surge",
        limitedUse: {
          maxUses: 1,
          numberUsed: 0,
          resetTypeDescription: "Short Rest",
        },
      },
    ],
  },
};

describe("updateHp", () => {
  let mockClient: DdbClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn().mockResolvedValue(mockCharacter),
      getRaw: vi.fn(),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;
  });

  it("should heal character when hpChange is positive", async () => {
    const result = await updateHp(mockClient, {
      characterId: 123,
      hpChange: 10,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/life/hp/damage-taken"),
      { characterId: 123, removedHitPoints: 0 },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Healed Test Character for 10 HP");
  });

  it("should damage character when hpChange is negative", async () => {
    const result = await updateHp(mockClient, {
      characterId: 123,
      hpChange: -5,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/life/hp/damage-taken"),
      { characterId: 123, removedHitPoints: 15 },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Damaged Test Character for 5 HP");
  });

  it("should not allow negative HP", async () => {
    await updateHp(mockClient, {
      characterId: 123,
      hpChange: -100,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.anything(),
      { characterId: 123, removedHitPoints: 55 },
      expect.anything()
    );
  });
});

describe("updateSpellSlots", () => {
  let mockClient: DdbClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn().mockResolvedValue(mockCharacter),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;
  });

  it("should update spell slots for valid level", async () => {
    const result = await updateSpellSlots(mockClient, {
      characterId: 123,
      level: 3,
      used: 2,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/character/123/spell/slots"),
      { level: 3, used: 2 },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Updated level 3 spell slots to 2 used");
  });

  it("should reject invalid spell level below 1", async () => {
    const result = await updateSpellSlots(mockClient, {
      characterId: 123,
      level: 0,
      used: 1,
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Spell slot level must be between 1 and 9");
  });

  it("should reject invalid spell level above 9", async () => {
    const result = await updateSpellSlots(mockClient, {
      characterId: 123,
      level: 10,
      used: 1,
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Spell slot level must be between 1 and 9");
  });

  it("should reject negative used slots", async () => {
    const result = await updateSpellSlots(mockClient, {
      characterId: 123,
      level: 1,
      used: -1,
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Used spell slots cannot be negative");
  });
});

describe("updateDeathSaves", () => {
  let mockClient: DdbClient;

  beforeEach(() => {
    mockClient = {
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;
  });

  it("should update success death saves", async () => {
    const result = await updateDeathSaves(mockClient, {
      characterId: 123,
      type: "success",
      count: 2,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/character/123/life/death-saves"),
      { successCount: 2 },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Updated death saves: 2 successes");
  });

  it("should update failure death saves", async () => {
    const result = await updateDeathSaves(mockClient, {
      characterId: 123,
      type: "failure",
      count: 1,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/character/123/life/death-saves"),
      { failCount: 1 },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Updated death saves: 1 failure");
  });

  it("should reject invalid type", async () => {
    const result = await updateDeathSaves(mockClient, {
      characterId: 123,
      type: "invalid" as "success",
      count: 1,
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Death save type must be 'success' or 'failure'");
  });

  it("should reject count below 0", async () => {
    const result = await updateDeathSaves(mockClient, {
      characterId: 123,
      type: "success",
      count: -1,
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Death save count must be between 0 and 3");
  });

  it("should reject count above 3", async () => {
    const result = await updateDeathSaves(mockClient, {
      characterId: 123,
      type: "success",
      count: 4,
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Death save count must be between 0 and 3");
  });
});

describe("updateCurrency", () => {
  let mockClient: DdbClient;

  beforeEach(() => {
    mockClient = {
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;
  });

  it("should update gold pieces", async () => {
    const result = await updateCurrency(mockClient, {
      characterId: 123,
      currency: "gp",
      amount: 150,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/inventory/currency/gold"),
      { characterId: 123, amount: 150 },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Set GP to 150");
  });

  it("should use legacy currency endpoint for non-gold coins", async () => {
    const currencies = ["cp", "sp", "ep", "pp"] as const;

    for (const currency of currencies) {
      await updateCurrency(mockClient, {
        characterId: 123,
        currency,
        amount: 10,
      });

      expect(mockClient.put).toHaveBeenCalledWith(
        expect.anything(),
        { [currency]: 10 },
        ["character:123"]
      );
    }
  });

  it("should reject invalid currency type", async () => {
    const result = await updateCurrency(mockClient, {
      characterId: 123,
      currency: "invalid" as "gp",
      amount: 100,
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Currency must be one of: cp, sp, ep, gp, pp");
  });
});

describe("useAbility", () => {
  let mockClient: DdbClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn().mockResolvedValue(mockCharacterWithActions),
      getRaw: vi.fn(),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;
  });

  it("should use a limited ability", async () => {
    const result = await useAbility(mockClient, {
      characterId: 123,
      abilityName: "Action Surge",
    });

    expect(mockClient.get).toHaveBeenCalled();
    expect(mockClient.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        characterId: 123,
        id: "100",
        entityTypeId: "200",
        uses: 1,
      }),
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Action Surge");
    expect(result.content[0].text).toContain("1/1 uses expended");
  });

  it("should reject empty ability name", async () => {
    const result = await useAbility(mockClient, {
      characterId: 123,
      abilityName: "",
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Ability name cannot be empty");
  });

  it("should reject whitespace-only ability name", async () => {
    const result = await useAbility(mockClient, {
      characterId: 123,
      abilityName: "   ",
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Ability name cannot be empty");
  });
});

describe("updateHp with temporary HP", () => {
  let mockClient: DdbClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn().mockResolvedValue(mockCharacter),
      getRaw: vi.fn(),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;
  });

  it("should include temporaryHitPoints in PUT body when tempHp is provided", async () => {
    const result = await updateHp(mockClient, {
      characterId: 123,
      hpChange: 5,
      tempHp: 10,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/life/hp/damage-taken"),
      { characterId: 123, removedHitPoints: 5, temporaryHitPoints: 10 },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("(10 temp HP)");
  });

  it("should not include temporaryHitPoints when tempHp is undefined", async () => {
    await updateHp(mockClient, {
      characterId: 123,
      hpChange: 5,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/life/hp/damage-taken"),
      { characterId: 123, removedHitPoints: 5 },
      ["character:123"]
    );
  });

  it("should set temporaryHitPoints to 0 when tempHp is 0", async () => {
    const result = await updateHp(mockClient, {
      characterId: 123,
      hpChange: 0,
      tempHp: 0,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.anything(),
      { characterId: 123, removedHitPoints: 10, temporaryHitPoints: 0 },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("(0 temp HP)");
  });
});

describe("setCharacterPreferences", () => {
  it("should update provided preference fields", async () => {
    const mockClient = {
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await setCharacterPreferences(mockClient, {
      characterId: 123,
      progressionType: 2,
      hitPointType: 1,
      enableOptionalClassFeatures: true,
      diceSetId: null,
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/character/preferences"),
      {
        characterId: 123,
        progressionType: 2,
        hitPointType: 1,
        enableOptionalClassFeatures: true,
        diceSetId: null,
      },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Updated preferences");
  });

  it("should reject empty preference updates", async () => {
    const mockClient = {
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await setCharacterPreferences(mockClient, { characterId: 123 });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Provide at least one preference field");
  });
});

describe("setCharacterSourceCategories", () => {
  it("should update active source categories", async () => {
    const mockClient = {
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await setCharacterSourceCategories(mockClient, {
      characterId: 123,
      sourceCategories: [24, 26],
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/character/source-categories"),
      { characterId: 123, activeSourceCategories: [24, 26] },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Updated source categories");
  });

  it("should allow disabling all toggled source categories", async () => {
    const mockClient = {
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    await setCharacterSourceCategories(mockClient, {
      characterId: 123,
      sourceCategories: [],
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/character/source-categories"),
      { characterId: 123, activeSourceCategories: [] },
      ["character:123"]
    );
  });
});

describe("setCharacterAppearance", () => {
  it("should update a physical appearance field", async () => {
    const mockClient = {
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await setCharacterAppearance(mockClient, {
      characterId: 123,
      field: "hair",
      value: "Black",
    });

    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/description/hair"),
      { characterId: 123, hair: "Black" },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Updated hair");
  });

  it("should reject unknown appearance fields", async () => {
    const mockClient = {
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await setCharacterAppearance(mockClient, {
      characterId: 123,
      field: "backstory",
      value: "Nope",
    });

    expect(mockClient.put).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Invalid appearance field");
  });
});

describe("createCharacter", () => {
  it("should apply preferences and appearance after standard creation", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue(456),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await createCharacter(mockClient, {
      method: "standard",
      preferences: {
        progressionType: 1,
        useHomebrewContent: true,
      },
      sourceCategories: [24, 26],
      appearance: {
        eyes: "Green",
        height: "5'9\"",
      },
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/builder/standard-build"),
      { showHelpText: false }
    );
    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/character/preferences"),
      { characterId: 456, progressionType: 1, useHomebrewContent: true },
      ["character:456"]
    );
    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/character/source-categories"),
      { characterId: 456, activeSourceCategories: [24, 26] },
      ["character:456"]
    );
    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/description/eyes"),
      { characterId: 456, eyes: "Green" },
      ["character:456"]
    );
    expect(mockClient.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/description/height"),
      { characterId: 456, height: "5'9\"" },
      ["character:456"]
    );
    expect(result.content[0].text).toContain("Applied preferences and source categories and 2 appearance field(s)");
  });
});

const shadowSorcerer = {
  ...mockCharacter,
  name: "Test Sorcerer",
  configuration: { abilityScoreType: 1, startingEquipmentType: 1 },
  classes: [{
    id: 234222691,
    definition: { id: 6, name: "Sorcerer" },
    subclassDefinition: { id: 114, name: "Shadow Magic", classFeatures: [] },
    level: 5,
    isStartingClass: true,
    classFeatures: [{ definition: { id: 750, name: "Sorcerous Origin", requiredLevel: 1, description: "", snippet: null } }],
  }],
} as unknown as DdbCharacter;

const acidSplash = {
  id: 136018,
  entityTypeId: 435869154,
  definition: {
    id: 1989,
    name: "Acid Splash",
    level: 0,
    school: "Conjuration",
    description: "",
    range: null,
    duration: null,
    activation: null,
    components: null,
    componentsDescription: null,
    concentration: false,
    ritual: false,
  },
  prepared: false,
  alwaysPrepared: false,
  usesSpellSlot: false,
};

describe("subclass and spell builder APIs", () => {
  const wizardChoiceCharacter = {
    ...shadowSorcerer,
    name: "Choice Wizard",
    classes: [{
      id: 234229296,
      definition: { id: 8, name: "Wizard" },
      subclassDefinition: { id: 26, name: "School of Evocation", classFeatures: [] },
      level: 3,
      isStartingClass: true,
      classFeatures: [{ definition: { id: 470, name: "Proficiencies", requiredLevel: 1, description: "", snippet: null } }],
    }],
    choices: {
      class: [{
        id: "2-1597",
        label: "Choose a Wizard Skill",
        componentId: 470,
        componentTypeId: 12168134,
        type: 2,
        optionValue: null,
        optionIds: [4154, 4155],
      }],
      choiceDefinitions: [{
        id: "12168134-2",
        options: [
          { id: 4154, label: "Arcana" },
          { id: 4155, label: "History" },
          { id: 9999, label: "Not Allowed" },
        ],
      }],
    },
  } as unknown as DdbCharacter;

  it("lists labeled class choices joined to their class features", async () => {
    const client = {
      get: vi.fn()
        .mockResolvedValueOnce(wizardChoiceCharacter)
        .mockResolvedValueOnce([{ id: 8, classFeatures: [{ id: 470, name: "Proficiencies" }] }]),
    } as unknown as DdbClient;

    const result = await listClassFeatureChoices(client, { characterId: 123 });
    const data = JSON.parse(result.content[0].text);

    expect(data.choices[0]).toEqual(expect.objectContaining({
      featureName: "Proficiencies",
      choiceKey: "2-1597",
      options: [{ id: 4154, label: "Arcana" }, { id: 4155, label: "History" }],
    }));
  });

  it("sets a class feature choice by its labeled option name", async () => {
    const client = {
      get: vi.fn().mockResolvedValue(wizardChoiceCharacter),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await setClassFeatureChoice(client, {
      characterId: 123,
      choiceKey: "2-1597",
      optionName: "Arcana",
    });

    expect(client.put).toHaveBeenCalledWith(
      expect.stringContaining("/class/feature/choice"),
      {
        characterId: 123,
        classId: 26,
        classFeatureId: 470,
        classMappingId: 234229296,
        type: 2,
        choiceKey: "2-1597",
        choiceValue: 4154,
        parentChoiceId: null,
      },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Arcana");
  });

  it("fills subclass choices from the subclass catalogue", async () => {
    const character = {
      ...wizardChoiceCharacter,
      classes: [{ ...wizardChoiceCharacter.classes[0], subclassDefinition: null }],
      choices: {
        class: [{
          id: "7-412",
          componentId: 412,
          componentTypeId: 12168134,
          type: 7,
          optionValue: null,
          optionIds: [],
        }],
        choiceDefinitions: [{ id: "12168134-7", options: [] }],
      },
    } as unknown as DdbCharacter;
    const client = {
      get: vi.fn()
        .mockResolvedValueOnce(character)
        .mockResolvedValueOnce([{ id: 8, classFeatures: [{ id: 412, name: "Arcane Tradition" }] }])
        .mockResolvedValueOnce([{ id: 26, name: "School of Evocation", parentClassId: 8 }]),
    } as unknown as DdbClient;

    const result = await listClassFeatureChoices(client, { characterId: 123 });
    const data = JSON.parse(result.content[0].text);

    expect(data.choices[0].options).toEqual([{ id: 26, label: "School of Evocation" }]);
  });

  it("fills feat choices from the feat catalogue and preserves their parent", async () => {
    const character = {
      ...wizardChoiceCharacter,
      choices: {
        class: [{
          id: "6-268",
          label: "Choose a Feat",
          componentId: 268,
          componentTypeId: 12168134,
          type: 6,
          optionValue: null,
          optionIds: [],
          parentChoiceId: "1-268",
        }],
        choiceDefinitions: [{ id: "12168134-6", options: [] }],
      },
    } as unknown as DdbCharacter;
    const client = {
      get: vi.fn()
        .mockResolvedValueOnce(character)
        .mockResolvedValueOnce([{ id: 41, name: "Sentinel" }]),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    await setClassFeatureChoice(client, {
      characterId: 123,
      choiceKey: "6-268",
      optionName: "Sentinel",
    });

    expect(client.put).toHaveBeenCalledWith(
      expect.stringContaining("/class/feature/choice"),
      expect.objectContaining({ choiceValue: 41, parentChoiceId: "1-268" }),
      ["character:123"]
    );
  });

  it("lists subclasses from the live game-data endpoint", async () => {
    const client = { get: vi.fn().mockResolvedValue([{ id: 114, name: "Shadow Magic", parentClassId: 6 }]) } as unknown as DdbClient;

    const result = await listSubclasses(client, { baseClassId: 6 });

    expect(client.get).toHaveBeenCalledWith(expect.stringContaining("/game-data/subclasses?sharingSetting=2&baseClassId=6"), "subclasses:6");
    expect(result.content[0].text).toContain("ID 114 | Shadow Magic");
  });

  it("sets a subclass using its catalogue ID", async () => {
    const character = {
      ...shadowSorcerer,
      classes: [{ ...shadowSorcerer.classes[0], subclassDefinition: null }],
      choices: { class: [{ id: "7-750", type: 7, componentId: 750, optionValue: null }] },
    } as unknown as DdbCharacter;
    const client = {
      get: vi.fn().mockResolvedValueOnce(character).mockResolvedValueOnce([{ id: 114, name: "Shadow Magic", parentClassId: 6 }]),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    await setSubclass(client, { characterId: 123, subclassName: "Shadow Magic" });

    expect(client.put).toHaveBeenCalledWith(
      expect.stringContaining("/class/feature/choice"),
      expect.objectContaining({ characterId: 123, classId: 6, classMappingId: 234222691, choiceValue: 114 }),
      ["character:123"]
    );
  });

  it("changes an already selected subclass", async () => {
    const character = {
      ...shadowSorcerer,
      choices: { class: [{ id: "7-750", type: 7, componentId: 750, optionValue: 114 }] },
    } as unknown as DdbCharacter;
    const client = {
      get: vi.fn().mockResolvedValueOnce(character).mockResolvedValueOnce([{ id: 115, name: "Draconic Bloodline", parentClassId: 6 }]),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    await setSubclass(client, { characterId: 123, subclassName: "Draconic Bloodline" });

    expect(client.put).toHaveBeenCalledWith(
      expect.stringContaining("/class/feature/choice"),
      expect.objectContaining({ choiceKey: "7-750", choiceValue: 115 }),
      ["character:123"]
    );
  });

  it("lists ordinary spells using the base class ID", async () => {
    const client = { get: vi.fn().mockResolvedValueOnce(shadowSorcerer).mockResolvedValueOnce([acidSplash]).mockResolvedValueOnce([acidSplash]) } as unknown as DdbClient;

    const result = await listClassSpells(client, { characterId: 123, name: "acid" });

    expect(client.get).toHaveBeenCalledWith(expect.stringContaining("classId=6&classLevel=5"), "class-spells:6:5");
    expect(result.content[0].text).toContain("Definition 1989");
  });

  it("adds a spell with the captured POST body", async () => {
    const client = {
      get: vi.fn().mockResolvedValueOnce(shadowSorcerer).mockResolvedValueOnce([acidSplash]).mockResolvedValueOnce([acidSplash]),
      post: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    await addCharacterSpell(client, { characterId: 123, spellName: "Acid Splash" });

    expect(client.post).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/spell"),
      { characterId: 123, characterClassId: 234222691, spellId: 1989, id: 136018, entityTypeId: 435869154 },
      ["character:123"]
    );
  });

  it("adds multiple spells with one catalogue lookup", async () => {
    const client = {
      get: vi.fn().mockResolvedValueOnce(shadowSorcerer).mockResolvedValueOnce([acidSplash]).mockResolvedValueOnce([acidSplash]),
      post: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await addCharacterSpells(client, {
      characterId: 123,
      spellNames: ["Acid Splash", "Missing Spell"],
    });

    expect(client.get).toHaveBeenCalledTimes(3);
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(result.content[0].text).toContain("Added 1 spell(s)");
    expect(result.content[0].text).toContain("Missing Spell");
  });

  it("prepares multiple spells with the captured PUT body", async () => {
    const bane = {
      ...acidSplash,
      id: 136081,
      definition: { ...acidSplash.definition, id: 2009, name: "Bane", level: 1 },
      prepared: false,
    };
    const character = {
      ...shadowSorcerer,
      classSpells: [{ characterClassId: 234222691, spells: [bane] }],
    } as unknown as DdbCharacter;
    const client = {
      get: vi.fn().mockResolvedValueOnce(character).mockResolvedValueOnce([bane]),
      put: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    const result = await setCharacterSpellsPrepared(client, {
      characterId: 123,
      spellNames: ["Bane"],
      prepared: true,
    });

    expect(client.put).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/spell/prepared"),
      { characterId: 123, spellId: 2009, characterClassId: 234222691, entityTypeId: 435869154, id: 136081, prepared: true },
      ["character:123"]
    );
    expect(result.content[0].text).toContain("Prepared 1 spell(s)");
  });

  it("removes a spell with the captured DELETE body", async () => {
    const character = { ...shadowSorcerer, classSpells: [{ characterClassId: 234222691, spells: [acidSplash] }] } as unknown as DdbCharacter;
    const client = {
      get: vi.fn().mockResolvedValueOnce(character).mockResolvedValueOnce([acidSplash]).mockResolvedValueOnce([acidSplash]),
      delete: vi.fn().mockResolvedValue({}),
    } as unknown as DdbClient;

    await removeCharacterSpell(client, { characterId: 123, spellName: "Acid Splash" });

    expect(client.delete).toHaveBeenCalledWith(
      expect.stringContaining("/character/v5/spell"),
      { characterId: 123, spellId: 1989, characterClassId: 234222691, entityTypeId: 435869154, id: 136018 },
      ["character:123"]
    );
  });

  it("resolves a type-7 subclass choice from the subclass catalogue", async () => {
    let resolved = false;
    const unresolvedCharacter = {
      ...shadowSorcerer,
      classes: [{ ...shadowSorcerer.classes[0], subclassDefinition: null }],
      choices: { class: [{ id: "7-750", type: 7, componentId: 750, optionValue: null }] },
    } as unknown as DdbCharacter;
    const resolvedCharacter = {
      ...unresolvedCharacter,
      choices: { class: [{ id: "7-750", type: 7, componentId: 750, optionValue: 114 }] },
    } as unknown as DdbCharacter;
    const client = {
      get: vi.fn(async (url: string) => {
        if (url.includes("/game-data/subclasses")) return [{ id: 114, name: "Shadow Magic", parentClassId: 6 }];
        return resolved ? resolvedCharacter : unresolvedCharacter;
      }),
      put: vi.fn(async () => { resolved = true; }),
    } as unknown as DdbClient;

    const result = await resolveChoices(client, { characterId: 123 });

    expect(client.put).toHaveBeenCalledWith(
      expect.stringContaining("/class/feature/choice"),
      expect.objectContaining({ choiceValue: 114 }),
      ["character:123"]
    );
    expect(result.content[0].text).toContain("All choices resolved");
  });
});
