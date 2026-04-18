"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { DriverPlaybackState } from "@/lib/types";
import { ProjectedTrack, projectTrackToSVG, getPositionOnTrack } from "@/lib/track-utils";
import { CircuitGeoJSON } from "@/lib/types";
import { extractTrackCoords } from "@/lib/track-utils";

interface TrackCanvasProps {
  geoJSON: CircuitGeoJSON | null;
  drivers: DriverPlaybackState[];
  totalLaps: number;
  currentLap: number;
  isPlaying: boolean;
  showCars: boolean;
  onTrackReady?: (track: ProjectedTrack) => void;
}

interface SmoothedDriver extends DriverPlaybackState {
  x: number;
  y: number;
  heading: number; // angle in degrees, 0 = pointing right
}

const LERP_FACTOR = 0.3;
const LERP_FACTOR_PAUSED = 0.12;

/** Returns true if driver should NOT appear on the track (DNS, DNF, or loading) */
function isOffTrack(driver: DriverPlaybackState): boolean {
  const s = driver.status.toLowerCase();
  // DNS: never started the race
  if (s === "dns") return true;
  // DNF: retired / broken down during the race
  if (s === "dnf") return true;
  // Still loading or no data
  if (s.includes("loading") || s.includes("no lap data")) return true;
  return false;
}

