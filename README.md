# Semiconductors and Microelectronics Certificate — Builder

An interactive plan-of-study builder for Purdue University's Semiconductors and
Microelectronics Certificate. Students select coursework and log experience; a live
tracker shows how close they are to meeting every certificate requirement.

`index.html` is fully self-contained — open it directly in a browser, no build step
or server required. Bootstrap 5 and Bootstrap Icons load from CDN; all other CSS,
JavaScript, and course data are inline.

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
- **45-skill filter cloud** with live per-skill course counts and match-any / match-all modes
- Free-text search across course number, title, and skill tags
- Collapsed skill chips per course (`+N more`), with filter-matched skills promoted and highlighted
- Credit pickers for variable-credit special-topics and VIP offerings
- Live **area-breadth meter** enforcing the 2-of-5 rule
- Running **Skills You'll Gain** profile accumulated across all selections
- Autosave to `localStorage`; plans survive a page reload
- Print-ready plan-of-study sheet, unlocked once all requirements are met

## Data

Course data lives in `course_data.xlsx` on the **`website`** tab and is compiled into
the `SKILLS`, `AREAS`, `COURSES`, and `VIP` constants inside `index.html`.

Sheet layout:

- Row 1, columns F–AX — the 45 skill names
- Row 2 — column headers (`Certificate`, `Primary Certificate Area`, `Course Number`, `Course`, `Credits`, `Skills`)
- Rows 3+ — one course per row; an `x` in a skill column tags that course with that skill

### Regenerating after a spreadsheet update

The data blob in `index.html` is generated, not hand-edited. To refresh it, re-extract
from the `website` tab and replace the `const SKILLS` / `const AREAS` / `const COURSES` /
`const VIP` block at the top of the `<script>` element.

Notes on the current extraction:

- The 3 VIP rows are routed to the **experience** section rather than the technical bucket.
- 22 courses have blank credits in the spreadsheet (mostly ECE 59500 / IE 49000 / MSE 59700
  special topics). These render a 1–4 credit dropdown defaulting to 3.
- Course numbers are stripped from the front of course titles, since the number is
  displayed separately.
- 5 sets of courses share a normalized title (cross-listings and renumberings). Selecting
  more than one in a set raises a non-blocking "confirm with your advisor" warning.

## Structure

Everything is in `index.html`:

- **Purdue brand tokens** — `--pu-*` custom properties per Purdue's web brand standards
- **Print summary sheet** — `#print-sheet`, hidden until "Generate plan of study"
- **App markup** — the three requirement sections plus the sticky tracker column
- **Data + logic** — the generated data blob, then state, filtering, rendering, and persistence

## Disclaimer

This is a planning tool. Generated output is not an official advising document or
transcript. Students should confirm their plan of study with an academic advisor.
