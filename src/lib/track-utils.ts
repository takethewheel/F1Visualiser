// ============================================================
// Track Geometry Utilities
// ============================================================

import { GeoCoord, TrackPoint, CircuitGeoJSON } from "./types";

/** Result of projecting a track to SVG coordinates */
export interface ProjectedTrack {
  /** SVG path d-attribute string */
  pathD: string;
  /** Array of projected SVG points */
  points: TrackPoint[];
  /** Total path length in SVG units (approximate) */
  totalLength: number;
  /** Bounding box in SVG coords */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** SVG viewBox string */
  viewBox: string;
}

/**
 * Project GeoJSON coordinates onto an SVG viewport.
 * Maintains aspect ratio and adds padding.
 */
export function projectTrackToSVG(
  coords: GeoCoord[],
  svgWidth: number = 800,
  svgHeight: number = 600,
  padding: number = 40
): ProjectedTrack {
  if (coords.length < 2) {
    throw new Error("Track must have at least 2 coordinates");
  }

  // Calculate bounding box
  let minLon = Infinity,
    maxLon = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const lonRange = maxLon - minLon || 0.001;
  const latRange = maxLat - minLat || 0.001;

  // Available drawing area
  const drawWidth = svgWidth - 2 * padding;
  const drawHeight = svgHeight - 2 * padding;

  // Calculate scale to fit (maintain aspect ratio)
  const scaleX = drawWidth / lonRange;
  const scaleY = drawHeight / latRange;
  const scale = Math.min(scaleX, scaleY);

  // Center offset
  const projectedWidth = lonRange * scale;
  const projectedHeight = latRange * scale;
  const offsetX = padding + (drawWidth - projectedWidth) / 2;
  const offsetY = padding + (drawHeight - projectedHeight) / 2;

  // Project each coordinate (flip Y-axis for SVG)
  const points: TrackPoint[] = coords.map(([lon, lat]) => ({
    x: offsetX + (lon - minLon) * scale,
    y: offsetY + (maxLat - lat) * scale, // flip Y
  }));

  // Build SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ") + " Z"; // Close the loop

  // Calculate approximate total path length
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  // Add closing segment
  const dx = points[0].x - points[points.length - 1].x;
  const dy = points[0].y - points[points.length - 1].y;
  totalLength += Math.sqrt(dx * dx + dy * dy);

  const bounds = {
    minX: padding,
    minY: padding,
    maxX: svgWidth - padding,
    maxY: svgHeight - padding,
  };

  return {
    pathD,
    points,
    totalLength,
    bounds,
    viewBox: `0 0 ${svgWidth} ${svgHeight}`,
  };
}

/**
 * Get the position on a track at a given progress (0.0 to 1.0).
 * Returns interpolated SVG coordinates.
 */
export function getPositionOnTrack(
  points: TrackPoint[],
  progress: number
): TrackPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };

  // Progress is 0.0 to 1.0 representing one full lap
  const p = ((progress % 1) + 1) % 1; // normalize to 0-1

  // Calculate cumulative distances
  const distances: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalDist += Math.sqrt(dx * dx + dy * dy);
    distances.push(totalDist);
  }
  // Closing segment
  const dx = points[0].x - points[points.length - 1].x;
  const dy = points[0].y - points[points.length - 1].y;
  totalDist += Math.sqrt(dx * dx + dy * dy);

  const targetDist = p * totalDist;

  // Find the segment containing targetDist
  // Check closing segment first
  if (targetDist >= distances[distances.length - 1]) {
    const segDist = targetDist - distances[distances.length - 1];
    const segLength = totalDist - distances[distances.length - 1];
    const t = segLength > 0 ? segDist / segLength : 0;
    return {
      x: points[points.length - 1].x + t * (points[0].x - points[points.length - 1].x),
      y: points[points.length - 1].y + t * (points[0].y - points[points.length - 1].y),
    };
  }

  // Binary search for the right segment
  let lo = 0,
    hi = distances.length - 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (distances[mid + 1] < targetDist) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const segStart = distances[lo];
  const segEnd = distances[lo + 1];
  const segLength = segEnd - segStart;
  const t = segLength > 0 ? (targetDist - segStart) / segLength : 0;

  return {
    x: points[lo].x + t * (points[lo + 1].x - points[lo].x),
    y: points[lo].y + t * (points[lo + 1].y - points[lo].y),
  };
}

/**
 * Parse a GeoJSON response and extract the track coordinates.
 */
export function extractTrackCoords(geojson: CircuitGeoJSON): GeoCoord[] {
  if (
    !geojson.features ||
    geojson.features.length === 0 ||
    !geojson.features[0].geometry ||
    !geojson.features[0].geometry.coordinates
  ) {
    throw new Error("Invalid GeoJSON: no track coordinates found");
  }
  return geojson.features[0].geometry.coordinates as GeoCoord[];
}
