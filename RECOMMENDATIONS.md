# F1 Race Visualizer — Feature Recommendations

This document lists recommended feature improvements for the F1 Race Visualizer project.
Future agents should read this to understand what features are planned, their priority,
and implementation notes.

**Last updated:** 2026-04-18

---

## Project Architecture Overview

```
src/
├── app/
│   ├── page.tsx                         ← Root page, renders <RaceVisualizer />
│   └── api/f1/
│       ├── seasons/route.ts             ← GET /api/f1/seasons
│       ├── races/route.ts               ← GET /api/f1/races?year=  (has hasTrack/hasResults flags)
│       ├── race-data/route.ts           ← GET /api/f1/race-data?year=&round=
│       ├── driver-laps/route.ts         ← GET /api/f1/driver-laps?year=&round=&driverId=
│       ├── circuit/route.ts             ← GET /api/f1/circuit?circuitId=
│       └── pit-stops/route.ts           ← GET /api/f1/pit-stops?year=&round=
├── components/f1/
│   ├── race-visualizer.tsx              ← Main orchestrator (computeStates, animation, data loading)
│   ├── track-canvas.tsx                 ← SVG track rendering (isOffTrack filter, lerp smoothing)
│   ├── leaderboard.tsx                  ← Standings sidebar (isDNS/isDNF checks)
│   ├── lap-times.tsx                    ← Lap times sidebar tab
│   ├── race-controls.tsx                ← Play/pause/seek/speed controls (SPEED_OPTIONS)
│   └── race-selector.tsx                ← Year/race dropdowns (hasTrack/hasResults flags)
└── lib/
    ├── types.ts                         ← All TypeScript interfaces (DriverLapData, RaceEvent, etc.)
    ├── circuit-map.ts                   ← Ergast↔f1-circuits mapping + team colors
    ├── track-utils.ts                   ← GeoJSON→SVG projection + getPositionOnTrack
    ├── race-engine.ts                   ← Legacy (unused)
    └── f1-api.ts                        ← Legacy (unused)
```

### Key Data Flow
1. **Server-side (fast)**: `/api/f1/race-data` fetches results + circuit GeoJSON (2 external calls)
2. **Client-side (parallel)**: Each driver's laps fetched individually via `/api/f1/driver-laps`
3. **computeStates(raceTime)**: Single source of truth for driver positions, statuses (DNS/DNF/Finished/active)
4. **Animation loop**: `requestAnimationFrame` + throttled React state updates (~30fps)

### Key Design Decisions
- `DriverLapData.isDNS` is the authoritative DNS flag — set once during skeleton creation
- `computeStates` sets `status` to exactly "DNS", "DNF", "Finished", or raw Ergast status
- Downstream components (`isOffTrack`, `isDNS`, `isDNF`) just check the status string
- DNS takes priority over DNF in `computeStates`
- Races without track/results are disabled in the race selector

---

## Feature Recommendations

### 1. Qualifying Grid Overlay ⭐⭐⭐

**Priority:** High
**Status:** Not implemented

Show cars lined up in their actual grid positions on the track before the race starts.
Currently all cars appear at position 0 (start/finish line) and spread out naturally.

**Implementation Notes:**
- In `track-canvas.tsx`, when `driver.trackProgress < 0.01` and `driver.gridPosition > 0`,
  offset the car backward on the track by a small amount per grid row
- Use `effectiveProgress = ((1 - gridRow * 0.002) % 1 + 1) % 1` to place cars just
  behind the start/finish line (progress close to 1.0 wraps to just before 0.0)
- Grid layout is 2-wide: row = `Math.ceil(gridPosition / 2)`
- Fade the offset smoothly: `gridFade = Math.max(0, 1 - driver.trackProgress * 20)`
- Lateral offset (left/right side of grid) handled by existing overlap grouping
- **Files to modify:** `track-canvas.tsx`

