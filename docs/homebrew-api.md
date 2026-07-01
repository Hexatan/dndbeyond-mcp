# D&D Beyond Homebrew API — Research Notes

Captured 2026-07-01 by inspecting `/my-creations`, `/my-collection`, the create
flow at `/homebrew/creations/create-{type}/create`, and the public view page.

## TL;DR

**There is no clean JSON CRUD API for homebrew content.** Unlike the
encounter service, the homebrew feature is built on a legacy ASP.NET MVC
(F5/Views) template stack. The list and edit pages are server-rendered HTML,
and mutations happen via full-page form POSTs with `application/x-www-form-urlencoded`
bodies, not JSON.

The only programmatic surface that *does* exist is:

| Surface                              | Use                                              |
|--------------------------------------|--------------------------------------------------|
| `POST /api/vcm/{typeId}-{id}`        | View-counter ping (returns `{"Successful":true}`) |
| `GET /homebrew/creations/view?…`     | Server-rendered redirect to public compendium    |
| `POST /homebrew/creations/{type}/create` | Form-encoded create (requires CSRF + cookies) |
| `POST /homebrew/creations/{type}/edit/{id}` | Form-encoded edit (presumed; not yet captured) |

Anything we want to do (list, read details, create, edit, delete) will need
either:
1. **HTML scraping** of the server-rendered pages, or
2. **Browser-driven form submission** via Playwright (reusing `setup/`).

Both are heavy compared to the encounter API and don't fit the existing MCP
shape. Recommendation: **skip homebrew management in v1** unless the user has
a specific need.

## What I Captured

### URLs

```
/my-creations                                — list of user's drafts
/my-collection                               — list of user's homebrew they've added
/homebrew/creations/create-monster           — landing: pick template or scratch
/homebrew/creations/create-monster/create    — actual create form
/homebrew/creations/create-background        — same pattern for backgrounds
/homebrew/creations/create-feat              — "                      feats
/homebrew/creations/create-magic-item        — "                      magic items
/homebrew/creations/create-species           — "                      species
/homebrew/creations/create-spell             — "                      spells
/homebrew/creations/create-subclass          — "                      subclasses
/homebrew/creations/view?entityTypeId=…&id=… — redirects to public compendium
```

### Entity Type IDs (from the type filter dropdown)

| `entityTypeId` | Type         | Public compendium path |
|----------------|--------------|------------------------|
| `1669830167`   | Background   | `/backgrounds/{id}-…`  |
| `1088085227`   | Feat         | `/feats/{id}-…`        |
| `112130694`    | Magic Item   | `/magic-items/{id}-…`  |
| `779871897`    | Monster      | `/monsters/{id}-…`     |
| `1743923279`   | Species      | `/species/{id}-…`      |
| `1118725998`   | Spell        | `/spells/{id}-…`       |
| `789467139`    | Subclass     | `/subclasses/{id}-…`   |

These are stable — the same IDs were observed in the user's existing
creations and in the type-filter select.

### Auth on the create form

`POST /homebrew/creations/create-monster/create` requires:

- **Cookies** (full session, including `CobaltSession`, `RequestVerificationToken`).
- A **`RequestVerificationToken`** value in the body, matching the
  `RequestVerificationToken` cookie. This is the same antiforgery token
  used across the F5 site; the F5 backend reads it from the form body.
- **Form-encoded** body (`content-type: application/x-www-form-urlencoded`).
  The body has ~78 fields for a monster (name, version, type, subtype, size,
  alignment, CR, AC, HP, abilities, actions, traits, etc.).

This is the same antiforgery mechanism used by every F5 page on the site
(see also `POST /refresh-request-verification-token` which the front-end calls
to rotate the token). Reusable for the MCP only if we already have the
session cookies.

### List page

`/my-creations` and `/my-collection` are fully server-rendered. No JSON
endpoint backs them. Filter UI is a plain `<form method="get" action="/my-creations">`
with selects for status/type/moderation-status. Submitting reloads the page
with query params — there's no SPA-style fetch.

The filter selects observed:
- `filter-status` (1=Private, 2=Published, 3=Deleted) — multi-select
- `filter-moderation-status` (1=New, 2=In Moderation, 4=Approved, 3=Rejected) — multi-select
- `filter-type` — single select with the seven entity type IDs above
- `filter-name` — text input

### Create form structure (monster)

`#monster-form` is the form id. It has ~78 inputs; the required ones observed
on the create page include:

