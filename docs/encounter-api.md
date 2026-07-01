# D&D Beyond Encounter Service API

Captured via Chrome DevTools network inspection on **2026-07-01** using the
`"A beastly wake-up call"` encounter (id `11e1c9d4-a0bc-42da-aaf0-5c510ce834c6`)
in the "One-shot" campaign (id `3999469`).

All encounter traffic is served by **`encounter-service.dndbeyond.com`** with a
cobalt Bearer token (same auth as the character service). The envelope is
`{ data, editable, stats }` for reads, and the bare encounter object for writes.

## Base URL

```
https://encounter-service.dndbeyond.com/v1
```

## Endpoints

### 1. List encounters

```
GET /encounters?skip=0&take=10
```

Returns the caller's encounters with full data (monsters, players, groups, etc.).
`editable` is an object keyed by encounter id indicating write permission.
`config.encounterLimit` / `config.currentEncounterCount` reflect subscription caps.

Response shape: `{ editable, config, pagination, stats, metaData, data: Encounter[] }`.

### 2. Get single encounter

```
GET /encounters/{id}
```

Response: `{ data: Encounter, editable, stats }`. The `data` payload is identical
to one element of the list response. Encounter UUIDs are stable identifiers
visible in the URL (`/encounters/{uuid}` and `/combat-tracker/{uuid}`).

### 3. Create encounter

```
POST /encounters
```

Body: full `Encounter` object (without `id`/`dateCreated`/`dateModified`).
Returns `201` with `Location: /v1.0/Encounters/{id}` and the new encounter in
`{ data, editable, stats }`. Client-side `Save` button is disabled until the
builder has at least a name — the POST is only sent on `Save`.

### 4. Update encounter (full save)

```
PUT /encounters/{id}
```

Body: the full `Encounter` object (including the unchanged `id`). Returns `201`
with the canonical state in `{ data, editable, stats }`. Every write — combat
tracker HP changes, encounter builder `Save`, add/remove monsters, name edits —
goes through this same endpoint. Combat tracker writes happen on every action
(no explicit save step); the encounter builder batches changes until `Save`.

### 5. Delete encounter

```
DELETE /encounters/{id}
```

Returns `200` with no body. The page navigates back to `/my-encounters`. UI uses
`window.confirm()` before the call (no in-app modal).

### 6. User config

```
GET /encounters/user-config
```

Response: `{ encounterLimit: number|null, currentEncounterCount: number }`.
Loaded on the encounter builder page; lets the UI enforce the subscription cap.

## Data Model

Top-level fields on the encounter object (mix of read-only metadata and editable
content). Fields observed in the captured responses:

| Field                  | Type                              | Notes                                                 |
|------------------------|-----------------------------------|-------------------------------------------------------|
| `id`                   | string (UUID)                     | Path-stable; not editable                             |
| `userId`               | number                            | Owner; read-only                                       |
| `name`                 | string                            | Editable                                                |
| `description`          | string \| null                    | Free text                                               |
| `flavorText`           | string \| null                    | Free text                                               |
| `coverImage`           | string \| null                    | URL; default supplied by server when missing            |
| `coverImagePosition`   | string                            | CSS background-position, e.g. `"center center"`        |
| `campaign`             | `{ id, name }` \| null            |                                                           |
| `campaignsWithAccess`  | `unknown` \| null                 | Sent in write bodies                                     |
| `source` / `sourceId`  | string \| null                    | Set when encounter is imported from compendium/Maps      |
| `compendiumLink`       | string \| null                    | Link back to source                                     |
| `copiedFromId`         | string \| null                    | Tracks copy chain                                       |
| `map` / `room`         | string \| null                    | Legacy fields                                            |
| `inProgress`           | boolean                           | True once combat has started (`Combat Tracker`)         |
| `roundNum` / `turnNum` | number                            | Combat position, mutated by `Next` / `Undo`             |
| `status`               | number                            | Enum, `1` observed                                       |
| `difficulty`           | number \| null                    | Server-computed for builder summary                      |
| `versionNumber`        | number                            | Increments on every PUT/POST; used for optimistic UI    |
| `dateCreated`          | number (epoch ms)                 | Read-only on writes                                      |
| `dateModified`         | number (epoch ms)                 | Server-set; client does not send                          |
| `rewards`              | `unknown` \| null                 | Never populated in our captures                          |
| `isEditable`           | boolean                           | Sent in write bodies (server decides real permission)   |
| `monsters`             | `MonsterCombatant[]`              | See below                                                 |
| `groups`               | `{ id, order, name }[]`           | Logical grouping of monsters (turn buckets)               |
| `players`              | `PlayerCombatant[]`               | Characters pulled from the campaign                        |
| `manualEntries`        | `ManualEntry[]`                   | Created via the `MANUAL ENTRY` button in combat tracker   |

