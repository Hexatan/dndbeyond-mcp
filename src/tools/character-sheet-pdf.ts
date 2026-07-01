import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFPage } from "pdf-lib";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DdbClient } from "../api/client.js";
import { ENDPOINTS } from "../api/endpoints.js";
import type {
  DdbAction,
  DdbCharacter,
  DdbClass,
  DdbClassFeature,
  DdbInventoryItem,
  DdbModifier,
  DdbMovementSpeeds,
  DdbSpell,
} from "../types/character.js";
import {
  ABILITY_NAMES,
  calculateAc,
  calculateCurrentHp,
  calculateMaxHp,
  computeFinalAbilityScore,
  computeLevel,
  sumModifierBonuses,
} from "../utils/character-calculations.js";
import { findAccessibleCharacterByName } from "../utils/character-list.js";
import { stripHtml } from "../utils/html.js";

export type CharacterSheetTheme = "light" | "color" | "inverted";

interface GenerateCharacterSheetPdfParams {
  characterId?: number;
  characterName?: string;
  theme?: CharacterSheetTheme;
}

interface SheetField {
  label: string;
  value: string;
}

interface SkillValue {
  name: string;
  ability: string;
  total: string;
  proficient: boolean;
  expertise: boolean;
}

interface SaveValue {
  ability: string;
  total: string;
  proficient: boolean;
}

interface ActionRow {
  name: string;
  bonus: string;
  damage: string;
  notes: string;
}

interface NamedDetail {
  name: string;
  detail: string;
}

interface SpellEntry extends NamedDetail {
  level: number;
}

interface ProficiencyCategories {
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
}

export interface CharacterSheetData {
  id: number;
  name: string;
  race: string;
  classes: string;
  level: number;
  proficiencyBonus: number;
  background: string;
  campaign: string;
  hp: { current: number; max: number; temp: number };
  ac: number;
  speed: string;
  abilities: SheetField[];
  saves: SaveValue[];
  skills: SkillValue[];
  spellcasting: { ability: string; saveDc: string; attackBonus: string };
  spellsByLevel: Array<{ level: number; label: string; spells: SpellEntry[] }>;
  spellSlots: Array<{ level: number; used: number; available: number }>;
  pactMagic: { level: number; used: number; available: number } | null;
  actionRows: ActionRow[];
  hitDice: string[];
  resources: string[];
  defenses: SheetField[];
  proficiencies: ProficiencyCategories;
  features: NamedDetail[];
  racialTraits: NamedDetail[];
  feats: NamedDetail[];
  equipment: string[];
  inventory: Array<{ name: string; quantity: number; weight: number; value: string; equipped: boolean }>;
  currencies: SheetField[];
  traits: SheetField[];
  notes: SheetField[];
  deathSaves: { successes: number; failures: number };
}

const VIRTUAL_W = 576;
const VIRTUAL_H = 768;
const PAGE_W = 1620 / 229 * 72;
const PAGE_H = 2160 / 229 * 72;
const MARGIN = 8;
const GAP = 6;
const BOX_GAP = 8;
const DDB_WEAPON_ENTITY_TYPE_ID = 1782728300;
const WRITING_LINE_SPACING = 16;
const BOX_TEXT_TOP_PAD = 30;
const MIN_TEXT_TO_LINE_GAP = 16;
const PROFICIENCY_LABEL_TO_VALUE_GAP = 9;
const PROFICIENCY_VALUE_LINE_H = 8;
const PROFICIENCY_SECTION_GAP = 8;
const DETAIL_ROW_H = 11;
const BLACK = "black";
const MID = "mid";
const LIGHT = "light";

const PAPER_RED = "#C46861";
const PAPER_ORANGE = "#C0762E";
const PAPER_GREEN = "#5B8D4A";
const PAPER_BLUE = "#2F5D90";
const PAPER_CYAN = "#5EABB4";
const PAPER_PURPLE = "#A34B82";
const PAPER_MAGENTA = "#C678A6";

const ABILITY_COLORS: Record<string, string> = {
  STR: PAPER_RED,
  DEX: PAPER_GREEN,
  CON: PAPER_ORANGE,
  INT: PAPER_BLUE,
  WIS: PAPER_CYAN,
  CHA: PAPER_MAGENTA,
};

const ABILITY_FULL_NAMES: Record<number, string> = {
  1: "Strength",
  2: "Dexterity",
  3: "Constitution",
  4: "Intelligence",
  5: "Wisdom",
  6: "Charisma",
};

const SAVING_THROW_SUBTYPES: Record<number, string> = {
  1: "strength-saving-throws",
  2: "dexterity-saving-throws",
  3: "constitution-saving-throws",
  4: "intelligence-saving-throws",
  5: "wisdom-saving-throws",
  6: "charisma-saving-throws",
};

const SKILL_DEFINITIONS: Array<{ name: string; abilityId: number; subType: string }> = [
  { name: "Acrobatics", abilityId: 2, subType: "acrobatics" },
  { name: "Animal Handling", abilityId: 5, subType: "animal-handling" },
  { name: "Arcana", abilityId: 4, subType: "arcana" },
  { name: "Athletics", abilityId: 1, subType: "athletics" },
  { name: "Deception", abilityId: 6, subType: "deception" },
  { name: "History", abilityId: 4, subType: "history" },
  { name: "Insight", abilityId: 5, subType: "insight" },
  { name: "Intimidation", abilityId: 6, subType: "intimidation" },
  { name: "Investigation", abilityId: 4, subType: "investigation" },
  { name: "Medicine", abilityId: 5, subType: "medicine" },
  { name: "Nature", abilityId: 4, subType: "nature" },
  { name: "Perception", abilityId: 5, subType: "perception" },
  { name: "Performance", abilityId: 6, subType: "performance" },
  { name: "Persuasion", abilityId: 6, subType: "persuasion" },
  { name: "Religion", abilityId: 4, subType: "religion" },
  { name: "Sleight of Hand", abilityId: 2, subType: "sleight-of-hand" },
  { name: "Stealth", abilityId: 2, subType: "stealth" },
  { name: "Survival", abilityId: 5, subType: "survival" },
];

const EXCLUDED_PROFICIENCY_SUBTYPES = new Set([
  "strength-saving-throws", "dexterity-saving-throws", "constitution-saving-throws",
  "intelligence-saving-throws", "wisdom-saving-throws", "charisma-saving-throws",
  "acrobatics", "animal-handling", "arcana", "athletics", "deception", "history",
  "insight", "intimidation", "investigation", "medicine", "nature", "perception",
  "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival",
]);
const ARMOR_SUBTYPES = new Set(["light-armor", "medium-armor", "heavy-armor", "shields"]);
const WEAPON_GROUPS = new Set(["simple-weapons", "martial-weapons"]);
const LANGUAGE_SUBTYPES = new Set([
  "common", "dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling", "orc",
  "abyssal", "celestial", "draconic", "deep-speech", "infernal", "primordial",
  "sylvan", "undercommon", "thieves-cant", "druidic", "aarakocra", "auran",
  "aquan", "ignan", "terran",
]);
const SAVE_ADVANTAGE_CONDITIONS: Record<string, string> = {
  blinded: "Blinded",
  charmed: "Charmed",
  deafened: "Deafened",
  frightened: "Frightened",
  fear: "Frightened",
  grappled: "Grappled",
  incapacitated: "Incapacitated",
  invisible: "Invisible",
  paralyzed: "Paralyzed",
  petrified: "Petrified",
  poisoned: "Poisoned",
  prone: "Prone",
  restrained: "Restrained",
  stunned: "Stunned",
  unconscious: "Unconscious",
};

const HIT_DIE_MAP: Record<string, string> = {
  Barbarian: "d12",
  Fighter: "d10",
  Paladin: "d10",
  Ranger: "d10",
  Bard: "d8",
  Cleric: "d8",
  Druid: "d8",
  Monk: "d8",
  Rogue: "d8",
  Warlock: "d8",
  Artificer: "d8",
  Sorcerer: "d6",
  Wizard: "d6",
};

const WEAPON_FALLBACKS: Record<string, { damage: string; type: string; ability: "str" | "dex" | "finesse"; group: "simple" | "martial" }> = {
  club: { damage: "1d4", type: "bludgeoning", ability: "str", group: "simple" },
  dagger: { damage: "1d4", type: "piercing", ability: "finesse", group: "simple" },
  dart: { damage: "1d4", type: "piercing", ability: "dex", group: "simple" },
  "greatclub": { damage: "1d8", type: "bludgeoning", ability: "str", group: "simple" },
  handaxe: { damage: "1d6", type: "slashing", ability: "str", group: "simple" },
  javelin: { damage: "1d6", type: "piercing", ability: "str", group: "simple" },
  "light hammer": { damage: "1d4", type: "bludgeoning", ability: "str", group: "simple" },
  mace: { damage: "1d6", type: "bludgeoning", ability: "str", group: "simple" },
  quarterstaff: { damage: "1d6", type: "bludgeoning", ability: "str", group: "simple" },
  sickle: { damage: "1d4", type: "slashing", ability: "str", group: "simple" },
  spear: { damage: "1d6", type: "piercing", ability: "str", group: "simple" },
  "crossbow, light": { damage: "1d8", type: "piercing", ability: "dex", group: "simple" },
  shortbow: { damage: "1d6", type: "piercing", ability: "dex", group: "simple" },
  sling: { damage: "1d4", type: "bludgeoning", ability: "dex", group: "simple" },
  battleaxe: { damage: "1d8", type: "slashing", ability: "str", group: "martial" },
  flail: { damage: "1d8", type: "bludgeoning", ability: "str", group: "martial" },
  glaive: { damage: "1d10", type: "slashing", ability: "str", group: "martial" },
  greataxe: { damage: "1d12", type: "slashing", ability: "str", group: "martial" },
  greatsword: { damage: "2d6", type: "slashing", ability: "str", group: "martial" },
  halberd: { damage: "1d10", type: "slashing", ability: "str", group: "martial" },
  lance: { damage: "1d12", type: "piercing", ability: "str", group: "martial" },
  longsword: { damage: "1d8", type: "slashing", ability: "str", group: "martial" },
  maul: { damage: "2d6", type: "bludgeoning", ability: "str", group: "martial" },
  morningstar: { damage: "1d8", type: "piercing", ability: "str", group: "martial" },
  pike: { damage: "1d10", type: "piercing", ability: "str", group: "martial" },
  rapier: { damage: "1d8", type: "piercing", ability: "finesse", group: "martial" },
  scimitar: { damage: "1d6", type: "slashing", ability: "finesse", group: "martial" },
  shortsword: { damage: "1d6", type: "piercing", ability: "finesse", group: "martial" },
  trident: { damage: "1d6", type: "piercing", ability: "str", group: "martial" },
  warhammer: { damage: "1d8", type: "bludgeoning", ability: "str", group: "martial" },
  whip: { damage: "1d4", type: "slashing", ability: "finesse", group: "martial" },
  blowgun: { damage: "1", type: "piercing", ability: "dex", group: "martial" },
  "crossbow, hand": { damage: "1d6", type: "piercing", ability: "dex", group: "martial" },
  "crossbow, heavy": { damage: "1d10", type: "piercing", ability: "dex", group: "martial" },
  longbow: { damage: "1d8", type: "piercing", ability: "dex", group: "martial" },
};

