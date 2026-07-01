# D&D Beyond Maps VTT — Research Notes

Captured 2026-07-01 by inspecting `/games/3999469` in a browser session.
The map was created and then deleted in the same session, so the user's
campaign is back to its original empty state.

## TL;DR

**The map VTT is a Next.js Server Components (RSC) application.** There is
no public REST/JSON API. All mutations are **Next.js Server Actions** —
POSTs to the page URL with a SHA-1 hash in the `next-action` header that
identifies the function. Those hashes are **build artefacts** — they change
every time D&D Beyond deploys a new build, so calling them from a long-lived
MCP is fragile at best and impossible at worst.

This rules out a clean MCP integration the same way `homebrew-api.md` did
for the homebrew feature. The only viable pattern is **Playwright-driven UI
automation** (like the `setup/` script does for auth).

## What I Captured

### URL

```
https://www.dndbeyond.com/games/{campaignId}
```

Same URL for the initial page load and for every Server Action. The action
is identified by the `next-action` request header.

### Request shape

```
POST /games/3999469
next-action: 7fde567f3593525f04b136560aec48fdc011912a11
accept: text/x-component
content-type: text/plain;charset=UTF-8
cookie: <full session, including CobaltSession, cobalt-token, RequestVerificationToken, …>
origin: https://www.dndbeyond.com

[<args…>]
```

- **No `Authorization` header** — the cookie session is the auth.
- **No CSRF token in the body** — Next.js uses a different mechanism
  (it relies on the same-site cookie + the `next-action` header signature).
- The body is a JSON-encoded array of arguments. The argument positions
  map to the server function's parameter list.

### Response shape

Server Components "wire format":

```
0:{...action acknowledgement, includes a flight chunk id...}
1:<return value, possibly a RSC payload>
```

The first line (`0:…`) contains `{"a":"$@1","f":"","q":"","i":false,"b":"…"}`
where `b` is the action's flight id. The second line carries the actual
return value, which for our mutations is the new `scenarios` object from
the game state.

### Action IDs observed

| Action                                              | Args                                                                           |
|-----------------------------------------------------|--------------------------------------------------------------------------------|
| `40ba53e6c28b6c7dfd153d249f15da50ab7d5c97c5`         | Page load (no args in body)                                                     |
| `70be8a5bf79ce7e9f33c3fca47aad1a3688b174bbe`         | `[true,"3999469",110164516]` — session/game init                                |
| `7fde567f3593525f04b136560aec48fdc011912a11`         | `["3999469",<mapId>,<sourceObj>,"",<title>,<name>,false,"Web",false]` — add map |
| `60db3fe092df9c8973650be2c9335673668a49d638`         | `["3999469",<scenarioId>]` — delete map                                         |

These IDs are **not stable**. Treat them as scratch.

### Add-map payload (decoded)

Args sent to add the "Mushroom Cave" basic map:

| Index | Value                                                       | Meaning                             |
|-------|-------------------------------------------------------------|-------------------------------------|
| 0     | `"3999469"`                                                 | campaignId                          |
| 1     | `"fa31de26-ae3a-43fa-8efd-529f160805ba"`                     | map definition id                   |
| 2     | `{"sourceId":"1","sourceName":"BR","chapterId":"1"}`        | source attribution                   |
| 3     | `""`                                                        | (unknown, always empty in our run)  |
| 4     | `"Mushroom Cave"`                                           | map title                           |
| 5     | `"Mushroom Cave"`                                           | map display name                    |
| 6     | `false`                                                     | (unknown, always false)             |
| 7     | `"Web"`                                                     | source platform                     |
| 8     | `false`                                                     | (unknown, always false)             |

### Add-map response (decoded)

```json
{
  "PartitionKey": "game_3999469",
  "SortKey": "scenarios",
  "scenarios": [{
    "id": "d5f909c9-4b38-42a2-bdb2-7a0de30b6375",
    "name": "Mushroom Cave",
    "maps": [{
      "id": "fa31de26-ae3a-43fa-8efd-529f160805ba",
      "imageKey": "official/maps/br/01-Mushroom-Cave.jpg",
      "videoKey": null,
      "tokenScale": 0.04791666666666667,
      "imageDimensions": {"x": 2880, "y": 1800},
      "officialData": "$T0:2",
      "name": "Mushroom Cave",
      "description": ""
    }]
  }],
  "activeScenarioId": "d5f909c9-4b38-42a2-bdb2-7a0de30b6375"
}
```

