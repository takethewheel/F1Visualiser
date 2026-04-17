import { NextRequest, NextResponse } from "next/server";

const ERGAST_BASE = "https://api.jolpi.ca/ergast/f1";
const F1CIRCUITS_RAW =
  "https://raw.githubusercontent.com/SergioSediq/f1-circuits/main";

import { ERGAST_TO_F1CIRCUITS } from "@/lib/circuit-map";

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
    // 1. Fetch race results
    const resultsRes = await fetch(
      `${ERGAST_BASE}/${year}/${round}/results.json?limit=30`
    );
    if (!resultsRes.ok) throw new Error(`Results API error: ${resultsRes.status}`);
    const resultsData = await resultsRes.json();
    const raceInfo = resultsData.MRData.RaceTable.Races?.[0];

    if (!raceInfo) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const results = raceInfo.Results || [];
    const circuitId = raceInfo.Circuit.circuitId;

    // 2. Fetch lap data for each driver in parallel
    const lapPromises = results.map(
      (result: any) =>
        fetch(
          `${ERGAST_BASE}/${year}/${round}/drivers/${result.Driver.driverId}/laps.json?limit=100`
        )
          .then((r) => r.json())
          .then((d) => d.MRData.RaceTable.Races?.[0]?.Laps || [])
          .catch(() => [])
    );
    const allLaps = await Promise.all(lapPromises);

    // 3. Fetch circuit GeoJSON
    const f1CircuitsId = ERGAST_TO_F1CIRCUITS[circuitId];
    let circuitGeoJSON = null;
    if (f1CircuitsId) {
      try {
        const geoRes = await fetch(
          `${F1CIRCUITS_RAW}/circuits/${f1CircuitsId}.geojson`
        );
        if (geoRes.ok) {
          circuitGeoJSON = await geoRes.json();
        } else {
          // Try combined file
          const fallbackRes = await fetch(
            `${F1CIRCUITS_RAW}/f1-circuits.geojson`
          );
          if (fallbackRes.ok) {
            const allCircuits = await fallbackRes.json();
            const feature = allCircuits.features?.find(
              (f: any) => f.properties?.id === f1CircuitsId
            );
            if (feature) {
              circuitGeoJSON = {
                type: "FeatureCollection",
                features: [feature],
              };
            }
          }
        }
      } catch {
        // Circuit data not available, continue without it
      }
    }

    return NextResponse.json({
      raceInfo: {
        raceName: raceInfo.raceName,
        circuitId,
        circuitName: raceInfo.Circuit.circuitName,
        country: raceInfo.Circuit.Location.country,
        locality: raceInfo.Circuit.Location.locality,
        season: parseInt(year),
        round: parseInt(round),
      },
      results,
      laps: allLaps,
      circuitGeoJSON,
      f1CircuitsId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
