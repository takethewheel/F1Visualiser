import { NextRequest, NextResponse } from "next/server";

const ERGAST_BASE = "https://api.jolpi.ca/ergast/f1";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const round = searchParams.get("round");
  const driverId = searchParams.get("driverId");

  if (!year || !round || !driverId) {
    return NextResponse.json(
      { error: "year, round, and driverId parameters required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${ERGAST_BASE}/${year}/${round}/drivers/${driverId}/laps.json?limit=100`
    );
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const laps = data.MRData?.RaceTable?.Races?.[0]?.Laps || [];
    return NextResponse.json({ laps });
  } catch (error: any) {
    return NextResponse.json({ laps: [], error: error.message }, { status: 200 });
  }
}
