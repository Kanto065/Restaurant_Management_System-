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

  // Count the shared area, not shared samples: a long border sliver catches many samples but
  // adds up to little ground. Under ~1.5 hectares (a 120 m square) isn't worth a warning.
  const steps = 40;
  const cellSqMetres = (((n - s) / steps) * 110_574) * (((e - w) / steps) * 111_320 * Math.cos((s * Math.PI) / 180));
  let both = 0;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const p: LatLng = [s + ((n - s) * i) / steps, w + ((e - w) * j) / steps];
      if (pointInArea(p, a) && pointInArea(p, b) && ++both * cellSqMetres >= 15_000 && both >= 3) return true;
    }
  }
  return false;
}

/** Distinct, readable-on-a-map colours for new zones. */
export const ZONE_COLOURS = [
  '#e8823c', '#2f80ed', '#27ae60', '#9b51e0', '#eb5757', '#f2c94c', '#00a3a3', '#d6336c',
  '#6c7a89', '#8e5a2b', '#1f9d55', '#5b5bd6',
];
