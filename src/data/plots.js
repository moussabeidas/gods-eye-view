// Representative Dubai Municipality plots for the prototype (BRD AC-01: one to
// two plots). Every value here is simulated or illustrative and is attributed
// to the represented source system through `sources` (see sources.js).

import { ringAreaM2, ringFromOffsets, rectangle, offset } from '../engine/geo.js';

const WARQAA_CENTER = [55.4262, 25.1936];
const JADDAF_CENTER = [55.3372, 25.2206];

const warqaaRing = ringFromOffsets(WARQAA_CENTER, [
  [-76, -62],
  [76, -62],
  [79, 54],
  [22, 66],
  [-76, 62],
]);

const jaddafRing = rectangle(JADDAF_CENTER, 105, 90, 28);

function strip(center, offsets) {
  return ringFromOffsets(center, offsets);
}

export const PLOTS = [
  {
    id: '426-0318',
    plotNumber: '426-0318',
    name: 'Al Warqa’a Third — Community Facilities Plot',
    community: 'Al Warqa’a Third',
    communityCode: '426',
    sector: 'Dubai — Deira hinterland (east)',
    center: WARQAA_CENTER,
    geometry: warqaaRing,
    areaM2: Math.round(ringAreaM2(warqaaRing) / 10) * 10,
    currentUse: 'Vacant government land (fenced, unimproved)',
    assetClassification: 'Government land bank — Commercial / Community Facilities',
    ownership: 'Dubai Municipality (freehold, land bank)',
    description:
      'Corner plot on the community distributor road serving Al Warqa’a Third villa neighbourhoods. The plot is flat, vacant and fenced, with frontage to a 4-lane distributor and a local access street. It was reserved in the community master plan for neighbourhood facilities.',
    physical: {
      shape: 'Irregular pentagon (near-rectangular)',
      frontageM: 152,
      depthM: 124,
      topography: 'Flat, compacted sand; no structures',
      access: 'Primary frontage to distributor road (south); secondary to local street (west)',
      utilities: 'Power, water, sewer and telecom available at plot boundary',
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
      restrictions: ['Active frontage required to distributor road', 'Servicing and deliveries from local street only', 'Building height must step down within 12 m of the transmission-line easement'],
    },
    affection: {
      affectionPlanNo: 'AP-426-0318-2025-117',
      issueDate: '2025-11-04',
      landUseCode: 'CF-2',
      roadReservation: '4 m road-widening reservation along southern frontage',
      easements: ['132 kV overhead transmission line easement, 14 m strip along northern edge', 'Stormwater drainage line, 6 m strip along western edge'],
      utilitiesNotes: 'DEWA NOC required for any structure within 20 m of the 132 kV line',
      notes: 'Plot boundary verified by DM Survey (simulated record). No encumbrances registered.',
    },
    constraints: [
      {
        id: 'C1',
        type: 'power-easement',
        label: '132 kV transmission easement',
        description: 'No-build strip of 14 m along the northern boundary; sensitive uses (education, residential) discouraged within 50 m of the line.',
        severity: 'high',
        noBuild: true,
        geometry: strip(WARQAA_CENTER, [
          [-76, 48],
          [79, 40],
          [79, 54],
          [22, 66],
          [-76, 62],
        ]),
      },
      {
        id: 'C2',
        type: 'road-reservation',
        label: 'Road-widening reservation',
        description: '4 m strip along the southern frontage reserved for future widening.',
        severity: 'low',
        noBuild: true,
        geometry: strip(WARQAA_CENTER, [
          [-76, -62],
          [76, -62],
          [76, -58],
          [-76, -58],
        ]),
      },
      {
        id: 'C3',
        type: 'drainage',
        label: 'Stormwater drainage line',
        description: '6 m strip along the western edge; landscaping and surface parking only.',
        severity: 'medium',
        noBuild: true,
        geometry: strip(WARQAA_CENTER, [
          [-76, -58],
          [-70, -58],
          [-70, 48],
          [-76, 48],
        ]),
      },
    ],
    catchmentRadiusM: 2500,
    candidateUses: ['community-retail', 'private-school', 'sports-wellness', 'polyclinic', 'residential-villas'],
  },
  {
    id: '332-0914',
    plotNumber: '332-0914',
    name: 'Al Jaddaf — Creekside Mixed-Use Plot',
    community: 'Al Jaddaf',
    communityCode: '332',
    sector: 'Dubai — Creek corridor (Bur Dubai side)',
    center: JADDAF_CENTER,
    geometry: jaddafRing,
    areaM2: Math.round(ringAreaM2(jaddafRing) / 10) * 10,
    currentUse: 'Temporary surface car park (short-term DM licence)',
    assetClassification: 'Government land bank — Mixed-Use Development',
    ownership: 'Dubai Municipality (freehold, land bank)',
    description:
      'Rectangular plot about 400 m from Al Jaddaf Metro Station, between the Creek-side tower cluster and the healthcare district. It is used on an interim basis as a licensed surface car park. The master plan designates it for mixed-use development.',
    physical: {
      shape: 'Rectangular',
      frontageM: 105,
      depthM: 90,
      topography: 'Level, asphalt-surfaced parking',
      access: 'Frontage to Al Jaddaf main collector (east); service lane (west)',
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
        setbacks: 'Front 5 m · Sides 4 m · Rear 4 m',
        parking: 'Per DM parking regulation; 20% reduction within 500 m of Metro',
      },
      restrictions: [
        'RTA NOC required for works within the Metro protection zone',
        'Aviation obstacle limitation: structure ≤ 75 m AMSL (DCAA)',
        'Minimum 20% of GFA as active/non-residential uses at podium',
      ],
    },
    affection: {
      affectionPlanNo: 'AP-332-0914-2026-042',
      issueDate: '2026-02-18',
      landUseCode: 'MU-3',
      roadReservation: 'None',
      easements: ['Metro protection zone, 25 m from western boundary (no basement)', 'Sewer line easement, 5 m along northern edge'],
      utilitiesNotes: 'District cooling capacity reserved (simulated DEWA/Empower record)',
      notes: 'Interim car-park licence terminable on 6 months’ notice.',
    },
    constraints: [
      {
        id: 'C1',
        type: 'metro-protection',
        label: 'Metro protection zone',
        description: 'No basement within the 25 m protection corridor; limits below-grade parking and raises foundation cost.',
        severity: 'medium',
        noBuild: false,
        geometry: rectangle(offset(JADDAF_CENTER, -32, -18), 42, 92, 28),
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
        description: '5 m easement along the northern edge; landscaping and driveway only.',
        severity: 'low',
        noBuild: true,
        geometry: rectangle(offset(JADDAF_CENTER, 19, 38), 106, 6, 28),
      },
    ],
    catchmentRadiusM: 2000,
    candidateUses: ['midscale-hotel', 'serviced-apartments', 'grade-a-office', 'build-to-rent', 'logistics'],
  },
];

export function getPlot(plotId) {
  const needle = String(plotId ?? '')
    .trim()
    .replace(/^plot\s*/i, '')
    .replace(/\s+/g, '');
  return PLOTS.find((p) => p.plotNumber === needle || p.id === needle || p.plotNumber.replace('-', '') === needle) ?? null;
}
