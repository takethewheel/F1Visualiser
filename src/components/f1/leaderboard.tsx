"use client";

import React from "react";
import { DriverPlaybackState } from "@/lib/types";

interface LeaderboardProps {
  drivers: DriverPlaybackState[];
  currentLap: number;
  totalLaps: number;
  raceName: string;
}

function isDNS(driver: DriverPlaybackState): boolean {
  return driver.status.toLowerCase() === "dns";
}

function isDNF(driver: DriverPlaybackState): boolean {
  const s = driver.status.toLowerCase();
  // computeStates is the single source of truth; it sets status to exactly "DNF"
  // for retired drivers and "DNS" for non-starters
  if (s === "dnf") return true;
  // Also catch raw Ergast retirement statuses that might leak through
  // (Engine, Accident, Gearbox, Retired, etc.)
  if (driver.lap > 0 || driver.trackProgress > 0) {
    if (
      s !== "finished" &&
      s !== "dns" &&
      !s.startsWith("+") &&
      !s.includes("ready") &&
      !s.includes("loading") &&
      !s.includes("no lap data") &&
      s.length > 0
    ) {
      return true;
    }
  }
  return false;
}

export default function Leaderboard({
  drivers,
  currentLap,
  totalLaps,
  raceName,
}: LeaderboardProps) {
  // Separate active, DNF, and DNS drivers
  const activeDrivers = drivers.filter((d) => !isDNS(d) && !isDNF(d));
  const dnfDrivers = drivers.filter((d) => isDNF(d));
  const dnsDrivers = drivers.filter((d) => isDNS(d));

  // Sort active drivers by position
  const sortedActive = [...activeDrivers].sort(
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
        {sortedActive.map((driver) => (
          <div
            key={driver.driverId}
            className={`
              grid grid-cols-[28px_1fr_70px_50px] gap-1 px-4 py-1.5
              items-center text-xs border-b border-zinc-800/30
              hover:bg-zinc-800/40 transition-colors
              ${driver.position <= 3 ? "bg-zinc-800/20" : ""}
              ${driver.finished ? "opacity-70" : ""}
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

        {/* DNF drivers section */}
        {dnfDrivers.length > 0 && (
          <>
            <div className="px-4 py-1 text-[9px] text-red-500/70 uppercase tracking-wider border-t border-zinc-700/50 bg-zinc-900/20">
              Retired (DNF)
            </div>
            {dnfDrivers.map((driver) => (
              <div
                key={driver.driverId}
                className="grid grid-cols-[28px_1fr_70px_50px] gap-1 px-4 py-1.5 items-center text-xs border-b border-zinc-800/20 opacity-50"
              >
                <span className="text-zinc-600 text-center text-[10px]">—</span>
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-1.5 h-6 rounded-full flex-shrink-0 opacity-50"
                    style={{ backgroundColor: driver.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-500 truncate text-[11px]">
                      {driver.code}
                    </div>
                    <div className="text-[9px] text-red-600/60 truncate">
                      DNF
                    </div>
                  </div>
                </div>
                <span className="text-red-600/50 text-[10px]">DNF</span>
                <span className="text-zinc-700 text-[10px] text-right">{driver.lap}</span>
              </div>
            ))}
          </>
        )}

        {/* DNS drivers section */}
        {dnsDrivers.length > 0 && (
          <>
            <div className="px-4 py-1 text-[9px] text-zinc-600 uppercase tracking-wider border-t border-zinc-700/50 bg-zinc-900/20">
              Did Not Start
            </div>
            {dnsDrivers.map((driver) => (
              <div
                key={driver.driverId}
                className="grid grid-cols-[28px_1fr_70px_50px] gap-1 px-4 py-1.5 items-center text-xs border-b border-zinc-800/20 opacity-40"
              >
                <span className="text-zinc-600 text-center text-[10px]">—</span>
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-1.5 h-6 rounded-full flex-shrink-0 opacity-50"
                    style={{ backgroundColor: driver.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-500 truncate text-[11px]">
                      {driver.code}
                    </div>
                    <div className="text-[9px] text-zinc-700 truncate">
                      DNS
                    </div>
                  </div>
                </div>
                <span className="text-zinc-700 text-[10px]">DNS</span>
                <span className="text-zinc-700 text-[10px] text-right">—</span>
              </div>
            ))}
          </>
        )}

        {sortedActive.length === 0 && dnfDrivers.length === 0 && dnsDrivers.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
            No driver data
          </div>
        )}
      </div>
    </div>
  );
}
