"use client";

import React from "react";
import { DriverPlaybackState } from "@/lib/types";

interface LeaderboardProps {
  drivers: DriverPlaybackState[];
  currentLap: number;
  totalLaps: number;
  raceName: string;
}

export default function Leaderboard({
  drivers,
  currentLap,
  totalLaps,
  raceName,
}: LeaderboardProps) {
  // Sort drivers by position
  const sortedDrivers = [...drivers].sort(
    (a, b) => a.position - b.position
  );

  return (
    <div className="h-full flex flex-col bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
          Standings
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">{raceName}</p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[28px_1fr_70px_50px] gap-1 px-4 py-1.5 text-[10px] text-zinc-600 uppercase tracking-wider border-b border-zinc-800/50 bg-zinc-900/30">
        <span>Pos</span>
        <span>Driver</span>
        <span>Gap</span>
        <span>Lap</span>
      </div>

      {/* Driver list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sortedDrivers.map((driver) => (
          <div
            key={driver.driverId}
            className={`
              grid grid-cols-[28px_1fr_70px_50px] gap-1 px-4 py-1.5
              items-center text-xs border-b border-zinc-800/30
              hover:bg-zinc-800/40 transition-colors
              ${driver.position <= 3 ? "bg-zinc-800/20" : ""}
              ${driver.finished ? "opacity-80" : ""}
            `}
          >
            {/* Position */}
            <span
              className={`font-bold text-center ${
                driver.position === 1
                  ? "text-yellow-400"
                  : driver.position === 2
                  ? "text-zinc-300"
                  : driver.position === 3
                  ? "text-amber-600"
                  : "text-zinc-500"
              }`}
            >
              {driver.position}
            </span>

            {/* Driver name + team color */}
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-1.5 h-6 rounded-full flex-shrink-0"
                style={{ backgroundColor: driver.color }}
              />
              <div className="min-w-0">
                <div className="font-semibold text-zinc-200 truncate text-[11px]">
                  {driver.code}
                </div>
                <div className="text-[9px] text-zinc-600 truncate">
                  {driver.teamName}
                </div>
              </div>
            </div>

            {/* Gap */}
            <span className="text-zinc-500 text-[10px] tabular-nums">
              {driver.position === 1
                ? "Leader"
                : driver.gapToLeader || "---"}
            </span>

            {/* Lap */}
            <span className="text-zinc-500 text-[10px] tabular-nums text-right">
              {driver.lap}
            </span>
          </div>
        ))}

        {sortedDrivers.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
            No driver data
          </div>
        )}
      </div>
    </div>
  );
}