### Monster combatant

```json
{
  "groupId": "974398e2-0162-48cd-a50a-7ff96897b92a",
  "id": 16889,
  "uniqueId": "119e2e72-93cc-497d-aef2-a7e2fa0d29ef",
  "name": "Giant Owl (A)",
  "order": 2,
  "quantity": 1,
  "notes": null,
  "index": 0,
  "currentHitPoints": 19,
  "temporaryHitPoints": 0,
  "maximumHitPoints": 19,
  "averageHitPoints": 19,
  "initiative": 14
}
```

- `id` is the monster compendium id (matches `monster-service`).
- `uniqueId` is a per-instance UUID generated by the client; never reused.
- `groupId` references a `groups[].id`. Group ordering is separate from monster
  `order` (groups are turn buckets, `order` is initiative tiebreaker within).
- `index` is `null` for ungrouped monsters and `0..quantity-1` for grouped ones.

### Player combatant

```json
{
  "id": "98962156",
  "count": 1,
  "level": 5,
  "type": "CHARACTER_TYPE_DDB",
  "hidden": false,
  "race": "Human",
  "gender": null,
  "name": "Marin Singlebraid",
  "userName": "Hexatan",
  "isReady": true,
  "avatarUrl": null,
  "classByLine": "Fighter / Champion",
  "initiative": 18,
  "currentHitPoints": 0,
  "temporaryHitPoints": 0,
  "maximumHitPoints": 0
}
```

`id` is the D&D Beyond character id (string even when numeric). HP is mirrored
from the character sheet via `character-service-scds.dndbeyond.com/v2/characters`
and is `0` on the encounter payload when the live character is logged out or
private.

## Adjacent Endpoints Used by the Encounter UI

These were captured alongside encounter calls; they live on other services but
are needed to fully render the page.

| Endpoint                                                                                                | Purpose                                              |
|---------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| `GET https://monster-service.dndbeyond.com/v1/Monster?ids={id1}&ids={id2}`                             | Fetch stat blocks for the encounter's monsters        |
| `GET https://monster-service.dndbeyond.com/v1/Monster?skip=0&take=10`                                  | Monster listing on the builder (with search/filters)  |
| `POST https://character-service-scds.dndbeyond.com/v2/characters`                                       | Bulk character sheet lookup (HP, name, class)         |
| `GET https://api.dndbeyond.com/campaigns/v1/details/{campaignId}`                                       | Campaign metadata                                    |
| `GET https://www.dndbeyond.com/api/campaign/stt/active-campaigns/{campaignId}`                          | Players in the campaign (combat roster)              |
| `GET https://www.dndbeyond.com/api/campaign/stt/active-short-characters/{campaignId}`                    | Short character summaries                            |
| `GET https://game-log-rest-live.dndbeyond.com/v1/getmessages?gameId={campaignId}&userId={userId}`       | Game log / dice roll history for the campaign         |
| `GET https://www.dndbeyond.com/api/campaign/active-characters/{campaignId}`                              | Full active-character list (builder "Manage...")     |
| `GET https://www.dndbeyond.com/api/campaign/active-campaigns`                                            | Campaign picker (list page)                           |

