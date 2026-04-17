// ============================================================
// Race Playback Engine
// ============================================================

import {
  ProcessedRaceData,
  DriverLapData,
  DriverPlaybackState,
  RacePlaybackState,
} from "./types";
import { TrackPoint } from "./track-utils";
import { getPositionOnTrack, ProjectedTrack } from "./track-utils";

/**
 * Create the initial playback state for a race.
 * All drivers start at position 0 on the track.
 */
export function createInitialPlaybackState(
  raceData: ProcessedRaceData
): RacePlaybackState {
  return {
    currentTime: 0,
    currentLap: 0,
    isPlaying: false,
    speedMultiplier: 1,
    isFinished: false,
    drivers: raceData.drivers.map((driver) => ({
      driverId: driver.driverId,
      code: driver.code,
      teamName: driver.teamName,
      color: driver.color,
      position: driver.gridPosition,
      lap: 0,
      trackProgress: 0,
      x: 0,
      y: 0,
      finished: false,
      status: "Starting",
      gapToLeader: "",
      gridPosition: driver.gridPosition,
    })),
  };
}

/**
 * Calculate a driver's position on track at a given race time.
 * Returns lap number, track progress (0-1 within current lap), and
 * whether the driver has finished.
 */
function calculateDriverPosition(
  driver: DriverLapData,
  raceTime: number,
  totalLaps: number
): {
  lap: number;
  lapProgress: number;
  finished: boolean;
  totalProgress: number; // 0 to totalLaps (fractional)
} {
  if (driver.cumulativeTimes.length === 0) {
    return { lap: 0, lapProgress: 0, finished: false, totalProgress: 0 };
  }

  // Check if driver has finished
  const lastCumTime =
    driver.cumulativeTimes[driver.cumulativeTimes.length - 1];
  const driverFinished = raceTime >= lastCumTime && driver.finished;
  const driverLapsCompleted = driver.cumulativeTimes.length;

  if (raceTime >= lastCumTime) {
    // Driver has completed all their laps
    if (driverFinished) {
      return {
        lap: driverLapsCompleted,
        lapProgress: 0,
        finished: true,
        totalProgress: driverLapsCompleted,
      };
    } else {
      // DNF - driver stopped at their last completed lap
      return {
        lap: driverLapsCompleted,
        lapProgress: 0,
        finished: false,
        totalProgress: driverLapsCompleted,
      };
    }
  }

  // Find which lap the driver is currently on
  let currentLapIdx = 0;
  for (let i = 0; i < driver.cumulativeTimes.length; i++) {
    if (raceTime < driver.cumulativeTimes[i]) {
      currentLapIdx = i;
      break;
    }
    if (i === driver.cumulativeTimes.length - 1) {
      currentLapIdx = i;
    }
  }

  // Calculate progress within the current lap
  const lapStartTime = currentLapIdx > 0 ? driver.cumulativeTimes[currentLapIdx - 1] : 0;
  const lapEndTime = driver.cumulativeTimes[currentLapIdx];
  const lapDuration = lapEndTime - lapStartTime;
  const elapsedInLap = raceTime - lapStartTime;
  const lapProgress = lapDuration > 0 ? elapsedInLap / lapDuration : 0;

  // Total progress (0 = start, totalLaps = finish)
  const totalProgress = currentLapIdx + Math.min(lapProgress, 1);

  return {
    lap: currentLapIdx + 1, // 1-indexed
    lapProgress: Math.min(Math.max(lapProgress, 0), 1),
    finished: false,
    totalProgress,
  };
}

/**
 * Update the playback state for a given race time.
 * Returns a new state object with all driver positions calculated.
 */
