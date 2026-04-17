// ============================================================
// F1 Data Fetching Layer
// ============================================================

import {
  ErgastRace,
  ErgastResult,
  ErgastLap,
  ProcessedRaceData,
  DriverLapData,
} from "./types";
import { getTeamColor, parseLapTime, parseRaceTime } from "./circuit-map";

const ERGAST_BASE = "https://api.jolpi.ca/ergast/f1";
const F1CIRCUITS_RAW =
  "https://raw.githubusercontent.com/SergioSediq/f1-circuits/main";
const F1API_BASE = "https://f1api.dev/api";

// ============================================================
// Ergast API helpers
// ============================================================

async function ergastFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${ERGAST_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`Ergast API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.MRData as T;
}

/** Fetch all seasons (years) */
export async function fetchSeasons(): Promise<string[]> {
  const data = await ergastFetch<any>("/seasons.json?limit=100");
  return data.SeasonTable.Seasons.map(
    (s: { season: string }) => s.season
  ).reverse();
}

/** Fetch races for a given year */
export async function fetchRaces(year: number): Promise<ErgastRace[]> {
  const data = await ergastFetch<any>(`/${year}/races.json?limit=30`);
  return data.RaceTable.Races as ErgastRace[];
}

/** Fetch race results */
export async function fetchResults(
  year: number,
  round: number
): Promise<ErgastResult[]> {
  const data = await ergastFetch<any>(
    `/${year}/${round}/results.json?limit=30`
  );
  const races = data.RaceTable.Races as any[];
  if (races.length === 0) return [];
  return races[0].Results as ErgastResult[];
}

/** Fetch lap times for a specific driver */
export async function fetchDriverLaps(
  year: number,
  round: number,
  driverId: string
): Promise<ErgastLap[]> {
  const data = await ergastFetch<any>(
    `/${year}/${round}/drivers/${driverId}/laps.json?limit=100`
  );
  const races = data.RaceTable.Races as any[];
  if (races.length === 0) return [];
  return (races[0].Laps || []) as ErgastLap[];
}

/** Fetch qualifying results */
export async function fetchQualifying(
  year: number,
  round: number
): Promise<any[]> {
  const data = await ergastFetch<any>(
    `/${year}/${round}/qualifying.json?limit=30`
  );
  const races = data.RaceTable.Races as any[];
  if (races.length === 0) return [];
  return races[0].QualifyingResults || [];
}

// ============================================================
// Circuit GeoJSON fetching
// ============================================================

/**
 * Fetch circuit GeoJSON from the f1-circuits GitHub repo.
 * Uses the f1-circuits ID mapping.
 */
export async function fetchCircuitGeoJSON(
  f1CircuitsId: string
): Promise<any> {
  const url = `${F1CIRCUITS_RAW}/circuits/${f1CircuitsId}.geojson`;
  const res = await fetch(url);
  if (!res.ok) {
    // Try the combined geojson as fallback
    const fallbackUrl = `${F1CIRCUITS_RAW}/f1-circuits.geojson`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok)
      throw new Error(`Failed to fetch circuit data for ${f1CircuitsId}`);
    const allCircuits = await fallbackRes.json();
    const feature = allCircuits.features?.find(
      (f: any) => f.properties?.id === f1CircuitsId
    );
    if (!feature)
      throw new Error(`Circuit ${f1CircuitsId} not found in combined GeoJSON`);
    return {
      type: "FeatureCollection",
      features: [feature],
    };
  }
  return res.json();
}

// ============================================================
// Consolidated race data fetching (client-side)
// ============================================================

/**
 * Fetch and process all data needed for a race visualization.
 * This makes multiple API calls in parallel for efficiency.
 */
export async function fetchRaceVisualizationData(
  year: number,
  round: number
): Promise<ProcessedRaceData> {
  // 1. Fetch results (gives us driver list, positions, status)
  const resultsData = await ergastFetch<any>(
    `/${year}/${round}/results.json?limit=30`
  );
  const raceInfo = resultsData.RaceTable.Races[0];
  const results: ErgastResult[] = raceInfo.Results;

  if (!results || results.length === 0) {
    throw new Error("No race results found");
  }

  // 2. Fetch lap data for each driver in parallel
  const lapPromises = results.map((result) =>
    fetchDriverLaps(year, round, result.Driver.driverId).catch(() => [])
  );
  const allLapData = await Promise.all(lapPromises);

  // 3. Process each driver's data
  const winnerTime = results[0]?.Time
    ? parseRaceTime(results[0].Time.time)
    : 0;

  const drivers: DriverLapData[] = results.map((result, index) => {
    const lapData = allLapData[index];
    const driverId = result.Driver.driverId;
    const code =
      result.Driver.code ||
      `${result.Driver.givenName[0]}${result.Driver.familyName.substring(0, 3)}`.toUpperCase();
    const teamId = result.Constructor.constructorId;
    const teamName = result.Constructor.name;
    const gridPosition = parseInt(result.grid) || index + 1;
    const finishingPosition = parseInt(result.position) || index + 1;
    const status = result.status;
    const finished =
      status === "Finished" || status.startsWith("+");
    const lapsCompleted = parseInt(result.laps) || 0;

    // Parse lap times
    const laps: number[] = (lapData || []).map((lap: ErgastLap) => {
      const timing = lap.Timings?.[0]; // Only one timing per driver lap
      return timing ? parseLapTime(timing.time) : 90; // Default 90s if missing
    });

    // Calculate cumulative times
    const cumulativeTimes: number[] = [];
    let cumTime = 0;
    for (const lapTime of laps) {
      cumTime += isFinite(lapTime) ? lapTime : 90;
      cumulativeTimes.push(cumTime);
    }

    const totalRaceTime = cumulativeTimes.length > 0
      ? cumulativeTimes[cumulativeTimes.length - 1]
      : 0;

    const gapToFront = result.Time?.time || "";

    return {
      driverId,
      code,
      firstName: result.Driver.givenName,
      lastName: result.Driver.familyName,
      teamName,
      teamId,
      gridPosition,
      finishingPosition,
      status,
      laps,
      cumulativeTimes,
      totalRaceTime,
      finished,
      lapsCompleted,
      gapToFront,
      color: getTeamColor(teamId),
    };
  });

  // Find the maximum race time (winner's time)
  const maxRaceTime =
    drivers.length > 0 && drivers[0].cumulativeTimes.length > 0
      ? drivers[0].cumulativeTimes[drivers[0].cumulativeTimes.length - 1]
      : 0;

  return {
    raceName: raceInfo.raceName,
    circuitId: raceInfo.Circuit.circuitId,
    circuitName: raceInfo.Circuit.circuitName,
    country: raceInfo.Circuit.Location.country,
    locality: raceInfo.Circuit.Location.locality,
    season: year,
    round,
    totalLaps: drivers.reduce(
      (max, d) => Math.max(max, d.lapsCompleted),
      0
    ),
    drivers,
    maxRaceTime,
  };
}