const FALLBACK_SPELLCASTING_ABILITY: Record<string, number> = {
  Wizard: 4,
  Artificer: 4,
  Cleric: 5,
  Druid: 5,
  Ranger: 5,
  Bard: 6,
  Paladin: 6,
  Sorcerer: 6,
  Warlock: 6,
};

type PdfColor = ReturnType<typeof rgb>;

interface Theme {
  black: PdfColor;
  white: PdfColor;
  mid: PdfColor;
  light: PdfColor;
  faint: PdfColor;
  pale: PdfColor;
  bg: PdfColor;
}

interface Fonts {
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
}

function hexColor(value: string): PdfColor {
  const hex = value.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function colorTheme(theme: CharacterSheetTheme): Theme {
  if (theme === "inverted") {
    return {
      black: rgb(1, 1, 1),
      white: rgb(0, 0, 0),
      mid: hexColor("#D8D8D8"),
      light: hexColor("#5E5E5E"),
      faint: hexColor("#343434"),
      pale: hexColor("#333333"),
      bg: rgb(0, 0, 0),
    };
  }

  return {
    black: rgb(0, 0, 0),
    white: rgb(1, 1, 1),
    mid: theme === "color" ? hexColor("#686868") : rgb(0, 0, 0),
    light: theme === "color" ? hexColor("#B8B8B8") : hexColor("#D3D3D3"),
    faint: hexColor("#E8E8E8"),
    pale: hexColor("#EEEEEE"),
    bg: rgb(1, 1, 1),
  };
}

class PdfElements {
  private readonly scaleX = PAGE_W / VIRTUAL_W;
  private readonly scaleY = PAGE_H / VIRTUAL_H;

  constructor(
    private readonly page: PDFPage,
    private readonly fonts: Fonts,
    private readonly theme: Theme,
    private readonly colorMode: boolean,
  ) {}

  background(): void {
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: this.theme.bg });
  }

  color(value?: string | PdfColor | null, fallback: string = MID): PdfColor {
    const chosen = value ?? fallback;
    if (typeof chosen !== "string") return chosen;
    if (chosen === BLACK) return this.theme.black;
    if (chosen === "white") return this.theme.white;
    if (chosen === MID) return this.theme.mid;
    if (chosen === LIGHT) return this.theme.light;
    if (chosen === "faint") return this.theme.faint;
    if (chosen === "pale") return this.theme.pale;
    return hexColor(chosen);
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.35, color?: string | PdfColor | null): void {
    this.page.drawLine({
      start: { x: this.x(x1), y: this.y(y1) },
      end: { x: this.x(x2), y: this.y(y2) },
      thickness: width * this.scaleX,
      color: this.color(color, LIGHT),
    });
  }

  rect(x: number, y: number, w: number, h: number, width = 0.55, color?: string | PdfColor | null): void {
    this.page.drawRectangle({
      x: this.x(x),
      y: this.y(y),
      width: this.w(w),
      height: this.h(h),
      borderWidth: width * this.scaleX,
      borderColor: this.color(color, MID),
    });
  }

  fillRect(x: number, y: number, w: number, h: number, color?: string | PdfColor | null): void {
    this.page.drawRectangle({
      x: this.x(x),
      y: this.y(y),
      width: this.w(w),
      height: this.h(h),
      color: color ? this.color(color) : this.theme.bg,
    });
  }

  text(x: number, y: number, value: string, size = 8, bold = false, color?: string | PdfColor | null): void {
    const safe = cleanPdfText(value);
    if (!safe) return;
    this.page.drawText(safe, {
      x: this.x(x),
      y: this.y(y),
      size: this.fontSize(size),
      font: bold ? this.fonts.bold : this.fonts.regular,
      color: this.color(color, BLACK),
    });
  }

  centered(x: number, y: number, w: number, value: string, size = 8, bold = false, color?: string | PdfColor | null): void {
    const safe = cleanPdfText(value);
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const fontSize = this.fontSize(size);
    const textWidth = font.widthOfTextAtSize(safe, fontSize);
    this.page.drawText(safe, {
      x: this.x(x) + (this.w(w) - textWidth) / 2,
      y: this.y(y),
      size: fontSize,
      font,
      color: this.color(color, BLACK),
    });
  }

  pageTitle(title: string, subtitle?: string): void {
    this.text(MARGIN, VIRTUAL_H - 16, title, 16, true);
    if (subtitle) this.text(MARGIN + 176, VIRTUAL_H - 15, subtitle, 6.6, false, MID);
    this.line(MARGIN, VIRTUAL_H - 25, VIRTUAL_W - MARGIN, VIRTUAL_H - 25, 0.7, MID);
  }

  box(x: number, y: number, w: number, h: number, title: string, titleSize = 7.5): void {
    this.rect(x, y, w, h, 0.55, MID);
    this.text(x + 5, y + h - 12, title.toUpperCase(), titleSize, true, MID);
    this.line(x, y + h - 17, x + w, y + h - 17, 0.4, LIGHT);
  }

  field(x: number, y: number, w: number, label: string, value = "", valueH = 18, accent?: string, valueSize = 8.6): void {
    const color = this.colorMode && accent ? hexColor(accent) : MID;
    this.text(x, y + valueH + 2, label.toUpperCase(), 6.4, true, color);
    this.rect(x, y, w, valueH, 0.45, color);
    if (value) {
      const baseline = y + Math.max(4, (valueH - valueSize) / 2);
      this.fitText(x + 3, baseline, w - 6, value, valueSize, true);
    }
  }

  checkbox(x: number, y: number, size = 7, checked = false, color?: string | PdfColor | null): void {
    this.rect(x, y, size, size, 0.45, color ?? MID);
    if (!checked) return;
    this.line(x + 1.5, y + size * 0.52, x + size * 0.4, y + 1.5, 0.65, color ?? MID);
    this.line(x + size * 0.4, y + 1.5, x + size - 1.5, y + size - 1.5, 0.65, color ?? MID);
  }

  writingLines(x: number, y: number, w: number, h: number, spacing = 16, topPad = 33, bottomPad = 6, xPad = 5): void {
    const maxY = y + h - topPad;
    for (let yy = y + bottomPad; yy <= maxY; yy += spacing) {
      this.line(x + xPad, yy, x + w - xPad, yy, 0.28, LIGHT);
    }
  }

  table(x: number, y: number, widths: number[], rowH: number, rows: number, headers: string[], headerH = 18): void {
    const totalW = widths.reduce((sum, width) => sum + width, 0);
    const totalH = headerH + rows * rowH;
    this.rect(x, y, totalW, totalH, 0.5, MID);
    this.line(x, y + totalH - headerH, x + totalW, y + totalH - headerH, 0.45, MID);

    let xx = x;
    for (const [idx, width] of widths.entries()) {
      this.centered(xx, y + totalH - 12, width, headers[idx]?.toUpperCase() ?? "", 5.8, true, MID);
      this.line(xx, y, xx, y + totalH, 0.28, LIGHT);
      xx += width;
    }
    this.line(x + totalW, y, x + totalW, y + totalH, 0.28, LIGHT);

    for (let row = 1; row < rows; row++) {
      const yy = y + totalH - headerH - row * rowH;
      this.line(x, yy, x + totalW, yy, 0.25, LIGHT);
    }
  }

  textBlock(x: number, y: number, w: number, h: number, value: string, size = 7.2, lineHeight = 14, color?: string | PdfColor | null): number {
    const font = this.fonts.regular;
    const fontSize = this.fontSize(size);
    const maxWidth = this.w(w);
    const lines = wrapText(cleanPdfText(value), font, fontSize, maxWidth);
    const maxLines = Math.max(1, Math.floor((h - 6) / lineHeight));
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length > 0) {
      visible[visible.length - 1] = ellipsize(visible[visible.length - 1], font, fontSize, maxWidth);
    }
    for (const [idx, line] of visible.entries()) {
      const baseline = y + h - 6 - idx * lineHeight;
      this.page.drawRectangle({
        x: this.x(x - 5),
        y: this.y(baseline - 2),
        width: this.w(w + 10),
        height: this.h(lineHeight - 2),
        color: this.theme.bg,
      });
      this.text(x, baseline, line, size, false, color ?? BLACK);
    }
    return visible.length;
  }

  wrappedText(x: number, y: number, w: number, value: string, size = 7.2, lineHeight = 10, bold = false, color?: string | PdfColor | null): number {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const fontSize = this.fontSize(size);
    const lines = wrapText(cleanPdfText(value), font, fontSize, this.w(w));
    for (const [idx, line] of lines.entries()) {
      this.text(x, y - idx * lineHeight, line, size, bold, color);
    }
    return lines.length;
  }

  fitText(x: number, y: number, w: number, value: string, size = 8, bold = false, color?: string | PdfColor | null): void {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const fontSize = this.fontSize(size);
    const maxWidth = this.w(w);
    this.text(x, y, ellipsize(cleanPdfText(value), font, fontSize, maxWidth), size, bold, color);
  }

  accent(ability: string, fallback: string = MID): string {
    return this.colorMode ? ABILITY_COLORS[ability] ?? fallback : fallback;
  }

  private x(value: number): number {
    return value * this.scaleX;
  }

  private y(value: number): number {
    return value * this.scaleY;
  }

  private w(value: number): number {
    return value * this.scaleX;
  }

  private h(value: number): number {
    return value * this.scaleY;
  }

  private fontSize(value: number): number {
    return value * this.scaleY;
  }
}

