import type { DdbCharacter, DdbSpell } from "../types/character.js";

export function getCharacterSpells(char: DdbCharacter): DdbSpell[] {
  const spells = [
    ...(char.classSpells ?? []).flatMap((entry) => entry.spells ?? []),
    ...(char.spells.class ?? []),
    ...(char.spells.race ?? []),
    ...(char.spells.background ?? []),
    ...(char.spells.item ?? []),
    ...(char.spells.feat ?? []),
  ];
  const unique = new Map<string, DdbSpell>();

  for (const spell of spells) {
    const key = String(spell.definition.id ?? `${spell.definition.level}:${spell.definition.name.toLowerCase()}`);
    const previous = unique.get(key);
    unique.set(key, previous ? {
      ...previous,
      prepared: previous.prepared || spell.prepared,
      alwaysPrepared: previous.alwaysPrepared || spell.alwaysPrepared,
      countsAsKnownSpell: previous.countsAsKnownSpell || spell.countsAsKnownSpell,
    } : spell);
  }

  return [...unique.values()];
}
