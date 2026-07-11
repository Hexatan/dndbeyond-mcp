# dndbeyond-mcp

A TypeScript MCP (Model Context Protocol) server for D&D Beyond. Gives Claude and other MCP-compatible AI assistants access to your characters, campaigns, encounters, spells, monsters, items, and character builder.

> **This is a fork** of [AlexWorland/dndbeyond-mcp](https://github.com/AlexWorland/dndbeyond-mcp). It adds character creation, encounter management, PDF character sheets, downloadable compendium snapshots, edition-aware reference lookups, and live session checks. The current package version is **`0.5.2`**.

> **Disclaimer:** This project uses unofficial, reverse-engineered D&D Beyond endpoints. It is not affiliated with, endorsed by, or supported by D&D Beyond or Wizards of the Coast. Endpoints may change without notice.

## Features

- **Character Sheets** — Read complete character data, look up definitions, and generate reMarkable-friendly PDFs
- **Character Gameplay** — Update HP, inspiration, conditions, rests, limited-use features, currency, and supported spell resources
- **Guided Character Creation** — Conversational character-creator prompt plus tools for class, species, background, ability scores, equipment, preferences, sources, appearance, and builder choices
- **Campaign Access** — List active or broader user campaigns, view party rosters
- **Encounter Management** — List, inspect, update, and safely delete saved D&D Beyond encounters
- **Reference Lookups** — Search and retrieve spells, monsters, magic items, feats, conditions, classes, races, backgrounds, class features, racial traits, and source books — **edition-aware** (2014/2024) for spells, conditions, and monsters
- **Compendium Snapshots** — Download resumable, structured JSON snapshots of D&D Beyond reference data
- **Workflow Prompts** — Character creation and summaries, session prep, encounter building, level-up guidance, spell recommendations, and rules lookup
- **Browser-Based Auth** — Playwright-powered login flow (no manual cookie extraction)

## Installation

This fork is **not published to npm**, so `npx dndbeyond-mcp` will not work. Build it from source:

```bash
git clone https://github.com/Hexatan/dndbeyond-mcp.git
cd dndbeyond-mcp
npm ci
npm run build
```

The built server entrypoint is `build/src/index.js`.

## Setup

Before using the server, authenticate with D&D Beyond:

```bash
npm run setup
```

This opens a browser window where you log into D&D Beyond normally. The server captures your session cookie automatically and saves it to `~/.dndbeyond-mcp/config.json`.

## Download a Compendium Snapshot

After authenticating, you can export the reference content available to your account as compact JSON:

```bash
npm run compendium:download
```

The command writes a manifest plus separate files for spells, monsters, items, classes, feats, races, backgrounds, and game configuration to `~/.dndbeyond-mcp/compendium`. Interrupted downloads resume from checkpoints, and a completed snapshot replaces the previous one atomically.

Use `--output` for a different directory or `--fresh` to discard a saved checkpoint:

```bash
npm run compendium:download -- --output ./compendium
npm run compendium:download -- --fresh
```

## Tools

### Character
- `get_character` — Character by ID or name; `detail` can be `summary`, `sheet` (default), or `full`
- `list_characters` — All owned characters, including characters outside campaigns
- `generate_character_sheet_pdf` — Generate a data-driven, paginated PDF with light, color, or inverted themes
- `get_definition` — Look up a character's spell, feat, class feature, racial trait, background feature, or equipped item by name

### Character Gameplay
- `update_hp` — Apply damage/healing and optionally set temporary HP
- `set_inspiration` — Grant or remove inspiration
- `add_condition` / `remove_condition` — Apply or remove standard condition IDs
- `use_ability` — Increment or set uses for a limited-use action, with fuzzy name matching
- `long_rest` / `short_rest` — Trigger D&D Beyond rest endpoints and refresh local cache
- `update_spell_slots` — Best-effort legacy spell slot update
- `update_death_saves` — Best-effort legacy death save update
- `update_currency` — Set/add/spend coins; GP uses the current gold endpoint, other coin types use legacy endpoints
- `update_pact_magic` — Best-effort legacy pact magic update
- `cast_spell` — Local cantrip tracking; best-effort slot or pact magic decrement for leveled spells

### Character Builder
- `create_character` / `delete_character` — Create or delete a character; creation can immediately apply preferences, source categories, and appearance
- `add_class` / `set_class_level` — Add a class or change class level
- `set_species` — Set race/species by entity IDs
- `set_background` / `set_background_choice` — Set background and background choices
- `list_class_feature_choices` / `set_class_feature_choice` — Discover and resolve every active class choice by name or ID, including skills, expertise, spells, feats, and subclasses
- `set_race_trait_choice` / `set_feat_choice` — Resolve species and feat choices
- `list_subclasses` / `set_subclass` — Discover and select subclasses by name
- `list_class_spells` / `add_character_spell` / `remove_character_spell` — Manage known or prepared class spells
- `resolve_choices` — Auto-resolve unresolved builder choices using first available options
- `set_ability_score_type` / `set_ability_score` — Set ability score method and values
- `set_character_preferences` — Configure advancement, HP, privacy, homebrew, optional features, prerequisite rules, and display preferences
- `set_character_source_categories` — Enable D&D Beyond source categories independently of the homebrew preference
- `set_starting_equipment_type` / `add_inventory_items` / `set_gold` — Configure starting equipment, add items, set gold
- `set_character_appearance` — Update age, height, weight, eyes, skin, hair, or gender
- `update_character_name` / `update_description` — Update name and supported description fields and notes

### Campaign
- `list_campaigns` — Active campaigns by default; `includeAll` uses D&D Beyond's broader `user-campaigns` endpoint
- `get_campaign_characters` — Party roster for a campaign; `includeAll` can resolve through `user-campaigns`

### Encounter
- `list_encounters` — Saved D&D Beyond encounters with pagination, IDs, party/monster counts, campaign, and combat state
- `get_encounter_config` — Encounter count and D&D Beyond account limit
- `get_encounter` — Encounter detail by ID or name, including players, monsters, groups, HP, initiative, and combat round/turn state
- `update_encounter` — Update safe metadata fields (name, description, flavor text) via D&D Beyond's full-save endpoint
- `delete_encounter` — Delete an encounter after confirming its exact name

### Reference
- `search_spells` / `get_spell` — Spell lookup with filters; `get_spell` accepts optional `edition` (`2014`/`2024`)
- `search_monsters` / `get_monster` — Monster stat blocks; supports `edition`, `page`, `showHomebrew`, and source book filtering
- `search_items` / `get_item` — Magic item catalog; search supports `source` and `page`
- `list_sources` — Source book IDs/names from D&D Beyond config
- `search_feats` — Feat discovery by name
- `get_condition` — Condition rules; accepts an optional `edition` (`2014`/`2024`, default `2014`)
- `search_classes` — Class/subclass info
- `search_races` — Race/species lookup
- `search_backgrounds` — Background lookup
- `search_class_features` — Class feature lookup by name, class, or level
- `search_racial_traits` — Racial trait lookup by name or race

### Utility
- `setup_auth` — Re-run login flow
- `check_auth` — Verify the session is live (performs a real cobalt-token liveness probe against D&D Beyond, not just a config-file existence check)

### Write Status

D&D Beyond's unofficial write endpoints are inconsistent. HP, inspiration, conditions, rests, limited-use actions, gold, and builder operations use currently discovered endpoints. Spell slots, death saves, non-GP currency, pact magic, and leveled spell casting still depend on legacy endpoints that may return 404; those tools return a clear unavailable message when that happens.

## Resources

| URI                                    | Description         |
|----------------------------------------|---------------------|
| `dndbeyond://characters`               | Your character list |
| `dndbeyond://character/{id}`           | Character sheet     |
| `dndbeyond://character/{id}/spells`    | Spell list          |
| `dndbeyond://character/{id}/inventory` | Inventory           |
| `dndbeyond://campaigns`                | Your campaigns      |
| `dndbeyond://campaign/{id}/party`      | Party roster        |

## Prompts

| Prompt              | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| `character-summary` | Full character rundown                                         |
| `character-creator` | Conversational, confirmation-first character creation workflow |
| `session-prep`      | DM session preparation                                         |
| `encounter-builder` | Balanced encounter design                                      |
| `spell-advisor`     | Spell recommendations                                          |
| `level-up-guide`    | Level-up walkthrough                                           |
| `rules-lookup`      | Rules clarification                                            |

## Version History

- **`v0.5.2`** — Adds checkbox trackers for Sorcery, Ki, Focus, and other limited-use resources; selected Metamagic descriptions; and two-line spell descriptions on generated character sheets.
- **`v0.5.1`** — Corrects HP and spell-slot calculations, includes complete known and granted spell lists, and redesigns generated character sheets with paginated boxed sections, full spell and inventory tables, and handwriting space. Generated character PDFs and previews are no longer tracked.
- **`v0.5.0`** — Adds the guided `character-creator` workflow; character preferences, source categories, and appearance controls; resumable compendium snapshots; encounter management; PDF character sheets; bearer authentication support; and expanded character/tool output.
- **`v0.4.0`** — `check_auth` is now a **real session-liveness probe**: it performs a cobalt-token exchange against D&D Beyond rather than only checking whether a config file exists, so callers can detect an expired-but-present cookie.
- **`v0.3.0`** — Edition-aware **monster search + lookup**: `search_monsters` / `get_monster` resolve the requested edition via D&D Beyond's `isLegacy` flag — preferring the selected edition, collapsing cross-edition duplicate names, and keeping/tagging other-edition-only results. Mirrors the existing `get_spell` edition handling.
- **`v0.2.0`** — Edition-aware **conditions**: a 2024 (SRD 5.2) condition set plus an `edition` parameter on `get_condition` (default `2014`).

## Security

This server stores your D&D Beyond session cookie locally at `~/.dndbeyond-mcp/config.json`. The cookie provides full access to your D&D Beyond account. Never share this file. The server only communicates with `dndbeyond.com` domains.

## License

MIT
