// Geometry helpers for the Delivery Zones map. A zone's area is a list of rings (each a list
// of [lat, lng] corners) read with the even-odd rule, exactly like the server: a point is inside
// when it's inside an odd number of rings, so a ring inside another is a hole.

export type LatLng = [number, number];
export type Rings = LatLng[][];

/** Ray casting on one ring. */
export function pointInRing(point: LatLng, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ay, ax] = ring[i];
    const [by, bx] = ring[j];
    if (ay > point[0] !== by > point[0] && point[1] < ((bx - ax) * (point[0] - ay)) / (by - ay) + ax) {
      inside = !inside;
    }
  }
  return inside;
}

/** Even-odd over all of a zone's rings - the same rule the server prices with. */
export function pointInArea(point: LatLng, rings: Rings): boolean {
  let inside = false;
  for (const ring of rings) if (ring.length >= 3 && pointInRing(point, ring)) inside = !inside;
  return inside;
}

export function bounds(rings: Rings) {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const ring of rings) for (const [lat, lng] of ring) {
    s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lng); e = Math.max(e, lng);
  }
  return { s, w, n, e };
}

/**
 * True when two zones share real area. Checked by sampling a grid over where their boxes
 * overlap: neighbours drawn edge-to-edge (or auto-drawn, with borders smoothed a few metres
 * apart) touch along thin slivers, which only ever catch the odd sample - not an overlap.
 */
export function areasOverlap(a: Rings, b: Rings): boolean {
  const ba = bounds(a);
  const bb = bounds(b);
  const s = Math.max(ba.s, bb.s), n = Math.min(ba.n, bb.n);
  const w = Math.max(ba.w, bb.w), e = Math.min(ba.e, bb.e);
  if (s >= n || w >= e) return false;

  // A real overlap has ground well inside both shapes. Neighbours whose borders don't quite
  // line up (an auto-drawn area next to a hand-drawn curve) only share a thin sliver, where
  // every shared point is within a few tens of metres of a border - not worth a warning.
  const steps = 40;
  let deep = 0;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const p: LatLng = [s + ((n - s) * i) / steps, w + ((e - w) * j) / steps];
      if (pointInArea(p, a) && pointInArea(p, b)
          && metresToEdge(p, a) > SLIVER_METRES && metresToEdge(p, b) > SLIVER_METRES && ++deep >= 2) return true;
    }
  }
  return false;
}

const SLIVER_METRES = 30;

/** Distance from a point to the nearest border of an area, in metres (flat, town scale). */
export function metresToEdge(point: LatLng, rings: Rings): number {
  const kx = 111_320 * Math.cos((point[0] * Math.PI) / 180);
  const ky = 110_574;
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][1] - point[1]) * kx, ay = (ring[j][0] - point[0]) * ky;
      const bx = (ring[i][1] - point[1]) * kx, by = (ring[i][0] - point[0]) * ky;
      const dx = bx - ax, dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

/** Distinct, readable-on-a-map colours for new zones. */
export const ZONE_COLOURS = [
  '#e8823c', '#2f80ed', '#27ae60', '#9b51e0', '#eb5757', '#f2c94c', '#00a3a3', '#d6336c',
  '#6c7a89', '#8e5a2b', '#1f9d55', '#5b5bd6',
];
