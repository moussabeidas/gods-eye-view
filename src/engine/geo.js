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
