// Land-bank screening set for the recategorisation ranking. The two fully
// analysed plots are joined by further vacant parcels taken from open
// land-use data (real outlines and areas). Plot numbers and current zoning of
// the screening parcels are simulated for demonstration.

import { getArea } from './geo/index.js';
import { PLOTS } from './plots.js';
import { ringAreaM2, ringAreaCentroid, distanceM } from '../engine/geo.js';

/**
 * Representative zoning categories (DM-style) the ranking may move a plot
 * between. FAR, height and coverage are illustrative development controls;
 * `uses` lists the uses each category permits.
 */
export const ZONING_CATEGORIES = {
  'R-V': { name: 'Villa residential', far: 0.6, maxHeightM: 12, maxFloors: 'G+1', plotCoverage: 0.5, uses: ['residential-villas'] },
  CF: { name: 'Community facilities', far: 1.0, maxHeightM: 15, maxFloors: 'G+2', plotCoverage: 0.5, uses: ['private-school', 'polyclinic', 'sports-wellness'] },
  'C-2 / CF': {
    name: 'Neighbourhood commercial & community facilities',
    far: 1.2,
    maxHeightM: 15,
    maxFloors: 'G+2',
    plotCoverage: 0.5,
    uses: ['community-retail', 'polyclinic', 'sports-wellness', 'private-school'],
  },
  'C-2': { name: 'Neighbourhood commercial', far: 1.5, maxHeightM: 15, maxFloors: 'G+2', plotCoverage: 0.6, uses: ['community-retail', 'polyclinic', 'sports-wellness'] },
  'R-A': { name: 'Residential apartments', far: 3.5, maxHeightM: 60, maxFloors: 'G+14', plotCoverage: 0.5, uses: ['build-to-rent'] },
  'MU-2': { name: 'Mixed use — medium density', far: 3.0, maxHeightM: 50, maxFloors: 'G+12', plotCoverage: 0.6, uses: ['serviced-apartments', 'grade-a-office', 'build-to-rent'] },
  'MU-3': { name: 'Mixed use — high density', far: 4.5, maxHeightM: 68, maxFloors: 'B+G+15', plotCoverage: 0.6, uses: ['midscale-hotel', 'serviced-apartments', 'grade-a-office', 'build-to-rent'] },
};

/** Categories a plot in each area may realistically be moved into (market and planning context). */
export const AREA_CATEGORIES = {
  warqaa: ['R-V', 'CF', 'C-2 / CF', 'C-2'],
  jaddaf: ['R-A', 'MU-2', 'MU-3'],
};

// Screening parcels: real vacant parcels located by their centroid in the open land-use data.
const SCREENING = [
  { plotNumber: '421-0417', area: 'warqaa', at: [55.4056, 25.1929], community: 'Al Warqa 1', zoning: 'R-V', currentUse: 'Vacant land within the villa neighbourhood' },
  { plotNumber: '326-0521', area: 'jaddaf', at: [55.3329, 25.2208], community: 'Al Jaddaf', zoning: 'R-A', currentUse: 'Vacant land near Creek Metro Station' },
  { plotNumber: '326-0533', area: 'jaddaf', at: [55.3322, 25.2251], community: 'Al Jaddaf', zoning: 'MU-2', currentUse: 'Vacant land by Al Jadaf Metro Station' },
  { plotNumber: '326-0540', area: 'jaddaf', at: [55.3332, 25.222], community: 'Al Jaddaf', zoning: 'R-A', currentUse: 'Vacant land' },
  { plotNumber: '326-0547', area: 'jaddaf', at: [55.3339, 25.2212], community: 'Al Jaddaf', zoning: 'MU-2', currentUse: 'Vacant land' },
  { plotNumber: '326-0602', area: 'jaddaf', at: [55.3421, 25.2256], community: 'Al Jaddaf', zoning: 'MU-3', currentUse: 'Vacant land in Culture Village' },
  { plotNumber: '326-0611', area: 'jaddaf', at: [55.3312, 25.2247], community: 'Al Jaddaf', zoning: 'R-A', currentUse: 'Vacant land' },
];

function findParcel(area, at) {
  let best = null;
  for (const l of getArea(area).landuse) {
    if (l.cls !== 'vacant') continue;
    const ring = l.polygons[0][0];
    const d = distanceM(ringAreaCentroid(ring), at);
    if (d < 40 && (!best || d < best.d)) best = { ring, d };
  }
  return best?.ring ?? null;
}

let cache = null;

/** Every plot in the screening set, the analysed plots first. */
export function getLandBank() {
  if (cache) return cache;
  const analysed = PLOTS.map((p) => ({
    plotNumber: p.plotNumber,
    area: p.mapArea,
    community: p.community,
    zoning: p.planning.zoningCode,
    currentUse: p.currentUse,
    geometry: p.geometry,
    center: p.center,
    areaM2: p.areaM2,
    analysed: true,
  }));
  const screened = SCREENING.map((s) => {
    const ring = findParcel(s.area, s.at);
    if (!ring) return null;
    return { ...s, geometry: ring, center: ringAreaCentroid(ring), areaM2: Math.round(ringAreaM2(ring) / 10) * 10, analysed: false };
  }).filter(Boolean);
  cache = [...analysed, ...screened];
  return cache;
}
