# DDB-Backed Feature Ideas

Date: 2026-07-01

This MCP should prefer features backed by D&D Beyond data or endpoints. Local-only state, such as a standalone combat tracker, is out of scope unless it only mirrors live DDB data.

## Candidates

1. Campaign-aware compendium
   Add `campaignId` to spell, item, feat, class, race, and background lookups so results include DM-shared campaign content.

2. Party combat snapshot
   Fetch live character sheets for a campaign and summarize HP, temp HP, AC, conditions, saves, spell slots, pact slots, limited-use resources, exhaustion, and death saves.

3. Encounter builder from DDB monsters
   Generate encounter options from DDB monster-service data, source filters, edition, homebrew, and live campaign party level. Do not store local encounter state.

4. DDB encounter endpoint research
   Use browser request capture against D&D Beyond encounter pages. If working list/detail/create/update endpoints are found, add MCP tools for them. If only static pages or 404s are found, do not build a local substitute.

   Initial result: read endpoints are viable. Authenticated traffic confirmed `GET https://encounter-service.dndbeyond.com/v1/Encounters`, `GET /v1/encounters/{encounterId}`, and `GET /v1/encounters/user-config`. Write endpoints still need a separate disposable-encounter test.

5. Better monster discovery
   Expose filters already present in DDB monster data: environment, CR range, source, edition, legendary, lair, mythic, movement type, damage immunity/resistance, and condition immunity.

6. Owned vs restricted content diagnostics
   Show whether monster, item, spell, and rules content is fully accessible, campaign-shared, or restricted.

7. Rich detail tools
   Add `get_class`, `get_subclass`, `get_race`, `get_background`, `get_feat`, `get_class_feature`, and `get_racial_trait` for full DDB-backed details.

8. Character builder gap helper
   Read a character and list unresolved DDB builder choices, then use existing write tools to resolve supported choices.

9. Inventory and equipment helpers
   Summarize equipped items, attunement slots, armor/weapon bonuses, magic item details, and carried weight from DDB character data.

10. Session prep from real campaign data
    Return campaign roster, character snapshots, and relevant DDB monsters/items/spells as a data-backed tool instead of relying only on a prompt.

## First Pass Priority

Start with campaign-aware compendium, party combat snapshot, and encounter endpoint research. They are closest to DDB data that is already known or testable.