**Data needed:** Already available (`driver.gridPosition`)

---

### 2. Tire Compound Indicators ⭐⭐⭐

**Priority:** High
**Status:** Not implemented

Show a small colored dot/strip on each car indicating tire compound:
- Soft (red), Medium (yellow), Hard (white), Intermediate (green), Wet (blue)
Add a tire column to the leaderboard.

**Implementation Notes:**
- The Ergast API does NOT provide per-lap tire data
- **OpenF1 API** has stint data: `https://api.openf1.org/v1/stints?session_key=<key>`
  Returns: `{ driver_number, compound, lap_start, lap_end }` per stint
- Need to add OpenF1 as a new data source (currently only Ergast + f1-circuits)
- Add `tireCompound` and `currentStint` fields to `DriverLapData`
- In `computeStates`, determine current compound based on current lap vs stint ranges
- In `track-canvas.tsx`, add a small colored rectangle near the car/dot
- In `leaderboard.tsx`, add a tire compound column with colored dot
- **Files to modify:** `types.ts`, `race-visualizer.tsx`, `track-canvas.tsx`, `leaderboard.tsx`
- **New API route:** `src/app/api/f1/stints/route.ts`

**Data needed:** OpenF1 stint API (only available for 2018+ races)

---

### 3. Pit Stop Visualizations ⭐⭐⭐

**Priority:** High
**Status:** API route created (`/api/f1/pit-stops`), not yet integrated into UI

When a driver pits, show a "PIT" label and draw a pit lane line parallel to the main straight.
This is the single most requested feature in race visualizers.

**Implementation Notes:**
- API route exists: `GET /api/f1/pit-stops?year=&round=` returns `{ pitStops: [...] }`
- Ergast pit stop data: `{ driverId, lap, stop (number), time (wall clock), duration }`
- **Phase 1 (easy):** Add `pitStopLaps: number[]` to `DriverLapData`. During data loading,
  fetch pit stops and associate with each driver. In `computeStates`, set `isPitting` flag
  when `driver.lap` is in `pitStopLaps`. Show "PIT" label on the car.
- **Phase 2 (moderate):** Draw a pit lane line on the track SVG (parallel to main straight,
  offset by ~30px). When `isPitting`, move the car to the pit lane path instead of the
  main track path. After the pit stop lap, move it back.
- **Phase 3 (advanced):** Add pit stop duration to the car's total race time so it
  realistically stops for the duration of the pit stop.
- **Files to modify:** `types.ts`, `race-visualizer.tsx`, `track-canvas.tsx`, `race-controls.tsx`

**Data needed:** Ergast pit stops API (already available via `/api/f1/pit-stops`)

---

### 4. Minimap / Track Position Key ⭐⭐

**Priority:** Medium
**Status:** Not implemented

Add a small labelled track map showing corner numbers and DRS zones.
Users who don't know the circuit have no spatial reference.

**Implementation Notes:**
- The f1-circuits GeoJSON doesn't include corner data
- **Option A:** Add a static JSON file per circuit with corner positions (manual curation)
- **Option B:** Fetch corner data from OpenF1 or F1 official data
- **Option C:** Add DRS detection zones from timing data (sectors with big speed changes)
- Render corner numbers at specific track positions in the SVG
- Add a small legend showing sector boundaries
- **Files to modify:** `track-canvas.tsx`, possibly new `src/lib/circuit-corners.ts`

**Data needed:** Corner positions per circuit (not available in current data sources)

---

### 5. Battle Highlights ⭐⭐⭐

**Priority:** High
**Status:** ✅ Implemented

When two drivers are within ~1 second of each other, draw a subtle connecting line
between them on the track. Shows who's fighting for position at a glance.

**Implementation:**
- In `track-canvas.tsx`, find pairs of active drivers within proximity (trackProgress diff < 0.033)
- Render dashed amber lines between battling pairs
- Show "N Battles" indicator in the top-left of the track view

