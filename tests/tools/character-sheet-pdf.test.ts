import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { DdbClient } from "../../src/api/client.js";
import type { DdbCharacter } from "../../src/types/character.js";
import {
  extractCharacterSheetData,
  generateCharacterSheetPdf,
  renderCharacterSheetPdf,
} from "../../src/tools/character-sheet-pdf.js";

function createMockClient(): DdbClient {
  return {
    get: vi.fn(),
    getRaw: vi.fn(),
  } as unknown as DdbClient;
}

function createMockCharacter(): DdbCharacter {
  return {
    id: 12345,
    readonlyUrl: "https://www.dndbeyond.com/characters/12345",
    name: "Test Sorcerer",
    race: {
      fullName: "Changeling",
      baseRaceName: "Changeling",
      isHomebrew: false,
      racialTraits: [
        { definition: { name: "Shapechanger", description: "", snippet: null } },
      ],
    },
    classes: [
      {
        id: 1,
        definition: {
          id: 6,
          name: "Sorcerer",
          canCastSpells: true,
          spellRules: {
            multiClassSpellSlotDivisor: 1,
            multiClassSpellSlotRounding: 1,
            levelSpellSlots: [[], [], [], [], [], [], [4, 3, 3]],
          },
        },
        subclassDefinition: {
          name: "Aberrant Mind",
          classFeatures: [
            { name: "Telepathic Speech", requiredLevel: 1, description: "" },
            { name: "Psychic Defenses", requiredLevel: 6, description: "" },
          ],
        },
        level: 6,
        isStartingClass: true,
        classFeatures: [
          { definition: { name: "Spellcasting", requiredLevel: 1, description: "", snippet: null } },
          { definition: { name: "Font of Magic", requiredLevel: 2, description: "", snippet: null } },
          {
            definition: {
              id: 372,
              name: "Metamagic",
              requiredLevel: 3,
              description: "Use Sorcery Points to customize spells.",
              snippet: null,
            },
          },
        ],
      },
    ],
    background: {
      definition: {
        name: "Investigator",
        description: "",
        featureName: "Official Inquiry",
        featureDescription: "",
        snippet: null,
        skillProficienciesDescription: null,
        toolProficienciesDescription: null,
        equipmentDescription: null,
      },
    },
    stats: [
      { id: 1, value: 7 },
      { id: 2, value: 12 },
      { id: 3, value: 12 },
      { id: 4, value: 14 },
      { id: 5, value: 14 },
      { id: 6, value: 18 },
    ],
    bonusStats: [],
    overrideStats: [],
    baseHitPoints: 26,
    bonusHitPoints: null,
    overrideHitPoints: null,
    removedHitPoints: 5,
    temporaryHitPoints: 3,
    currentXp: 0,
    alignmentId: 1,
    lifestyleId: 1,
    currencies: { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 },
    spells: {
      race: [],
      class: [
        {
          id: 1,
          definition: {
            name: "Mind Sliver",
            level: 0,
            school: "Enchantment",
            description: "The target takes 1d6 psychic damage.",
            range: { origin: "Ranged", rangeValue: 60, aoeType: null, aoeValue: null },
            duration: { durationInterval: 1, durationUnit: "Round", durationType: "Time" },
            activation: { activationTime: 1, activationType: 1 },
            components: [1],
            componentsDescription: null,
            concentration: false,
            ritual: false,
          },
          prepared: true,
          alwaysPrepared: false,
          usesSpellSlot: false,
        },
        {
          id: 2,
          definition: {
            name: "Sending",
            level: 3,
            school: "Evocation",
            description: "",
            range: null,
            duration: null,
            activation: null,
            components: [1, 2, 3],
            componentsDescription: null,
            concentration: false,
            ritual: false,
          },
          prepared: true,
          alwaysPrepared: false,
          usesSpellSlot: true,
        },
      ],
      background: [],
      item: [],
      feat: [],
    },
    classSpells: [{
      characterClassId: 1,
      spells: [
        {
          id: 3,
          definition: {
            id: 3,
            name: "Fire Bolt",
            level: 0,
            school: "Evocation",
            description: "Make a ranged spell attack. The target takes 1d10 fire damage.",
            range: { origin: "Ranged", rangeValue: 120, aoeType: null, aoeValue: null },
            duration: { durationInterval: null, durationUnit: null, durationType: "Instantaneous" },
            activation: { activationTime: 1, activationType: 1 },
            components: [1, 2],
            componentsDescription: null,
            concentration: false,
            ritual: false,
          },
          prepared: false,
          alwaysPrepared: false,
          countsAsKnownSpell: true,
          usesSpellSlot: false,
        },
        {
          id: 4,
          definition: {
            id: 4,
            name: "Mage Armor",
            level: 1,
            school: "Abjuration",
            description: "The target's base AC becomes 13 plus its Dexterity modifier.",
            range: { origin: "Touch", rangeValue: null, aoeType: null, aoeValue: null },
            duration: { durationInterval: 8, durationUnit: "Hour", durationType: "Time" },
            activation: { activationTime: 1, activationType: 1 },
            components: [1, 2, 3],
            componentsDescription: null,
            concentration: false,
            ritual: false,
          },
          prepared: false,
          alwaysPrepared: false,
          countsAsKnownSpell: true,
          usesSpellSlot: true,
        },
      ],
    }],
    inventory: [
      {
        id: 1,
        definition: {
          name: "Dagger",
          description: "",
          type: "Weapon",
          rarity: "Common",
          weight: 1,
          cost: 2,
          isHomebrew: false,
        },
        equipped: true,
        quantity: 1,
      },
      {
        id: 2,
        entityTypeId: 1782728300,
        definition: {
          name: "Crossbow, Light",
          description: "",
          type: "Equipment",
          rarity: "Common",
          weight: 5,
          cost: 25,
          isHomebrew: false,
        },
        equipped: true,
        quantity: 1,
      },
      {
        id: 3,
        definition: {
          name: "Backpack",
          description: "",
          type: "Gear",
          rarity: "Common",
          weight: 5,
          cost: 2,
          isHomebrew: false,
        },
        equipped: false,
        quantity: 1,
      },
    ],
    deathSaves: { failCount: 1, successCount: 2, isStabilized: false },
    traits: {
      personalityTraits: "I never accept that I am out of my depth.",
      ideals: "Obsession.",
      bonds: "I use my cunning mind to solve mysteries.",
      flaws: "Too naive.",
      appearance: null,
    },
    preferences: {},
    configuration: {},
    choices: {
      class: [
        { componentId: 372, componentTypeId: 12168134, type: 3, optionValue: 111 },
        { componentId: 372, componentTypeId: 12168134, type: 3, optionValue: 109 },
      ],
      feat: [
        { componentId: 452833, componentTypeId: 1088085227, type: 3, optionValue: 113 },
      ],
      choiceDefinitions: [
        {
          id: "12168134-3",
          options: [
            { id: 111, label: "Quickened Spell", description: "Spend 2 Sorcery Points to cast as a Bonus Action." },
            { id: 109, label: "Extended Spell", description: "Spend 1 Sorcery Point to double the duration." },
          ],
        },
        {
          id: "1088085227-3",
          options: [
            { id: 113, label: "Twinned Spell", description: "Spend Sorcery Points to affect a second target." },
          ],
        },
      ],
    },
    actions: {
      class: [
        {
          id: 1,
          entityTypeId: 1,
          name: "Sorcery Points",
          componentId: 1,
          componentTypeId: 1,
          limitedUse: {
            maxUses: 6,
            numberUsed: 2,
            resetType: 1,
            resetTypeDescription: "Long Rest",
          },
        },
      ],
      item: [
        {
          id: 2,
          entityTypeId: 1,
          name: "Quarterstaff",
          componentId: 1,
          componentTypeId: 1,
          limitedUse: null,
          displayAsAttack: true,
          snippet: "Melee Weapon Attack: +1 to hit. Hit: 1d6 - 2 bludgeoning damage.",
        } as any,
        {
          id: 3,
          entityTypeId: 1,
          name: "Dagger",
          componentId: 1,
          componentTypeId: 1,
          limitedUse: null,
          displayAsAttack: true,
        } as any,
        {
          id: 4,
          entityTypeId: 1,
          name: "Light Crossbow",
          componentId: 1,
          componentTypeId: 1,
          limitedUse: null,
          displayAsAttack: true,
          snippet: "Ranged Weapon Attack: +4 to hit. Hit: 1d8 + 1 piercing damage.",
        } as any,
      ],
    },
    modifiers: {
      class: [
        { id: "save-con", type: "proficiency", subType: "constitution-saving-throws", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Constitution Saving Throws", componentId: 1, componentTypeId: 1 },
        { id: "save-cha", type: "proficiency", subType: "charisma-saving-throws", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Charisma Saving Throws", componentId: 1, componentTypeId: 1 },
        { id: "arcana", type: "proficiency", subType: "arcana", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Arcana", componentId: 1, componentTypeId: 1 },
        { id: "psychic", type: "resistance", subType: "psychic", value: null, friendlyTypeName: "Resistance", friendlySubtypeName: "Psychic", componentId: 1, componentTypeId: 1 },
        { id: "charm-fear", type: "advantage", subType: "saving-throws", value: null, friendlyTypeName: "Advantage", friendlySubtypeName: "Saving Throws", restriction: "against being charmed or frightened", componentId: 1, componentTypeId: 1 },
      ],
      race: [
        { id: "tool", type: "proficiency", subType: "disguise-kit", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Disguise Kit", componentId: 1, componentTypeId: 1 },
        { id: "dagger", type: "proficiency", subType: "dagger", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Dagger", componentId: 1, componentTypeId: 1 },
        { id: "crossbow-light", type: "proficiency", subType: "light-crossbows", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Light Crossbows", componentId: 1, componentTypeId: 1 },
        { id: "common", type: "language", subType: "common", value: null, friendlyTypeName: "Language", friendlySubtypeName: "Common", componentId: 1, componentTypeId: 1 },
      ],
    },
    campaign: { id: 1, name: "Test Campaign" },
    feats: [
      {
        componentId: 1,
        componentTypeId: 12168134,
        definition: {
          id: 452833,
          entityTypeId: 1088085227,
          name: "Metamagic Adept",
          description: "Learn two additional Metamagic options.",
          snippet: null,
          prerequisite: null,
        },
      },
    ],
    notes: {
      personalPossessions: "Maps and jewelry.",
      backstory: "The test sorcerer grew up with family stories.",
      otherNotes: null,
      allies: null,
      organizations: null,
    },
    pactMagic: null,
    spellSlots: [
      { level: 1, used: 0, available: 0 },
      { level: 2, used: 0, available: 0 },
      { level: 3, used: 1, available: 0 },
    ],
    hitDiceUsed: 1,
    speed: 30,
  };
}

describe("character sheet PDF", () => {
  it("extracts D&D Beyond data for a filled sheet", () => {
    const data = extractCharacterSheetData(createMockCharacter());

    expect(data.name).toBe("Test Sorcerer");
    expect(data.level).toBe(6);
    expect(data.proficiencyBonus).toBe(3);
    expect(data.hp).toEqual({ current: 27, max: 32, temp: 3 });
    expect(data.ac).toBe(11);
    expect(data.abilities.find((ability) => ability.label === "CHA")?.value).toBe("18");
    expect(data.saves.find((save) => save.ability === "CON")).toMatchObject({ total: "+4", proficient: true });
    expect(data.skills.find((skill) => skill.name === "Arcana")).toMatchObject({ total: "+5", proficient: true });
    expect(data.spellcasting).toEqual({ ability: "CHA", saveDc: "15", attackBonus: "+7" });
    expect(data.spellSlots).toEqual([
      { level: 1, used: 0, available: 4 },
      { level: 2, used: 0, available: 3 },
      { level: 3, used: 1, available: 3 },
    ]);
    expect(data.proficiencies).toMatchObject({
      weapons: ["Dagger", "Light Crossbows"],
      tools: ["Disguise Kit"],
      languages: ["Common"],
    });
    expect(data.defenses).toEqual([
      { label: "Resistances", value: "Psychic" },
      { label: "Save Advantages", value: "Charmed, Frightened" },
    ]);
    expect(data.resources).toEqual([
      { name: "Sorcery Points", numberUsed: 2, maxUses: 6 },
    ]);
    expect(data.features).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Metamagic: Quickened Spell", detail: "Spend 2 Sorcery Points to cast as a Bonus Action." }),
      expect.objectContaining({ name: "Metamagic: Extended Spell", detail: "Spend 1 Sorcery Point to double the duration." }),
    ]));
    expect(data.feats).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Metamagic Adept: Twinned Spell", detail: "Spend Sorcery Points to affect a second target." }),
    ]));
    expect(data.actionRows).toEqual([
      { name: "Fire Bolt", bonus: "+7", damage: "2d10 fire", notes: "" },
      { name: "Mind Sliver", bonus: "", damage: "2d6 psychic", notes: "DC 15" },
      { name: "Quarterstaff", bonus: "+1", damage: "1d6-2 bludgeoning", notes: "" },
      { name: "Dagger", bonus: "+4", damage: "1d4+1 piercing", notes: "Prof." },
      { name: "Crossbow, Light", bonus: "+4", damage: "1d8+1 piercing", notes: "Prof." },
    ]);
    expect(data.spellsByLevel.flatMap((group) => group.spells.map((spell) => spell.name))).toEqual([
      "Fire Bolt",
      "Mind Sliver",
      "Mage Armor",
      "Sending",
    ]);
    expect(data.spellsByLevel.flatMap((group) => group.spells)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Mage Armor", status: "K" }),
      expect.objectContaining({ name: "Sending", status: "P" }),
    ]));
    expect(data.inventory).toHaveLength(3);
  });

  it.each(["Ki Points", "Focus Points"])("builds a checkbox-ready %s pool", (name) => {
    const character = createMockCharacter();
    character.actions.class = [{
      ...character.actions.class[0],
      name,
      limitedUse: {
        maxUses: 7,
        numberUsed: 3,
        resetType: 1,
        resetTypeDescription: null,
      },
    }];

    expect(extractCharacterSheetData(character).resources).toEqual([
      { name, numberUsed: 3, maxUses: 7 },
    ]);
  });

  it("keeps spell descriptions for the two-line spellbook rows", () => {
    const character = createMockCharacter();
    const spell = character.classSpells[0].spells[0];
    spell.definition.description = "A detailed spell description that exceeds the old one-line character limit. It remains available to the two-line spellbook layout instead of being shortened before rendering.";

    const spellData = extractCharacterSheetData(character).spellsByLevel[0].spells.find((entry) => entry.name === spell.definition.name);

    expect(spellData?.detail).toContain("It remains available to the two-line spellbook layout");
  });

  it("renders a valid data-backed PDF", async () => {
    const data = extractCharacterSheetData(createMockCharacter());
    const pdfBytes = await renderCharacterSheetPdf(data, "light");

    expect(Buffer.from(pdfBytes.subarray(0, 4)).toString("ascii")).toBe("%PDF");
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(5);
  });

  it("adds continuation pages instead of dropping overflowing data", async () => {
    const data = extractCharacterSheetData(createMockCharacter());
    const spell = data.spellsByLevel[0].spells[0];
    const item = data.inventory[0];
    data.features = Array.from({ length: 50 }, (_, index) => ({
      name: `Feature ${index + 1}`,
      detail: "A complete feature description that must flow onto continuation pages without being hidden.",
    }));
    data.spellsByLevel = [{
      level: 1,
      label: "Level 1",
      spells: Array.from({ length: 40 }, (_, index) => ({ ...spell, level: 1, name: `Spell ${index + 1}` })),
    }];
    data.inventory = Array.from({ length: 40 }, (_, index) => ({ ...item, name: `Item ${index + 1}` }));

    const pdf = await PDFDocument.load(await renderCharacterSheetPdf(data, "light"));

    expect(pdf.getPageCount()).toBeGreaterThan(5);
  });

  it("returns an embedded PDF resource from the MCP tool", async () => {
    const client = createMockClient();
    vi.mocked(client.get).mockResolvedValue(createMockCharacter());

    const result = await generateCharacterSheetPdf(client, { characterId: 12345, theme: "color" });
    const resource = result.content[0];

    expect(resource.type).toBe("resource");
    if (resource.type !== "resource") throw new Error("Expected resource content");
    expect(resource.resource.uri).toBe("dndbeyond://character/12345/sheet.pdf");
    expect(resource.resource.mimeType).toBe("application/pdf");
    expect("blob" in resource.resource).toBe(true);
    if (!("blob" in resource.resource)) throw new Error("Expected blob resource");
    expect(Buffer.from(resource.resource.blob, "base64").subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(result.structuredContent).toMatchObject({
      characterId: 12345,
      characterName: "Test Sorcerer",
      pageCount: 5,
      theme: "color",
      mimeType: "application/pdf",
    });
  });
});
