// Real open map data for the prototype (Overture Maps / OpenStreetMap), built
// by tools/build_geo.py. Coordinates are integer micro-degrees relative to
// each file's origin, delta-encoded per ring or line; they are decoded once
// on first use. See ATTRIBUTION.md for licences and what is real.

import REGION_RAW from './region.js';
import WARQAA_RAW from './warqaa.js';
import JADDAF_RAW from './jaddaf.js';

const SCALE = 1e6;

/** Decode one delta-encoded line or ring to [lon, lat] positions. */
export function decodeLine(flat, [ox, oy]) {
  const out = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    out.push([ox + x / SCALE, oy + y / SCALE]);
  }
  return out;
}

/** Decode a ring and close it. */
export function decodeRing(flat, origin) {
  const ring = decodeLine(flat, origin);
  return [...ring, ring[0]];
}

const decodePoint = ([x, y], [ox, oy]) => [ox + x / SCALE, oy + y / SCALE];
const decodePolygons = (polys, origin) => polys.map((rings) => rings.map((r) => decodeRing(r, origin)));

let region = null;

/** City-scale layers: communities, water, major roads, metro and airport. */
export function getRegion() {
  if (region) return region;
  const o = REGION_RAW.origin;
  region = {
    release: REGION_RAW.release,
    communities: REGION_RAW.communities.map((c) => ({ id: c.id, name: c.name, ar: c.ar, macro: c.sub === 'm', areaKm2: c.km2, labelPoint: decodePoint(c.lp, o), polygons: decodePolygons(c.g, o) })),
    water: REGION_RAW.water.map((w) => ({ name: w.name, polygons: decodePolygons(w.g, o) })),
    roads: REGION_RAW.roads.map((r) => ({ cls: r.cls, name: r.name, ar: r.ar, lines: r.g.map((l) => decodeLine(l, o)) })),
    rail: REGION_RAW.rail.map((r) => ({ line: r.line, status: r.status, lines: r.g.map((l) => decodeLine(l, o)) })),
    stations: REGION_RAW.stations.map((s) => ({ name: s.name, ar: s.ar, line: s.line, status: s.status, coord: decodePoint(s.c, o) })),
    airport: REGION_RAW.airport.map((a) => (a.cls === 'runway-line' ? { cls: 'runway', lines: a.g.map((l) => decodeLine(l, o)) } : { cls: a.cls, polygons: decodePolygons(a.g, o) })),
  };
  return region;
}

const AREAS = { warqaa: WARQAA_RAW, jaddaf: JADDAF_RAW };
const areaCache = new Map();

/** Street-level layers around one plot site. */
export function getArea(key) {
  if (areaCache.has(key)) return areaCache.get(key);
  const raw = AREAS[key];
  if (!raw) return null;
  const o = raw.origin;
  const area = {
    key,
    release: raw.release,
    center: raw.center,
    bbox: raw.bbox,
    parcel: decodeRing(raw.parcel, o),
    parcelAreaM2: raw.parcelAreaM2,
    catchment: raw.catchment,
    roads: raw.roads.map((r) => ({ cls: r.cls, name: r.name, ar: r.ar, lines: r.g.map((l) => decodeLine(l, o)) })),
    landuse: raw.landuse.map((l) => ({ cls: l.cls, name: l.name ?? null, polygons: decodePolygons(l.g, o) })),
    buildings: raw.buildings.map(([h, est, ...ring]) => ({ h, estimated: !!est, ring: decodeRing(ring, o) })),
    places: raw.places.map(([category, raw, name, ar, x, y, count]) => ({ category, raw, name, ar, coord: decodePoint([x, y], o), count })),
    busStops: raw.busStops.map((p) => decodePoint(p, o)),
    power: raw.power.map((p) => ({ cls: p.cls, lines: p.g.map((l) => decodeLine(l, o)) })),
    substations: raw.substations.map(([name, x, y]) => ({ name, coord: decodePoint([x, y], o) })),
  };
  areaCache.set(key, area);
  return area;
}

export const AREA_KEYS = Object.keys(AREAS);
export const MAP_DATA_RELEASE = REGION_RAW.release;
