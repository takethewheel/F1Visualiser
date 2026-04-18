import { NextRequest, NextResponse } from "next/server";
import { ERGAST_TO_F1CIRCUITS } from "@/lib/circuit-map";

const ERGAST_BASE = "https://api.jolpi.ca/ergast/f1";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  if (!year) {
    return NextResponse.json({ error: "Year parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ERGAST_BASE}/${year}/races.json?limit=30`);
    if (!res.ok) throw new Error(`Ergast API error: ${res.status}`);
    const data = await res.json();
    const races = data.MRData.RaceTable.Races;

    // Annotate each race with availability flags
    const now = new Date();
    const annotatedRaces = races.map((r: any) => {
      const circuitId = r.Circuit?.circuitId || "";
      const hasTrack = circuitId in ERGAST_TO_F1CIRCUITS;

      // Check if the race has already taken place
      // The date field is like "2024-03-02", time is optional like "15:00:00Z"
      const raceDateStr = r.date || "";
      const raceTimeStr = r.time || "";
      const raceDateTime = new Date(`${raceDateStr}T${raceTimeStr || "23:59:59Z"}`);
      const hasResults = !isNaN(raceDateTime.getTime()) && raceDateTime < now;

      return {
        ...r,
        hasTrack,
        hasResults,
      };
    });

    return NextResponse.json({ races: annotatedRaces });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
