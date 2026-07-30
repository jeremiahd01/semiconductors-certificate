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
- **Catalog deep link** on every course row, opening that course in the myPurdue catalog
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

Note that area display order and the displayed labels are **not** in the spreadsheet —
they live in `AREA_POLICY`. To reorder or rename an area, edit that list in `admin.html`
and re-run the conversion.

Each area carries both a `label` (the canonical name matched against the spreadsheet)
and a `short` (what the builder displays). They are currently identical, since the
program asked for full names throughout. `short` is kept as its own field so any one
area can be abbreviated later without a schema change or a spreadsheet edit.

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

### Course catalog links — `CATALOG_TERM` needs a bump each year

Every course row deep-links into the myPurdue self-service catalog:

```
https://selfservice.mypurdue.purdue.edu/prod/bwckctlg.p_disp_course_detail
  ?cat_term_in=202620&subj_code_in=ECE&crse_numb_in=30500
```

The URL is derived from the course number at render time — nothing extra is stored in
the spreadsheet or the JSON. `catalogUrl()` in `index.html` takes the subject letters
and digits and discards section suffixes the catalog doesn't recognise
(`ECE 59500IC` → `59500`, `PHYS 570P` → `57000`), then pads three-digit numbers to five
(`ME 597` → `59700`). All 100 current courses produce a valid link.

**`CATALOG_TERM` is a hardcoded Purdue term code** (`YYYYTT`, currently `202620`). It is
deliberately *not* part of the uploaded course data, since it is not something the
spreadsheet knows about — but that means it does not update itself. When the catalog
rolls to a new term, edit the constant near the top of the `<script>` block in
`index.html`. Leaving it stale doesn't break the page; links just resolve against an
older term.

Special-topics numbers (ECE 59500, MSE 59700, PHYS 570P and similar) land on the
catalog's generic special-topics entry rather than the specific offering. That is a
limitation of the catalog, not the link — students need the department page for those.

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

### Spreadsheet rules

**Structure**

- The tab must be named `website`. Case and surrounding spaces are forgiven
  (`Website` works); any other name is an error.
- Row 1 — skill names, from column **F** onward. Must be unique. A column with marks
  but no name in row 1 is ignored.
- Row 2 — headers. **Read positionally, not by name** — the text in row 2 is never
  checked, so renaming a header is harmless but *moving, inserting, or deleting a
  column in A–E breaks everything.*
- Rows 3+ — one course per row. Blank rows are fine and don't shift row numbering.

**Columns A–E are fixed**

| Col | Field | Rules |
|---|---|---|
| A | `Certificate` | Must be `Yes` (any case) to be included. `No` is silently excluded; anything else is excluded **with a warning**. |
| B | `Primary Certificate Area` | Must match one of the five canonical labels. Case and extra spaces forgiven; punctuation is not. Mismatch **blocks publishing**. |
| C | `Course Number` | Required. `VIP` (any case) routes the row to the experience section. |
| D | `Course` | Required. A leading course number is stripped, since it's displayed separately. |
| E | `Credits` | A number 0–12, or blank. Blank means variable-credit — the student picks. Non-numeric text warns and is treated as blank. |
| F+ | Skills | Only `x` or `X` tags a skill. Anything else (`✓`, `1`, `yes`) does **not** tag it and warns. |

The five area labels, which must match exactly:

```
Semiconductor and Microelectronic Devices
Semiconductor Materials, Characterization, and Processing
Integrated Circuit & System Design, Electronic Design Automation
Electronics Packaging, Heterogeneous Integration, and Thermal Management
Semiconductor Manufacturing and Global Supply Chain Management
```

**File**

- Must be `.xlsx`. `.xls` and macro-enabled `.xlsm` are rejected — re-save as
  *Excel Workbook (.xlsx)*.
- Under 12 MB.
- Not password-protected, and not open in Excel at the same time.

Adding a **new skill column** is fine and needs no code change. Adding or renaming a
**certificate area** requires editing `AREA_POLICY` in `admin.html` — the 2-of-5 rule
assumes exactly five.

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