| Field name             | Type        | Notes                              |
|------------------------|-------------|------------------------------------|
| `name`                 | text        | Required                           |
| `version`              | text        | "1, 1.5, A, B, etc." (free text)   |
| `monster-type`         | select      | Integer ID, `1`=Aberration, `2`=Beast, … |
| `monster-sub-type`     | select2     | Multi, integer IDs (from a tag list) |
| `size`                 | select      | `2`=Tiny, `3`=Small, `4`=Medium, …  |
| `swarm-monster`        | select      | Integer ID, optional base form     |
| `alignment`            | select      | `11`=Any, `13`=Any Evil, etc.       |
| `challenge-rating`     | select      | `1`, `2`, `3`, …                    |
| `lair-challenge-rating`| select      | Same scale, optional                |
| `hit-points-die-value` | select      | `4`, `6`, `8`, `10`, `12`, `20`      |
| `monster-saving-throw` | select2     | Multi                               |
| `damage-adjustment`    | select2     | Multi                               |
| `condition-immunity`   | select2     | Multi                               |
| `monster-environments` | select2     | Multi                               |
| `monster-tags-public`  | select2     | Multi                               |
| `treasure`             | select2     | Multi                               |

TinyMCE editors (id `mce_*`) handle free-text fields (description, actions,
etc.). Their content gets serialised into hidden inputs on submit.

### View counter endpoint

```
POST https://www.dndbeyond.com/api/vcm/{entityTypeId}-{entityId}
Content-Type: application/x-www-form-urlencoded
Body: request-verification-token=<CSRF_TOKEN>
```

Returns `{"Successful":true}`. The body is a 19-byte stub — this is **not** a
data endpoint, just analytics. Do not use it for reading homebrew data.

## Reading Homebrew Data: Practical Alternatives

Since there's no JSON API, the most reliable ways to fetch the user's
homebrew content are:

1. **Use the public compendium endpoints** (already in the codebase).
   `monster-service.dndbeyond.com/v1/Monster/{id}` returns the full stat block
   for any monster, including homebrew ones (when `showHomebrew=t`). Same
   likely true for `spells`, `items`, `backgrounds`, etc. — we just don't
   know the exact paths for the non-monster compendia yet. This is the
   cleanest read path because the data is the same shape the rest of the
   MCP already uses.

2. **Scrape `/my-creations` and `/my-collection`.** The HTML has the
   entity type, id, name, status, date modified, view count, add count, and
   version for every row. We'd need a small HTML parser and the cobalt
   session cookies. A read-only tool could be built around this if we ever
   need to surface the user's *draft* status (which the public compendium
   won't show).

3. **For the actual homebrew *content* (full stat block, traits, etc.) of a
   draft, scrape the edit page** at `/homebrew/creations/{type}/edit/{id}`.
   We didn't navigate there, but the structure should mirror the create
   form, so we'd have to parse the same 78-ish fields.

## Writing Homebrew: Practical Alternatives

Same story. No JSON. The only path is:

1. Open the edit page in a browser, fill the form, click Save (which is a
   full-page form POST). This is what `setup/` does for auth — we'd
   extend Playwright to drive the homebrew form.

2. Replicate the form POST from the MCP via `fetch()` with the session
   cookies. This requires us to:
   - GET the edit page, scrape the `RequestVerificationToken` from the
     antiforgery hidden field.
   - Encode all 78 fields as `application/x-www-form-urlencoded`.
   - POST to `/homebrew/creations/{type}/edit/{id}` (or `/create` for
     new entities).
   - Parse the 302 redirect to know the new id (for create) or the success
     state (for update).

   This is doable but fragile — the field names and TinyMCE encoding have
   to be kept in sync with the F5 site, and any field the user has
   touched client-side (e.g. via WYSIWYG) needs the right markup type
   (1=BBCode, 2=HTML, etc.) on the hidden field.

## Recommendation

For the MCP v1 scope:
- **No new homebrew tools.** Document the absence so the next person doesn't
  re-research this.
- If we ever need homebrew reads, the right move is probably to extend
  `setup/` to scrape the collections and dump a JSON cache the MCP can
  serve. This keeps the MCP server stateless and pure HTTP/JSON.
- If we ever need homebrew writes, gate them behind a confirmation prompt
  and drive the form via Playwright in `setup/` (or via a dedicated
  `npm run homebrew:create` script). Direct `fetch()` from the MCP is
  possible but tightly coupled to the F5 form schema.

## Captured Payloads

| File                                    | Notes                                            |
|-----------------------------------------|--------------------------------------------------|
| `.tmp/homebrew-trace/get.req.network-request` | Body of `POST /api/vcm/779871897-3500625` (form-encoded CSRF token) |
| `.tmp/homebrew-trace/get.resp.network-response` | `{"Successful":true}` — 19 bytes |
| `.tmp/homebrew-trace/create-monster.snapshot.txt` | Accessibility tree of the create form, showing all controls |
