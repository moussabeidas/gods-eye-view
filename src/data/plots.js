// Representative Dubai Municipality plots for the prototype (BRD AC-01: one to
// two plots). Each plot is drawn on a real vacant parcel from open land-use
// data (OpenStreetMap via Overture Maps, see geo/ATTRIBUTION.md). Plot
// numbers, planning controls and affection-plan fields are simulated and
// attributed to the represented source system through `sources` (sources.js).

import { getArea } from './geo/index.js';
import { ringAreaM2, ringAreaCentroid, edgeBand } from '../engine/geo.js';

// Al Warqa 1: a rectangular parcel mapped as a construction site, inside the
// community's private-school cluster. Edges: 0 west, 1 south, 2 east (21 Street), 3 north.
const warqaa = getArea('warqaa');
const warqaaRing = warqaa.parcel;
const WARQAA_CENTER = ringAreaCentroid(warqaaRing);

// Al Jaddaf waterfront: an irregular greenfield parcel beside the creek-side
// lagoon. Edges 0–1 face the access road (south); edges 6–8 face the water (west).
const jaddaf = getArea('jaddaf');
const jaddafRing = jaddaf.parcel;
const JADDAF_CENTER = ringAreaCentroid(jaddafRing);

export const PLOTS = [
  {
    id: '421-0318',
    plotNumber: '421-0318',
    name: 'Al Warqa 1 — Community Facilities Plot',
    community: 'Al Warqa 1',
    communityCode: '421',
    sector: 'Dubai — Deira hinterland (east)',
    center: WARQAA_CENTER,
    geometry: warqaaRing,
    areaM2: Math.round(ringAreaM2(warqaaRing) / 10) * 10,
    currentUse: 'Vacant land (mapped as a construction site in open map data)',
    assetClassification: 'Government land bank — Commercial / Community Facilities',
    ownership: 'Dubai Municipality (freehold, land bank)',
    description:
      'Near-square plot in Al Warqa 1, inside the community’s private-school and services cluster. It fronts 21 Street to the east and a local access street to the north. Sheikh Mohammed Bin Zayed Road (E311) is about 400 m away and the Blue Line’s Al Warqa’a Metro station, under construction, about 850 m. The community master plan reserves the plot for neighbourhood facilities.',
    physical: {
      shape: 'Near-square (rotated rectangle)',
      frontageM: 140,
      depthM: 135,
      topography: 'Flat, compacted sand; no permanent structures',
      access: 'Frontage to 21 Street (east) and a local access street (north)',
      utilities: 'Power, water, sewer and telecom available at plot boundary; DEWA substation about 390 m south-west',
    },
    planning: {
      zoningCode: 'C-2 / CF',
      zoningName: 'Neighbourhood Commercial & Community Facilities',
      permittedUses: ['Neighbourhood retail', 'Supermarket', 'Food & beverage', 'Clinic / polyclinic', 'Sports & recreation', 'Nursery / school', 'Community centre'],
      conditionalUses: ['Private school (KHDA approval & traffic impact study)'],
      prohibitedUses: ['Residential', 'Hotel', 'Industrial / warehousing', 'Fuel station'],
      controls: {
        far: 1.2,
        maxHeightM: 15,
        maxFloors: 'G+2',
        plotCoverage: 0.5,
        setbacks: 'Front 6 m · Sides 3 m · Rear 3 m',
        parking: '1 space / 50 m² retail GFA · 1 / 4 staff (education)',
      },
      restrictions: ['Active frontage required to 21 Street', 'Servicing and deliveries from the northern access street only', 'Traffic impact study required for any use generating school-run peaks'],
    },
    affection: {
      affectionPlanNo: 'AP-421-0318-2025-117',
      issueDate: '2025-11-04',
      landUseCode: 'CF-2',
      roadReservation: '4 m road-widening reservation along the 21 Street frontage (east)',
      easements: ['DEWA 11 kV cable corridor, 6 m strip along the southern edge', 'Stormwater drainage line, 6 m strip along the western edge'],
      utilitiesNotes: 'DEWA NOC required for works within the cable corridor',
      notes: 'Plot boundary follows the mapped parcel; DM survey verification pending (simulated record). No encumbrances registered.',
    },
    constraints: [
      {
        id: 'C1',
        type: 'power-easement',
        label: 'DEWA cable corridor (11 kV)',
        description:
          '6 m underground cable corridor along the southern boundary, feeding the DEWA substation about 390 m south-west; no structures or deep foundations, only landscaping and surface parking.',
        severity: 'medium',
        noBuild: true,
        geometry: edgeBand(warqaaRing, 1, 1, 6),
      },
      {
        id: 'C2',
        type: 'road-reservation',
        label: 'Road-widening reservation',
        description: '4 m strip along the 21 Street frontage reserved for future widening.',
        severity: 'low',
        noBuild: true,
        geometry: edgeBand(warqaaRing, 2, 2, 4),
      },
      {
        id: 'C3',
        type: 'drainage',
        label: 'Stormwater drainage line',
        description: '6 m strip along the western edge; landscaping and surface parking only.',
        severity: 'medium',
        noBuild: true,
        geometry: edgeBand(warqaaRing, 0, 0, 6),
      },
    ],
    catchmentRadiusM: 2500,
    candidateUses: ['community-retail', 'private-school', 'sports-wellness', 'polyclinic', 'residential-villas'],
    mapArea: 'warqaa',
  },
  {
    id: '326-0914',
    plotNumber: '326-0914',
    name: 'Al Jaddaf Waterfront — Creekside Mixed-Use Plot',
    community: 'Al Jaddaf',
    communityCode: '326',
    sector: 'Dubai — Creek corridor (Bur Dubai side)',
    center: JADDAF_CENTER,
    geometry: jaddafRing,
    areaM2: Math.round(ringAreaM2(jaddafRing) / 10) * 10,
    currentUse: 'Vacant greenfield land',
    assetClassification: 'Government land bank — Mixed-Use Development',
    ownership: 'Dubai Municipality (freehold, land bank)',
    description:
      'Irregular waterfront plot in Culture Village on the Al Jaddaf waterfront, next to the Jameel Arts Centre and the creek-side hotel cluster, with water along its north-western side and Dubai Creek about 50 m to the north-east. Al Jadaf Metro Station (Green Line) is about 700 m away and Al Garhoud Bridge (Sheikh Rashid Road) about 300 m. The master plan designates it for mixed-use development.',
    physical: {
      shape: 'Irregular (waterfront)',
      frontageM: 56,
      depthM: 125,
      topography: 'Level reclaimed land; unimproved',
      access: 'Frontage to the waterfront access road (south); waterfront promenade (north-west)',
      utilities: 'Full utilities at boundary; district cooling connection available',
    },
    planning: {
      zoningCode: 'MU-3',
      zoningName: 'Mixed Use — High Density',
      permittedUses: ['Hotel', 'Serviced apartments', 'Office', 'Residential apartments', 'Retail podium', 'Food & beverage'],
      conditionalUses: ['Healthcare (DHA licensing)', 'Education (KHDA approval)'],
      prohibitedUses: ['Industrial / warehousing', 'Fuel station', 'Villa residential'],
      controls: {
        far: 4.5,
        maxHeightM: 68,
        maxFloors: 'B+G+15',
        plotCoverage: 0.6,
        setbacks: 'Front 5 m · Sides 4 m · Waterfront 8 m',
        parking: 'Per DM parking regulation; 20% reduction within 800 m of Metro',
      },
      restrictions: [
        'Continuous public promenade to be kept along the waterfront edge',
        'Aviation obstacle limitation: structure ≤ 75 m AMSL (DCAA)',
        'Minimum 20% of GFA as active/non-residential uses at podium',
      ],
    },
    affection: {
      affectionPlanNo: 'AP-326-0914-2026-042',
      issueDate: '2026-02-18',
      landUseCode: 'MU-3',
      roadReservation: 'None',
      easements: ['Waterfront promenade access, 8 m along the north-western (water) edge', 'Sewer line easement, 5 m along the southern road edge'],
      utilitiesNotes: 'District cooling capacity reserved (simulated DEWA/Empower record)',
      notes: 'Plot boundary follows the mapped parcel; DM survey verification pending (simulated record).',
    },
    constraints: [
      {
        id: 'C1',
        type: 'waterfront-promenade',
        label: 'Waterfront promenade easement',
        description: '8 m public-access strip along the north-western water edge for the waterfront promenade; landscaping, seating and outdoor dining only.',
        severity: 'medium',
        noBuild: true,
        geometry: edgeBand(jaddafRing, 6, 8, 8),
      },
      {
        id: 'C2',
        type: 'aviation',
        label: 'Aviation height limit (DCAA)',
        description: 'Structure limited to 75 m AMSL, which caps the tower at about 15 floors.',
        severity: 'low',
        noBuild: false,
        geometry: null,
      },
      {
        id: 'C3',
        type: 'sewer-easement',
        label: 'Sewer line easement',
        description: '5 m easement along the southern road edge; landscaping and driveway only.',
        severity: 'low',
        noBuild: true,
        geometry: edgeBand(jaddafRing, 0, 1, 5),
      },
    ],
    catchmentRadiusM: 2000,
    candidateUses: ['midscale-hotel', 'serviced-apartments', 'grade-a-office', 'build-to-rent', 'logistics'],
    mapArea: 'jaddaf',
  },
];

export function getPlot(plotId) {
  const needle = String(plotId ?? '')
    .trim()
    .replace(/^plot\s*/i, '')
    .replace(/\s+/g, '');
  return PLOTS.find((p) => p.plotNumber === needle || p.id === needle || p.plotNumber.replace('-', '') === needle) ?? null;
}