The `PartitionKey`/`SortKey` shape strongly suggests DynamoDB on the
backend (game state is keyed by `game_{campaignId}` + a sort key like
`scenarios` or `tokens`).

### Map metadata (from the Map Browser)

The Map Browser ships a static catalogue of pre-built maps. The basic
essentials we saw:

| Map                          | Map id                            | Source          |
|------------------------------|-----------------------------------|-----------------|
| Mushroom Cave                | `fa31de26-ae3a-43fa-8efd-529f160805ba` | BR, ch 1    |
| Mushroom Cave (Animated)     | (different id)                    | BR, ch 1        |
| Grass Field                  | …                                 | …               |
| Grass Field (Animated)       | …                                 | …               |
| Grass                        | …                                 | …               |
| Grass (Animated)             | …                                 | …               |
| Wood Floor                   | …                                 | …               |
| Wood Floor (Animated)        | …                                 | …               |
| Red Sands                    | …                                 | …               |
| Red Sands (Animated)         | …                                 | …               |
| Snow                         | …                                 | …               |
| Snow (Animated)              | …                                 | …               |
| Water                        | …                                 | …               |
| Water (Animated)             | …                                 | …               |
| Boat                         | …                                 | …               |
| Boat (Animated)              | …                                 | …               |
| Stone Tiling                | …                                 | …               |
| Stone Tiling (Animated)      | …                                 | …               |

The browser has three categories (`Basic Maps`, `Uploaded Maps`,
`Quickplay Maps`) plus three collapsed drawers (`D&D BEYOND DROPS`,
`SOURCEBOOKS`, `ADVENTURES`). Search is server-side. The data behind
this UI doesn't appear to be a separate API call — it's bundled in the
initial RSC payload.

### Auth

Same cookies the rest of the F5 site uses:

- `CobaltSession` (JWE-encrypted cobalt token)
- `cobalt-token` (Bearer-friendly variant, also used as a cookie here)
- `RequestVerificationToken` (antiforgery, set as a cookie even though not
  used in the body — possibly for legacy F5 endpoints on the same domain)
- `User.ID`, `User.Username`, `UserInfo` (account info)
- `ddb_sid`, `ddb_vid` (session ids)
- `_gsid`, `_swb`, `_ga`, `_fbp`, … (tracking)

If the MCP ever drives this from Playwright, the cobalt cookie is the
authoritative auth — no Bearer header is used.

## Recommendation

For the MCP v1 scope:
- **No maps/VTT tools.** Document the absence so the next person doesn't
  re-research this.
- If we ever need a "switch the active map" capability, the only sane
  path is to drive the browser via Playwright in `setup/` (or a sibling
  `npm run maps:switch -- --map=mushroom-cave` script). Direct HTTP is
  not stable.
- A read-only path is technically possible: the Map Browser UI is fully
  hydrated from the initial RSC payload, so a Playwright run that opens
  the page could scrape the catalogue. Still not worth doing for v1.

## Captured Payloads

| File                                  | Notes                                            |
|---------------------------------------|--------------------------------------------------|
| `.tmp/maps-trace/init.req.network-request` | First POST body: `["3999469"]`               |
| `.tmp/maps-trace/2.req.network-request` | Second POST body: `[true,"3999469",110164516]` |
| `.tmp/maps-trace/add-map.req.network-request` | Add-map body: `["3999469","fa31de26-…",{…},"","Mushroom Cave","Mushroom Cave",false,"Web",false]` |
| `.tmp/maps-trace/add-map.resp.network-response` | Full RSC response with the new scenario |
| `.tmp/maps-trace/delete-map.req.network-request` | Delete-map body: `["3999469","d5f909c9-…"]` |
| `.tmp/maps-trace/main.snapshot.txt`    | Accessibility tree of the Map Browser modal       |
| `.tmp/maps-trace/main-view.snapshot.txt` | Main VTT toolbar after adding the map            |
| `.tmp/maps-trace/cleared.snapshot.txt` | Main VTT toolbar after deleting the map (empty)  |

The map was created and then deleted in the same session, so the campaign
is back to its original empty state.
