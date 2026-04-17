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
} from "lucide-react";

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
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (time: number) => void;
  onReset: () => void;
}

export default function RaceControls({
  isPlaying,
  speedMultiplier,
  currentTime,
  maxTime,
  currentLap,
  totalLaps,
  onPlayPause,
  onSpeedChange,
  onSeek,
  onReset,
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
      {/* Progress bar */}
      <div className="mb-3">
        <Slider
          value={[progress]}
          max={100}
          step={0.1}
          onValueChange={(value) => {
            onSeek((value[0] / 100) * maxTime);
          }}
          className="cursor-pointer"
        />
        <div className="flex justify-between mt-1 text-[10px] text-zinc-600 tabular-nums">
          <span>{formatRaceTime(currentTime)}</span>
          <span>
            Lap {currentLap} / {totalLaps}
          </span>
          <span>{formatRaceTime(maxTime)}</span>
        </div>
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
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
            onClick={() => onSeek(Math.max(0, currentTime - 30))}
            title="Back 30s"
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
            title="Forward 30s"
          >
            <SkipForward className="h-4 w-4" />
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