export function updatePlaybackState(
  raceData: ProcessedRaceData,
  projectedTrack: ProjectedTrack | null,
  currentTime: number
): RacePlaybackState {
  const totalLaps = raceData.totalLaps;

  // Calculate each driver's position
  const driverStates: DriverPlaybackState[] = raceData.drivers.map(
    (driver) => {
      const pos = calculateDriverPosition(driver, currentTime, totalLaps);

      // Get track position from progress
      let x = 0,
        y = 0;
      if (projectedTrack) {
        const trackPoint = getPositionOnTrack(
          projectedTrack.points,
          pos.lapProgress
        );
        x = trackPoint.x;
        y = trackPoint.y;
      }

      return {
        driverId: driver.driverId,
        code: driver.code,
        teamName: driver.teamName,
        color: driver.color,
        position: 0, // Will be calculated below
        lap: pos.lap,
        trackProgress: pos.totalProgress,
        x,
        y,
        finished: pos.finished,
        status: pos.finished ? "Finished" : driver.status,
        gapToLeader: driver.gapToFront,
        gridPosition: driver.gridPosition,
      };
    }
  );

  // Sort drivers by total progress (descending) to determine positions
  const sorted = [...driverStates].sort(
    (a, b) => b.trackProgress - a.trackProgress
  );

  // Assign positions based on sort order
  // But we need to handle lapped cars and DNFs properly
  const positionMap = new Map<string, number>();
  sorted.forEach((driver, index) => {
    positionMap.set(driver.driverId, index + 1);
  });

  const driversWithPositions = driverStates.map((driver) => ({
    ...driver,
    position: positionMap.get(driver.driverId) || 0,
  }));

  // Calculate leader's lap
  const leaderProgress = Math.max(
    ...driverStates.map((d) => d.trackProgress)
  );
  const currentLap = Math.floor(leaderProgress);

  // Check if race is finished
  const isFinished = driverStates.some((d) => d.finished);

  // Calculate gaps
  const leaderTime = currentTime;
  const driversWithGaps = driversWithPositions.map((driver) => {
    const driverData = raceData.drivers.find(
      (d) => d.driverId === driver.driverId
    );
    if (!driverData) return driver;

    if (driver.position === 1) {
      return { ...driver, gapToLeader: "Leader" };
    }

    // Calculate time gap from cumulative times
    const leaderData = raceData.drivers.find(
      (d) =>
        d.driverId ===
        driversWithPositions.find((dd) => dd.position === 1)?.driverId
    );

    if (leaderData && driverData.cumulativeTimes.length > 0) {
      const leaderLapIdx = Math.min(
        Math.floor(leaderProgress),
        leaderData.cumulativeTimes.length - 1
      );
      const driverLapIdx = Math.min(
        driver.lap - 1,
        driverData.cumulativeTimes.length - 1
      );

      if (leaderLapIdx >= 0 && driverLapIdx >= 0) {
        const lapDiff = leaderLapIdx - driverLapIdx;
        if (lapDiff >= 1) {
          return {
            ...driver,
            gapToLeader: `+${lapDiff} Lap${lapDiff > 1 ? "s" : ""}`,
          };
        }
      }
    }

    return driver;
  });

  return {
    currentTime,
    currentLap,
    isPlaying: false, // This will be managed by the UI
    speedMultiplier: 1,
    isFinished,
    drivers: driversWithGaps,
  };
}

/**
 * Calculate the estimated race duration in seconds.
 */
export function getRaceDuration(raceData: ProcessedRaceData): number {
  const maxTime = raceData.maxRaceTime;
  // Add a small buffer
  return maxTime > 0 ? maxTime + 5 : 7200; // Default 2 hours
}

/**
 * Get the approximate lap time for the leader (average).
 */
export function getAverageLapTime(raceData: ProcessedRaceData): number {
  if (raceData.drivers.length === 0) return 90;
  const leader = raceData.drivers[0];
  if (leader.laps.length === 0) return 90;
  const totalTime = leader.cumulativeTimes[leader.cumulativeTimes.length - 1] || 0;
  return totalTime / leader.laps.length || 90;
}
