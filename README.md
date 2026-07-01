# dndbeyond-mcp

A TypeScript MCP (Model Context Protocol) server for D&D Beyond. Gives Claude (and other MCP-compatible AI assistants) access to your D&D Beyond characters, campaigns, spells, monsters, items, and more.

> **This is a fork** of [AlexWorland/dndbeyond-mcp](https://github.com/AlexWorland/dndbeyond-mcp). It adds **edition-aware reference lookups** (2014 vs 2024, resolved via D&D Beyond's `isLegacy` flag) for spells, conditions, and monsters, and makes **`check_auth` a real session-liveness probe**. It is the MCP backend for [dndtools](https://github.com/dmjohnston89/dndtools) and is **built from source** (not published to npm — see Installation). Released via annotated tags (current: **`v0.4.0`**); see [Fork changes](#fork-changes).

> **Disclaimer:** This project uses unofficial, reverse-engineered D&D Beyond endpoints. It is not affiliated with, endorsed by, or supported by D&D Beyond or Wizards of the Coast. Endpoints may change without notice.

## Features

- **Character Management** — Read character sheets, look up definitions, update HP, inspiration, conditions, limited-use features, and some builder fields
- **Character Builder Helpers** — Create/delete characters, set class/species/background, resolve choices, set ability scores, starting equipment, inventory, gold, and description fields
- **Campaign Access** — List active or broader user campaigns, view party rosters
- **Reference Lookups** — Search and retrieve spells, monsters, magic items, feats, conditions, classes, races, backgrounds, class features, racial traits, and source books — **edition-aware** (2014/2024) for spells, conditions, and monsters
- **Workflow Prompts** — Session prep, encounter building, level-up guidance, spell recommendations
- **Browser-Based Auth** — Playwright-powered login flow (no manual cookie extraction)

## Installation

This fork is **not published to npm**, so `npx dndbeyond-mcp` will not work. Build it from source and check out the pinned release tag:

```bash
git clone https://github.com/dmjohnston89/dndbeyond-mcp
cd dndbeyond-mcp
git checkout v0.4.0
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

## Claude Desktop Configuration

Add this to your Claude Desktop configuration file, pointing at the built entrypoint (absolute path):

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dndbeyond": {
      "command": "node",
      "args": ["/abs/path/to/dndbeyond-mcp/build/src/index.js"]
    }
  }
}
```

After adding the configuration, restart Claude Desktop.

## Tools

### Character
- `get_character` — Character by ID or name; `detail` can be `summary`, `sheet` (default), or `full`
- `list_characters` — All owned characters, including characters outside campaigns
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
- `create_character` / `delete_character` — Create or delete a D&D Beyond character
- `add_class` / `set_class_level` — Add a class or change class level
- `set_species` — Set race/species by entity IDs
- `set_background` / `set_background_choice` — Set background and background choices
- `set_class_feature_choice` / `set_race_trait_choice` / `set_feat_choice` — Resolve builder choices
- `resolve_choices` — Auto-resolve unresolved builder choices using first available options
- `set_ability_score_type` / `set_ability_score` — Set ability score method and values
- `set_starting_equipment_type` / `add_inventory_items` / `set_gold` — Configure starting equipment, add items, set gold
- `update_character_name` / `update_description` — Update name and supported description fields

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

| URI | Description |
|-----|-------------|
| `dndbeyond://characters` | Your character list |
| `dndbeyond://character/{id}` | Character sheet |
| `dndbeyond://character/{id}/spells` | Spell list |
| `dndbeyond://character/{id}/inventory` | Inventory |
| `dndbeyond://campaigns` | Your campaigns |
| `dndbeyond://campaign/{id}/party` | Party roster |

## Prompts

| Prompt | Purpose |
|--------|---------|
| `character-summary` | Full character rundown |
| `session-prep` | DM session preparation |
| `encounter-builder` | Balanced encounter design |
| `spell-advisor` | Spell recommendations |
| `level-up-guide` | Level-up walkthrough |
| `rules-lookup` | Rules clarification |

## Fork changes

Released as annotated tags (dndtools pins one by tag):

- **Unreleased** — Expanded README/tool inventory; exposed `includeAll` campaign lookups; fixed monster `page`; improved spellcasting ability and speed display; routed GP updates through the newer gold endpoint while marking remaining legacy writes as best-effort.
- **`v0.2.0`** — Edition-aware **conditions**: a 2024 (SRD 5.2) condition set plus an `edition` parameter on `get_condition` (default `2014`).
- **`v0.3.0`** — Edition-aware **monster search + lookup**: `search_monsters` / `get_monster` resolve the requested edition via D&D Beyond's `isLegacy` flag — preferring the selected edition, collapsing cross-edition duplicate names, and keeping/tagging other-edition-only results. Mirrors the existing `get_spell` edition handling.
- **`v0.4.0`** — `check_auth` is now a **real session-liveness probe**: it performs a cobalt-token exchange against D&D Beyond rather than only checking whether a config file exists, so callers can detect an expired-but-present cookie.

## Security

This server stores your D&D Beyond session cookie locally at `~/.dndbeyond-mcp/config.json`. The cookie provides full access to your D&D Beyond account. Never share this file. The server only communicates with `dndbeyond.com` domains.

## License

MIT
