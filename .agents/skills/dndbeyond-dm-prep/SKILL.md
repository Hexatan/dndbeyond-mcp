---
name: dndbeyond-dm-prep
description: Prepare D&D sessions and build encounters with dndbeyond-mcp campaign, character, monster, item, and spell tools. Use when the user asks for session prep, campaign prep, encounter design, party analysis, monster selection, XP/CR balance, or tactical notes for a D&D game.
---

# D&D Beyond DM Prep

## Overview

Prepare table-ready session material from the actual party when possible. Prefer concrete encounters, tactics, and relevant D&D Beyond references over generic adventure text.

## Workflow

1. Ask for missing basics only when needed: campaign ID or party size, party level, difficulty, environment/theme, session goal, and any constraints.
2. If a campaign ID is available, call `get_campaign_characters` before designing encounters. Use party composition, level spread, classes, durability, spell access, and notable gaps.
3. For encounters, estimate the XP/CR budget from party size, level, and requested difficulty. Say when the budget is approximate.
4. Use `search_monsters` and `get_monster` for candidate creatures. Prefer monsters that match the environment, story role, and party capabilities over exact CR math.
5. Use `search_items`, `get_item`, `search_spells`, and `get_spell` only when loot, hazards, NPC spellcasting, or rules interactions matter.
6. Produce a compact runnable prep packet: setup, roster, encounter(s), tactics, terrain, scaling knobs, loot/clues, and open questions.

## Encounter Output

For each encounter include:

- Purpose: why it exists in the session.
- Lineup: monsters, count, source/name, and rough difficulty.
- Terrain: 2-4 actionable features.
- Tactics: first round, pressure pattern, retreat/surrender behavior.
- Scaling: one easier knob and one harder knob.
- Rewards or clues when relevant.

## Defaults

- Do not fabricate campaign facts. If campaign context is missing, state assumptions.
- Keep prep usable at the table; avoid long lore unless the user asks.
- Do not save, update, or delete encounters unless the user explicitly asks and confirms the target.