export async function generateCharacterSheetPdf(
  client: DdbClient,
  params: GenerateCharacterSheetPdfParams,
): Promise<CallToolResult> {
  const idOrError = await resolveCharacterId(client, params);
  if (typeof idOrError === "string") {
    return { content: [{ type: "text", text: idOrError }], isError: true };
  }

  const character = await client.get<DdbCharacter>(
    ENDPOINTS.character.get(idOrError),
    `character:${idOrError}`,
    60_000,
  );
  const theme = params.theme ?? "light";
  const data = extractCharacterSheetData(character);
  const pdfBytes = await renderCharacterSheetPdf(data, theme);
  const blob = Buffer.from(pdfBytes).toString("base64");

  return {
    content: [
      {
        type: "resource",
        resource: {
          uri: `dndbeyond://character/${data.id}/sheet.pdf`,
          mimeType: "application/pdf",
          blob,
        },
      },
    ],
    structuredContent: {
      characterId: data.id,
      characterName: data.name,
      pageCount: 8,
      theme,
      mimeType: "application/pdf",
    },
  };
}

export function extractCharacterSheetData(char: DdbCharacter): CharacterSheetData {
  const level = computeLevel(char);
  const proficiencyBonus = calculateProficiencyBonus(level);
  const allSpells = getAllSpells(char);
  const preparedSpells = allSpells.filter((spell) => spell.prepared || spell.alwaysPrepared);
  const spellcasting = computeSpellcasting(char, allSpells);
  const proficiencies = buildProficiencies(char);

  return {
    id: char.id,
    name: char.name,
    race: char.race.fullName,
    classes: formatClasses(char),
    level,
    proficiencyBonus,
    background: char.background?.definition?.name ?? "None",
    campaign: char.campaign?.name ?? "",
    hp: {
      current: calculateCurrentHp(char),
      max: calculateMaxHp(char),
      temp: char.temporaryHitPoints ?? 0,
    },
    ac: calculateAc(char),
    speed: formatSpeed(char),
    abilities: buildAbilities(char),
    saves: buildSaves(char, proficiencyBonus),
    skills: buildSkills(char, proficiencyBonus),
    spellcasting,
    spellsByLevel: groupSpells(preparedSpells, level),
    spellSlots: (char.spellSlots ?? []).filter((slot) => slot.available > 0),
    pactMagic: char.pactMagic && char.pactMagic.available > 0 ? char.pactMagic : null,
    actionRows: buildActionRows(char, preparedSpells, spellcasting, proficiencyBonus),
    hitDice: buildHitDice(char),
    resources: buildResources(char),
    defenses: buildDefenses(char),
    proficiencies,
    features: buildFeatures(char),
    racialTraits: (char.race.racialTraits ?? []).map((trait) => ({
      name: trait.definition.name,
      detail: shortDetail(trait.definition.snippet || trait.definition.description),
    })),
    feats: (char.feats ?? []).map((feat) => ({
      name: feat.definition.name,
      detail: shortDetail(feat.definition.snippet || feat.definition.description || feat.definition.prerequisite),
    })),
    equipment: char.inventory
      .filter((item) => item.equipped)
      .map((item) => item.quantity > 1 ? `${item.definition.name} x${item.quantity}` : item.definition.name),
    inventory: char.inventory.map((item) => ({
      name: item.definition.name,
      quantity: item.quantity,
      weight: item.definition.weight ?? 0,
      value: item.definition.cost == null ? "" : String(item.definition.cost),
      equipped: item.equipped,
    })),
    currencies: [
      { label: "CP", value: String(char.currencies.cp ?? 0) },
      { label: "SP", value: String(char.currencies.sp ?? 0) },
      { label: "EP", value: String(char.currencies.ep ?? 0) },
      { label: "GP", value: String(char.currencies.gp ?? 0) },
      { label: "PP", value: String(char.currencies.pp ?? 0) },
    ],
    traits: [
      { label: "Personality", value: char.traits.personalityTraits ?? "" },
      { label: "Ideals", value: char.traits.ideals ?? "" },
      { label: "Bonds", value: char.traits.bonds ?? "" },
      { label: "Flaws", value: char.traits.flaws ?? "" },
    ].filter((field) => field.value),
    notes: [
      { label: "Backstory", value: char.notes.backstory ?? "" },
      { label: "Possessions", value: char.notes.personalPossessions ?? "" },
      { label: "Other", value: char.notes.otherNotes ?? "" },
      { label: "Allies", value: char.notes.allies ?? "" },
      { label: "Organizations", value: char.notes.organizations ?? "" },
    ].filter((field) => field.value),
    deathSaves: {
      successes: char.deathSaves.successCount ?? 0,
      failures: char.deathSaves.failCount ?? 0,
    },
  };
}

