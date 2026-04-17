import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json({ races });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
