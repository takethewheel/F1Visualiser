import { NextRequest, NextResponse } from "next/server";

const F1CIRCUITS_RAW =
  "https://raw.githubusercontent.com/SergioSediq/f1-circuits/main";
import { ERGAST_TO_F1CIRCUITS } from "@/lib/circuit-map";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const circuitId = searchParams.get("circuitId"); // Ergast circuit ID

  if (!circuitId) {
    return NextResponse.json(
      { error: "circuitId parameter required" },
      { status: 400 }
    );
  }

  const f1CircuitsId = ERGAST_TO_F1CIRCUITS[circuitId];
  if (!f1CircuitsId) {
    return NextResponse.json(
      { error: `No circuit mapping found for ${circuitId}` },
      { status: 404 }
    );
  }

  try {
    const res = await fetch(`${F1CIRCUITS_RAW}/circuits/${f1CircuitsId}.geojson`);
    if (!res.ok) {
      // Try combined file
      const fallbackRes = await fetch(`${F1CIRCUITS_RAW}/f1-circuits.geojson`);
      if (!fallbackRes.ok) {
        throw new Error("Failed to fetch circuit data");
      }
      const allCircuits = await fallbackRes.json();
      const feature = allCircuits.features?.find(
        (f: any) => f.properties?.id === f1CircuitsId
      );
      if (!feature) {
        throw new Error(`Circuit ${f1CircuitsId} not found`);
      }
      return NextResponse.json({
        type: "FeatureCollection",
        features: [feature],
      });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
