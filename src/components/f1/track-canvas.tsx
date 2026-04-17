"use client";

import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { DriverPlaybackState } from "@/lib/types";
import { ProjectedTrack, projectTrackToSVG, getPositionOnTrack } from "@/lib/track-utils";
import { CircuitGeoJSON, GeoCoord } from "@/lib/types";
import { extractTrackCoords } from "@/lib/track-utils";

interface TrackCanvasProps {
  geoJSON: CircuitGeoJSON | null;
  drivers: DriverPlaybackState[];
  totalLaps: number;
  currentLap: number;
  isPlaying: boolean;
  onTrackReady?: (track: ProjectedTrack) => void;
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

  // Project the track to SVG coordinates
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

  // Notify parent when track is ready
  useEffect(() => {
    if (projectedTrack && onTrackReady) {
      onTrackReady(projectedTrack);
    }
  }, [projectedTrack, onTrackReady]);

  // Calculate driver positions on the track
  const driverPositions = useMemo(() => {
    if (!projectedTrack) return [];

    return drivers.map((driver) => {
      const progress = driver.trackProgress % 1;
      const point = getPositionOnTrack(projectedTrack.points, progress);
      return {
        ...driver,
        x: point.x,
        y: point.y,
      };
    });
  }, [drivers, projectedTrack]);

  // Start/finish line position
  const startFinishPos = useMemo(() => {
    if (!projectedTrack) return null;
    return projectedTrack.points[0];
  }, [projectedTrack]);

  // Group overlapping drivers to offset them
  const offsetDrivers = useMemo(() => {
    const offset = 8; // pixel offset for overlapping drivers
    const positionMap = new Map<string, { x: number; y: number }[]>();

    for (const driver of driverPositions) {
      const key = `${Math.round(driver.x / 15)},${Math.round(driver.y / 15)}`;
      if (!positionMap.has(key)) positionMap.set(key, []);
      positionMap.get(key)!.push(driver);
    }

    return driverPositions.map((driver) => {
      const key = `${Math.round(driver.x / 15)},${Math.round(driver.y / 15)}`;
      const group = positionMap.get(key) || [];
      const idx = group.findIndex((d) => d.driverId === driver.driverId);
      const total = group.length;

      if (total <= 1) return driver;

      // Offset in a small circle
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      return {
        ...driver,
        x: driver.x + Math.cos(angle) * offset,
        y: driver.y + Math.sin(angle) * offset,
      };
    });
  }, [driverPositions]);

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
      {/* Track name overlay */}
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
        {/* Background gradient */}
        <defs>
          <radialGradient id="trackGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
          {/* Glow filter for the track */}
          <filter id="trackGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Drop shadow for driver dots */}
          <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.8" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#trackGlow)" />

        {/* Track outline (wider, dim) */}
        <path
          ref={pathRef}
          d={projectedTrack.pathD}
          fill="none"
          stroke="#27272a"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Track surface */}
        <path
          d={projectedTrack.pathD}
          fill="none"
          stroke="#3f3f46"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Track center line (dashed) */}
        <path
          d={projectedTrack.pathD}
          fill="none"
          stroke="#52525b"
          strokeWidth="0.5"
          strokeDasharray="8 12"
          strokeLinecap="round"
        />

        {/* Kerb markers at start/finish */}
        {startFinishPos && (
          <g>
            <line
              x1={startFinishPos.x - 8}
              y1={startFinishPos.y - 8}
              x2={startFinishPos.x + 8}
              y2={startFinishPos.y + 8}
              stroke="#ef4444"
              strokeWidth="3"
              opacity="0.8"
            />
            <line
              x1={startFinishPos.x - 8}
              y1={startFinishPos.y + 8}
              x2={startFinishPos.x + 8}
              y2={startFinishPos.y - 8}
              stroke="#ef4444"
              strokeWidth="3"
              opacity="0.8"
            />
          </g>
        )}

        {/* Driver dots and labels */}
        {offsetDrivers.map((driver) => (
          <g key={driver.driverId}>
            {/* Outer glow */}
            <circle
              cx={driver.x}
              cy={driver.y}
              r="8"
              fill={driver.color}
              opacity="0.3"
              filter="url(#dotShadow)"
            />
            {/* Main dot */}
            <circle
              cx={driver.x}
              cy={driver.y}
              r="6"
              fill={driver.color}
              stroke="#09090b"
              strokeWidth="1.5"
            />
            {/* Driver code label */}
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