All authenticated with the same cobalt Bearer token issued by
`auth-service.dndbeyond.com/v1/cobalt-token`.

## UI Flow → API Mapping

| UI action                                           | Endpoint                                       | Notes                                  |
|-----------------------------------------------------|------------------------------------------------|----------------------------------------|
| `/my-encounters` page load                          | `GET /encounters?skip=0&take=10`              | One call returns the whole list         |
| Click encounter card                                | `GET /encounters/{id}`                        | Builder is read-only when `inProgress` |
| `/encounters/{id}` view                             | `GET /encounters/{id}`                        | Same payload, just different chrome     |
| `/encounters/{id}/edit` page                        | `GET /encounters/{id}` + `GET /encounters/user-config` + `GET /v1/Monster?skip=0&take=10` | Builder needs user config + monster list |
| Add monster / change qty / edit name / etc.         | _local state only_                             | Stays in the SPA until `Save` is clicked |
| `Save` button on builder                            | `PUT /encounters/{id}`                        | Full document replaced                  |
| HP adjust / `Next` / `Undo` in combat tracker      | `PUT /encounters/{id}`                        | One PUT per action                      |
| `MANUAL ENTRY` → save                               | `PUT /encounters/{id}`                        | Adds to `manualEntries` array           |
| `/encounter-builder` (new) → set name → `Save`     | `POST /encounters`                            | Returns new id in `Location` header     |
| `DELETE` button on builder                          | `DELETE /encounters/{id}`                     | Confirmed via `window.confirm`          |
| `RESUME ENCOUNTER` link in builder                  | _navigation only_                              | Goes to `/combat-tracker/{id}`         |

## Notes for Implementation

- **No PATCH, no partial updates.** The only write verb is `PUT`, and the body
  must be the entire encounter. Re-fetch + mutate + send is the only safe
  pattern.
- **Optimistic concurrency**: `versionNumber` increments on every save. The
  server does not appear to reject stale writes, but the client sends the
  value it last saw, so we should preserve it when we round-trip.
- **Cobalt token** (`auth-service.dndbeyond.com/v1/cobalt-token`) must be
  refreshed before each request; the existing MCP code already handles this for
  the character and monster services — the encounter service uses the same
  token, so no new auth flow is needed.
- **No query params on write endpoints** — encounter id is the only path
  segment. `skip`/`take` exist only on the list endpoint.
- **`AboveVTT` caveat**: encounters with `flavorText` starting with
  `"This encounter is maintained by AboveVTT"` are auto-managed by the
  AboveVTT browser extension; they will be deleted and recreated on the next
  DM session. The MCP should treat these as read-only and skip them in the
  list response (or at least warn when surfacing them).
- **Status field** appears to be an enum (only `1` observed). Out of caution
  treat it as opaque and round-trip whatever the server returns.
- **Combat tracker auto-save** means even a single HP tick triggers a full
  PUT. Rate-limit accordingly when wrapping these calls in MCP tools (the
  existing 2 req/s limit + circuit breaker in `src/resilience/` will help).

## Captured Payloads (for reference)

The full request/response bodies for the four key operations live in
`.tmp/encounter-trace/`:

| File                            | Endpoint                                     |
|---------------------------------|----------------------------------------------|
| `list.resp.network-response`    | `GET /encounters?skip=0&take=10`             |
| `get.resp.network-response`     | `GET /encounters/{id}`                       |
| `put.req.network-request`       | `PUT /encounters/{id}` (combat tracker HP)   |
| `put-add.req.network-request`   | `PUT /encounters/{id}` (builder add monster) |
| `create.req.network-request`    | `POST /encounters`                           |
| `user-config.resp.network-response` | `GET /encounters/user-config`            |
| `monster-list.resp.network-response` | `GET /v1/Monster?skip=0&take=10`        |
