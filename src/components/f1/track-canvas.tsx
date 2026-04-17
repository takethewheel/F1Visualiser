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
  onTrackReady?: (track: ProjectedTrack) => void;
}

interface SmoothedDriver extends DriverPlaybackState {
  x: number;
  y: number;
}

const LERP_FACTOR = 0.3;
const LERP_FACTOR_PAUSED = 0.12;

function isDNS(driver: DriverPlaybackState): boolean {
  if (driver.lap === 0 && driver.trackProgress === 0) {
    const s = driver.status.toLowerCase();
    if (
      s.includes("dns") ||
      s.includes("did not start") ||
      s.includes("withheld") ||
      s.includes("107%") ||
      s.includes("no lap data") ||
      s.includes("loading")
    ) {
      return true;
    }
    if (driver.gridPosition === 0) return true;
  }
  return false;
}

export default function TrackCanvas({
  geoJSON,
  drivers,
  totalLaps,
  currentLap,
  isPlaying,
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

  const startFinishPos = useMemo(() => {
    if (!projectedTrack) return null;
    return projectedTrack.points[0];
  }, [projectedTrack]);

  // Calculate raw (unsmoothed) driver positions, filtering DNS
  const rawDriverPositions = useMemo(() => {
    if (!projectedTrack) return [];

    return drivers
      .filter((d) => !isDNS(d))
      .map((driver) => {
        const progress = driver.trackProgress % 1;
        const point = getPositionOnTrack(projectedTrack.points, progress);
        return { driver, rawX: point.x, rawY: point.y };
      });
  }, [drivers, projectedTrack]);

  // Apply lerp smoothing and update cache
  const smoothedDrivers = useMemo<SmoothedDriver[]>(() => {
    const factor = isPlaying ? LERP_FACTOR : LERP_FACTOR_PAUSED;
    const newCache = new Map<string, { x: number; y: number }>();

    const result: SmoothedDriver[] = rawDriverPositions.map(({ driver, rawX, rawY }) => {
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
      return { ...driver, x, y };
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
    const offset = 9;
    const proximityThreshold = 20;

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
  }, [smoothedDrivers]);

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

        {startFinishPos && (
          <g>
            <line x1={startFinishPos.x - 8} y1={startFinishPos.y - 8} x2={startFinishPos.x + 8} y2={startFinishPos.y + 8} stroke="#ef4444" strokeWidth="3" opacity="0.8" />
            <line x1={startFinishPos.x - 8} y1={startFinishPos.y + 8} x2={startFinishPos.x + 8} y2={startFinishPos.y - 8} stroke="#ef4444" strokeWidth="3" opacity="0.8" />
          </g>
        )}

        {offsetDrivers.map((driver) => (
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
        ))}
      </svg>
    </div>
  );
}
