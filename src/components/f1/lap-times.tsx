"use client";

import React from "react";
import { DriverPlaybackState } from "@/lib/types";

interface LapTimesProps {
  drivers: DriverPlaybackState[];
  raceName: string;
}

/** Format seconds into F1-style lap time string: "1:23.456" or "23.456" */
function formatLapTime(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds) || seconds <= 0) return "---";
  if (seconds < 60) {
    return seconds.toFixed(3);
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

function isDNS(driver: DriverPlaybackState): boolean {
  return driver.status.toLowerCase() === "dns";
}

function isDNF(driver: DriverPlaybackState): boolean {
  const s = driver.status.toLowerCase();
  // computeStates sets status to exactly "DNF" for retired drivers
  if (s === "dnf") return true;
  // Also catch raw Ergast retirement statuses that might leak through
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

export default function LapTimes({ drivers, raceName }: LapTimesProps) {
  const activeDrivers = drivers.filter((d) => !isDNS(d) && !isDNF(d));
  const dnfDrivers = drivers.filter((d) => isDNF(d));
  const dnsDrivers = drivers.filter((d) => isDNS(d));

  // Find the overall fastest lap across all active drivers
  const allFastest = activeDrivers
    .map((d) => d.fastestLapTime)
    .filter((t): t is number => t !== null && isFinite(t));
  const overallFastest = allFastest.length > 0 ? Math.min(...allFastest) : null;

  const sortedActive = [...activeDrivers].sort((a, b) => a.position - b.position);

  return (
    <div className="h-full flex flex-col bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
          Lap Times
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">{raceName}</p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_62px_62px_62px] gap-1 px-4 py-1.5 text-[10px] text-zinc-600 uppercase tracking-wider border-b border-zinc-800/50 bg-zinc-900/30">
        <span>Driver</span>
        <span className="text-right">Current</span>
        <span className="text-right">Previous</span>
        <span className="text-right">Fastest</span>
      </div>

      {/* Driver list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sortedActive.map((driver) => {
          const isOverallFastest =
            overallFastest !== null &&
            driver.fastestLapTime !== null &&
            Math.abs(driver.fastestLapTime - overallFastest) < 0.001;

          return (
            <div
              key={driver.driverId}
              className={`
                grid grid-cols-[1fr_62px_62px_62px] gap-1 px-4 py-1.5
                items-center text-xs border-b border-zinc-800/30
                hover:bg-zinc-800/40 transition-colors
                ${driver.position <= 3 ? "bg-zinc-800/20" : ""}
                ${driver.finished ? "opacity-70" : ""}
              `}
            >
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
                    L{driver.lap}
                  </div>
                </div>
              </div>

              {/* Current lap time */}
              <span className="text-zinc-400 text-[10px] tabular-nums text-right font-mono">
                {driver.currentLapTime !== null ? formatLapTime(driver.currentLapTime) : "---"}
              </span>

              {/* Previous lap time */}
              <span className="text-zinc-300 text-[10px] tabular-nums text-right font-mono">
                {formatLapTime(driver.previousLapTime)}
              </span>

              {/* Fastest lap time */}
              <span
                className={`text-[10px] tabular-nums text-right font-mono ${
                  isOverallFastest
                    ? "text-purple-400 font-bold"
                    : "text-zinc-400"
                }`}
              >
                {isOverallFastest ? "\u2B50" : ""}
                {formatLapTime(driver.fastestLapTime)}
              </span>
            </div>
          );
        })}

        {/* DNF drivers section */}
        {dnfDrivers.length > 0 && (
          <>
            <div className="px-4 py-1 text-[9px] text-red-500/70 uppercase tracking-wider border-t border-zinc-700/50 bg-zinc-900/20">
              Retired (DNF)
            </div>
            {dnfDrivers.map((driver) => (
              <div
                key={driver.driverId}
                className="grid grid-cols-[1fr_62px_62px_62px] gap-1 px-4 py-1.5 items-center text-xs border-b border-zinc-800/20 opacity-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-1.5 h-6 rounded-full flex-shrink-0 opacity-50"
                    style={{ backgroundColor: driver.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-500 truncate text-[11px]">
                      {driver.code}
                    </div>
                    <div className="text-[9px] text-red-600/60 truncate">DNF</div>
                  </div>
                </div>
                <span className="text-zinc-700 text-[10px] text-right font-mono">---</span>
                <span className="text-zinc-600 text-[10px] text-right font-mono">
                  {formatLapTime(driver.previousLapTime)}
                </span>
                <span className="text-zinc-600 text-[10px] text-right font-mono">
                  {formatLapTime(driver.fastestLapTime)}
                </span>
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
                className="grid grid-cols-[1fr_62px_62px_62px] gap-1 px-4 py-1.5 items-center text-xs border-b border-zinc-800/20 opacity-40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-1.5 h-6 rounded-full flex-shrink-0 opacity-50"
                    style={{ backgroundColor: driver.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-500 truncate text-[11px]">
                      {driver.code}
                    </div>
                    <div className="text-[9px] text-zinc-700 truncate">DNS</div>
                  </div>
                </div>
                <span className="text-zinc-700 text-[10px] text-right font-mono">---</span>
                <span className="text-zinc-700 text-[10px] text-right font-mono">---</span>
                <span className="text-zinc-700 text-[10px] text-right font-mono">---</span>
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
