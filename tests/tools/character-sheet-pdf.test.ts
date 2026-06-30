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
    name: "Neesk",
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
        definition: { id: 6, name: "Sorcerer" },
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
            range: null,
            duration: null,
            activation: null,
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
    },
    modifiers: {
      class: [
        { id: "save-con", type: "proficiency", subType: "constitution-saving-throws", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Constitution Saving Throws", componentId: 1, componentTypeId: 1 },
        { id: "save-cha", type: "proficiency", subType: "charisma-saving-throws", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Charisma Saving Throws", componentId: 1, componentTypeId: 1 },
        { id: "arcana", type: "proficiency", subType: "arcana", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Arcana", componentId: 1, componentTypeId: 1 },
      ],
      race: [
        { id: "tool", type: "proficiency", subType: "disguise-kit", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Disguise Kit", componentId: 1, componentTypeId: 1 },
        { id: "dagger", type: "proficiency", subType: "dagger", value: null, friendlyTypeName: "Proficiency", friendlySubtypeName: "Dagger", componentId: 1, componentTypeId: 1 },
      ],
    },
    campaign: { id: 1, name: "Test Campaign" },
    feats: [],
    notes: {
      personalPossessions: "Maps and jewelry.",
      backstory: "Neesk grew up with family stories.",
      otherNotes: null,
      allies: null,
      organizations: null,
    },
    pactMagic: null,
    spellSlots: [
      { level: 1, used: 0, available: 4 },
      { level: 3, used: 1, available: 3 },
    ],
    hitDiceUsed: 1,
    speed: 30,
  };
}

describe("character sheet PDF", () => {
  it("extracts D&D Beyond data for a filled sheet", () => {
    const data = extractCharacterSheetData(createMockCharacter());

    expect(data.name).toBe("Neesk");
    expect(data.level).toBe(6);
    expect(data.proficiencyBonus).toBe(3);
    expect(data.hp).toEqual({ current: 21, max: 26, temp: 3 });
    expect(data.ac).toBe(11);
    expect(data.abilities.find((ability) => ability.label === "CHA")?.value).toBe("18");
    expect(data.saves.find((save) => save.ability === "CON")).toMatchObject({ total: "+4", proficient: true });
    expect(data.skills.find((skill) => skill.name === "Arcana")).toMatchObject({ total: "+5", proficient: true });
    expect(data.spellcasting).toEqual({ ability: "CHA", saveDc: "15", attackBonus: "+7" });
    expect(data.proficiencies).toMatchObject({
      weapons: ["Dagger"],
      tools: ["Disguise Kit"],
    });
    expect(data.actionRows).toEqual([
      { name: "Mind Sliver", bonus: "", damage: "2d6 psychic", notes: "DC 15" },
      { name: "Dagger", bonus: "+4", damage: "1d4+1 piercing", notes: "Prof." },
    ]);
    expect(data.spellsByLevel).toEqual([
      { level: 0, label: "Cantrips", spells: [{ level: 0, name: "Mind Sliver", detail: "Cantrip Enchantment - V" }] },
      { level: 3, label: "Level 3", spells: [{ level: 3, name: "Sending", detail: "Level 3 Evocation - V/S/M" }] },
    ]);
  });

  it("renders a valid 8-page PDF", async () => {
    const data = extractCharacterSheetData(createMockCharacter());
    const pdfBytes = await renderCharacterSheetPdf(data, "light");

    expect(Buffer.from(pdfBytes.subarray(0, 4)).toString("ascii")).toBe("%PDF");
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(8);
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
      characterName: "Neesk",
      pageCount: 8,
      theme: "color",
      mimeType: "application/pdf",
    });
  });
});
