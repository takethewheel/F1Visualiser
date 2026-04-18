import { NextRequest, NextResponse } from "next/server";

const ERGAST_BASE = "https://api.jolpi.ca/ergast/f1";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const round = searchParams.get("round");

  if (!year || !round) {
    return NextResponse.json(
      { error: "Year and round parameters required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${ERGAST_BASE}/${year}/${round}/pitstops.json?limit=100`
    );
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const pitStops = data.MRData?.RaceTable?.Races?.[0]?.PitStops || [];
    return NextResponse.json({ pitStops });
  } catch (error: any) {
    // Graceful degradation: return empty array on error
    return NextResponse.json({ pitStops: [], error: error.message }, { status: 200 });
  }
}
