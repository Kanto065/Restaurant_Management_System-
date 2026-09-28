// Tiny geometry helpers for the Delivery Zones map. Shapes are [lat, lng] corner lists,
// the same form the API stores. Treating lat/lng as flat is fine at town scale.

export type LatLng = [number, number];

/** Ray casting - same rule the server uses to price an address. */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ay, ax] = polygon[i];
    const [by, bx] = polygon[j];
    if (ay > point[0] !== by > point[0] && point[1] < ((bx - ax) * (point[0] - ay)) / (by - ay) + ax) {
      inside = !inside;
    }
  }
  return inside;
}

function cross(o: LatLng, a: LatLng, b: LatLng) {
  return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
}

// ~5 metres in degrees. Neighbours drawn to share a border (or a corner where three meet)
// cross each other by centimetres once corners are rounded for storage - not a real overlap.
const CORNER_TOLERANCE = 5 / 111_000;

function closeTo(a: LatLng, b: LatLng) {
  return Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.62) < CORNER_TOLERANCE;
}

function segmentsCross(p1: LatLng, p2: LatLng, q1: LatLng, q2: LatLng): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  if (!(((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))) return false;

  const t = d1 / (d1 - d2);
  const at: LatLng = [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  if ([p1, p2, q1, q2].some((corner) => closeTo(corner, at))) return false;

  // A shared border runs (almost) parallel; a real overlap crosses at an angle.
  const u = [p2[0] - p1[0], p2[1] - p1[1]];
  const v = [q2[0] - q1[0], q2[1] - q1[1]];
  const sin = Math.abs(u[0] * v[1] - u[1] * v[0]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]));
  return sin > 0.02;
}

/** True when two shapes share any area (edges crossing, or one inside the other). Shapes
 *  that only touch along an edge don't count - neighbours drawn edge-to-edge are fine. */
export function polygonsOverlap(a: LatLng[], b: LatLng[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return pointInPolygon(centroid(a), b) || pointInPolygon(centroid(b), a);
}

export function centroid(polygon: LatLng[]): LatLng {
  const lat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  return [lat, lng];
}

/** Distinct, readable-on-a-map colours for new zones. */
export const ZONE_COLOURS = [
  '#e8823c', '#2f80ed', '#27ae60', '#9b51e0', '#eb5757', '#f2c94c', '#00a3a3', '#d6336c',
  '#6c7a89', '#8e5a2b', '#1f9d55', '#5b5bd6',
];
