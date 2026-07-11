---
name: dndbeyond-character-creator
description: Guide conversational D&D Beyond character creation through the dndbeyond-mcp tools. Use when the user asks to create, finish, build, draft, or configure a D&D Beyond character, especially when choices should be collected by asking questions before writing to D&D Beyond.
---

# D&D Beyond Character Creator

## Overview

Create useful D&D Beyond characters, not blank shells. Collect choices first, confirm the build, then use the MCP write tools in one focused pass.

## Workflow

1. If the user provides an existing character ID, continue that character. Call `get_character` first and do not create a new one.
2. Ask only 1-2 short questions at a time. Collect at least: name, level, class, species/race, background, ability score method, and whether to use 2014 or 2024 rules/content.
3. Use reference tools before write tools: `search_classes`, `search_races`, and `search_backgrounds`. Do not invent IDs.
4. Summarize the planned build and ask for explicit approval before any write tool that creates, deletes, or mutates a D&D Beyond character.
5. Prefer to avoid a visible blank stopping point. If creating from scratch, either:
   - use `create_character` with `method: "quick"` when class and species IDs are known and quick build fits, or
   - use `create_character` with `method: "standard"` and immediately apply the selected name, class, species, background, ability score method, and core preferences.
6. Resolve active builder choices with the choice workflow below.
7. After mutations, call `get_character` and report what is complete and what choices remain unresolved.

## Edition Sources

Set the exact Core + Expanded pair for the chosen edition:

- 2014 rules: `sourceCategories: [26, 1]` (`5e Core Rules`, `5e Expanded Rules`).
- 2024 rules: `sourceCategories: [24, 38]` (`5.5e Core Rules`, `5.5e Expanded Rules`).

Do not enable the other edition's pair. Keep Homebrew separate through
`set_character_preferences.useHomebrewContent`; leave it disabled unless the
user asks. Enable Legacy/Noncore (`23`), partnered, subscriber, or playtest
content only when requested.

## Class Feature Choices

After adding or leveling a class, setting a subclass, or resolving a choice
that may unlock more choices:

1. Call `list_class_feature_choices`. Pass `className` for multiclass characters.
2. Present unresolved choices with their feature names and labeled options.
3. Respect feature eligibility and prerequisites. For example, expertise must
   use an existing proficiency, and repeated skill or spell picks must be distinct.
4. Set the choice using `set_class_feature_choice` with `choiceKey` and
   `optionName`. Do not construct raw class, feature, mapping, type, or option IDs
   when a labeled option is available.
5. Refetch and repeat until no unresolved active class choices remain.

This workflow covers proficiencies, expertise, ability-score choices, fighting
styles, invocations, class-feature spells, feats, and subclasses across classes.
Future-level choices appear only after `set_class_level`; level first, then
refetch instead of guessing future choice IDs.

Use `add_character_spell` and `remove_character_spell` for ordinary learned or
spellbook spells. Use `set_character_spells_prepared` for prepared spells. Use
`set_class_feature_choice` for spells granted through a specific feature such
as Magical Secrets. If a choice has no labeled options, stop and inspect the
live data rather than inventing IDs.

## Ordinary Class Spells

Ordinary learned, prepared, or spellbook spells are not builder choices and
are not populated by `resolve_choices`. For a spellcasting class:

1. Call `list_class_spells` after setting the final class level and subclass.
2. Select the class-appropriate number of cantrips and leveled spells.
3. Use `add_character_spells` for learned spells and spellbook entries, or `set_character_spells_prepared` for prepared casters.
   `add_character_spell` for an individual selection.
4. Refetch the sheet and verify that ordinary class spells are present. Do not
   count racial spells, subclass grants, domain/oath spells, or Mystic Arcanum
   as proof that the normal class spell selection is complete.

### Spell Quota Verification

Raw spell-array totals are not sufficient. Open the sheet's Manage Spells / Add
Spells picker and verify its displayed cantrip and learned/prepared counters.
Treat an over-cap numerator (for example `28/22`) as an invalid build.

- Count normal 2014 Bard Magical Secrets against Spells Known; College of Lore's
  Additional Magical Secrets do not count. Each Magical Secrets choice must be
  distinct.
- Do not count domain, oath, subclass, species, feat, or other always-prepared
  grants toward the character's ordinary preparation quota.
- For Wizards, verify both spellbook size and currently prepared spells. The
  2014 preparation limit depends on Wizard level plus Intelligence modifier;
  do not infer it from the spellbook size.
- Some 2024 classes label learned selections as Prepared Spells. Use the live
  picker label and limit rather than applying 2014 terminology.
- After batch writes, allow D&D Beyond to settle, refetch, and compare the
  displayed numerator with its limit before reporting the caster ready.

## Ready-to-Play Verification

Do not treat a creation response or `resolve_choices` message as completion.
Refetch the character and verify all of the following from live state:

- exactly the intended class or classes and levels;
- selected species, background, source categories, and all six ability scores;
- actual inventory and currency, not merely a starting-equipment configuration;
- ordinary class spell selections for every spellcasting class;
- legal displayed spell-selection counters with no over-cap values, plus full
  preparation where the build calls for it;
- no unresolved choices across `class`, `race`, `feat`, and `background`.

Changing a subclass can add new class, feat, or race choices. Set the subclass,
then repeat both the class-feature workflow and the general choice check before
reporting the character as ready to play.

## Tool Sequence

Use the smallest sequence that completes the agreed build:

- Identity: `update_character_name`
- Class and level: `add_class`, then `set_class_level` only when changing an existing class mapping
- Species/race: `set_species`
- Background: `set_background`
- Ability method: `set_ability_score_type`; then `set_ability_score` for STR/DEX/CON/INT/WIS/CHA
- Preferences and sources: `set_character_preferences`, `set_character_source_categories`
- Description: `set_character_appearance`, `update_description`
- Equipment: `set_starting_equipment_type`, `add_inventory_items`, `set_gold`
- Open builder choices: specific choice tools when the user chooses; `resolve_choices` only after explaining it picks the first available option for each unresolved choice
- Class feature choices: `list_class_feature_choices`, then `set_class_feature_choice` with `choiceKey` + `optionName`
- Ordinary spells: `list_class_spells`, then `add_character_spells` for learned/spellbook casters or `set_character_spells_prepared` for prepared casters

## Defaults

Use these defaults unless the user says otherwise:

- Ask before enabling homebrew, legacy content, optional features, or automatic choice resolution.
- When an edition is chosen, enable its Core + Expanded pair and disable the other edition.
- Use standard array only when the user does not care about ability generation.
- Do not delete a character unless the user explicitly asks and confirms the exact character ID or name.
- If the MCP tools are unavailable in the current Codex session, say that the D&D Beyond MCP server needs to be configured/enabled before live character changes can be made.
