# 🏎️ F1 Race Visualizer

Relive every Formula 1 Grand Prix with interactive race visualization. Watch drivers compete on real track layouts with lap-by-lap timing data.

![F1 Race Visualizer](https://img.shields.io/badge/F1-Race_Visualizer-e10600?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0zIDRsNS40NDcgMi43MjRBMSAxIDAgMDE5IDcuNjE4djEwLjc2NGExIDEgMCAwMS0xLjQ0Ny44OTRMMyAxN00zIDR2MTNNMyA0aDhtLTggMTNoOG0wLTEzbDUuNDQ3LTIuNzI0QTEgMSAwIDAxMTYgNS4zODJ2MTAuMjM2YTEgMSAwIDAxLS41NTMuODk0TDExIDE5TTExIDRoOG0wIDEzbTEtMTNsMS40NDctLjcyNEExIDEgMCAwMTIxIDQuNjE4djEwLjc2NGExIDEgMCAwMS0uNTUzLjg5NEwxOSAxNyIvPjwvc3ZnPg==)

## Features

- **Interactive Race Playback** — Watch races play out in real-time or at custom speeds (0.5x to 100x)
- **Real Track Maps** — SVG circuit outlines from actual GPS data for 35+ F1 tracks
- **Live Leaderboard** — Real-time position tracking with gaps and lap counts
- **Historical Data** — Access every F1 race from 1950 to 2025
- **Team Colors** — Each driver dot uses their team's actual livery color
- **Random Race** — Discover classic races with one click
- **Play/Pause/Seek** — Full playback controls including scrubbing and skip

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Data Sources**:
  - [Ergast API (Jolpi fork)](https://api.jolpi.ca/ergast/) — Race results, lap times, driver info
  - [f1-circuits](https://github.com/SergioSediq/f1-circuits) — Track GeoJSON outlines (MIT)
  - [F1 API](https://f1api.dev) — Supplementary circuit & team data

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)
- npm, yarn, or bun

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/f1-race-visualizer.git
cd f1-race-visualizer

# Install dependencies
npm install
# or: bun install

# Run the dev server
npm run dev
# or: bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## How It Works

1. **Select a race** — Choose a year and Grand Prix, or hit Random
2. **Race loads** — The app fetches results + per-driver lap times from the Ergast API, and the circuit GeoJSON from f1-circuits
3. **Playback** — The engine interpolates driver positions along the track based on cumulative lap times. Each driver's dot moves smoothly around the SVG track outline
4. **Leaderboard** — Positions and gaps are calculated in real-time based on track progress

### Architecture

```
src/
├── app/
│   ├── api/f1/           # API route proxies (avoids CORS)
│   │   ├── seasons/      # Available F1 seasons
│   │   ├── races/        # Races for a given year
│   │   ├── race-data/    # Full race data (results + laps + circuit)
│   │   └── circuit/      # Circuit GeoJSON
│   ├── page.tsx          # Main page
│   └── layout.tsx        # Root layout
├── components/f1/
│   ├── race-visualizer.tsx  # Main orchestrator
│   ├── track-canvas.tsx     # SVG track + driver dots
│   ├── leaderboard.tsx      # Position sidebar
│   ├── race-controls.tsx    # Play/pause/speed/seek
│   └── race-selector.tsx    # Year/race dropdowns
└── lib/
    ├── types.ts           # TypeScript type definitions
    ├── circuit-map.ts     # Ergast↔f1-circuits ID mapping + team colors
    ├── track-utils.ts     # GeoJSON→SVG projection + track position math
    ├── race-engine.ts     # Playback engine logic
    └── f1-api.ts          # Direct API client (client-side fallback)
```

## Data Sources

| Source | Data | License |
|--------|------|---------|
| [Ergast API](https://ergast.com/mrd/) | Race results, lap times, standings | CC-BY 3.0 |
| [f1-circuits](https://github.com/SergioSediq/f1-circuits) | Track GeoJSON outlines | MIT |
| [F1 API](https://f1api.dev) | Circuit info, teams, drivers | Free/Open |

## License

MIT