export default function TrackCanvas({
  geoJSON,
  drivers,
  totalLaps,
  currentLap,
  isPlaying,
  showCars,
  onTrackReady,
}: TrackCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  // Smoothing cache stored in state (safe for render-time access)
  const [smoothCache, setSmoothCache] = useState<Map<string, { x: number; y: number }>>(new Map());

  const projectedTrack = useMemo<ProjectedTrack | null>(() => {
    if (!geoJSON) return null;
    try {
      const coords = extractTrackCoords(geoJSON);
      return projectTrackToSVG(coords, 900, 650, 50);
    } catch (e) {
      console.error("Failed to project track:", e);
      return null;
    }
  }, [geoJSON]);

  useEffect(() => {
    if (projectedTrack && onTrackReady) {
      onTrackReady(projectedTrack);
    }
  }, [projectedTrack, onTrackReady]);

  // Calculate start/finish line perpendicular to track direction
  const startFinishLine = useMemo(() => {
    if (!projectedTrack || projectedTrack.points.length < 2) return null;
    const pts = projectedTrack.points;
    const p0 = pts[0];
    // Use the next point to determine track direction at start
    const p1 = pts[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular direction (normal)
    const nx = -dy / len;
    const ny = dx / len;
    const halfWidth = 11; // half the width of the start/finish line across the track
    return {
      x: p0.x,
      y: p0.y,
      x1: p0.x + nx * halfWidth,
      y1: p0.y + ny * halfWidth,
      x2: p0.x - nx * halfWidth,
      y2: p0.y - ny * halfWidth,
    };
  }, [projectedTrack]);

  // Calculate raw (unsmoothed) driver positions + heading, filtering DNS/DNF
  const rawDriverPositions = useMemo(() => {
    if (!projectedTrack) return [];

    return drivers
      .filter((d) => !isOffTrack(d))
      .map((driver) => {
        const progress = driver.trackProgress % 1;
        const point = getPositionOnTrack(projectedTrack.points, progress);
        // Calculate heading by sampling a point slightly ahead on the track
        const aheadProgress = ((progress + 0.003) % 1 + 1) % 1;
        const aheadPoint = getPositionOnTrack(projectedTrack.points, aheadProgress);
        const heading = (Math.atan2(aheadPoint.y - point.y, aheadPoint.x - point.x) * 180) / Math.PI;
        return { driver, rawX: point.x, rawY: point.y, heading };
      });
  }, [drivers, projectedTrack]);

  // Apply lerp smoothing and update cache
  const smoothedDrivers = useMemo<SmoothedDriver[]>(() => {
    const factor = isPlaying ? LERP_FACTOR : LERP_FACTOR_PAUSED;
    const newCache = new Map<string, { x: number; y: number }>();

    const result: SmoothedDriver[] = rawDriverPositions.map(({ driver, rawX, rawY, heading }) => {
      const prev = smoothCache.get(driver.driverId);
      let x: number;
      let y: number;

      if (prev) {
        const dx = rawX - prev.x;
        const dy = rawY - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Detect lap wrap-around: snap if jump > 30% of track length
        if (projectedTrack && dist > projectedTrack.totalLength * 0.3) {
          x = rawX;
          y = rawY;
        } else {
          x = prev.x + dx * factor;
          y = prev.y + dy * factor;
        }
      } else {
        x = rawX;
        y = rawY;
      }

      newCache.set(driver.driverId, { x, y });
      return { ...driver, x, y, heading };
    });

    return result;
  }, [rawDriverPositions, isPlaying, projectedTrack, smoothCache]);

  // Update the smooth cache after render (schedule for next frame)
  // This is intentional: we compute the smoothed positions from the old cache,
  // then update the cache so the next render uses these as the "previous" positions.
  const newCache = useMemo(() => {
    const cache = new Map<string, { x: number; y: number }>();
    for (const d of smoothedDrivers) {
      cache.set(d.driverId, { x: d.x, y: d.y });
    }
    return cache;
  }, [smoothedDrivers]);

  useEffect(() => {
    setSmoothCache(newCache);
  }, [newCache]);

  // Group overlapping drivers to offset them stably
  const offsetDrivers = useMemo(() => {
    const offset = showCars ? 12 : 9;
    const proximityThreshold = showCars ? 24 : 20;

    const sorted = [...smoothedDrivers].sort(
      (a, b) => b.trackProgress - a.trackProgress
    );

    const groups: SmoothedDriver[][] = [];
    const assigned = new Set<string>();

    for (const driver of sorted) {
      if (assigned.has(driver.driverId)) continue;

      const group: SmoothedDriver[] = [driver];
      assigned.add(driver.driverId);

      for (const other of sorted) {
        if (assigned.has(other.driverId)) continue;
        const dx = driver.x - other.x;
        const dy = driver.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < proximityThreshold) {
          group.push(other);
          assigned.add(other.driverId);
        }
      }

      groups.push(group);
    }

    const result: SmoothedDriver[] = [];
    for (const group of groups) {
      if (group.length === 1) {
        result.push(group[0]);
        continue;
      }

      group.sort((a, b) => b.trackProgress - a.trackProgress);

      for (let i = 0; i < group.length; i++) {
        const total = group.length;
        const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
        result.push({
          ...group[i],
          x: group[i].x + Math.cos(angle) * offset,
          y: group[i].y + Math.sin(angle) * offset,
        });
      }
    }

    return result;
  }, [smoothedDrivers, showCars]);

  // Find battling driver pairs (within ~3 seconds = ~0.033 of a lap)
  const battles = useMemo(() => {
    const battleThreshold = 0.033;
    const pairs: [SmoothedDriver, SmoothedDriver][] = [];

    for (let i = 0; i < offsetDrivers.length; i++) {
      for (let j = i + 1; j < offsetDrivers.length; j++) {
        const a = offsetDrivers[i];
        const b = offsetDrivers[j];
        const progDiff = Math.abs(a.trackProgress - b.trackProgress);
        // Only count as battle if on the same lap (or very close lap)
        const lapDiff = Math.abs(Math.floor(a.trackProgress) - Math.floor(b.trackProgress));
        if (progDiff < battleThreshold && lapDiff === 0) {
          pairs.push([a, b]);
        }
      }
    }
    return pairs;
  }, [offsetDrivers]);

  if (!projectedTrack) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950 rounded-xl border border-zinc-800">
        <div className="text-zinc-500 text-center">
          <svg className="w-16 h-16 mx-auto mb-3 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm">Loading track data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="absolute top-3 left-4 z-10">
        <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Lap {currentLap} / {totalLaps}
        </div>
        {battles.length > 0 && (
          <div className="text-[10px] text-amber-500/80 mt-0.5">
            {battles.length} Battle{battles.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={projectedTrack.viewBox}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="trackGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
          <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.8" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#trackGlow)" />

        <path ref={pathRef} d={projectedTrack.pathD} fill="none" stroke="#27272a" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path d={projectedTrack.pathD} fill="none" stroke="#3f3f46" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
        <path d={projectedTrack.pathD} fill="none" stroke="#52525b" strokeWidth="0.5" strokeDasharray="8 12" strokeLinecap="round" />

        {startFinishLine && (
          <g>
            {/* Start/finish line - perpendicular white line across track */}
            <line
              x1={startFinishLine.x1}
              y1={startFinishLine.y1}
              x2={startFinishLine.x2}
              y2={startFinishLine.y2}
              stroke="#ffffff"
              strokeWidth="3"
              opacity="0.9"
              strokeLinecap="butt"
            />
            {/* Checkered pattern overlay */}
            <line
              x1={startFinishLine.x1}
              y1={startFinishLine.y1}
              x2={startFinishLine.x}
              y2={startFinishLine.y}
              stroke="#000000"
              strokeWidth="3"
              opacity="0.7"
              strokeLinecap="butt"
              strokeDasharray="2 2"
            />
            <line
              x1={startFinishLine.x}
              y1={startFinishLine.y}
              x2={startFinishLine.x2}
              y2={startFinishLine.y2}
              stroke="#000000"
              strokeWidth="3"
              opacity="0.7"
              strokeLinecap="butt"
              strokeDasharray="2 2"
              strokeDashoffset="2"
            />
            {/* S/F label */}
            <text
              x={startFinishLine.x}
              y={startFinishLine.y - 14}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="8"
              fontFamily="monospace"
              fontWeight="bold"
              opacity="0.8"
            >
              S/F
            </text>
          </g>
        )}

        {/* Battle highlight lines */}
        {battles.map(([a, b], i) => (
          <line
            key={`battle-${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.35"
          />
        ))}

        {offsetDrivers.map((driver) =>
          showCars ? (
            <g key={driver.driverId} transform={`translate(${driver.x},${driver.y}) rotate(${driver.heading})`}>
              {/* F1 car - top-down view, pointing right at 0 degrees */}
              {/* Glow / shadow */}
              <ellipse cx="0" cy="0" rx="9" ry="5" fill={driver.color} opacity="0.25" filter="url(#dotShadow)" />
              {/* Main body */}
              <path
                d="M-8,-3 L-6,-4 L-2,-4.5 L3,-4.5 L6,-3.5 L8,-2 L8,2 L6,3.5 L3,4.5 L-2,4.5 L-6,4 L-8,3 Z"
                fill={driver.color}
                stroke="#09090b"
                strokeWidth="0.8"
              />
              {/* Front wing */}
              <path
                d="M7,-4 L9,-5 L9,5 L7,4"
                fill={driver.color}
                stroke="#09090b"
                strokeWidth="0.5"
                opacity="0.9"
              />
              {/* Rear wing */}
              <path
                d="M-8,-4 L-9,-5 L-9,5 L-8,4"
                fill={driver.color}
                stroke="#09090b"
                strokeWidth="0.5"
                opacity="0.9"
              />
              {/* Cockpit */}
              <ellipse cx="1" cy="0" rx="2.5" ry="2" fill="#18181b" stroke="#27272a" strokeWidth="0.3" />
              {/* Helmet dot */}
              <circle cx="2" cy="0" r="1.2" fill={driver.color} opacity="0.8" />
              {/* Position number for top 3 */}
              {driver.position <= 3 && (
                <text x="0" y="1" textAnchor="middle" fill="#fff" fontSize="4" fontFamily="monospace" fontWeight="bold">
                  {driver.position}
                </text>
              )}
              {/* Driver code label - offset above car, counter-rotated so text stays readable */}
              <text
                x="0"
                y={-9}
                textAnchor="middle"
                fill={driver.color}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                transform={`rotate(${-driver.heading})`}
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
              >
                {driver.code}
              </text>
            </g>
          ) : (
            <g key={driver.driverId}>
              <circle cx={driver.x} cy={driver.y} r="8" fill={driver.color} opacity="0.3" filter="url(#dotShadow)" />
              <circle cx={driver.x} cy={driver.y} r="6" fill={driver.color} stroke="#09090b" strokeWidth="1.5" />
              {driver.position <= 3 && (
                <text x={driver.x} y={driver.y + 3} textAnchor="middle" fill="#fff" fontSize="7" fontFamily="monospace" fontWeight="bold">
                  {driver.position}
                </text>
              )}
              <text
                x={driver.x}
                y={driver.y - 12}
                textAnchor="middle"
                fill={driver.color}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
              >
                {driver.code}
              </text>
            </g>
          )
        )}
      </svg>
    </div>
  );
}