export async function renderCharacterSheetPdf(data: CharacterSheetData, themeName: CharacterSheetTheme = "light"): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${data.name} Character Sheet`);
  pdfDoc.setAuthor("dndbeyond-mcp");
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  const theme = colorTheme(themeName);
  const colorMode = themeName === "color";
  const pages = [
    drawCorePage,
    drawFeaturesPage,
    drawSpellPage,
    drawAdventureNotesPage,
    drawLevelUpPage,
    drawInventoryPage,
    drawDowntimePage,
    drawRelationshipsPage,
  ];

  for (const [idx, drawPage] of pages.entries()) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const pdf = new PdfElements(page, fonts, theme, colorMode);
    pdf.background();
    drawPage(pdf, data);
    pdf.centered(VIRTUAL_W - MARGIN - 36, 8, 36, String(idx + 1), 6.5, false, MID);
  }

  return pdfDoc.save({ objectsPerTick: Infinity });
}

function drawCorePage(pdf: PdfElements, data: CharacterSheetData): void {
  drawIdentity(pdf, data);
  drawAbilities(pdf, data);
  drawSavesSkills(pdf, data);
  drawCombat(pdf, data);
}

function drawIdentity(pdf: PdfElements, data: CharacterSheetData): void {
  pdf.pageTitle("Character Sheet", "reMarkable 5e-compatible filled sheet");
  const top = VIRTUAL_H - 58;
  let x = MARGIN;
  const available = VIRTUAL_W - 2 * MARGIN - 3 * GAP;
  const fields = [
    { label: "Character name", value: data.name, w: available * 0.35 },
    { label: "Class / levels", value: data.classes, w: available * 0.27 },
    { label: "Species", value: data.race, w: available * 0.17 },
    { label: "Background", value: data.background, w: available * 0.21 },
  ];
  for (const field of fields) {
    pdf.field(x, top, field.w, field.label, field.value);
    x += field.w + GAP;
  }
}

function drawAbilities(pdf: PdfElements, data: CharacterSheetData): void {
  const x = MARGIN;
  const statW = 76;
  const topY = 688;
  const bottomY = 248;
  const statH = (topY - bottomY - 5 * BOX_GAP) / 6;
  let y = topY;
  for (const ability of data.abilities) {
    const accent = pdf.accent(ability.label, BLACK);
    pdf.rect(x, y - statH, statW, statH, 0.55, accent);
    pdf.centered(x, y - 12, statW, ability.label, 7, true, accent);
    pdf.line(x, y - 18, x + statW, y - 18, 0.5, pdf.accent(ability.label, LIGHT));
    pdf.centered(x, y - 43, statW, ability.value, 19, true, BLACK);
    pdf.centered(x, y - 61, statW, abilityModLabel(Number(ability.value)), 10, true, MID);
    y -= statH + BOX_GAP;
  }

  const coreX = MARGIN + statW + GAP;
  const coreY = VIRTUAL_H - 80;
  const contentW = VIRTUAL_W - MARGIN - coreX;
  const profW = 164;
  const coreW = contentW - profW - 8;
  pdf.box(coreX, coreY - 64, coreW, 64, "Core Numbers");
  const innerY = coreY - 58;
  const colW = (coreW - 18) / 4;
  const dexScore = Number(data.abilities.find((ability) => ability.label === "DEX")?.value ?? "10");
  const core = [
    ["AC", String(data.ac), PAPER_BLUE],
    ["Initiative", abilityModLabel(dexScore), PAPER_GREEN],
    ["Speed", data.speed.replace("Speed: ", ""), PAPER_CYAN],
    ["Prof. bonus", signed(data.proficiencyBonus), PAPER_PURPLE],
  ];
  for (const [idx, field] of core.entries()) {
    pdf.field(coreX + 6 + idx * colW, innerY, colW - 6, field[0], field[1], 32, field[2], 12);
  }
}

function drawSavesSkills(pdf: PdfElements, data: CharacterSheetData): void {
  const statW = 76;
  const leftX = MARGIN + statW + GAP;
  const contentW = VIRTUAL_W - MARGIN - leftX;
  const profW = 164;
  const mainW = contentW - profW - 8;
  const profX = leftX + mainW + 8;
  const topY = 688;
  const savingY = 536;
  const sensesY = 248;
  const sensesH = 86;
  const profY = sensesY + sensesH + BOX_GAP;
  const defensesY = savingY;
  const defensesH = topY - defensesY;
  const profH = defensesY - BOX_GAP - profY;

  pdf.box(profX, defensesY, profW, defensesH, "Conditions / Defenses");
  const defenseLines = pdf.textBlock(profX + 8, defensesY + 10, profW - 16, defensesH - 34, fieldsToText(data.defenses), 6.8);
  pdf.writingLines(profX, defensesY, profW, defensesH, WRITING_LINE_SPACING, writingTopPad(defenseLines));

  pdf.box(profX, profY, profW, profH, "Proficiencies & Languages");
  drawProficiencyCategories(pdf, profX, profY, profW, profH, data.proficiencies);

  pdf.box(profX, sensesY, profW, sensesH, "Senses");
  labeledLine(pdf, profX + 8, sensesY + 50, profW - 16, "Passive Perception", passiveScore(data, "Perception"));
  labeledLine(pdf, profX + 8, sensesY + 30, profW - 16, "Passive Investigation", passiveScore(data, "Investigation"));
  labeledLine(pdf, profX + 8, sensesY + 10, profW - 16, "Passive Insight", passiveScore(data, "Insight"));

  pdf.box(leftX, savingY, mainW, 80, "Saving Throws");
  const colW = (mainW - 20) / 2;
  for (const [idx, save] of data.saves.entries()) {
    const col = Math.floor(idx / 3);
    const row = idx % 3;
    const sx = leftX + 8 + col * (colW + 8);
    const sy = savingY + 50 - row * 21;
    pdf.checkbox(sx, sy + 1, 7, save.proficient, pdf.accent(save.ability, MID));
    pdf.line(sx + 15, sy, sx + 43, sy, 0.4, LIGHT);
    pdf.text(sx + 18, sy + 3, save.total, 6.6, true);
    pdf.text(sx + 50, sy - 2, ABILITY_FULL_NAMES[idx + 1] ?? save.ability, 7.4);
  }

  const skillsY = 248;
  const skillsH = 280;
  pdf.box(leftX, skillsY, mainW, skillsH, "Skills");
  const colGap = 10;
  const skillColW = (mainW - 16 - colGap) / 2;
  for (const [idx, skill] of data.skills.entries()) {
    const col = Math.floor(idx / 9);
    const row = idx % 9;
    const sx = leftX + 8 + col * (skillColW + colGap);
    const sy = skillsY + 238 - row * 24;
    pdf.checkbox(sx, sy + 1, 7, skill.proficient || skill.expertise, pdf.accent(skill.ability, MID));
    pdf.line(sx + 13, sy, sx + 37, sy, 0.4, LIGHT);
    pdf.text(sx + 16, sy + 3, skill.total, 6.4, true);
    pdf.text(sx + 42, sy - 2, skill.name, 7.2);
    pdf.text(sx + skillColW - 16, sy - 2, skill.ability, 6.2, true, pdf.accent(skill.ability, MID));
  }
}

function drawCombat(pdf: PdfElements, data: CharacterSheetData): void {
  const y = 14;
  pdf.box(MARGIN, y, VIRTUAL_W - 2 * MARGIN, 224, "Combat & Actions");
  const x = MARGIN + 8;
  pdf.field(x, y + 166, 72, "Max HP", String(data.hp.max), 26, PAPER_RED);
  pdf.field(x + 82, y + 166, 72, "Current HP", String(data.hp.current), 26, PAPER_RED);
  pdf.field(x + 164, y + 166, 72, "Temp HP", String(data.hp.temp), 26, PAPER_CYAN);
  pdf.field(x + 246, y + 166, 74, "Hit Dice", data.hitDice.join(", "), 26, PAPER_GREEN);

  const deathX = x + 338;
  pdf.text(deathX, y + 201, "DEATH SAVES", 6.2, true, pdf.accent("CHA", MID));
  pdf.text(deathX, y + 186, "SUCCESS", 5.6, true, pdf.accent("DEX", MID));
  for (let i = 0; i < 3; i++) pdf.checkbox(deathX + 38 + i * 12, y + 184, 8, i < data.deathSaves.successes, pdf.accent("DEX", MID));
  pdf.text(deathX + 86, y + 186, "FAIL", 5.6, true, pdf.accent("STR", MID));
  for (let i = 0; i < 3; i++) pdf.checkbox(deathX + 116 + i * 12, y + 184, 8, i < data.deathSaves.failures, pdf.accent("STR", MID));

  pdf.text(deathX, y + 167, "EXHAUSTION", 5.6, true, pdf.accent("CON", MID));
  for (let i = 0; i < 6; i++) pdf.checkbox(deathX + 58 + i * 12, y + 165, 8, false, pdf.accent("CON", MID));

  const headers = ["Attack / Cantrip", "Bonus", "Damage / Type", "Notes"];
  const widths = [150, 60, 110, 170];
  let xx = x;
  for (const [idx, header] of headers.entries()) {
    pdf.text(xx, y + 136, header.toUpperCase(), 6.2, true, MID);
    xx += widths[idx];
  }
  const rows = data.actionRows.slice(0, 5);
  for (let row = 0; row < 5; row++) {
    const yy = y + 112 - row * 22;
    xx = x;
    for (const w of widths) {
      pdf.line(xx, yy, xx + w - 6, yy, 0.35, LIGHT);
      xx += w;
    }
    const action = rows[row];
    if (action) {
      pdf.fitText(x, yy + 5, widths[0] - 10, action.name, 8.8, true);
      pdf.fitText(x + widths[0], yy + 5, widths[1] - 10, action.bonus, 8.4, true);
      pdf.fitText(x + widths[0] + widths[1], yy + 5, widths[2] - 10, action.damage, 8.2, true);
      pdf.fitText(x + widths[0] + widths[1] + widths[2], yy + 5, widths[3] - 10, action.notes, 7.4);
    }
  }
}

function drawFeaturesPage(pdf: PdfElements, data: CharacterSheetData): void {
  pdf.pageTitle("Character Sheet", "Features, resources, equipment, and campaign notes");
  const topY = VIRTUAL_H - 40;
  const bottomY = 24;
  const leftW = 272;
  const rightX = MARGIN + leftW + BOX_GAP;
  const rightW = VIRTUAL_W - MARGIN - rightX;

  const row1H = 200;
  const row1Y = topY - row1H;
  const featureEntries = [
    ...data.features,
    ...data.racialTraits.map((trait) => ({ ...trait, name: `Species: ${trait.name}` })),
    ...data.feats.map((feat) => ({ ...feat, name: `Feat: ${feat.name}` })),
  ];
  pdf.box(MARGIN, row1Y, VIRTUAL_W - 2 * MARGIN, row1H, "Class & Species Features");
  const featureRows = drawDetailList(pdf, MARGIN + 8, row1Y + 10, VIRTUAL_W - 2 * MARGIN - 16, row1H - 34, featureEntries);
  pdf.writingLines(MARGIN, row1Y, VIRTUAL_W - 2 * MARGIN, row1H, WRITING_LINE_SPACING, writingTopPad(featureRows, DETAIL_ROW_H));

  const row2H = 208;
  const row2Y = row1Y - BOX_GAP - row2H;
  pdf.box(MARGIN, row2Y, leftW, row2H, "Equipment");
  const equipmentLines = pdf.textBlock(MARGIN + 8, row2Y + 10, leftW - 16, row2H - 34, data.equipment.join("\n"), 7.1);
  pdf.writingLines(MARGIN, row2Y, leftW, row2H, WRITING_LINE_SPACING, writingTopPad(equipmentLines));

  pdf.box(rightX, row2Y, rightW, row2H, "Personality, Ideals, Bonds, Flaws");
  const traitLines = pdf.textBlock(rightX + 8, row2Y + 10, rightW - 16, row2H - 34, fieldsToText(data.traits), 6.8);
  pdf.writingLines(rightX, row2Y, rightW, row2H, WRITING_LINE_SPACING, writingTopPad(traitLines));

  const notesH = row2Y - BOX_GAP - bottomY;
  pdf.box(MARGIN, bottomY, VIRTUAL_W - 2 * MARGIN, notesH, "Campaign Notes");
  const noteLines = pdf.textBlock(MARGIN + 8, bottomY + 10, VIRTUAL_W - 2 * MARGIN - 16, notesH - 34, fieldsToText(data.notes), 6.8);
  pdf.writingLines(MARGIN, bottomY, VIRTUAL_W - 2 * MARGIN, notesH, WRITING_LINE_SPACING, writingTopPad(noteLines));
}

function drawSpellPage(pdf: PdfElements, data: CharacterSheetData): void {
  pdf.pageTitle("Spellcasting Sheet", "Clean spell tracker for handwriting on e-ink");
  const topY = VIRTUAL_H - 40;
  const bottomY = 24;
  const fieldY = topY - 24;
  pdf.field(MARGIN, fieldY, 116, "Spellcasting ability", data.spellcasting.ability, 24);
  pdf.field(MARGIN + 126, fieldY, 86, "Save DC", data.spellcasting.saveDc, 24);
  pdf.field(MARGIN + 222, fieldY, 86, "Attack bonus", data.spellcasting.attackBonus, 24);
  pdf.field(MARGIN + 318, fieldY, VIRTUAL_W - MARGIN - (MARGIN + 318), "Prepared / known notes", "", 24);

  const slotsH = 84;
  const slotsY = fieldY - BOX_GAP - slotsH;
  pdf.box(MARGIN, slotsY, VIRTUAL_W - 2 * MARGIN, slotsH, "Spell Slots");
  let x = MARGIN + 10;
  const slots = data.spellSlots.filter((slot) => slot.available > 0).sort((a, b) => a.level - b.level);
  const slotColumnCount = slots.length + (data.pactMagic ? 1 : 0);
  const slotPitch = Math.min(58, (VIRTUAL_W - 2 * MARGIN - 24) / Math.max(1, slotColumnCount));
  if (slots.length === 0 && !data.pactMagic) {
    pdf.text(x, slotsY + 36, "No spell slots", 7.2, true, MID);
  }
  for (const slot of slots) {
    pdf.text(x, slotsY + 48, `L${slot.level}`, 7.2, true);
    for (let n = 0; n < slot.available; n++) {
      pdf.checkbox(x + n * 12, slotsY + 26, 8, n < slot.available - slot.used);
    }
    x += slotPitch;
  }
  if (data.pactMagic) {
    pdf.text(x + 8, slotsY + 48, `Pact L${data.pactMagic.level}`, 7.2, true, MID);
    for (let n = 0; n < data.pactMagic.available; n++) {
      pdf.checkbox(x + 8 + n * 12, slotsY + 26, 8, n < data.pactMagic.available - data.pactMagic.used);
    }
  }

  const colW = (VIRTUAL_W - 2 * MARGIN - BOX_GAP) / 2;
  const upperH = 286;
  const upperY = slotsY - BOX_GAP - upperH;
  spellBox(pdf, MARGIN, upperY, colW, upperH, "Cantrips & Prepared Spells", data, [0]);
  spellBox(pdf, MARGIN + colW + BOX_GAP, upperY, colW, upperH, "1st-3rd Level Spells", data, [1, 2, 3]);
  const lowerH = upperY - BOX_GAP - bottomY;
  spellBox(pdf, MARGIN, bottomY, colW, lowerH, "4th-6th Level Spells", data, [4, 5, 6]);
  spellBox(pdf, MARGIN + colW + BOX_GAP, bottomY, colW, lowerH, "7th-9th Level Spells", data, [7, 8, 9]);
}

function drawAdventureNotesPage(pdf: PdfElements): void {
  pdf.pageTitle("Adventure Notes", "Session log, NPCs, locations, loot, and unresolved threads");
  const topY = VIRTUAL_H - 40;
  const bottomY = 24;
  const colW = (VIRTUAL_W - 2 * MARGIN - BOX_GAP) / 2;
  const topH = 234;
  const topBoxY = topY - topH;
  for (const [idx, label] of ["Session Log", "NPCs & Factions", "Quests & Loose Ends", "Loot, Clues & Maps"].entries()) {
    const x = MARGIN + (idx % 2) * (colW + BOX_GAP);
    const y = idx < 2 ? topBoxY : bottomY;
    const h = idx < 2 ? topH : topBoxY - BOX_GAP - bottomY;
    pdf.box(x, y, colW, h, label);
    pdf.writingLines(x, y, colW, h);
  }
}

function drawLevelUpPage(pdf: PdfElements, data: CharacterSheetData): void {
  pdf.pageTitle("Level Up", "Class choices, HP, new features, spells, ASI, and feat notes");
  const topY = VIRTUAL_H - 52;
  const bottomY = 24;
  const fieldW = (VIRTUAL_W - 2 * MARGIN - 5 * GAP) / 6;
  const fields = [
    ["Current", String(data.level)],
    ["New", ""],
    ["Class", data.classes],
    ["Subclass", ""],
    ["HP roll", ""],
    ["Prof.", signed(data.proficiencyBonus)],
  ];
  let x = MARGIN;
  for (const [label, value] of fields) {
    pdf.field(x, topY - 22, fieldW, label, value, 22);
    x += fieldW + GAP;
  }

  const leftW = 276;
  const rightX = MARGIN + leftW + BOX_GAP;
  const rightW = VIRTUAL_W - MARGIN - rightX;
  const upperH = 238;
  const upperY = topY - 22 - BOX_GAP - upperH;
  pdf.box(MARGIN, upperY, leftW, upperH, "Class Choices");
  for (const [idx, label] of ["Features", "Subclass", "Invocations / Fighting Style", "Other choice"].entries()) {
    labeledLine(pdf, MARGIN + 8, upperY + upperH - 44 - idx * 34, leftW - 16, label);
  }
  pdf.writingLines(MARGIN, upperY, leftW, upperH - 146, 152);

  pdf.box(rightX, upperY, rightW, upperH, "ASI / Feat");
  pdf.field(rightX + 8, upperY + upperH - 50, 82, "Ability 1", "", 24);
  pdf.field(rightX + 100, upperY + upperH - 50, 82, "Ability 2", "", 24);
  pdf.field(rightX + 192, upperY + upperH - 50, rightW - 200, "Feat", "", 24);
  pdf.writingLines(rightX, upperY, rightW, upperH - 82, 16, 96);

  const lowerH = upperY - BOX_GAP - bottomY;
  const lowerW = (VIRTUAL_W - 2 * MARGIN - BOX_GAP) / 2;
  pdf.box(MARGIN, bottomY, lowerW, lowerH, "New Spells");
  pdf.table(MARGIN + 8, bottomY + 12, [102, 42, 42, lowerW - 202], 22, 7, ["Spell", "Lvl", "Prep", "Notes"]);
  pdf.box(MARGIN + lowerW + BOX_GAP, bottomY, lowerW, lowerH, "Level Notes");
  pdf.writingLines(MARGIN + lowerW + BOX_GAP, bottomY, lowerW, lowerH);
}

function drawInventoryPage(pdf: PdfElements, data: CharacterSheetData): void {
  pdf.pageTitle("Inventory", "Equipment, attunement, consumables, coins, and carrying capacity");
  const topY = VIRTUAL_H - 40;
  const bottomY = 24;
  const capH = 84;
  const capY = topY - capH;
  pdf.box(MARGIN, capY, VIRTUAL_W - 2 * MARGIN, capH, "Carrying Capacity");
  let x = MARGIN + 8;
  const strength = data.abilities.find((ability) => ability.label === "STR")?.value ?? "";
  for (const [label, value] of [["Strength", strength], ["Capacity", ""], ["Current", ""], ["Push / drag", ""], ["Lifestyle", ""]]) {
    pdf.field(x, capY + 18, 96, label, value, 28);
    x += 108;
  }

  const tableY = capY - BOX_GAP - 318;
  pdf.box(MARGIN, tableY, VIRTUAL_W - 2 * MARGIN, 318, "Equipment");
  pdf.table(MARGIN + 8, tableY + 12, [160, 40, 44, 86, 76, 142], 22, 12, ["Item", "Qty", "Wt", "Where", "Value", "Notes"]);
  for (const [idx, item] of data.inventory.slice(0, 12).entries()) {
    const rowY = tableY + 12 + 22 * (11 - idx) + 7;
    pdf.fitText(MARGIN + 12, rowY, 150, item.name, 6.7);
    pdf.centered(MARGIN + 168, rowY, 36, String(item.quantity), 6.7);
    pdf.centered(MARGIN + 210, rowY, 40, item.weight ? String(item.weight) : "", 6.7);
    pdf.fitText(MARGIN + 254, rowY, 78, item.equipped ? "Equipped" : "", 6.7);
    pdf.fitText(MARGIN + 340, rowY, 68, item.value, 6.7);
  }

  const lowerH = tableY - BOX_GAP - bottomY;
  const leftW = 274;
  const rightX = MARGIN + leftW + BOX_GAP;
  const rightW = VIRTUAL_W - MARGIN - rightX;
  pdf.box(MARGIN, bottomY, leftW, lowerH, "Attunement");
  for (let idx = 0; idx < 3; idx++) {
    pdf.field(MARGIN + 8, bottomY + lowerH - 50 - idx * 42, leftW - 16, `Slot ${idx + 1}`, "", 24);
  }

  pdf.box(rightX, bottomY, rightW, lowerH, "Consumables & Coins");
  for (const [idx, coin] of data.currencies.entries()) {
    pdf.field(rightX + 8 + idx * 47, bottomY + lowerH - 50, 38, coin.label, coin.value, 22);
  }
  pdf.table(rightX + 8, bottomY + 14, [112, 42, rightW - 170], 23, 8, ["Item", "Qty", "Notes"]);
}

function drawDowntimePage(pdf: PdfElements): void {
  pdf.pageTitle("Downtime", "Projects, crafting, training, contacts, and lifestyle costs");
  const topY = VIRTUAL_H - 40;
  const bottomY = 24;
  const projectH = 314;
  const projectY = topY - projectH;
  pdf.box(MARGIN, projectY, VIRTUAL_W - 2 * MARGIN, projectH, "Projects");
  pdf.table(MARGIN + 8, projectY + 12, [148, 134, 72, 72, 122], 24, 10, ["Project", "Goal", "Days", "Cost", "Next Step"]);

  const lowerH = projectY - BOX_GAP - bottomY;
  const colW = (VIRTUAL_W - 2 * MARGIN - 2 * BOX_GAP) / 3;
  for (const [idx, label] of ["Contacts", "Training / Craft", "Lifestyle"].entries()) {
    const x = MARGIN + idx * (colW + BOX_GAP);
    pdf.box(x, bottomY, colW, lowerH, label);
    pdf.writingLines(x, bottomY, colW, lowerH);
  }
}

function drawRelationshipsPage(pdf: PdfElements): void {
  pdf.pageTitle("Relationships", "Allies, rivals, patrons, factions, debts, and secrets");
  const topY = VIRTUAL_H - 40;
  const bottomY = 24;
  const colW = (VIRTUAL_W - 2 * MARGIN - BOX_GAP) / 2;
  const rowH = (topY - bottomY - 2 * BOX_GAP) / 3;
  const labels = ["Allies", "Rivals", "Patrons", "Factions", "Debts", "Secrets"];
  for (const [idx, label] of labels.entries()) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = MARGIN + col * (colW + BOX_GAP);
    const y = topY - (row + 1) * rowH - row * BOX_GAP;
    pdf.box(x, y, colW, rowH, label);
    pdf.table(x + 8, y + 12, [86, 76, 54, colW - 232], 21, 8, ["Name", "Link", "Status", "Notes"]);
  }
}

function spellBox(pdf: PdfElements, x: number, y: number, w: number, h: number, title: string, data: CharacterSheetData, levels: number[]): void {
  pdf.box(x, y, w, h, title);
  const text = data.spellsByLevel
    .filter((group) => levels.includes(group.level))
    .flatMap((group) => group.spells.map((spell) => `${spell.name} - ${spell.detail || group.label}`))
    .join("\n");
  const spellLines = pdf.textBlock(x + 8, y + 10, w - 16, h - 34, text, 6.5, 11);
  pdf.writingLines(x, y, w, h, WRITING_LINE_SPACING, writingTopPad(spellLines, 11));
}

function labeledLine(pdf: PdfElements, x: number, y: number, w: number, label: string, value = ""): void {
  pdf.text(x, y + 6, label.toUpperCase(), 6.2, true, MID);
  pdf.line(x + 92, y + 7, x + w, y + 7, 0.45, LIGHT);
  if (value) pdf.fitText(x + 96, y + 9, w - 98, value, 7, true);
}

function drawProficiencyCategories(
  pdf: PdfElements,
  x: number,
  y: number,
  w: number,
  h: number,
  categories: ProficiencyCategories,
): void {
  const rows = [
    ["Weapons", categories.weapons],
    ["Armor", categories.armor],
    ["Tools", categories.tools],
    ["Languages", categories.languages],
  ] as const;
  let cursor = y + h - 30;
  for (const [label, values] of rows) {
    pdf.text(x + 8, cursor, label.toUpperCase(), 5.9, true, MID);
    const value = values.join(", ");
    const valueY = cursor - PROFICIENCY_LABEL_TO_VALUE_GAP;
    const lineCount = value
      ? pdf.wrappedText(x + 8, valueY, w - 16, value, 6.6, PROFICIENCY_VALUE_LINE_H)
      : 1;
    const lineY = valueY - (lineCount - 1) * PROFICIENCY_VALUE_LINE_H - MIN_TEXT_TO_LINE_GAP;
    pdf.line(x + 8, lineY, x + w - 8, lineY, 0.35, LIGHT);
    cursor = lineY - PROFICIENCY_SECTION_GAP;
  }
}

function drawDetailList(pdf: PdfElements, x: number, y: number, w: number, h: number, entries: NamedDetail[]): number {
  const maxRows = Math.floor((h - 6) / DETAIL_ROW_H);
  for (const [idx, entry] of entries.slice(0, maxRows).entries()) {
    const yy = y + h - 6 - idx * DETAIL_ROW_H;
    const name = entry.detail ? `${entry.name}:` : entry.name;
    pdf.fillRect(x - 8, yy - 2, w + 16, 10);
    pdf.fitText(x, yy, 132, name, 6.9, true);
    if (entry.detail) pdf.fitText(x + 136, yy, w - 136, entry.detail, 6.6);
  }
  if (entries.length > maxRows) {
    pdf.fitText(x, y + 2, w, `+${entries.length - maxRows} more`, 6.4, true, MID);
  }
  return Math.min(entries.length, maxRows);
}

function writingTopPad(textLines: number, lineHeight = 14): number {
  if (textLines <= 0) return 33;
  return BOX_TEXT_TOP_PAD + (textLines - 1) * lineHeight + MIN_TEXT_TO_LINE_GAP;
}

function fieldsToText(fields: SheetField[]): string {
  return fields.map((field) => `${field.label}: ${field.value}`).join("\n");
}

async function resolveCharacterId(client: DdbClient, params: GenerateCharacterSheetPdfParams): Promise<number | string> {
  if (params.characterId) return params.characterId;
  if (!params.characterName) return "Either characterId or characterName must be provided.";

  const foundId = await findAccessibleCharacterByName(client, params.characterName);
  return foundId ?? `Character "${params.characterName}" not found.`;
}

function buildAbilities(char: DdbCharacter): SheetField[] {
  return ABILITY_NAMES.map((name, idx) => ({
    label: name,
    value: String(computeFinalAbilityScore(char.stats, char.bonusStats, char.overrideStats, char.modifiers, idx + 1)),
  }));
}

function buildSaves(char: DdbCharacter, proficiencyBonus: number): SaveValue[] {
  return ABILITY_NAMES.map((ability, idx) => {
    const id = idx + 1;
    const proficient = hasModifierBySubType(char.modifiers, SAVING_THROW_SUBTYPES[id], "proficiency");
    const total = abilityMod(char, id) + (proficient ? proficiencyBonus : 0);
    return { ability, total: signed(total), proficient };
  });
}

function buildSkills(char: DdbCharacter, proficiencyBonus: number): SkillValue[] {
  return SKILL_DEFINITIONS.map((skill) => {
    const proficient = hasModifierBySubType(char.modifiers, skill.subType, "proficiency");
    const expertise = hasModifierBySubType(char.modifiers, skill.subType, "expertise");
    const total = abilityMod(char, skill.abilityId) + (expertise ? proficiencyBonus * 2 : proficient ? proficiencyBonus : 0);
    return {
      name: skill.name,
      ability: ABILITY_NAMES[skill.abilityId - 1],
      total: signed(total),
      proficient,
      expertise,
    };
  });
}

function buildProficiencies(char: DdbCharacter): ProficiencyCategories {
  const armor = new Set<string>();
  const weapons = new Set<string>();
  const tools = new Set<string>();
  const languages = new Set<string>();

  for (const list of Object.values(char.modifiers)) {
    if (!Array.isArray(list)) continue;
    for (const mod of list) {
      if (mod.type !== "proficiency" || EXCLUDED_PROFICIENCY_SUBTYPES.has(mod.subType)) continue;
      const displayName = mod.friendlySubtypeName || titleCase(mod.subType.replace(/-/g, " "));
      if (ARMOR_SUBTYPES.has(mod.subType)) armor.add(displayName);
      else if (WEAPON_GROUPS.has(mod.subType)) weapons.add(displayName);
      else if (LANGUAGE_SUBTYPES.has(mod.subType)) languages.add(displayName);
      else if (mod.subType.endsWith("-tools") || mod.subType.includes("tools") || mod.subType.includes("kit") || mod.subType.includes("supplies") || mod.subType.includes("instrument") || mod.subType.includes("set")) tools.add(displayName);
      else weapons.add(displayName);
    }
  }

  return {
    armor: [...armor].sort(),
    weapons: [...weapons].sort(),
    tools: [...tools].sort(),
    languages: [...languages].sort(),
  };
}

function buildDefenses(char: DdbCharacter): SheetField[] {
  const groups = new Map<string, Set<string>>([
    ["Resistances", new Set<string>()],
    ["Immunities", new Set<string>()],
    ["Vulnerabilities", new Set<string>()],
    ["Save Advantages", new Set<string>()],
  ]);

  for (const list of Object.values(char.modifiers)) {
    if (!Array.isArray(list)) continue;
    for (const mod of list) {
      const label = defenseLabel(mod.type);
      if (label) groups.get(label)?.add(defenseName(mod));
      for (const name of saveAdvantageNames(mod)) {
        groups.get("Save Advantages")?.add(name);
      }
    }
  }

  return [...groups.entries()]
    .map(([label, values]) => ({ label, value: [...values].sort().join(", ") }))
    .filter((field) => field.value);
}

function defenseLabel(type: string): string | null {
  const normalized = type.toLowerCase();
  if (normalized.includes("resistance")) return "Resistances";
  if (normalized.includes("immunity")) return "Immunities";
  if (normalized.includes("vulnerability")) return "Vulnerabilities";
  return null;
}

function defenseName(mod: DdbModifier): string {
  return (mod.friendlySubtypeName || titleCase(mod.subType.replace(/-/g, " ")))
    .replace(/\s+damage$/i, "");
}

function saveAdvantageNames(mod: DdbModifier): string[] {
  if (!mod.type.toLowerCase().includes("advantage")) return [];
  const text = `${mod.subType} ${mod.friendlySubtypeName}`.toLowerCase();
  const isSaveAdvantage = /\bsav(e|ing)\b/.test(text) || Object.keys(SAVE_ADVANTAGE_CONDITIONS).some((key) => text.includes(key));
  if (!isSaveAdvantage) return [];

  const found = Object.entries(SAVE_ADVANTAGE_CONDITIONS)
    .filter(([key]) => text.includes(key))
    .map(([, label]) => label);
  if (found.length > 0) return [...new Set(found)];

  return [defenseName(mod).replace(/^saving throws?\s*(against|vs\.?)?\s*/i, "")];
}

function buildFeatures(char: DdbCharacter): NamedDetail[] {
  const seen = new Set<string>();
  const features: NamedDetail[] = [];
  for (const cls of char.classes) {
    for (const feature of cls.classFeatures ?? []) {
      if (featureLevel(feature) <= cls.level && !seen.has(featureName(feature))) {
        seen.add(featureName(feature));
        features.push({ name: featureName(feature), detail: shortDetail(featureSnippet(feature)) });
      }
    }
    for (const feature of cls.subclassDefinition?.classFeatures ?? []) {
      if (featureLevel(feature) <= cls.level && !seen.has(featureName(feature))) {
        seen.add(featureName(feature));
        features.push({ name: featureName(feature), detail: shortDetail(featureSnippet(feature)) });
      }
    }
  }
  return features;
}

function buildResources(char: DdbCharacter): string[] {
  const resources: string[] = [];
  for (const list of Object.values(char.actions ?? {}) as DdbAction[][]) {
    if (!Array.isArray(list)) continue;
    for (const action of list) {
      if (!action.limitedUse) continue;
      const remaining = action.limitedUse.maxUses - action.limitedUse.numberUsed;
      resources.push(`${action.name}: ${remaining}/${action.limitedUse.maxUses}`);
    }
  }
  return resources;
}

function buildActionRows(
  char: DdbCharacter,
  preparedSpells: DdbSpell[],
  spellcasting: CharacterSheetData["spellcasting"],
  proficiencyBonus: number,
): ActionRow[] {
  const cantrips = preparedSpells
    .filter((spell) => spell.definition.level === 0)
    .slice(0, 2)
    .map((spell) => ({
      name: spell.definition.name,
      bonus: spellLooksLikeAttack(spell) ? spellcasting.attackBonus : "",
      damage: spellDamage(spell, computeLevel(char)),
      notes: spellLooksLikeAttack(spell)
        ? ""
        : spellcasting.saveDc ? `DC ${spellcasting.saveDc}` : "",
    }));

  const weapons = char.inventory
    .filter((item) => item.equipped && isWeapon(item))
    .map((item) => weaponActionRow(char, item, proficiencyBonus));

  return dedupeActionRows([...cantrips, ...buildAttackActionRows(char), ...weapons]).slice(0, 6);
}

function buildAttackActionRows(char: DdbCharacter): ActionRow[] {
  const rows: ActionRow[] = [];
  for (const list of Object.values(char.actions ?? {}) as DdbAction[][]) {
    if (!Array.isArray(list)) continue;
    for (const action of list) {
      if (!looksLikeAttackAction(action)) continue;
      rows.push({
        name: action.name,
        bonus: actionAttackBonus(action),
        damage: actionDamage(action),
        notes: actionNotes(action),
      });
    }
  }
  return rows;
}

function dedupeActionRows(rows: ActionRow[]): ActionRow[] {
  const selected: ActionRow[] = [];

  for (const row of rows) {
    const aliases = weaponNameAliases(row.name);
    const existingIndex = selected.findIndex((existing) => setsOverlap(aliases, weaponNameAliases(existing.name)));
    if (existingIndex === -1) {
      selected.push(row);
      continue;
    }

    if (actionRowScore(row) > actionRowScore(selected[existingIndex])) {
      selected[existingIndex] = row;
    }
  }

  return selected;
}

function actionRowScore(row: ActionRow): number {
  return (row.bonus ? 1 : 0) + (row.damage ? 2 : 0) + (row.notes ? 1 : 0);
}

function setsOverlap(a: Set<string>, b: Set<string>): boolean {
  return [...a].some((value) => b.has(value));
}

function weaponActionRow(char: DdbCharacter, item: DdbInventoryItem, proficiencyBonus: number): ActionRow {
  const fallback = weaponFallback(item.definition.name);
  const ability = fallback?.ability ?? inferWeaponAbility(item);
  const strMod = abilityMod(char, 1);
  const dexMod = abilityMod(char, 2);
  const abilityBonus = ability === "finesse" ? Math.max(strMod, dexMod) : ability === "dex" ? dexMod : strMod;
  const proficient = isWeaponProficient(char, item, fallback?.group);
  const attackBonus = abilityBonus + (proficient ? proficiencyBonus : 0);
  const damage = itemDamage(item, fallback);

  return {
    name: item.definition.name,
    bonus: signed(attackBonus),
    damage: damage ? `${addDamageModifier(damage.dice, abilityBonus)} ${damage.type}`.trim() : "",
    notes: proficient ? "Prof." : "",
  };
}

function isWeapon(item: DdbInventoryItem): boolean {
  const definition = item.definition as DdbInventoryItem["definition"] & { filterType?: string | null; entityTypeId?: number | null };
  if (item.entityTypeId === DDB_WEAPON_ENTITY_TYPE_ID || definition.entityTypeId === DDB_WEAPON_ENTITY_TYPE_ID) return true;
  return `${definition.type ?? ""} ${definition.filterType ?? ""}`.toLowerCase().includes("weapon")
    || weaponFallback(definition.name) !== null;
}

function looksLikeAttackAction(action: DdbAction): boolean {
  const record = action as DdbAction & Record<string, unknown>;
  if (record.displayAsAttack === true || record.attackType != null || record.attackSubtype != null) return true;
  if (numberValue(record.toHit) != null || numberValue(record.toHitBonus) != null || numberValue(record.fixedToHit) != null) return true;
  if (actionDamage(action)) return true;
  return /attack|to hit|\bdamage\b/i.test(actionText(action));
}

function actionAttackBonus(action: DdbAction): string {
  const record = action as DdbAction & Record<string, unknown>;
  const bonus = numberValue(record.toHit)
    ?? numberValue(record.toHitBonus)
    ?? numberValue(record.fixedToHit)
    ?? numberValue(record.attackBonus);
  if (bonus != null) return signed(bonus);
  return actionText(action).match(/([+-]\d+)\s+to hit/i)?.[1] ?? "";
}

function actionDamage(action: DdbAction): string {
  const record = action as DdbAction & Record<string, unknown>;
  const damage = recordValue(record.damage);
  const dice = stringValue(record.damageDice)
    ?? stringValue(record.diceString)
    ?? stringValue(damage?.diceString)
    ?? stringValue(damage?.dice)
    ?? diceFromParts(numberValue(record.diceCount), numberValue(record.diceValue))
    ?? diceFromParts(numberValue(damage?.diceCount), numberValue(damage?.diceValue));
  const type = stringValue(record.damageType)
    ?? stringValue(damage?.damageType)
    ?? stringValue(recordValue(record.damageTypeDefinition)?.name)
    ?? stringValue(recordValue(damage?.damageTypeDefinition)?.name)
    ?? "";

  if (dice) return `${addDamageModifier(dice, numberValue(record.value) ?? numberValue(damage?.fixedValue) ?? 0)} ${type}`.trim();

  const match = actionText(action).match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)\s+damage/i);
  return match ? `${match[1].replace(/\s+/g, "")} ${match[2].toLowerCase()}` : "";
}

function actionNotes(action: DdbAction): string {
  const record = action as DdbAction & Record<string, unknown>;
  if (record.isProficient === true) return "Prof.";
  return "";
}

function actionText(action: DdbAction): string {
  const record = action as DdbAction & Record<string, unknown>;
  return stripHtml([
    stringValue(record.snippet),
    stringValue(record.description),
    stringValue(record.attackSubtype),
  ].filter(Boolean).join(" "));
}

function isWeaponProficient(char: DdbCharacter, item: DdbInventoryItem, group?: "simple" | "martial"): boolean {
  if (item.isProficient === true) return true;

  const weaponNames = weaponNameAliases(item.definition.name);
  const groupSubtype = group === "simple" ? "simple-weapons" : group === "martial" ? "martial-weapons" : "";

  for (const list of Object.values(char.modifiers)) {
    if (!Array.isArray(list)) continue;
    for (const mod of list) {
      if (mod.type !== "proficiency") continue;
      if (groupSubtype && mod.subType === groupSubtype) return true;
      const proficiencyNames = new Set([
        ...weaponNameAliases(mod.subType),
        ...weaponNameAliases(mod.friendlySubtypeName),
      ]);
      if ([...weaponNames].some((name) => proficiencyNames.has(name))) return true;
    }
  }

  return false;
}

function weaponNameAliases(value: string): Set<string> {
  const normalized = normalizeWeaponName(value);
  const aliases = new Set([normalized]);
  const withoutComma = normalized.replace(/,/g, "");
  aliases.add(withoutComma);

  const commaParts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length === 2) {
    aliases.add(`${commaParts[1]} ${commaParts[0]}`);
  }

  return aliases;
}

function inferWeaponAbility(item: DdbInventoryItem): "str" | "dex" | "finesse" {
  const name = normalizeWeaponName(item.definition.name);
  const text = `${name} ${item.definition.description ?? ""}`.toLowerCase();
  if (text.includes("finesse")) return "finesse";
  if (text.includes("ranged") || text.includes("crossbow") || text.includes("bow") || text.includes("sling") || name === "dart") return "dex";
  return "str";
}

function itemDamage(
  item: DdbInventoryItem,
  fallback: { damage: string; type: string } | null,
): { dice: string; type: string } | null {
  const definition = item.definition as DdbInventoryItem["definition"] & Record<string, unknown>;
  const damage = recordValue(definition.damage);
  const dice = stringValue(damage?.diceString)
    ?? stringValue(damage?.dice)
    ?? diceFromParts(numberValue(damage?.diceCount), numberValue(damage?.diceValue))
    ?? stringValue(definition.diceString)
    ?? fallback?.damage;
  const type = stringValue(definition.damageType)
    ?? stringValue(damage?.damageType)
    ?? stringValue(recordValue(definition.damageTypeDefinition)?.name)
    ?? stringValue(recordValue(damage?.damageTypeDefinition)?.name)
    ?? fallback?.type
    ?? "";

  if (!dice) return null;
  return { dice, type };
}

function spellDamage(spell: DdbSpell, characterLevel: number): string {
  const definition = spell.definition as DdbSpell["definition"] & Record<string, unknown>;
  const damage = recordValue(definition.damage);
  let dice = stringValue(damage?.diceString)
    ?? stringValue(damage?.dice)
    ?? diceFromParts(numberValue(damage?.diceCount), numberValue(damage?.diceValue));
  let type = stringValue(damage?.damageType)
    ?? stringValue(recordValue(damage?.damageTypeDefinition)?.name)
    ?? stringValue(definition.damageType);

  if (!dice) {
    const match = stripHtml(spell.definition.description).match(/(\d+d\d+)\s+([a-z]+)\s+damage/i);
    if (match) {
      dice = match[1];
      type = match[2].toLowerCase();
    }
  }

  if (!dice) return "";
  if (spell.definition.level === 0) dice = scaleCantripDice(dice, characterLevel);
  return `${dice}${type ? ` ${type}` : ""}`;
}

function spellLooksLikeAttack(spell: DdbSpell): boolean {
  const definition = spell.definition as DdbSpell["definition"] & Record<string, unknown>;
  if (definition.attackType != null) return true;
  return /spell attack/i.test(stripHtml(spell.definition.description));
}

function buildHitDice(char: DdbCharacter): string[] {
  return char.classes.map((cls) => `${cls.level}${HIT_DIE_MAP[cls.definition.name] ?? "d8"}`);
}

function computeSpellcasting(char: DdbCharacter, spells: DdbSpell[]): CharacterSheetData["spellcasting"] {
  const spellClass = char.classes.find((cls) => getSpellcastingAbilityId(cls) !== null);
  if (spells.length === 0 || !spellClass) return { ability: "", saveDc: "", attackBonus: "" };
  const abilityId = getSpellcastingAbilityId(spellClass) ?? 5;
  const mod = abilityMod(char, abilityId);
  const proficiencyBonus = calculateProficiencyBonus(computeLevel(char));
  return {
    ability: ABILITY_NAMES[abilityId - 1],
    saveDc: String(8 + proficiencyBonus + mod),
    attackBonus: signed(proficiencyBonus + mod),
  };
}

function groupSpells(spells: DdbSpell[], characterLevel: number): CharacterSheetData["spellsByLevel"] {
  const groups = new Map<number, SpellEntry[]>();
  for (const spell of spells) {
    const level = spell.definition.level;
    const group = groups.get(level) ?? [];
    group.push({
      level,
      name: spell.definition.name,
      detail: spellDetail(spell, characterLevel),
    });
    groups.set(level, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, names]) => ({
      level,
      label: level === 0 ? "Cantrips" : `Level ${level}`,
      spells: names.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

function getAllSpells(char: DdbCharacter): DdbSpell[] {
  return [
    ...(char.spells.class ?? []),
    ...(char.spells.race ?? []),
    ...(char.spells.background ?? []),
    ...(char.spells.item ?? []),
    ...(char.spells.feat ?? []),
  ];
}

function getSpellcastingAbilityId(cls: DdbClass): number | null {
  return cls.definition.spellCastingAbilityId
    ?? cls.spellCastingAbilityId
    ?? FALLBACK_SPELLCASTING_ABILITY[cls.definition.name]
    ?? null;
}

function spellDetail(spell: DdbSpell, characterLevel: number): string {
  const level = spell.definition.level === 0 ? "Cantrip" : `Level ${spell.definition.level}`;
  const components = (spell.definition.components ?? [])
    .map((component) => ({ 1: "V", 2: "S", 3: "M" })[component])
    .filter(Boolean)
    .join("/");
  const notes = [
    `${level} ${spell.definition.school}`,
    spellActivation(spell),
    spellShape(spell),
    spellDamage(spell, characterLevel),
    spellDuration(spell),
    components,
    spell.definition.concentration ? "Conc." : "",
    spell.definition.ritual ? "Ritual" : "",
    shortDetail(spell.definition.description, 70),
  ].filter(Boolean);
  return notes.join(" - ");
}

function spellActivation(spell: DdbSpell): string {
  const activation = spell.definition.activation;
  if (!activation) return "";
  const label = ({ 1: "Action", 3: "Bonus", 6: "Reaction" } as Record<number, string>)[activation.activationType] ?? "Cast";
  return activation.activationTime === 1 ? label : `${activation.activationTime} ${label}`;
}

function spellShape(spell: DdbSpell): string {
  return [
    spellAttackType(spell),
    spellSaveType(spell),
    spellRange(spell),
  ].filter(Boolean).join(" ");
}

function spellAttackType(spell: DdbSpell): string {
  const definition = spell.definition as DdbSpell["definition"] & Record<string, unknown>;
  const attackType = definition.attackType;
  const label = typeof attackType === "number"
    ? ({ 1: "Melee", 2: "Ranged" } as Record<number, string>)[attackType]
    : stringValue(attackType) ?? stringValue(recordValue(definition.attackTypeDefinition)?.name);
  if (label) return `${titleCase(label)} atk`;
  return spellLooksLikeAttack(spell) ? "Spell atk" : "";
}

function spellSaveType(spell: DdbSpell): string {
  const definition = spell.definition as DdbSpell["definition"] & Record<string, unknown>;
  const abilityId = numberValue(definition.saveDcAbilityId) ?? numberValue(recordValue(definition.saveDcAbility)?.id);
  const label = abilityId ? ABILITY_NAMES[abilityId - 1] : stringValue(definition.saveDcAbilityName) ?? stringValue(recordValue(definition.saveDcAbility)?.name);
  return label ? `${label} save` : "";
}

function spellRange(spell: DdbSpell): string {
  const range = spell.definition.range;
  if (!range) return "";
  const distance = range.rangeValue == null ? "" : `${range.rangeValue} ft`;
  const aoe = [range.aoeValue == null ? "" : `${range.aoeValue} ft`, range.aoeType ?? ""].filter(Boolean).join(" ");
  return [titleCase(range.origin.replace(/-/g, " ")), distance, aoe].filter(Boolean).join(" ");
}

function spellDuration(spell: DdbSpell): string {
  const duration = spell.definition.duration;
  if (!duration) return "";
  if (duration.durationType === "Instantaneous") return "Instant";
  if (duration.durationInterval != null && duration.durationUnit) {
    return `${duration.durationInterval} ${duration.durationUnit}`;
  }
  return duration.durationType === "Concentration" ? "Conc." : duration.durationType;
}

function hasModifierBySubType(modifiers: Record<string, DdbModifier[]>, subType: string, type: string): boolean {
  for (const list of Object.values(modifiers)) {
    if (!Array.isArray(list)) continue;
    for (const mod of list) {
      if (mod.subType === subType && mod.type === type) return true;
    }
  }
  return false;
}

function formatClasses(char: DdbCharacter): string {
  return [...char.classes]
    .sort((a, b) => (b.isStartingClass ? 1 : 0) - (a.isStartingClass ? 1 : 0))
    .map((cls) => `${cls.definition.name}${cls.subclassDefinition?.name ? ` (${cls.subclassDefinition.name})` : ""} ${cls.level}`)
    .join(" / ");
}

function formatSpeed(char: DdbCharacter): string {
  const speeds: DdbMovementSpeeds = { walk: 30, ...extractSpeeds(char) };
  speeds.walk = (speeds.walk ?? 30)
    + sumModifierBonuses(char.modifiers, "speed")
    + sumModifierBonuses(char.modifiers, "unarmored-movement")
    + sumModifierBonuses(char.modifiers, "innate-speed-walking")
    + sumModifierBonuses(char.modifiers, "walking-speed");
  speeds.fly = addSpeedBonus(char, speeds.fly, "innate-speed-flying", "flying-speed");
  speeds.swim = addSpeedBonus(char, speeds.swim, "innate-speed-swimming", "swimming-speed");
  speeds.climb = addSpeedBonus(char, speeds.climb, "innate-speed-climbing", "climbing-speed");
  speeds.burrow = addSpeedBonus(char, speeds.burrow, "innate-speed-burrowing", "burrowing-speed");
  return [
    formatSpeedPart("walk", speeds.walk),
    formatSpeedPart("fly", speeds.fly),
    formatSpeedPart("swim", speeds.swim),
    formatSpeedPart("climb", speeds.climb),
    formatSpeedPart("burrow", speeds.burrow),
  ].filter((part): part is string => Boolean(part)).join(", ");
}

function extractSpeeds(char: DdbCharacter): DdbMovementSpeeds {
  return normalizeSpeeds(char.weightSpeeds?.normal)
    ?? normalizeSpeeds(char.speeds)
    ?? normalizeSpeeds(char.speed)
    ?? normalizeSpeeds(char.race.weightSpeeds?.normal)
    ?? normalizeSpeeds(char.race.speed)
    ?? {};
}

function normalizeSpeeds(value: DdbMovementSpeeds | number | undefined): DdbMovementSpeeds | null {
  if (typeof value === "number") return { walk: value };
  return value ?? null;
}

function addSpeedBonus(char: DdbCharacter, base: number | null | undefined, ...subTypes: string[]): number | null | undefined {
  const bonus = subTypes.reduce((sum, subType) => sum + sumModifierBonuses(char.modifiers, subType), 0);
  if (base == null && bonus === 0) return base;
  return (base ?? 0) + bonus;
}

function formatSpeedPart(label: string, value: number | null | undefined): string | null {
  if (!value || value <= 0) return null;
  return label === "walk" ? `${value} ft` : `${label} ${value} ft`;
}

function abilityMod(char: DdbCharacter, id: number): number {
  const score = computeFinalAbilityScore(char.stats, char.bonusStats, char.overrideStats, char.modifiers, id);
  return Math.floor((score - 10) / 2);
}

function abilityModLabel(score: number): string {
  return signed(Math.floor((score - 10) / 2));
}

function calculateProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

function featureName(feature: DdbClassFeature): string {
  return feature.definition?.name ?? feature.name ?? "Unknown";
}

function featureLevel(feature: DdbClassFeature): number {
  return feature.definition?.requiredLevel ?? feature.requiredLevel ?? 0;
}

function featureSnippet(feature: DdbClassFeature): string {
  return feature.definition?.snippet
    ?? feature.definition?.description
    ?? feature.description
    ?? "";
}

function shortDetail(value: string | null | undefined, max = 90): string {
  const text = stripHtml(value)
    .split(/\.\s+/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

function passiveScore(data: CharacterSheetData, skillName: string): string {
  const skill = data.skills.find((entry) => entry.name === skillName);
  if (!skill) return "";
  return String(10 + Number(skill.total.replace("+", "")));
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function weaponFallback(name: string): { damage: string; type: string; ability: "str" | "dex" | "finesse"; group: "simple" | "martial" } | null {
  const normalized = normalizeWeaponName(name);
  if (WEAPON_FALLBACKS[normalized]) return WEAPON_FALLBACKS[normalized];
  if (normalized === "light crossbow") return WEAPON_FALLBACKS["crossbow, light"];
  if (normalized === "hand crossbow") return WEAPON_FALLBACKS["crossbow, hand"];
  if (normalized === "heavy crossbow") return WEAPON_FALLBACKS["crossbow, heavy"];
  return null;
}

function normalizeWeaponName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s$/, "");
}

function addDamageModifier(dice: string, modifier: number): string {
  if (modifier === 0) return dice;
  return `${dice}${modifier > 0 ? "+" : ""}${modifier}`;
}

function scaleCantripDice(dice: string, characterLevel: number): string {
  const match = dice.match(/^(\d+)d(\d+)$/);
  if (!match) return dice;
  const scale = characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1;
  return `${Number(match[1]) * scale}d${match[2]}`;
}

function diceFromParts(count: number | null, value: number | null): string | null {
  if (count == null || value == null) return null;
  return `${count}d${value}`;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanPdfText(value: string): string {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .trim();
}

function wrapText(value: string, font: Fonts["regular"], size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function ellipsize(value: string, font: Fonts["regular"], size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let result = value;
  while (result.length > 0 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}...`;
}
