// ============================================================
// Circuit ID Mapping: Ergast API ↔ f1-circuits GitHub
// ============================================================

/**
 * Maps Ergast API circuitId → f1-circuits GeoJSON file ID.
 * f1-circuits naming: {country_code}-{first_gp_year}
 */
export const ERGAST_TO_F1CIRCUITS: Record<string, string> = {
  albert_park: "au-1953",
  americas: "us-2012",
  bahrain: "bh-2002",
  baku: "az-2016",
  catalunya: "es-1991",
  hungaroring: "hu-1986",
  imola: "it-1953",
  interlagos: "br-1940",
  jeddah: "sa-2021",
  losail: "qa-2004",
  marina_bay: "sg-2008",
  miami: "us-2022",
  monaco: "mc-1929",
  monza: "it-1922",
  red_bull_ring: "at-1969",
  rodriguez: "mx-1962",
  shanghai: "cn-2004",
  silverstone: "gb-1948",
  spa: "be-1925",
  suzuka: "jp-1962",
  vegas: "us-2023",
  villeneuve: "ca-1978",
  yas_marina: "ae-2009",
  zandvoort: "nl-1948",
  // Historical / occasional circuits
  hockenheim: "de-1932",
  nurburgring: "de-1927",
  istanbul: "tr-2005",
  mugello: "it-1914",
  portimao: "pt-2008",
  paul_ricard: "fr-1969",
  magny_cours: "fr-1960",
  sochi: "ru-2014",
  sepang: "my-1999",
  kyalami: "za-1961",
  estoril: "pt-1972",
  indianapolis: "us-1909",
  watkins_glen: "us-1956",
  jerez: "es-1986",
  adelaide: "au-1985",
  ayrton_senna: "br-1977",
  buenos_aires: "ar-1952",
  donington: "gb-1931",
  oulton_park: "gb-1953",
  brands_hatch: "gb-1926",
  avus: "de-1907",
  reims: "fr-1926",
  rouen: "fr-1932",
  pedralbes: "es-1946",
  monza_10k: "it-1922",
  pescara: "it-1924",
  sebring: "us-1950",
  riverside: "us-1957",
  dallas: "us-1982",
  detroit: "us-1982",
  phoenix: "us-1964",
  monte_carlo: "mc-1929",
  dijon: "fr-1938",
  zolder: "be-1963",
  zeltweg: "at-1958",
  mosport: "ca-1958",
  mont_tremblant: "ca-1964",
  le_castellet: "fr-1969",
  fair_park: "us-1936",
  las_vegas: "us-2023",
  algarve: "pt-2008",
  bachetting: "be-1969",
};

/**
 * Get the f1-circuits file ID for a given Ergast circuitId.
 * Falls back to null if no mapping exists.
 */
export function getF1CircuitsId(ergastCircuitId: string): string | null {
  return ERGAST_TO_F1CIRCUITS[ergastCircuitId] ?? null;
}

// ============================================================
// F1 Team Colors (Constructor ID → Primary Color)
// ============================================================

export const TEAM_COLORS: Record<string, string> = {
  // Current / recent teams
  red_bull: "#3671C6",
  ferrari: "#E8002D",
  mercedes: "#27F4D2",
  mclaren: "#FF8000",
  aston_martin: "#229971",
  alpine: "#FF87BC",
  williams: "#64C4FF",
  rb: "#6692FF",
  sauber: "#52E252",
  haas: "#B6BABD",
  kick_sauber: "#52E252",
  alphatauri: "#6692FF",
  alfa: "#C92D4B",
  alfa_romeo: "#C92D4B",
  // Historical teams
  racing_point: "#F596C8",
  force_india: "#F596C8",
  renault: "#FFD800",
  toro_rosso: "#469BFF",
  bmw_sauber: "#005AFF",
  toyota: "#FF0000",
  honda: "#0066CC",
  super_aguri: "#FF2400",
  spyker: "#FF6600",
  midland: "#CC0000",
  jordan: "#FFD700",
  minardi: "#333333",
  jaguar: "#006633",
  bar: "#BB0000",
  benetton: "#009900",
  ligier: "#003399",
  prost: "#004488",
  arrows: "#FF6600",
  stewart: "#FFFFFF",
  tyrrell: "#003366",
  brabham: "#CC0000",
  lotus_f1: "#FFB800",
  caterham: "#006633",
  marussia: "#660000",
  hrt: "#BDA000",
  manor: "#003366",
  haas_f1: "#B6BABD",
  mclaren_f1: "#FF8000",
  mclaren_honda: "#FF8000",
  mercedes_f1: "#27F4D2",
  red_bull_racing: "#3671C6",
  scuderia_ferrari: "#E8002D",
};

/**
 * Get the team color for a constructor.
 * Falls back to a neutral gray.
 */
export function getTeamColor(constructorId: string): string {
  return TEAM_COLORS[constructorId] ?? "#888888";
}

// ============================================================
// Utility: Parse lap time string to seconds
// ============================================================

/**
 * Parse an Ergast lap time string to seconds.
 * Formats: "1:37.284" or "37.284" (no minute part)
 */
export function parseLapTime(timeStr: string): number {
  if (!timeStr || timeStr === "") return Infinity;

  const parts = timeStr.split(":");
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]);
}

/**
 * Parse a race time string like "1:31:44.742" or "+22.457" to seconds.
 */
export function parseRaceTime(timeStr: string): number {
  if (!timeStr || timeStr === "") return Infinity;
  if (timeStr.startsWith("+")) {
    return -1; // gap, not absolute time
  }

  const parts = timeStr.split(":");
  if (parts.length === 3) {
    return (
      parseFloat(parts[0]) * 3600 +
      parseFloat(parts[1]) * 60 +
      parseFloat(parts[2])
    );
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]);
}

/**
 * Format seconds to a display string like "1:31:44" or "1:37.2"
 */
export function formatTime(seconds: number, precise: boolean = false): string {
  if (!isFinite(seconds) || seconds < 0) return "---";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${precise ? s.toFixed(1) : Math.floor(s).toString().padStart(2, "0")}`;
  }
  return `${m}:${precise ? s.toFixed(3) : s.toFixed(1).padStart(4, "0")}`;
}

/**
 * Format a gap in seconds to a display string like "+1.234" or "+1 Lap"
 */
export function formatGap(
  gapSeconds: number,
  lapsBehind: number = 0
): string {
  if (lapsBehind > 0) return `+${lapsBehind} Lap${lapsBehind > 1 ? "s" : ""}`;
  if (!isFinite(gapSeconds) || gapSeconds <= 0) return "---";
  if (gapSeconds < 60) return `+${gapSeconds.toFixed(3)}`;
  const m = Math.floor(gapSeconds / 60);
  const s = (gapSeconds % 60).toFixed(1);
  return `+${m}:${s.padStart(4, "0")}`;
}
