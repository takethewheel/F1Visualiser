import { NextResponse } from "next/server";

const ERGAST_BASE = "https://api.jolpi.ca/ergast/f1";

export async function GET() {
  try {
    const res = await fetch(`${ERGAST_BASE}/seasons.json?limit=100`);
    if (!res.ok) throw new Error(`Ergast API error: ${res.status}`);
    const data = await res.json();
    const seasons = data.MRData.SeasonTable.Seasons.map(
      (s: { season: string }) => s.season
    ).reverse();
    return NextResponse.json({ seasons });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
