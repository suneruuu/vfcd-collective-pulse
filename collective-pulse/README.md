# Collective Pulse

A full-screen p5.js installation that asks:

> Does Vietnam need an annual Design Festival?

The piece records seven days of responses on one kiosk. Votes are grouped into one-second buckets: when both choices occur, YES and NO receive equal-width bars regardless of press order or vote count, while bar height represents each choice's count. Every vote remains part of the all-time overview.

## Before the event

Open `sketch.js` and edit the configuration near the top:

```js
CAMPAIGN_START_DATE: "2026-08-26"
```

The campaign begins at midnight in Vietnam (`UTC+07:00`) and freezes after seven complete calendar days. This preview build sets yesterday as day one and has `SEED_DEMO_DATA: true`, which adds deterministic sample votes across yesterday. Set it to `false` before collecting production responses.

Other editable values in the same section include the YES/NO colors, the initial tie color, prompt interval, ripple duration, and timeline spacing.

Add or reorder open questions in the `PROMPTS` array. The installation shows one every five minutes, keeps the newest four on screen, and loops to the beginning when it reaches the end.

## Controls

| Input | Response |
|---|---|
| Left Arrow | YES — move up |
| Right Arrow | NO — move down |
| Mouse/trackpad wheel over graph | Browse the current day |
| Drag graph | Browse the current day |
| Double-click graph | Return to the live edge |
| `FIT ALL` button or F key | Fit the current day's elapsed timeline into the graph |
| `LIVE` button or L key | Return to the scrolling live view |
| `−` / `+` buttons or keyboard keys | Zoom out or in |
| Ctrl/Cmd + mouse wheel | Zoom around the pointer position |

Held-key repeat is ignored, so each physical Makey Makey press records one response.

## Data

Votes and prompt state are stored in this browser's `localStorage` under a date-specific key beginning with `collective_pulse_v2`. On the next reload, older Collective Pulse storage namespaces are removed and the new preview dataset is saved. Use the same browser profile for the full event and do not clear site data during the campaign.

Changing `CAMPAIGN_START_DATE` intentionally starts a fresh campaign view. Previously stored data is left untouched under the same browser key but will not be loaded when its configured date differs.

## Run locally

Serve this folder from a local web server. For example, from inside `collective-pulse`:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000` and enter full-screen mode. The first page load needs internet access for the p5.js library and Iosevka Charon font files.

## Logic check

With Node.js installed, run this from the project folder:

```powershell
node tests/logic-check.js
```

It checks seven-day boundaries, local persistence, majority colors, the four-row prompt queue, and equal-width YES/NO aggregation within a single second.
