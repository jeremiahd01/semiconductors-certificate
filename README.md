# Semiconductors and Microelectronics Certificate — Builder

An interactive plan-of-study builder for Purdue University's Semiconductors and
Microelectronics Certificate. Students select coursework and log experience; a live
tracker shows how close they are to meeting every certificate requirement.

## Files

| File | Role |
|---|---|
| `index.html` | The student-facing builder |
| `admin.html` | Converts the semester spreadsheet into `course-data.json` |
| `course-data.json` | The published course catalog the builder reads |
| `course_data.xlsx` | Source spreadsheet, maintained by the program |

All four are static files. There is no build step and no server-side code — they can be
uploaded to a Zope folder as File objects and served directly.

## Certificate requirements

| # | Requirement | Credits |
|---|---|---|
| 1 | **Required course** — ENGR 10301 Introduction to Semiconductors | 1 |
| 2 | **Technical area courses** — drawn from at least 2 of the 5 certificate areas | 9 |
| 3 | **Semiconductor experience** — research, independent study, VIP, or full-time internship | 6 |
| | **Total** | **16** |

A summer or semester-long full-time internship / co-op / SURF or similar experience
is considered equivalent to the full 6 credit hours.

## Features

- **100 technical courses** grouped into 5 collapsible certificate areas
- **Skill filter cloud** with live per-skill course counts and match-any / match-all modes;
  skills with no remaining matches drop out of the cloud
- Free-text search across course number, title, and skill tags
- Collapsed skill chips per course (`+N more`), with filter-matched skills promoted and highlighted
- Credit pickers for variable-credit special-topics courses, defaulting to unset so hours
  are never silently assumed
- Live **area-breadth meter** enforcing the 2-of-5 rule
- Running **Skills You'll Gain** profile accumulated across all selections
- Autosave to `localStorage`; plans survive a page reload
- Print-ready plan-of-study sheet, unlocked once all requirements are met

---

# Updating the course data

## For the administrator

Each semester:

1. Edit `course_data.xlsx` as usual — the **`website`** tab is the one that matters
2. Open **`admin.html`** in a browser and drop the spreadsheet onto it
3. Read the report. Warnings are informational; **errors block publishing** until fixed
4. Click **Download course-data.json**
5. In the ZMI, open the folder containing `index.html`
6. **Rename** the existing `course-data.json` to e.g. `course-data-2026-fall.json` —
   this is the rollback, don't skip it
7. Upload the new `course-data.json` into that same folder
8. Load the builder and confirm the footer shows today's date

Nothing is uploaded anywhere during steps 2–4. The spreadsheet is parsed inside the
browser; the server never sees it.

If a bad file does get published, the builder falls back to a snapshot bundled inside
`index.html` and keeps working — so a mistake degrades the page rather than breaking it.
To roll back, rename the archived file back to `course-data.json`.

## Architecture

```
course_data.xlsx ── edited each semester
       │
       ▼
  admin.html ── parses, normalises, validates, diffs (all client-side)
       │
       ▼  course-data.json
  ZMI upload
       │
       ▼
  index.html ── fetch + validate ──┬── ok ──▶ live catalog
                                   └── any failure ──▶ embedded snapshot + banner
```

Nothing parses spreadsheets server-side. `.xlsx` is a zip archive of XML, and putting
that parser behind a file upload on a server invites zip-bomb and entity-expansion
attacks. Doing it in the administrator's browser keeps the whole format off the server.

### Catalog data vs. program policy

These are deliberately kept apart:

| | Catalog data | Program policy |
|---|---|---|
| Examples | Courses, credits, skill tags, area assignment | Credit targets (16/1/9/6), the 2-of-5 rule, area display order, short area names, VIP routing, title-prefix stripping |
| Changes | Every semester | Rarely, by decision |
| Lives in | `course_data.xlsx` → `course-data.json` | `AREA_POLICY` in `admin.html`; `TARGET_*` and `MIN_AREAS` in `index.html` |

