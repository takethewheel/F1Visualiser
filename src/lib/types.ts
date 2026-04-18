// ============================================================
// F1 Race Visualizer – Type Definitions
// ============================================================

/** A single GPS coordinate pair [longitude, latitude] */
export type GeoCoord = [number, number];

/** GeoJSON Feature for a circuit */
export interface CircuitFeature {
  type: "Feature";
  properties: {
    id: string;
    Location: string;
    Name: string;
    opened: number;
    firstgp: number;
    length: number;
    altitude: number;
  };
  geometry: {
    type: "LineString";
    coordinates: GeoCoord[];
  };
}

/** GeoJSON FeatureCollection for a circuit */
export interface CircuitGeoJSON {
  type: "FeatureCollection";
  name: string;
  bbox: [number, number, number, number];
  features: CircuitFeature[];
}

/** Circuit location entry from f1-locations.json */
export interface CircuitLocation {
  lon: number;
  lat: number;
  zoom: number;
  location: string;
  name: string;
  id: string;
}

/** Race from Ergast API race calendar */
export interface ErgastRace {
  season: string;
  round: string;
  url: string;
  raceName: string;
  Circuit: {
    circuitId: string;
    url: string;
    circuitName: string;
    Location: {
      lat: string;
      long: string;
      locality: string;
      country: string;
    };
  };
  date: string;
  time: string;
}

/** Driver info from Ergast API */
export interface ErgastDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  url: string;
  givenName: string;
  familyName: string;
  dateOfBirth?: string;
  nationality?: string;
}

/** Constructor info from Ergast API */
export interface ErgastConstructor {
  constructorId: string;
  url: string;
  name: string;
  nationality?: string;
}

/** Single result entry from Ergast API */
export interface ErgastResult {
  number: string;
  position: string;
  positionText: string;
  points: string;
  Driver: ErgastDriver;
  Constructor: ErgastConstructor;
  grid: string;
  laps: string;
  status: string;
  Time?: {
    millis: string;
    time: string;
  };
  FastestLap?: {
    rank: string;
    lap: string;
    Time: { time: string };
    AverageSpeed: { units: string; speed: string };
  };
}

/** Lap timing entry */
export interface LapTiming {
  driverId: string;
  position: string;
  time: string; // e.g. "1:37.284"
}

/** A single lap from the Ergast laps endpoint */
export interface ErgastLap {
  number: string;
  Timings: LapTiming[];
}

// ============================================================
// Processed / internal types
// ============================================================

/** Driver's lap data after processing */
export interface DriverLapData {
  driverId: string;
  code: string;
  firstName: string;
  lastName: string;
  teamName: string;
  teamId: string;
  gridPosition: number;
  finishingPosition: number;
  status: string;
  laps: number[]; // lap times in seconds
  cumulativeTimes: number[]; // cumulative race time at end of each lap
  totalRaceTime: number; // total race time in seconds
  finished: boolean;
  lapsCompleted: number;
  gapToFront?: string; // gap string from results
  color: string; // team color
  isDNS: boolean; // set once during skeleton creation, authoritative DNS flag
}

/** Full processed race data */
export interface ProcessedRaceData {
  raceName: string;
  circuitId: string;
  circuitName: string;
  country: string;
  locality: string;
  season: number;
  round: number;
  totalLaps: number;
  drivers: DriverLapData[];
  maxRaceTime: number; // time of the winner in seconds
}

/** Point on the SVG track */
export interface TrackPoint {
  x: number;
  y: number;
}

/** Driver state at a given moment during playback */
export interface DriverPlaybackState {
  driverId: string;
  code: string;
  teamName: string;
  color: string;
  position: number; // race position (1, 2, 3...)
  lap: number; // current lap number
  trackProgress: number; // 0.0 to totalLaps, position along the track
  x: number; // SVG x position
  y: number; // SVG y position
  finished: boolean;
  status: string;
  gapToLeader: string;
  gridPosition: number;
  currentLapTime: number | null; // seconds elapsed in current lap (null if not on a lap)
  previousLapTime: number | null; // last completed lap time in seconds (null if none)
  fastestLapTime: number | null; // fastest completed lap time in seconds (null if none)
}

/** Race playback state */
export interface RacePlaybackState {
  currentTime: number; // current race time in seconds
  currentLap: number; // approximate current lap (leader's lap)
  isPlaying: boolean;
  speedMultiplier: number;
  isFinished: boolean;
  drivers: DriverPlaybackState[];
}

/** Speed multiplier option */
export interface SpeedOption {
  label: string;
  value: number;
}

/** Race event for the timeline (retirements, fastest laps, etc.) */
export interface RaceEvent {
  type: "retirement" | "fastest_lap" | "pit_stop";
  time: number; // race time in seconds when the event occurred
  driverCode: string;
  description: string;
  lap?: number;
}