---

### 6. Driver Comparison Mode ⭐⭐

**Priority:** Medium
**Status:** Not implemented

Let the user click two drivers to overlay their lap time deltas on a mini chart.
"How did Hamilton compare to Verstappen?" is the #1 fan question.

**Implementation Notes:**
- Add a "Compare" tab to the sidebar (alongside Standings and Lap Times)
- Show two dropdown selectors for choosing drivers
- Render a simple delta chart: lap-by-lap time difference
- Could use a lightweight chart library (recharts, already common in Next.js)
- Delta = `driverA.laps[lap] - driverB.laps[lap]` per lap
- Positive = driver A slower, negative = driver A faster
- Color-code the bars by which driver was faster
- **Files to create:** `src/components/f1/driver-comparison.tsx`
- **Files to modify:** `race-visualizer.tsx` (add tab), `types.ts` (if needed)

**Data needed:** Already available (per-driver lap times)

---

### 7. Sector Times ⭐⭐

**Priority:** Medium
**Status:** Not implemented

Show S1/S2/S3 times in the lap times panel, color-coded purple/green/yellow like F1 TV.

**Implementation Notes:**
- Ergast API does NOT provide sector times per lap
- **OpenF1 API** has sector data: `https://api.openf1.org/v1/laps?session_key=<key>&driver_number=<num>`
  Returns per-lap data including `duration_sector_1`, `duration_sector_2`, `duration_sector_3`
- Need to add OpenF1 as a data source
- Color coding: purple = overall fastest, green = personal best, yellow = other
- Add sector columns to the Lap Times tab
- Could also show sector performance on the track (highlight which sector each driver is in)
- **Files to modify:** `types.ts`, `lap-times.tsx`, `race-visualizer.tsx`

**Data needed:** OpenF1 sector data (only for 2018+ races)

---

### 8. Race Events Timeline ⭐⭐⭐

**Priority:** High
**Status:** ✅ Partially implemented (retirement + fastest lap markers)

A horizontal timeline below the seek bar showing icons for key events:
- 🔴 Retirements
- 🏎️ Fastest Lap
- 🛞 Pit Stops (when integrated)
- 🟡 Safety Car (future)
- 🏴 Red Flag (future)

Users can click an event to jump to that moment.

**Implementation:**
- Events are computed in `race-visualizer.tsx` from driver data
- `RaceEvent` type in `types.ts` with `type`, `time`, `driverCode`, `description`
- Event markers rendered on the seek bar in `race-controls.tsx`
- Clicking a marker calls `onSeek(event.time)`
- Future: add Safety Car / Red Flag detection from timing gaps

---

### 9. Weather & Track Conditions ⭐

**Priority:** Low
**Status:** Not implemented

Show ambient temperature, track temperature, and weather icon in the race info header.

**Implementation Notes:**
- OpenF1 API has weather data: `https://api.openf1.org/v1/weather?session_key=<key>`
- Returns: `{ date, session_key, air_temperature, humidity, pressure, rainfall, track_temperature, wind_direction, wind_speed }`
- Could show a small weather widget next to the race name
- Even just showing "Wet Race" changes how you interpret lap times
- **Files to modify:** `race-visualizer.tsx` (fetch + display)
- **New API route:** `src/app/api/f1/weather/route.ts`

**Data needed:** OpenF1 weather API (only for 2018+ races)

---

### 10. Smooth Camera / Auto-Zoom ⭐

**Priority:** Low
**Status:** Not implemented

Auto-zoom the track view during the start or close battles, then zoom out during
stable running. Mimics F1 TV's director cut.

**Implementation Notes:**
- In `track-canvas.tsx`, dynamically adjust the SVG `viewBox` based on driver positions
- During the start: zoom to the first few corners where the pack is bunched
- During battles: zoom to the battling drivers' region
- During stable running: show the full track
- Use smooth viewBox transitions (CSS transition on SVG transform)
- Calculate the bounding box of active drivers + padding
- **Files to modify:** `track-canvas.tsx`

