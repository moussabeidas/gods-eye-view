// Small, dependency-free geodesy helpers shared by the browser and the API.

const EARTH_RADIUS_M = 6371008.8;
const M_PER_DEG_LAT = 111320;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two [lon, lat] positions. */
export function distanceM([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Move a [lon, lat] position by metres east (dx) and north (dy). */
export function offset([lon, lat], dx, dy) {
  return [lon + dx / (M_PER_DEG_LAT * Math.cos(toRad(lat))), lat + dy / M_PER_DEG_LAT];
}

/** A closed ring for a rectangle of w×h metres rotated by `bearingDeg`. */
export function rectangle(center, w, h, bearingDeg = 0) {
  const r = toRad(bearingDeg);
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => {
    const dx = x * Math.cos(r) - y * Math.sin(r);
    const dy = x * Math.sin(r) + y * Math.cos(r);
    return offset(center, dx, dy);
  });
  return [...corners, corners[0]];
}

/** A closed ring for an arbitrary polygon given as metre offsets from `center`. */
export function ringFromOffsets(center, offsets) {
  const ring = offsets.map(([dx, dy]) => offset(center, dx, dy));
  return [...ring, ring[0]];
}

/** A closed ring approximating a circle of `radiusM` metres. */
export function circle(center, radiusM, steps = 72) {
  const ring = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push(offset(center, radiusM * Math.cos(a), radiusM * Math.sin(a)));
  }
  return [...ring, ring[0]];
}

/** Planar area in m² of a closed [lon, lat] ring (accurate at plot scale). */
export function ringAreaM2(ring) {
  const lat0 = toRad(ring[0][1]);
  const kx = M_PER_DEG_LAT * Math.cos(lat0);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * kx * (y2 * M_PER_DEG_LAT) - x2 * kx * (y1 * M_PER_DEG_LAT);
  }
  return Math.abs(sum / 2);
}

/** Vertex-average centroid of a closed ring. */
export function ringCentroid(ring) {
  const pts = ring.slice(0, -1);
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lon, lat];
}

/** Bounding box [[minLon, minLat], [maxLon, maxLat]] of positions. */
export function bounds(positions) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of positions) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/** Deterministic PRNG (mulberry32) so simulated data is identical every run. */
export function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Signed planar area in m² (positive when the ring runs counter-clockwise). */
function signedAreaM2(ring) {
  const kx = M_PER_DEG_LAT * Math.cos(toRad(ring[0][1]));
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * kx * ring[i + 1][1] * M_PER_DEG_LAT - ring[i + 1][0] * kx * ring[i][1] * M_PER_DEG_LAT;
  return sum / 2;
}

/** Area-weighted centroid of a closed [lon, lat] ring. */
export function ringAreaCentroid(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  const [ox, oy] = ring[0];
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0] - ox;
    const y1 = ring[i][1] - oy;
    const x2 = ring[i + 1][0] - ox;
    const y2 = ring[i + 1][1] - oy;
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return a ? [ox + cx / (3 * a), oy + cy / (3 * a)] : ringCentroid(ring);
}

/**
 * A strip `widthM` wide running inside a closed ring along edges `from`..`to`
 * (edge i joins vertex i to vertex i + 1): an easement or reservation band.
 */
export function edgeBand(ring, from, to, widthM) {
  const lat0 = toRad(ring[0][1]);
  const kx = M_PER_DEG_LAT * Math.cos(lat0);
  const inward = signedAreaM2(ring) > 0 ? 1 : -1;
  const pts = ring.slice(from, to + 2).map(([lon, lat]) => [lon * kx, lat * M_PER_DEG_LAT]);
  const normals = pts.slice(1).map((b, i) => {
    const a = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(-(b[1] - a[1]) / len) * inward, ((b[0] - a[0]) / len) * inward];
  });
  const inner = pts.map((p, i) => {
    const n1 = normals[Math.max(0, i - 1)];
    const n2 = normals[Math.min(normals.length - 1, i)];
    const m = [n1[0] + n2[0], n1[1] + n2[1]];
    const len = Math.hypot(m[0], m[1]) || 1;
    const scale = widthM / Math.max(0.35, (m[0] / len) * n1[0] + (m[1] / len) * n1[1]);
    return [p[0] + (m[0] / len) * scale, p[1] + (m[1] / len) * scale];
  });
  const out = [...pts, ...inner.reverse()].map(([x, y]) => [x / kx, y / M_PER_DEG_LAT]);
  return [...out, out[0]];
}

/** True when a [lon, lat] position lies inside a closed ring (ray casting). */
export function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when a position lies inside a polygon given as [outer, ...holes]. */
export function pointInPolygon(pt, rings) {
  return pointInRing(pt, rings[0]) && !rings.slice(1).some((h) => pointInRing(pt, h));
}

/** Distance in metres from a position to the segment a–b (local plane). */
export function pointToSegmentM(p, a, b) {
  const kx = M_PER_DEG_LAT * Math.cos(toRad(p[1]));
  const ax = (a[0] - p[0]) * kx;
  const ay = (a[1] - p[1]) * M_PER_DEG_LAT;
  const bx = (b[0] - p[0]) * kx;
  const by = (b[1] - p[1]) * M_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Shortest distance in metres between a polyline and a closed ring (0 if they touch). */
export function lineToRingM(line, ring) {
  if (line.some((p) => pointInRing(p, ring))) return 0;
  let best = Infinity;
  for (const p of line) for (let i = 0; i < ring.length - 1; i++) best = Math.min(best, pointToSegmentM(p, ring[i], ring[i + 1]));
  for (const p of ring) for (let i = 0; i < line.length - 1; i++) best = Math.min(best, pointToSegmentM(p, line[i], line[i + 1]));
  return best;
}
