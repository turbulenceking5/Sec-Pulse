# Upcoming events

The Brief's **Upcoming events** section and its **See all** sheet list cyber security conferences in Australia, from `data/events.json`.

## Data (`data/events.json`, hand-maintained)
```jsonc
{
  "updated": "2026-10-19",            // when the dates were last checked (shown in the sheet)
  "events": [{
    "id": "bsides-brisbane-2027",      // unique; also the .ics UID
    "name": "BSides Brisbane",
    "start": "2027-07-10", "end": "2027-07-10",   // YYYY-MM-DD; end = start for one-day events
    "city": "Brisbane", "state": "QLD",           // QLD = "Near you"
    "venue": "QUT Gardens Point, Z Block",        // optional
    "url": "https://bsidesbrisbane.com/",         // organiser's site (http/https only)
    "kind": "community" | "industry",
    "tentative": true                             // optional: date only from a listing or social post
  }],
  "meetups": [{"name", "url", "note"}]            // recurring Brisbane meetups, shown at the bottom of the sheet
}
```

## Rules
- **Check every date against the organiser's own site** before adding it; aggregators (10times, infosec-conferences, cybereventsapac, Downunder Cons) are fine for discovering events but sometimes disagree. Mark `tentative` when only a listing or social post gives the date, and update `updated`.
- Keep it to Australian events relevant to a security analyst. Brisbane and Gold Coast events matter most.
- Order doesn't matter (the app sorts by `start`), and past events hide themselves (`end` < today, Brisbane date), so old entries can stay until a tidy-up.
- No employer-specific events (see [opsec.md](opsec.md)).

## App (`index.html`)
- `loadEvents()` fetches the file once; `upcomingEvents()` drops invalid and past entries and sorts.
- `renderEvents()` (from `renderBrief()`) shows the next 3, plus the next Queensland event if it isn't among them. `openEvents()` shows them all grouped by month, then the meetups.
- `eventCard()`: date tile, name linking to the organiser, dates with "in N days", location/venue, Near you / Community / Industry pills, and **+ Calendar**, which downloads an all-day `.ics` (`downloadIcs()`; `DTEND` is the day after the last day).

## Sources used for the 2026-10-19 list
Organiser sites for BSides Sydney, BSides Perth, CrikeyCon, BSides Brisbane, AUSCERT and AISA CyberCon (2026); Downunder Cons (downundercons.nz) for discovery; Gartner's conference page (via search) for the Sydney summit. RooCon (X post only) and CyberCon 2027 (not yet on the organiser's page text) are `tentative`.
