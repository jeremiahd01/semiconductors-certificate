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
| `semiconductors_course_data_2026_09_24.xlsx` | Source spreadsheet, maintained by the program |

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
- **Typed experience forms** — seven experience kinds, each collecting the details the
  Certificate Coordinator needs on a submitted plan of study
- **Details disclosure** per course — description, prerequisites, and other restrictions
- Live **area-breadth meter** enforcing the 2-of-5 rule
- Running **Skills You'll Gain** profile accumulated across all selections
- Autosave to `localStorage`; plans survive a page reload
- Print-ready plan-of-study sheet, unlocked once all requirements are met

---

# Updating the course data

## For the administrator

Each semester:

1. Edit the course workbook as usual — the **`Updated`** tab holds the course rows and the **`Data`** tab holds the catalog addresses
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
course workbook .xlsx ── edited each semester
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
| Examples | Courses, credits, skill tags, area assignment | Credit targets (16/1/9/6), the 2-of-5 rule, area display order and labels, VIP routing, title-prefix stripping |
| Changes | Every semester | Rarely, by decision |
| Lives in | the course workbook → `course-data.json` | `AREA_POLICY` in `admin.html`; `TARGET_*` and `MIN_AREAS` in `index.html` |

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

### `course-data.json` schema (version 2)

```jsonc
{
  "schemaVersion": 2,
  "generatedAt": "2026-09-26T18:04:11Z",
  "source": "semiconductors_course_data_2026_09_24.xlsx",
  "sheet": "Updated",
  "counts": { "courses": 100, "vip": 3, "skills": 51, "areas": 5 },
  "skills": ["Advanced Materials", "..."],          // index-addressed
  "areas":  [{ "id": "dev", "label": "...", "short": "Devices" }],
  "courses": [{
    "a": 0,             // index into areas — Primary Certificate Category
    "a2": null,         // Secondary Certificate Category, or null. Stored, not yet displayed
    "n": "ECE 30500",   // course number
    "t": "Semiconductor Devices",
    "c": 3,             // credits, or null for variable-credit
    "s": [12, 33],      // indices into skills
    "d": "...",         // course description   ─┐ shown in the row's
    "p": "...",         // prerequisites         ├─ "Details" panel,
    "r": "...",         // other restrictions   ─┘  in this order
    "u": "https://...", // catalog link, or "" — always http(s)
    "x": "digitalinteg",// optional: shared-title group key
    "i": 0              // stable row index
  }],
  "vip": [{ "n": "VIP", "t": "VIP STARS", "s": [4, 5], "d": "", "p": "", "r": "", "u": "" }]
}
```

Version 2 added `a2`, `d`, `p`, `r` and `u`. Bump `schemaVersion` on any breaking shape
change, and update `SCHEMA_VERSION` in both `index.html` and `admin.html`. The builder refuses versions it doesn't recognise and
falls back rather than misreading them.

### Experience section

Section 3 is **not** driven by the workbook. The seven experience kinds, their fields
and their default credits are declared in `EXPERIENCE_TYPES` in `index.html`, because
they describe what the Certificate Coordinator needs on a submitted plan of study
rather than a course catalog.

Entries are stored as `{ id, type, credits, f: {…} }`, where `f` holds the filled-in
field values. `expDetailText()` flattens them onto the printed plan, so a student who
completes every field can download the plan and email it as-is.

Two consequences worth knowing:

- Workbook rows whose Course Number begins `VIP` are ordinary technical-area courses
  and appear in the catalog under their declared category. The published `vip` array is
  retained for schema stability but is always empty, and the builder ignores it. VIP
  rows are numbered just `VIP` with no digits, so they group under a `VIP` subject in
  the filter and are correctly excluded by any level filter.
- Experience entries saved before this shape existed (a free-text name plus credits)
  cannot be mapped onto a typed form. They are dropped on load and the save note says
  how many need re-entering, rather than restoring a plan that quietly lost part of
  itself.

