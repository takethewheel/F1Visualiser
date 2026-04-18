"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Gauge,
  Car,
  Circle,
} from "lucide-react";
import { RaceEvent } from "@/lib/types";

const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "2x", value: 2 },
  { label: "5x", value: 5 },
  { label: "10x", value: 10 },
  { label: "20x", value: 20 },
  { label: "50x", value: 50 },
  { label: "100x", value: 100 },
];

interface RaceControlsProps {
  isPlaying: boolean;
  speedMultiplier: number;
  currentTime: number;
  maxTime: number;
  currentLap: number;
  totalLaps: number;
  showCars: boolean;
  raceEvents: RaceEvent[];
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (time: number) => void;
  onReset: () => void;
  onToggleCars: () => void;
}

function getEventIcon(type: RaceEvent["type"]): { symbol: string; color: string } {
  switch (type) {
    case "retirement":
      return { symbol: "✕", color: "#ef4444" };
    case "fastest_lap":
      return { symbol: "★", color: "#a855f7" };
    case "pit_stop":
      return { symbol: "⊞", color: "#f59e0b" };
    default:
      return { symbol: "•", color: "#71717a" };
  }
}

export default function RaceControls({
  isPlaying,
  speedMultiplier,
  currentTime,
  maxTime,
  currentLap,
  totalLaps,
  showCars,
  raceEvents,
  onPlayPause,
  onSpeedChange,
  onSeek,
  onReset,
  onToggleCars,
}: RaceControlsProps) {
  const progress = maxTime > 0 ? (currentTime / maxTime) * 100 : 0;

  const formatRaceTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return "0:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 px-4 py-3">
      {/* Progress bar + event markers */}
      <div className="mb-3">
        <div className="relative">
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={(value) => {
              onSeek((value[0] / 100) * maxTime);
            }}
            className="cursor-pointer"
          />
          {/* Race event markers overlaid on the progress bar */}
          {raceEvents.length > 0 && (
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none" style={{ height: "20px" }}>
              {raceEvents.map((event, i) => {
                const pct = maxTime > 0 ? (event.time / maxTime) * 100 : 0;
                if (pct < 0 || pct > 100) return null;
                const { symbol, color } = getEventIcon(event.type);
                return (
                  <button
                    key={`${event.type}-${event.driverCode}-${i}`}
                    className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 top-1/2 cursor-pointer hover:scale-150 transition-transform"
                    style={{ left: `${pct}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(event.time);
                    }}
                    title={event.description}
                  >
                    <span
                      className="text-[10px] leading-none drop-shadow-md"
                      style={{ color }}
                    >
                      {symbol}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-zinc-600 tabular-nums">
          <span>{formatRaceTime(currentTime)}</span>
          <span>
            Lap {currentLap} / {totalLaps}
          </span>
          <span>{formatRaceTime(maxTime)}</span>
        </div>
        {/* Event legend */}
        {raceEvents.length > 0 && (
          <div className="flex items-center gap-3 mt-1 text-[9px] text-zinc-600">
            <span className="flex items-center gap-1">
              <span style={{ color: "#ef4444" }}>✕</span> DNF
            </span>
            <span className="flex items-center gap-1">
              <span style={{ color: "#a855f7" }}>★</span> Fastest Lap
            </span>
          </div>
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Transport controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
            onClick={onReset}
            title="Reset (R)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
            onClick={() => onSeek(Math.max(0, currentTime - 30))}
            title="Back 30s (←)"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant={isPlaying ? "default" : "outline"}
            size="icon"
            className={`h-10 w-10 rounded-full ${
              isPlaying
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "border-zinc-600 text-zinc-300 hover:text-zinc-100 hover:border-zinc-400"
            }`}
            onClick={onPlayPause}
            title="Play/Pause (Space)"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
            onClick={() => onSeek(Math.min(maxTime, currentTime + 30))}
            title="Forward 30s (→)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Center: Car/Dot toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant={showCars ? "default" : "ghost"}
            size="icon"
            className={`h-8 w-8 ${showCars ? "bg-red-600 hover:bg-red-700 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
            onClick={onToggleCars}
            title={showCars ? "Show dots" : "Show F1 cars"}
          >
            <Car className="h-4 w-4" />
          </Button>
          <Button
            variant={!showCars ? "default" : "ghost"}
            size="icon"
            className={`h-8 w-8 ${!showCars ? "bg-red-600 hover:bg-red-700 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
            onClick={onToggleCars}
            title={showCars ? "Show dots" : "Show F1 cars"}
          >
            <Circle className="h-3 w-3" />
          </Button>
        </div>

        {/* Right: Speed selector */}
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-zinc-500" />
          <Select
            value={speedMultiplier.toString()}
            onValueChange={(v) => onSpeedChange(parseFloat(v))}
          >
            <SelectTrigger className="w-[72px] h-8 text-xs border-zinc-700 bg-zinc-900 text-zinc-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {SPEED_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value.toString()}
                  className="text-zinc-300 text-xs focus:bg-zinc-800 focus:text-zinc-100"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