**Data needed:** Already available (driver positions)

---

### 11. Constructor Standings Points ⭐

**Priority:** Low
**Status:** Not implemented

Add a toggle to show the Constructors' Championship points progression across the season.

**Implementation Notes:**
- Ergast API has constructor standings: `/${year}/constructorStandings.json`
- After each race, fetch the standings up to that round
- Render as a cumulative line chart (one line per constructor)
- Could add a "Season" tab to the sidebar
- Would need to fetch standings for all completed rounds in the season
- **Files to create:** `src/components/f1/season-standings.tsx`
- **Files to modify:** `race-visualizer.tsx` (add tab)

**Data needed:** Ergast constructor standings API

---

### 12. Keyboard Shortcuts ⭐⭐⭐

**Priority:** High
**Status:** ✅ Implemented

Quick controls for power users:
- **Space** — Play/Pause
- **Left Arrow** — Seek back 5 seconds
- **Right Arrow** — Seek forward 5 seconds
- **+** — Increase speed
- **-** — Decrease speed
- **R** — Reset to start

**Implementation:**
- `useEffect` in `race-visualizer.tsx` with `keydown` listener
- Ignores shortcuts when focus is in input/textarea elements
- Speed changes cycle through `SPEED_OPTIONS` array

---

## Implemented Features Checklist

- [x] DNS detector (authoritative `isDNS` flag on `DriverLapData`)
- [x] DNF detector (lap data exhaustion + Ergast status)
- [x] F1 car shapes with heading angles (car/dot toggle)
- [x] Checkered start/finish line with S/F label
- [x] Lap times sidebar tab (current/previous/fastest)
- [x] Race filtering (unavailable races disabled in selector)
- [x] Battle highlights (connecting lines between close drivers)
- [x] Race events timeline (retirement + fastest lap markers on seek bar)
- [x] Keyboard shortcuts (Space, Arrows, +/-, R)
- [x] Pit stop API route (infrastructure only)

## Not Yet Implemented

- [ ] Qualifying grid overlay
- [ ] Tire compound indicators (needs OpenF1 data source)
- [ ] Pit stop visualizations on track (API route exists)
- [ ] Minimap / corner numbers (needs corner data source)
- [ ] Driver comparison mode
- [ ] Sector times (needs OpenF1 data source)
- [ ] Weather & track conditions (needs OpenF1 data source)
- [ ] Smooth camera / auto-zoom
- [ ] Constructor standings (needs season-long data)

---

## API Endpoints Reference

| Endpoint | Method | Parameters | External API | Notes |
|----------|--------|-----------|-------------|-------|
| `/api/f1/seasons` | GET | — | Ergast | Returns all seasons |
| `/api/f1/races` | GET | `year` | Ergast | Returns races with `hasTrack`/`hasResults` flags |
| `/api/f1/race-data` | GET | `year`, `round` | Ergast + f1-circuits | Results + circuit GeoJSON |
| `/api/f1/driver-laps` | GET | `year`, `round`, `driverId` | Ergast | Per-driver lap times |
| `/api/f1/pit-stops` | GET | `year`, `round` | Ergast | All pit stops for a race |
| `/api/f1/circuit` | GET | `circuitId` | f1-circuits | Standalone circuit GeoJSON |

## External Data Sources

| Source | URL | Data Available | Notes |
|--------|-----|---------------|-------|
| Ergast API | `https://api.jolpi.ca/ergast/f1/` | Results, laps, pit stops, standings | Primary data source |
| f1-circuits | `https://github.com/SergioSediq/f1-circuits` | Circuit GeoJSON | Track outlines only |
| OpenF1 | `https://api.openf1.org/v1/` | Stints, sectors, weather, car data | Only 2018+ races |
