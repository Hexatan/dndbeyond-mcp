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
6. After mutations, call `get_character` and report what is complete and what choices remain unresolved.

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

## Defaults

Use these defaults unless the user says otherwise:

- Ask before enabling homebrew, legacy content, optional features, or automatic choice resolution.
- Use standard array only when the user does not care about ability generation.
- Do not delete a character unless the user explicitly asks and confirms the exact character ID or name.
- If the MCP tools are unavailable in the current Codex session, say that the D&D Beyond MCP server needs to be configured/enabled before live character changes can be made.