The consequence is that a semester upload can only change *which courses exist*. It
cannot change what the certificate requires. Credit targets are never read from the
JSON, so no uploaded file can alter them.

Note that area display order and the short labels ("Devices", "Packaging & Thermal")
are **not** in the spreadsheet — they live in `AREA_POLICY`. To reorder or rename an
area, edit that list in `admin.html` and re-run the conversion.

### `course-data.json` schema (version 1)

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-29T16:35:35Z",
  "source": "course_data.xlsx",
  "sheet": "website",
  "counts": { "courses": 100, "vip": 3, "skills": 45, "areas": 5 },
  "skills": ["Advanced Materials", "..."],          // index-addressed
  "areas":  [{ "id": "dev", "label": "...", "short": "Devices" }],
  "courses": [{
    "a": 0,             // index into areas
    "n": "ECE 30500",   // course number
    "t": "Semiconductor Devices",
    "c": 3,             // credits, or null for variable-credit
    "s": [12, 33],      // indices into skills
    "i": 0,             // stable row index
    "x": "digitalinteg" // optional: shared-title group key
  }],
  "vip": [{ "n": "VIP", "t": "VIP STARS", "s": [4, 5] }]
}
```

Bump `schemaVersion` on any breaking shape change, and update `SCHEMA_VERSION` in both
`index.html` and `admin.html`. The builder refuses versions it doesn't recognise and
falls back rather than misreading them.

### Validation

`admin.html` blocks the download on:

- A missing `website` tab, or an empty/unreadable sheet
- A `Primary Certificate Area` that doesn't exactly match one of the five canonical
  labels — a typo would otherwise silently create a sixth area
- Duplicate skill column names

It warns but allows: missing credit values, unreadable credit values, shared course
titles, skipped rows, and areas with no courses. **New skill columns are accepted
automatically**; new or renamed *areas* are treated as errors.

`index.html` independently re-validates everything it fetches, because the JSON is
untrusted input. The renderer escapes every string it prints, but numeric fields are
interpolated raw — so `validateCatalog()` type-checks area indices, skill references,
and credit values, and rejects the file outright if any are wrong.

### Fallback

`index.html` carries `FALLBACK_CATALOG`, a snapshot of the catalog as of the last time
the app itself was updated. It is used when the fetch fails for any reason: offline,
404, malformed JSON, an HTML error page from Zope, a schema mismatch, or failed
validation. A banner explains what happened and the builder stays fully usable.

The snapshot is refreshed by hand when the app is updated — it intentionally does not
track every semester publish, since its job is to be a known-good floor, not current.

### Zope notes

- **Content type** doesn't matter. The builder parses `res.text()` rather than
  `res.json()`, so a `text/plain` or octet-stream response still works.
- **Caching** is handled client-side, since headers can't be set reliably from the ZMI:
  `cache: 'no-store'` for the browser cache plus a date-stamped `?v=` parameter for any
  proxy in front.
- **Uploading over** an existing File object preserves its id and URL.
- `admin.html` loads the currently-published `course-data.json` from the same folder to
  produce its diff. If it's absent the tool still works — it just can't show what changed.

### Spreadsheet layout

- Row 1, columns F onward — skill names
- Row 2 — headers (`Certificate`, `Primary Certificate Area`, `Course Number`, `Course`, `Credits`, `Skills`)
- Rows 3+ — one course per row; an `x` in a skill column tags that course

Rows are ignored unless `Certificate` is `Yes`. Rows whose `Course Number` is `VIP` are
routed to the experience section instead of the technical catalog. Course numbers are
stripped from the front of titles, since the number is displayed separately.

## Local development

```bash
python3 -m http.server 8777
```

Then open `http://localhost:8777/index.html`. A plain `file://` open also works, but the
catalog fetch will fail and the builder will run on the embedded snapshot — which is a
useful way to exercise the fallback path deliberately.

## Disclaimer

This is a planning tool. Generated output is not an official advising document or
transcript. Students should confirm their plan of study with an academic advisor.
