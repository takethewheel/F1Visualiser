"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";

interface RaceSelectorProps {
  onYearChange: (year: number) => void;
  onRaceChange: (round: number) => void;
  onRandomRace: () => void;
  selectedYear: number | null;
  selectedRound: number | null;
  availableYears: number[];
  races: { round: number; raceName: string; circuitName: string }[];
  isLoading: boolean;
}

export default function RaceSelector({
  onYearChange,
  onRaceChange,
  onRandomRace,
  selectedYear,
  selectedRound,
  availableYears,
  races,
  isLoading,
}: RaceSelectorProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Year selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
          Year
        </span>
        <Select
          value={selectedYear?.toString() || ""}
          onValueChange={(v) => onYearChange(parseInt(v))}
          disabled={isLoading || availableYears.length === 0}
        >
          <SelectTrigger className="w-[90px] h-8 text-xs border-zinc-700 bg-zinc-900 text-zinc-300">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[200px]">
            {availableYears.map((year) => (
              <SelectItem
                key={year}
                value={year.toString()}
                className="text-zinc-300 text-xs focus:bg-zinc-800 focus:text-zinc-100"
              >
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Race selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
          Race
        </span>
        <Select
          value={selectedRound?.toString() || ""}
          onValueChange={(v) => onRaceChange(parseInt(v))}
          disabled={isLoading || races.length === 0}
        >
          <SelectTrigger className="w-[200px] h-8 text-xs border-zinc-700 bg-zinc-900 text-zinc-300">
            <SelectValue placeholder="Select race" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[200px]">
            {races.map((race) => (
              <SelectItem
                key={race.round}
                value={race.round.toString()}
                className="text-zinc-300 text-xs focus:bg-zinc-800 focus:text-zinc-100"
              >
                R{race.round} — {race.raceName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Random race button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRandomRace}
        disabled={isLoading}
        className="h-8 text-xs border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500"
      >
        <Shuffle className="h-3.5 w-3.5 mr-1.5" />
        Random
      </Button>
    </div>
  );
}
