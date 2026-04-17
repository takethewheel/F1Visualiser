"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import TrackCanvas from "./track-canvas";
import Leaderboard from "./leaderboard";
import RaceControls from "./race-controls";
import RaceSelector from "./race-selector";
import { ProjectedTrack } from "@/lib/track-utils";
import { getTeamColor, parseLapTime } from "@/lib/circuit-map";
import {
  ProcessedRaceData,
  DriverLapData,
  DriverPlaybackState,
  CircuitGeoJSON,
  ErgastRace,
} from "@/lib/types";

// ============================================================
// Track position calculation (pure function, extracted for perf)
// ============================================================
function getPointOnTrack(
  points: { x: number; y: number }[],
  progress: number
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };

  const p = ((progress % 1) + 1) % 1;

  const distances: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalDist += Math.sqrt(dx * dx + dy * dy);
    distances.push(totalDist);
  }
  const cdx = points[0].x - points[points.length - 1].x;
  const cdy = points[0].y - points[points.length - 1].y;
  totalDist += Math.sqrt(cdx * cdx + cdy * cdy);

  const targetDist = p * totalDist;

  if (targetDist >= distances[distances.length - 1]) {
    const segDist = targetDist - distances[distances.length - 1];
    const segLen = totalDist - distances[distances.length - 1];
    const t = segLen > 0 ? segDist / segLen : 0;
    return {
      x: points[points.length - 1].x + t * (points[0].x - points[points.length - 1].x),
      y: points[points.length - 1].y + t * (points[0].y - points[points.length - 1].y),
    };
  }

  let lo = 0, hi = distances.length - 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (distances[mid + 1] < targetDist) lo = mid + 1;
    else hi = mid;
  }

  const segLen = distances[lo + 1] - distances[lo];
  const t = segLen > 0 ? (targetDist - distances[lo]) / segLen : 0;
  return {
    x: points[lo].x + t * (points[lo + 1].x - points[lo].x),
    y: points[lo].y + t * (points[lo + 1].y - points[lo].y),
  };
}

function calcDriverPos(driver: DriverLapData, raceTime: number) {
  if (driver.cumulativeTimes.length === 0) {
    return { lap: 0, lapProgress: 0, finished: false, totalProgress: 0 };
  }

  const lastCum = driver.cumulativeTimes[driver.cumulativeTimes.length - 1];
  const driverFinished = raceTime >= lastCum && driver.finished;

  if (raceTime >= lastCum) {
    return {
      lap: driver.cumulativeTimes.length,
      lapProgress: 0,
      finished: driverFinished,
      totalProgress: driver.cumulativeTimes.length,
    };
  }

  let lapIdx = 0;
  for (let i = 0; i < driver.cumulativeTimes.length; i++) {
    if (raceTime < driver.cumulativeTimes[i]) { lapIdx = i; break; }
    if (i === driver.cumulativeTimes.length - 1) lapIdx = i;
  }

  const lapStart = lapIdx > 0 ? driver.cumulativeTimes[lapIdx - 1] : 0;
  const lapEnd = driver.cumulativeTimes[lapIdx];
  const lapDur = lapEnd - lapStart;
  const lapProg = lapDur > 0 ? (raceTime - lapStart) / lapDur : 0;
  const totalProg = lapIdx + Math.min(Math.max(lapProg, 0), 1);

  return {
    lap: lapIdx + 1,
    lapProgress: Math.min(Math.max(lapProg, 0), 1),
    finished: false,
    totalProgress: totalProg,
  };
}