### Course catalog links

Each course carries its own catalog address in the published JSON (`u`), taken from the
workbook. Nothing is derived from the course number and there is no term code to
maintain in the code — when the catalog rolls to a new term, the spreadsheet's links
change and the next publish picks them up.

**The address is not in the cell you would expect.** Column K on the `Updated` tab is

```
=IF(IFNA(VLOOKUP(C3,Data!A:H,7,FALSE),"")=0,"",
    IFNA(HYPERLINK(VLOOKUP(C3,Data!A:H,7,FALSE),"Catalog Link"),""))
```

so the cell's cached value — which is all a reader of the file can see — is the literal
words `Catalog Link`. The converter therefore redoes that lookup itself: it matches the
**ID#** in column C against the key column of the `Data` tab and reads the address from
there. If the `Data` tab is missing, the converter warns and publishes without links
rather than failing.

Only `http://` and `https://` addresses are ever emitted. The address comes from a
workbook and lands in an `href`, so `javascript:` and `data:` values are an injection
vector; both the converter and the builder reject anything else, and the builder's
renderer refuses a bad link a second time even if one somehow reached the JSON.

Courses with no address simply show no Catalog link. ENGR 10301 is not in the workbook —
it is defined in `index.html`, and so is its link.

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

- Course rows are read from the tab named `Updated`; catalog addresses come from the
  tab named `Data`. Case and surrounding spaces are forgiven. A missing `Updated` tab
  is an error; a missing `Data` tab only costs the catalog links.
- Row 1 — skill names, from column **N** onward (through BL). Must be unique. A column
  with marks but no name in row 1 is ignored, with a warning.
- Row 2 — headers. **Read positionally, not by name** — the text in row 2 is never
  checked, so renaming a header is harmless but *moving, inserting, or deleting a
  column in A–M breaks everything.*
- Rows 3+ — one course per row. Blank rows are fine and don't shift row numbering.

**Columns A–M are fixed**

| Col | Field | Published? | Rules |
|---|---|---|---|
| A | `Certificate?` | — | Must be `Yes` (any case) to be included. `No` is silently excluded; anything else is excluded **with a warning**. |
| B | `Course Number` | yes | Required. `VIP` rows are ordinary technical-area courses; they carry no digits, so they have a subject but no level. |
| C | `ID#` | no | Admin key. Also the key used to look the catalog address up on the `Data` tab. |
| D | `Course` | yes | Required. A leading course number is stripped, since it's displayed separately. |
| E | `Credits` | yes | A number 0–12, or blank. Blank means variable-credit — the student picks. Non-numeric text (e.g. `2 or 3`) warns and is treated as blank. |
| F | `Primary Certificate Category` | yes | Must match one of the five canonical labels. Case and extra spaces forgiven; punctuation is not. Mismatch **blocks publishing**. |
| G | `Secondary Certificate Category` | yes | Optional. Stored for later use, not displayed yet. An unrecognised value **warns** and is stored as empty rather than guessed. |
| H | `Pre-Requisites` | yes | Free text. Shown second in the Details panel. |
| I | `Other Restrictions / Notes` | yes | Free text. Shown third in the Details panel. |
| J | `Course Description` | yes | Free text. Shown **first** in the Details panel. |
| K | `Catalog Link` | yes | A HYPERLINK formula — the address is resolved from the `Data` tab, not this cell. See *Course catalog links*. |
| L | `Additional Information` | no | Admin only. |
| M | `Topics` | no | Admin only. |
| N–BL | Skills | yes | Only `x` or `X` tags a skill. Anything else (`✓`, `1`, `yes`) does **not** tag it and warns. |

The five category labels, which must match exactly:

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
- Under 20 MB.
- Not password-protected, and not open in Excel at the same time.

Adding a **new skill column** is fine and needs no code change. Adding or renaming a
**certificate category** requires editing `AREA_POLICY` in `admin.html` — the 2-of-5
rule assumes exactly five.

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