// ============================================================
// Main Component
// ============================================================
export default function RaceVisualizer() {
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [races, setRaces] = useState<{ round: number; raceName: string; circuitName: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [raceData, setRaceData] = useState<ProcessedRaceData | null>(null);
  const [circuitGeoJSON, setCircuitGeoJSON] = useState<CircuitGeoJSON | null>(null);
  const [projectedTrack, setProjectedTrack] = useState<ProjectedTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRace, setIsLoadingRace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(10);
  const [currentTime, setCurrentTime] = useState(0);
  const [driverStates, setDriverStates] = useState<DriverPlaybackState[]>([]);
  const [currentLap, setCurrentLap] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Refs for animation loop (avoid stale closures)
  const animRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const raceDataRef = useRef<ProcessedRaceData | null>(null);
  const trackRef = useRef<ProjectedTrack | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(10);

  useEffect(() => { raceDataRef.current = raceData; }, [raceData]);
  useEffect(() => { trackRef.current = projectedTrack; }, [projectedTrack]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);

  // ============================================================
  // Compute all driver states for a given race time
  // ============================================================
  const computeStates = useCallback((raceTime: number): DriverPlaybackState[] => {
    const rd = raceDataRef.current;
    const track = trackRef.current;
    if (!rd) return [];

    const states: DriverPlaybackState[] = rd.drivers.map((driver) => {
      const pos = calcDriverPos(driver, raceTime);
      let x = 0, y = 0;
      if (track) {
        const pt = getPointOnTrack(track.points, pos.lapProgress);
        x = pt.x; y = pt.y;
      }

      return {
        driverId: driver.driverId,
        code: driver.code,
        teamName: driver.teamName,
        color: driver.color,
        position: 0,
        lap: pos.lap,
        trackProgress: pos.totalProgress,
        x, y,
        finished: pos.finished,
        status: pos.finished ? "Finished" : driver.status,
        gapToLeader: "",
        gridPosition: driver.gridPosition,
      };
    });

    // Sort by totalProgress → assign positions
    const sorted = [...states].sort((a, b) => b.trackProgress - a.trackProgress);
    const posMap = new Map<string, number>();
    sorted.forEach((d, i) => posMap.set(d.driverId, i + 1));

    const leaderId = sorted[0]?.driverId;
    const leaderDriver = rd.drivers.find((d) => d.driverId === leaderId);

    return states.map((driver) => {
      const pos = posMap.get(driver.driverId) || 0;
      let gap = "";

      if (pos === 1) {
        gap = "Leader";
      } else {
        const dd = rd.drivers.find((d) => d.driverId === driver.driverId);
        if (dd && leaderDriver) {
          const lp = sorted[0].trackProgress;
          const dp = driver.trackProgress;
          const lapDiff = Math.floor(lp) - Math.floor(dp);
          if (lapDiff >= 1) {
            gap = `+${lapDiff} Lap${lapDiff > 1 ? "s" : ""}`;
          } else {
            const lIdx = Math.min(Math.floor(lp), leaderDriver.cumulativeTimes.length - 1);
            const dIdx = Math.min(driver.lap - 1, dd.cumulativeTimes.length - 1);
            if (lIdx >= 0 && dIdx >= 0 && dd.cumulativeTimes[dIdx] !== undefined && leaderDriver.cumulativeTimes[lIdx] !== undefined) {
              const leaderAtT = leaderDriver.cumulativeTimes[lIdx] + (lp - Math.floor(lp)) * (leaderDriver.laps[lIdx] || 90);
              const driverAtT = dd.cumulativeTimes[dIdx] + (dp - Math.floor(dp)) * (dd.laps[dIdx] || 90);
              const timeGap = driverAtT - leaderAtT;
              if (isFinite(timeGap) && timeGap > 0) {
                gap = `+${timeGap < 60 ? timeGap.toFixed(1) + "s" : Math.floor(timeGap / 60) + ":" + ((timeGap % 60).toFixed(0)).padStart(2, "0")}`;
              }
            }
          }
        }
      }

      return { ...driver, position: pos, gapToLeader: gap };
    });
  }, []);

  // ============================================================
  // Animation loop
  // ============================================================
  useEffect(() => {
    let rafId: number;
    let lastRender = 0;

    function tick(ts: number) {
      if (!playingRef.current || !raceDataRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (lastTsRef.current === 0) lastTsRef.current = ts;
      const delta = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      const newTime = timeRef.current + delta * speedRef.current;
      const maxTime = raceDataRef.current!.maxRaceTime;

      if (newTime >= maxTime) {
        timeRef.current = maxTime;
        const finalStates = computeStates(maxTime);
        setCurrentTime(maxTime);
        setDriverStates(finalStates);
        setCurrentLap(raceDataRef.current!.totalLaps);
        setIsPlaying(false);
        setIsFinished(true);
      } else {
        timeRef.current = newTime;
        // Throttle React state updates to ~30fps for better performance
        if (ts - lastRender >= 33) {
          lastRender = ts;
          const states = computeStates(newTime);
          setCurrentTime(newTime);
          setDriverStates(states);
          const leaderLap = states.length > 0 ? Math.max(...states.map(d => d.trackProgress)) : 0;
          setCurrentLap(Math.floor(leaderLap));
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [computeStates]);

  // ============================================================
  // Fetch seasons on mount
  // ============================================================
  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/f1/seasons");
        const data = await res.json();
        if (data.seasons) {
          const years = data.seasons.map(Number);
          setAvailableYears(years);
          // Avoid future years that don't have race results yet
          const pastYears = years.filter((y) => y <= 2025);
          const recent = pastYears.filter((y) => y >= 2018);
          const ry = recent[Math.floor(Math.random() * recent.length)] || pastYears[0] || years[0];
          setSelectedYear(ry);
        }
      } catch { setError("Failed to load seasons"); }
      finally { setIsLoading(false); }
    }
    load();
  }, []);

  // ============================================================
  // Fetch races when year changes
  // ============================================================
  useEffect(() => {
    if (!selectedYear) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/f1/races?year=${selectedYear}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.races) {
          const list = data.races.map((r: ErgastRace) => ({
            round: parseInt(r.round),
            raceName: r.raceName,
            circuitName: r.Circuit.circuitName,
          }));
          setRaces(list);
          // Auto-select a random race
          const pick = list[Math.floor(Math.random() * list.length)];
          if (pick) setSelectedRound(pick.round);
        }
      } catch { console.error("Failed to load races"); }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedYear]);

  // ============================================================
  // Fetch race data when year+round selected
  // Strategy: Fetch results + circuit from API route (fast, 2 requests),
  // then fetch each driver's laps IN PARALLEL from the client side.
  // This avoids Vercel serverless function timeouts.
  // ============================================================
  useEffect(() => {
    if (!selectedYear || !selectedRound) return;
    let cancelled = false;

    async function load() {
      setIsLoadingRace(true);
      setError(null);
      setIsPlaying(false);
      timeRef.current = 0;
      lastTsRef.current = 0;
      setCurrentTime(0);
      setIsFinished(false);

      try {
        // Step 1: Fetch race results + circuit GeoJSON (fast, 2 external requests)
        const res = await fetch(`/api/f1/race-data?year=${selectedYear}&round=${selectedRound}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.error) {
          setError(`This race doesn't have results yet. Try another year or race.`);
          setIsLoadingRace(false);
          return;
        }
        if (!data.results || data.results.length === 0) {
          setError(`No results found for this race. It may not have taken place yet.`);
          setIsLoadingRace(false);
          return;
        }

        const results = data.results;

        // Set circuit GeoJSON right away so track renders while laps load
        setCircuitGeoJSON(data.circuitGeoJSON || null);

        // Step 2: Build skeleton driver data (no lap times yet)
        const skeletonDrivers: DriverLapData[] = results.map((result: any, index: number) => {
          const driverId = result.Driver.driverId;
          const code = result.Driver.code || `${result.Driver.givenName[0]}${result.Driver.familyName.substring(0, 3)}`.toUpperCase();
          const teamId = result.Constructor.constructorId;
          const gridRaw = parseInt(result.grid);
          // Grid position 0 means DNS (did not start) — keep it as 0, don't fallback
          const gridPosition = isNaN(gridRaw) ? 0 : gridRaw;
          const status = result.status || "";
          const isDNS = gridPosition === 0 || status.toLowerCase().includes("dns");
          return {
            driverId, code,
            firstName: result.Driver.givenName,
            lastName: result.Driver.familyName,
            teamName: result.Constructor.name, teamId,
            gridPosition,
            finishingPosition: parseInt(result.position) || index + 1,
            status: isDNS ? "DNS" : status,
            finished: !isDNS && (status === "Finished" || status.startsWith("+")),
            lapsCompleted: parseInt(result.laps) || 0,
            laps: [], cumulativeTimes: [], totalRaceTime: 0,
            gapToFront: result.Time?.time || "",
            color: getTeamColor(teamId),
          };
        });

        // Set initial state so the UI shows the track + driver names
        const initial: DriverPlaybackState[] = skeletonDrivers.map((d) => ({
          driverId: d.driverId, code: d.code, teamName: d.teamName, color: d.color,
          position: d.gridPosition, lap: 0, trackProgress: 0, x: 0, y: 0,
          finished: false, status: "Loading laps...", gapToLeader: "", gridPosition: d.gridPosition,
        }));
        setDriverStates(initial);

        // Step 3: Fetch lap data for EACH driver in parallel from the client.
        // Each request hits our thin proxy which only makes 1 external API call,
        // so no Vercel serverless function timeout issues.
        const lapPromises = skeletonDrivers.map((driver) =>
          fetch(`/api/f1/driver-laps?year=${selectedYear}&round=${selectedRound}&driverId=${driver.driverId}`)
            .then((r) => r.json())
            .then((d) => d.laps || [])
            .catch(() => [])
        );
        const allLaps = await Promise.all(lapPromises);
        if (cancelled) return;

        // Step 4: Process lap data into driver objects
        const drivers: DriverLapData[] = skeletonDrivers.map((driver, index) => {
          const lapData = allLaps[index] || [];
          const laps: number[] = lapData.map((lap: any) => {
            const timing = lap.Timings?.[0];
            return timing ? parseLapTime(timing.time) : 90;
          });

          const cumulativeTimes: number[] = [];
          let cumTime = 0;
          for (const lt of laps) { cumTime += isFinite(lt) ? lt : 90; cumulativeTimes.push(cumTime); }
          const totalRaceTime = cumulativeTimes.length > 0 ? cumulativeTimes[cumulativeTimes.length - 1] : 0;

          return {
            ...driver,
            laps, cumulativeTimes, totalRaceTime,
          };
        });

        const maxRaceTime = drivers.length > 0 && drivers[0].cumulativeTimes.length > 0
          ? drivers[0].cumulativeTimes[drivers[0].cumulativeTimes.length - 1] : 0;

        const processed: ProcessedRaceData = {
          raceName: data.raceInfo.raceName,
          circuitId: data.raceInfo.circuitId,
          circuitName: data.raceInfo.circuitName,
          country: data.raceInfo.country,
          locality: data.raceInfo.locality,
          season: selectedYear!,
          round: selectedRound!,
          totalLaps: drivers.reduce((m: number, d: DriverLapData) => Math.max(m, d.lapsCompleted), 0),
          drivers, maxRaceTime,
        };

        setRaceData(processed);

        // Update driver states with loaded status
        const loaded: DriverPlaybackState[] = drivers.map((d) => {
          // Keep DNS status for drivers who never started
          const isDNSDriver = d.status === "DNS" || d.gridPosition === 0;
          return {
            driverId: d.driverId, code: d.code, teamName: d.teamName, color: d.color,
            position: isDNSDriver ? 0 : d.gridPosition,
            lap: 0, trackProgress: 0, x: 0, y: 0,
            finished: false,
            status: isDNSDriver ? "DNS" : (d.cumulativeTimes.length === 0 ? "No lap data" : "Ready"),
            gapToLeader: "", gridPosition: d.gridPosition,
          };
        });
        setDriverStates(loaded);
        setCurrentLap(0);

      } catch (err: any) { setError(err.message || "Failed to load race data"); }
      finally { setIsLoadingRace(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedYear, selectedRound]);

  // Auto-play once race data + track are ready
  useEffect(() => {
    if (raceData && projectedTrack && !isFinished && driverStates.length > 0 && !isPlaying) {
      // Small delay so the user can see the initial state
      const timer = setTimeout(() => setIsPlaying(true), 800);
      return () => clearTimeout(timer);
    }
  }, [raceData, projectedTrack, isFinished, isPlaying, driverStates.length]);

  // ============================================================
  // Handlers
  // ============================================================
  const handlePlayPause = useCallback(() => {
    if (isFinished) {
      timeRef.current = 0;
      lastTsRef.current = 0;
      setCurrentTime(0);
      setIsFinished(false);
    }
    setIsPlaying((p) => !p);
  }, [isFinished]);

  const handleSpeedChange = useCallback((speed: number) => { setSpeedMultiplier(speed); }, []);

  const handleSeek = useCallback((time: number) => {
    timeRef.current = time;
    lastTsRef.current = 0;
    setCurrentTime(time);
    setDriverStates(computeStates(time));
  }, [computeStates]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    timeRef.current = 0;
    lastTsRef.current = 0;
    setCurrentTime(0);
    setIsFinished(false);
    if (raceDataRef.current) setDriverStates(computeStates(0));
    setCurrentLap(0);
  }, [computeStates]);

  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year);
    setSelectedRound(null);
    setRaces([]);
    setRaceData(null);
    setCircuitGeoJSON(null);
    setProjectedTrack(null);
    setIsPlaying(false);
  }, []);

  const handleRaceChange = useCallback((round: number) => { setSelectedRound(round); }, []);

  const handleRandomRace = useCallback(() => {
    if (availableYears.length === 0) return;
    const pastYears = availableYears.filter((y) => y <= 2025);
    const pool = pastYears.length > 0 ? pastYears : availableYears;
    const ry = pool[Math.floor(Math.random() * pool.length)];
    setIsPlaying(false);
    setRaceData(null);
    setCircuitGeoJSON(null);
    setProjectedTrack(null);
    setSelectedYear(ry);
    setSelectedRound(null);
    setRaces([]);
  }, [availableYears]);

  const handleTrackReady = useCallback((track: ProjectedTrack) => { setProjectedTrack(track); }, []);

  const maxTime = raceData?.maxRaceTime || 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                  <path d="M3 4l5.447 2.724A1 1 0 019 7.618v10.764a1 1 0 01-1.447.894L3 17M3 4v13M3 4h8m-8 13h8m0-13l5.447-2.724A1 1 0 0116 5.382v10.236a1 1 0 01-.553.894L11 19M11 4h8m0 0v13m0-13l1.447-.724A1 1 0 0121 4.618v10.764a1 1 0 01-.553.894L19 17" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight">F1 Race Visualizer</h1>
                <p className="text-[10px] text-zinc-500">Relive every Grand Prix</p>
              </div>
            </div>
          </div>
          <RaceSelector
            onYearChange={handleYearChange}
            onRaceChange={handleRaceChange}
            onRandomRace={handleRandomRace}
            selectedYear={selectedYear}
            selectedRound={selectedRound}
            availableYears={availableYears}
            races={races}
            isLoading={isLoading || isLoadingRace}
          />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        {isLoadingRace && !raceData && (
          <div className="flex items-center justify-center h-[500px]">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">Loading race data...</p>
              <p className="text-zinc-600 text-xs mt-1">Fetching results and lap times</p>
            </div>
          </div>
        )}

        {!isLoadingRace && !raceData && !error && (
          <div className="flex items-center justify-center h-[500px]">
            <div className="text-center">
              <svg className="w-20 h-20 mx-auto mb-4 text-zinc-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M3 4l5.447 2.724A1 1 0 019 7.618v10.764a1 1 0 01-1.447.894L3 17M3 4v13M3 4h8m-8 13h8m0-13l5.447-2.724A1 1 0 0116 5.382v10.236a1 1 0 01-.553.894L11 19M11 4h8m0 0v13m0-13l1.447-.724A1 1 0 0121 4.618v10.764a1 1 0 01-.553.894L19 17" />
              </svg>
              <h2 className="text-lg font-semibold text-zinc-400 mb-1">Select a Race</h2>
              <p className="text-zinc-600 text-sm">Choose a year and race above, or click Random</p>
            </div>
          </div>
        )}

        {raceData && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            <div className="flex flex-col gap-4">
              {/* Race info */}
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-zinc-300 font-medium">{raceData.season} {raceData.raceName}</span>
                <span className="text-zinc-700">•</span>
                <span className="text-zinc-500">{raceData.circuitName}</span>
                <span className="text-zinc-700">•</span>
                <span className="text-zinc-500">{raceData.locality}, {raceData.country}</span>
                {!circuitGeoJSON && (
                  <>
                    <span className="text-zinc-700">•</span>
                    <span className="text-amber-500 text-xs">Track map unavailable</span>
                  </>
                )}
              </div>

              <TrackCanvas
                geoJSON={circuitGeoJSON}
                drivers={driverStates}
                totalLaps={raceData.totalLaps}
                currentLap={currentLap}
                isPlaying={isPlaying}
                onTrackReady={handleTrackReady}
              />

              <RaceControls
                isPlaying={isPlaying}
                speedMultiplier={speedMultiplier}
                currentTime={currentTime}
                maxTime={maxTime}
                currentLap={currentLap}
                totalLaps={raceData.totalLaps}
                onPlayPause={handlePlayPause}
                onSpeedChange={handleSpeedChange}
                onSeek={handleSeek}
                onReset={handleReset}
              />
            </div>

            <div className="h-[600px] lg:h-auto">
              <Leaderboard
                drivers={driverStates}
                currentLap={currentLap}
                totalLaps={raceData.totalLaps}
                raceName={`${raceData.season} ${raceData.raceName}`}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-3 text-center text-[10px] text-zinc-700">
        Data from{" "}
        <a href="https://api.jolpi.ca/ergast/" target="_blank" rel="noopener" className="underline hover:text-zinc-400">Ergast API</a>
        {" "}•{" "}
        <a href="https://f1api.dev" target="_blank" rel="noopener" className="underline hover:text-zinc-400">F1 API</a>
        {" "}•{" "}
        <a href="https://github.com/SergioSediq/f1-circuits" target="_blank" rel="noopener" className="underline hover:text-zinc-400">F1 Circuits</a>
      </footer>
    </div>
  );
}
