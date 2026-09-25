// Surrounding context for each prototype plot. The geography is real open map
// data (Overture Maps / OpenStreetMap, see geo/ATTRIBUTION.md): community
// boundaries, roads, Dubai Metro, water, land use, buildings and named
// facilities. Demographics, facility capacities, market benchmarks, DLD
// transactions and comparable-plot records are simulated for demonstration
// (BRD DP-03) and deterministic between runs.

import { PLOTS } from './plots.js';
import { getArea, getRegion } from './geo/index.js';
import { distanceM, rectangle, seededRandom, pointInPolygon, lineToRingM } from '../engine/geo.js';

// ---------------------------------------------------------------------------
// Community demographics (represented as Dubai Statistics Center data), keyed
// by the id of the real community boundary in geo/region.js.

const FAMILY_AGES = { '0-4': 9, '5-17': 24, '18-34': 22, '35-54': 32, '55+': 13 };

const COMMUNITY_PROFILES = {
  'al-warqa-1': {
    population: 15800,
    growthPct: 3.1,
    households: 2820,
    householdSize: 5.6,
    ageGroups: { '0-4': 9, '5-17': 25, '18-34': 21, '35-54': 32, '55+': 13 },
    segments: { 'Emirati families': 57, 'Expat families': 35, 'Single professionals': 8 },
    incomeBand: 'Upper-middle',
  },
  'al-warqa-2': {
    population: 19600,
    growthPct: 2.4,
    households: 3560,
    householdSize: 5.5,
    ageGroups: FAMILY_AGES,
    segments: { 'Emirati families': 54, 'Expat families': 37, 'Single professionals': 9 },
    incomeBand: 'Upper-middle',
  },
  'al-warqa-3': {
    population: 26300,
    growthPct: 4.6,
    households: 4700,
    householdSize: 5.6,
    ageGroups: { '0-4': 10, '5-17': 26, '18-34': 21, '35-54': 31, '55+': 12 },
    segments: { 'Emirati families': 61, 'Expat families': 32, 'Single professionals': 7 },
    incomeBand: 'Upper-middle',
  },
  'nadd-al-hamar': {
    population: 17900,
    growthPct: 1.9,
    households: 3380,
    householdSize: 5.3,
    ageGroups: { '0-4': 7, '5-17': 22, '18-34': 24, '35-54': 31, '55+': 16 },
    segments: { 'Emirati families': 49, 'Expat families': 39, 'Single professionals': 12 },
    incomeBand: 'Middle',
  },
  'warsan-1': {
    population: 68000,
    growthPct: 2.2,
    households: 21900,
    householdSize: 3.1,
    ageGroups: { '0-4': 6, '5-17': 13, '18-34': 47, '35-54': 29, '55+': 5 },
    segments: { 'Emirati families': 2, 'Expat families': 42, 'Single professionals': 56 },
    incomeBand: 'Lower-middle',
  },
  'al-jaddaf': {
    population: 38000,
    growthPct: 9.1,
    households: 16500,
    householdSize: 2.3,
    ageGroups: { '0-4': 5, '5-17': 9, '18-34': 46, '35-54': 33, '55+': 7 },
    segments: { 'Young professionals': 50, 'Expat families': 32, 'Emirati families': 6, 'Visitors / short-stay': 12 },
    incomeBand: 'Upper-middle',
    daytimeWorkers: 42000,
  },
  'dubai-festival-city': {
    population: 16500,
    growthPct: 5.2,
    households: 6100,
    householdSize: 2.7,
    ageGroups: { '0-4': 6, '5-17': 13, '18-34': 38, '35-54': 34, '55+': 9 },
    segments: { 'Young professionals': 38, 'Expat families': 44, 'Emirati families': 8, 'Visitors / short-stay': 10 },
    incomeBand: 'Upper-middle',
    daytimeWorkers: 24000,
  },
  'umm-hurair': {
    population: 28000,
    growthPct: 2.4,
    households: 9300,
    householdSize: 3.0,
    ageGroups: { '0-4': 6, '5-17': 14, '18-34': 38, '35-54': 32, '55+': 10 },
    segments: { 'Young professionals': 36, 'Expat families': 45, 'Emirati families': 11, 'Visitors / short-stay': 8 },
    incomeBand: 'Middle',
    daytimeWorkers: 38000,
  },
  'port-saeed': {
    population: 34000,
    growthPct: 1.2,
    households: 10300,
    householdSize: 3.3,
    ageGroups: { '0-4': 6, '5-17': 12, '18-34': 42, '35-54': 32, '55+': 8 },
    segments: { 'Young professionals': 42, 'Expat families': 44, 'Emirati families': 6, 'Visitors / short-stay': 8 },
    incomeBand: 'Middle',
    daytimeWorkers: 22000,
  },
  'al-garhoud': {
    population: 21000,
    growthPct: 1.8,
    households: 5800,
    householdSize: 3.6,
    ageGroups: { '0-4': 7, '5-17': 17, '18-34': 31, '35-54': 32, '55+': 13 },
    segments: { 'Young professionals': 30, 'Expat families': 49, 'Emirati families': 13, 'Visitors / short-stay': 8 },
    incomeBand: 'Upper-middle',
    daytimeWorkers: 18000,
  },
  'umm-ramool': {
    population: 6500,
    growthPct: 3.0,
    households: 2400,
    householdSize: 2.7,
    ageGroups: { '0-4': 5, '5-17': 10, '18-34': 45, '35-54': 34, '55+': 6 },
    segments: { 'Young professionals': 48, 'Expat families': 40, 'Emirati families': 4, 'Visitors / short-stay': 8 },
    incomeBand: 'Middle',
    daytimeWorkers: 21000,
  },
};

// ---------------------------------------------------------------------------
// Facilities: real named places from open map data, grouped into the app's
// categories. Capacity attributes are simulated per facility (see capacity()).

export const POI_CATEGORIES = {
  supermarket: { label: 'Supermarket / grocery', group: 'commercial', color: '#22c55e', source: 'DET-LIC' },
  convenience: { label: 'Convenience store', group: 'commercial', color: '#4ade80', source: 'DET-LIC' },
  retail: { label: 'Shopping centre', group: 'commercial', color: '#10b981', source: 'DET-LIC' },
  fnb: { label: 'Food & beverage', group: 'commercial', color: '#f59e0b', source: 'DET-LIC' },
  hotel: { label: 'Hotel', group: 'commercial', color: '#e879f9', source: 'DET-TOUR' },
  'serviced-apartments': { label: 'Serviced apartments', group: 'commercial', color: '#c084fc', source: 'DET-TOUR' },
  office: { label: 'Office', group: 'commercial', color: '#60a5fa', source: 'DET-LIC' },
  school: { label: 'School', group: 'community', color: '#38bdf8', source: 'KHDA' },
  nursery: { label: 'Nursery', group: 'community', color: '#7dd3fc', source: 'KHDA' },
  clinic: { label: 'Healthcare', group: 'community', color: '#f87171', source: 'DHA' },
  pharmacy: { label: 'Pharmacy', group: 'community', color: '#fca5a5', source: 'DHA' },
  sports: { label: 'Sports facility', group: 'community', color: '#fb923c', source: 'DSC-SPORT' },
  park: { label: 'Park', group: 'community', color: '#84cc16', source: 'DM-PARKS' },
  mosque: { label: 'Mosque', group: 'community', color: '#a3a3a3', source: 'IACAD' },
  attraction: { label: 'Attraction', group: 'community', color: '#facc15', source: 'DET-TOUR' },
  fuel: { label: 'Fuel station', group: 'infrastructure', color: '#94a3b8', source: 'DET-LIC' },
  bus: { label: 'Bus stop', group: 'infrastructure', color: '#cbd5e1', source: 'RTA' },
  metro: { label: 'Metro station', group: 'infrastructure', color: '#ef4444', source: 'RTA' },
};

const HYPERMARKET = /hypermarket|carrefour|lulu|géant|geant/i;
const GROCERY_CHAIN = /union co-?op|spinneys|waitrose|choithrams|nesto|viva|grandiose|al maya|west zone|w mart/i;
const REGIONAL_MALL = /festival (city|centre|mall)|wafi|city cent(re|er)|dragon|التنين|deira city/i;
const HOSPITAL = /hospital|مستشفى/i;
const CAFE = /cafe|coffee|tea|juice|ice_cream|dessert|bakery|bubble/;
const round = (x, step) => Math.round(x / step) * step;

/** Simulated capacity attributes for one facility (deterministic per place). */
function capacity(p, rand) {
  const r = rand();
  const r2 = rand();
  switch (p.category) {
    case 'supermarket':
      if (HYPERMARKET.test(p.name)) return { tier: 'Hypermarket — destination format, outside local grocery supply' };
      return { gla: GROCERY_CHAIN.test(p.name) ? round(1200 + r * 1800, 50) : round(180 + r * 420, 10) };
    case 'convenience':
      return { gla: round(70 + r * 90, 10) };
    case 'retail':
      return REGIONAL_MALL.test(p.name) ? { tier: 'Regional mall — outside neighbourhood supply' } : { gla: round(2500 + r * 9500, 100) };
    case 'fnb':
      return { gla: round((CAFE.test(p.raw) ? 60 : 110) + r * 120, 10) };
    case 'hotel':
      return { keys: round(140 + r * 300, 10), stars: 3 + Math.floor(r2 * 3) };
    case 'serviced-apartments':
      return { keys: round(80 + r * 170, 10) };
    case 'office':
      return { nla: round((4000 + r * 16000) * (p.count > 1 ? 1.3 : 1), 100) };
    case 'school': {
      const cap = round(900 + r * 1700, 50);
      return { capacity: cap, enrolled: round(cap * (0.84 + r2 * 0.14), 5) };
    }
    case 'nursery': {
      const cap = round(60 + r * 110, 5);
      return { capacity: cap, enrolled: Math.round(cap * (0.86 + r2 * 0.13)) };
    }
    case 'clinic':
      // Outpatient consultation rooms: hospitals by name, clinics and doctors' offices otherwise.
      return { rooms: HOSPITAL.test(p.name) ? Math.round(12 + r * 16) : /doctors_office|pediatric|public_health/.test(p.raw) ? Math.round(2 + r * 3) : Math.round(4 + r * 6) };
    case 'sports':
      return {
        area: p.raw === 'gym' ? round(400 + r * 1000, 50) : p.raw === 'swimming_pool' ? round(300 + r * 400, 50) : p.raw === 'martial_arts_club' ? round(150 + r * 250, 50) : round(900 + r * 2300, 50),
      };
    case 'park':
      return { area: round(2000 + r * 33000, 500) };
    default:
      return {};
  }
}

const METRO_LINES = { red: 'Red Line', green: 'Green Line', blue: 'Blue Line' };

// ---------------------------------------------------------------------------
// Market data (represented as RERA indices, DLD transactions and third-party research)

const MARKET = {
  '421-0318': {
    benchmarks: {
      communityRetailRent: { label: 'Community retail rent', value: 1050, unit: 'AED/m²/yr', range: [900, 1250], yoyPct: 6.8, source: 'RERA-RENT' },
      anchorRent: { label: 'Supermarket anchor rent', value: 620, unit: 'AED/m²/yr', range: [520, 720], yoyPct: 4.2, source: 'RERA-RENT' },
      clinicRent: { label: 'Clinic / medical rent', value: 1150, unit: 'AED/m²/yr', range: [1000, 1350], yoyPct: 5.1, source: 'RERA-RENT' },
      schoolFee: { label: 'Median school tuition (KHDA)', value: 44000, unit: 'AED/student/yr', range: [32000, 58000], yoyPct: 3.4, source: 'KHDA' },
      fitnessRevenue: { label: 'Sports & wellness revenue density', value: 900, unit: 'AED/m²/yr', range: [700, 1100], yoyPct: 5.6, source: 'TP-MARKET' },
      villaRent: { label: 'Villa rent (4BR)', value: 185000, unit: 'AED/yr', range: [160000, 210000], yoyPct: 9.5, source: 'RERA-RENT' },
      landValue: { label: 'Commercial land value', value: 1560, unit: 'AED/m² plot', range: [1300, 1850], yoyPct: 11.2, source: 'DLD-TXN' },
      retailVacancy: { label: 'Community retail vacancy', value: 4.5, unit: '%', source: 'TP-MARKET' },
      retailPipeline: { label: 'Retail GLA pipeline (3 yrs, catchment)', value: 3200, unit: 'm²', source: 'TP-MARKET' },
    },
    priceIndex: {
      label: 'Community retail rent index (2023 Q1 = 100)',
      source: 'RERA-RENT',
      series: [100, 102, 104, 107, 109, 112, 115, 117, 120, 123, 126, 128, 131, 134],
      start: '2023 Q1',
    },
    footfall: { label: 'Average daily traffic, 21 Street', value: 9200, unit: 'vehicles/day', source: 'RTA-NET' },
  },
  '326-0914': {
    benchmarks: {
      hotelAdr: { label: 'Midscale hotel ADR', value: 540, unit: 'AED/night', range: [460, 640], yoyPct: 5.4, source: 'DET-TOUR' },
      hotelOccupancy: { label: 'Hotel occupancy (catchment)', value: 79, unit: '%', yoyPct: 2.1, source: 'DET-TOUR' },
      servicedAdr: { label: 'Serviced apartment ADR', value: 410, unit: 'AED/night', range: [340, 480], yoyPct: 6.2, source: 'DET-TOUR' },
      servicedOccupancy: { label: 'Serviced apartment occupancy', value: 81, unit: '%', yoyPct: 3.0, source: 'DET-TOUR' },
      officeRent: { label: 'Grade A office rent', value: 1500, unit: 'AED/m²/yr', range: [1300, 1750], yoyPct: 12.5, source: 'RERA-RENT' },
      officeVacancy: { label: 'Office vacancy (catchment)', value: 7.5, unit: '%', source: 'TP-MARKET' },
      apartmentRent: { label: 'Apartment rent (avg)', value: 1180, unit: 'AED/m²/yr', range: [1000, 1400], yoyPct: 10.8, source: 'RERA-RENT' },
      residentialVacancy: { label: 'Residential vacancy', value: 3.8, unit: '%', source: 'TP-MARKET' },
      landValue: { label: 'Mixed-use land value', value: 4200, unit: 'AED/m² GFA', range: [3600, 4900], yoyPct: 14.6, source: 'DLD-TXN' },
      hotelPipeline: { label: 'Hotel keys pipeline (3 yrs, catchment)', value: 1400, unit: 'keys', source: 'TP-MARKET' },
      officePipeline: { label: 'Office NLA pipeline (3 yrs, catchment)', value: 30000, unit: 'm²', source: 'TP-MARKET' },
      residentialPipeline: { label: 'Apartment pipeline (3 yrs, catchment)', value: 2000, unit: 'units', source: 'TP-MARKET' },
      servicedPipeline: { label: 'Serviced apartment pipeline (3 yrs)', value: 360, unit: 'keys', source: 'TP-MARKET' },
    },
    priceIndex: {
      label: 'Creek corridor hotel RevPAR index (2023 Q1 = 100)',
      source: 'DET-TOUR',
      series: [100, 96, 104, 112, 108, 103, 111, 119, 116, 110, 118, 126, 123, 117],
      start: '2023 Q1',
    },
    footfall: { label: 'Al Jadaf Metro daily ridership', value: 14800, unit: 'passengers/day', source: 'RTA-NET' },
    visitors: { label: 'Annual overnight visitors, Creek corridor', value: 1.9, unit: 'million', growthPct: 7.5, source: 'DET-TOUR' },
  },
};

// Transactions and comparables are placed inside the real community they are
// recorded against (`in`), at a deterministic point on land.
const TRANSACTIONS = {
  '421-0318': [
    { id: 'DLD-2026-118204', date: '2026-06-12', type: 'Sale', property: 'Commercial land', areaM2: 9200, valueAed: 15.2e6, in: 'Al Warqa 3' },
    { id: 'DLD-2026-103551', date: '2026-04-03', type: 'Sale', property: 'Commercial land', areaM2: 14100, valueAed: 21.8e6, in: 'Nadd Al Hamar' },
    { id: 'DLD-2025-287713', date: '2025-12-19', type: 'Sale', property: 'Villa', areaM2: 780, valueAed: 4.6e6, in: 'Al Warqa 1' },
    { id: 'DLD-2025-276190', date: '2025-11-25', type: 'Sale', property: 'Villa', areaM2: 820, valueAed: 4.9e6, in: 'Al Warqa 2' },
    { id: 'DLD-2026-099812', date: '2026-03-20', type: 'Lease registration', property: 'Retail unit', areaM2: 320, valueAed: 352e3, in: 'Al Warqa 3' },
    { id: 'DLD-2026-121007', date: '2026-06-30', type: 'Lease registration', property: 'Retail unit', areaM2: 180, valueAed: 207e3, in: 'Al Warqa 1' },
    { id: 'DLD-2025-244588', date: '2025-09-14', type: 'Sale', property: 'Villa', areaM2: 760, valueAed: 4.3e6, in: 'Al Warqa 4' },
    { id: 'DLD-2026-110734', date: '2026-05-08', type: 'Sale', property: 'Residential land', areaM2: 1400, valueAed: 3.1e6, in: 'Al Warqa 2' },
  ],
  '326-0914': [
    { id: 'DLD-2026-120588', date: '2026-06-25', type: 'Sale', property: 'Mixed-use land', areaM2: 7800, valueAed: 148e6, in: 'Al Jaddaf' },
    { id: 'DLD-2026-097340', date: '2026-03-11', type: 'Sale', property: 'Hotel apartment', areaM2: 62, valueAed: 1.45e6, in: 'Culture Village' },
    { id: 'DLD-2025-281115', date: '2025-12-05', type: 'Sale', property: 'Office floor', areaM2: 1450, valueAed: 27.6e6, in: 'Al Jaddaf' },
    { id: 'DLD-2026-104221', date: '2026-04-16', type: 'Sale', property: 'Apartment', areaM2: 118, valueAed: 2.35e6, in: 'Culture Village' },
    { id: 'DLD-2026-112930', date: '2026-05-21', type: 'Lease registration', property: 'Office unit', areaM2: 410, valueAed: 615e3, in: 'Dubai Healthcare City' },
    { id: 'DLD-2025-259602', date: '2025-10-02', type: 'Sale', property: 'Mixed-use land', areaM2: 11200, valueAed: 196e6, in: 'Umm Hurair' },
    { id: 'DLD-2026-116478', date: '2026-06-03', type: 'Sale', property: 'Apartment', areaM2: 86, valueAed: 1.68e6, in: 'Al Jaddaf' },
    { id: 'DLD-2026-101776', date: '2026-03-28', type: 'Lease registration', property: 'Retail unit', areaM2: 140, valueAed: 245e3, in: 'Culture Village' },
  ],
};

const COMPARABLES = {
  '421-0318': [
    {
      plotNumber: '261-0122',
      community: 'Al Mizhar',
      areaM2: 17200,
      zoning: 'C-2 / CF',
      far: 1.2,
      landUse: 'Community retail centre',
      status: 'Operating since 2021',
      performance: 'Occupancy 96%; anchor supermarket 2,400 m²',
      marketTier: 'upper-middle',
      valueAedM2: 1640,
      activityMix: 'Retail 62% · F&B 23% · Clinic 15%',
    },
    {
      plotNumber: '422-0547',
      community: 'Al Warqa 2',
      areaM2: 14100,
      zoning: 'C-2 / CF',
      far: 1.0,
      landUse: 'Vacant — sold 2026 for community retail',
      status: 'Transaction April 2026',
      performance: 'Land sale AED 1,546/m²',
      marketTier: 'upper-middle',
      valueAedM2: 1546,
      activityMix: 'Planned retail + F&B',
    },
    {
      plotNumber: '424-0915',
      community: 'Al Warqa 4',
      areaM2: 21500,
      zoning: 'CF / Education',
      far: 0.8,
      landUse: 'Private school (K-12)',
      status: 'Opened 2023',
      performance: 'Capacity 1,900; 94% utilised in year 3',
      marketTier: 'upper-middle',
      valueAedM2: 1250,
      activityMix: 'Education 100%',
    },
    {
      plotNumber: '416-0376',
      community: 'Nadd Al Hamar',
      areaM2: 12600,
      zoning: 'C-2',
      far: 1.4,
      landUse: 'Neighbourhood retail & clinic',
      status: 'Operating since 2018',
      performance: 'Occupancy 88%; clinic fully let',
      marketTier: 'middle',
      valueAedM2: 1380,
      activityMix: 'Retail 55% · Clinic 30% · F&B 15%',
    },
    {
      plotNumber: '251-0741',
      community: 'Mirdif',
      areaM2: 19800,
      zoning: 'C-2 / CF',
      far: 1.2,
      landUse: 'Sports & wellness hub',
      status: 'Operating since 2022',
      performance: 'Membership 4,100; revenue AED 920/m²',
      marketTier: 'upper-middle',
      valueAedM2: 1720,
      activityMix: 'Sports 70% · F&B 20% · Retail 10%',
    },
    {
      plotNumber: '614-0288',
      community: 'Al Barsha South',
      coord: [55.2235, 25.0935],
      areaM2: 18900,
      zoning: 'C-2',
      far: 1.5,
      landUse: 'Community retail centre',
      status: 'Operating since 2019',
      performance: 'Occupancy 93%',
      marketTier: 'upper-middle',
      valueAedM2: 2250,
      activityMix: 'Retail 58% · F&B 30% · Services 12%',
    },
    {
      plotNumber: '421-0402',
      community: 'Al Warqa 1',
      areaM2: 4200,
      zoning: 'R-V',
      far: 0.6,
      landUse: 'Villa plot',
      status: 'Occupied',
      performance: 'n/a',
      marketTier: 'upper-middle',
      valueAedM2: 2200,
      activityMix: 'Residential 100%',
    },
  ],
  '326-0914': [
    {
      plotNumber: '326-0661',
      community: 'Al Jaddaf',
      areaM2: 7800,
      zoning: 'MU-3',
      far: 4.5,
      landUse: 'Mixed-use land — sold for hotel + residences',
      status: 'Transaction June 2026',
      performance: 'Land sale AED 4,216/m² GFA',
      marketTier: 'upper-middle',
      valueAedM2: 4216,
      activityMix: 'Planned hotel 60% · residential 40%',
    },
    {
      plotNumber: '326-0288',
      community: 'Culture Village',
      areaM2: 8600,
      zoning: 'MU-3',
      far: 4.0,
      landUse: '4★ hotel (310 keys)',
      status: 'Operating since 2020',
      performance: 'Occupancy 81%; ADR AED 560',
      marketTier: 'upper-middle',
      valueAedM2: 3950,
      activityMix: 'Hotel 85% · F&B 15%',
    },
    {
      plotNumber: '319-0452',
      community: 'Umm Hurair',
      areaM2: 11200,
      zoning: 'MU-2',
      far: 3.5,
      landUse: 'Mixed-use land — sold for office + retail',
      status: 'Transaction Oct 2025',
      performance: 'Land sale AED 5,000/m² GFA',
      marketTier: 'middle',
      valueAedM2: 5000,
      activityMix: 'Office 70% · retail 30%',
    },
    {
      plotNumber: '326-0120',
      community: 'Al Jaddaf',
      areaM2: 6400,
      zoning: 'MU-3',
      far: 5.0,
      landUse: 'Grade A office tower',
      status: 'Operating since 2019',
      performance: 'Occupancy 90%; rent AED 1,480/m²',
      marketTier: 'upper-middle',
      valueAedM2: 4400,
      activityMix: 'Office 90% · retail 10%',
    },
    {
      plotNumber: '326-0935',
      community: 'Culture Village',
      areaM2: 9900,
      zoning: 'MU-3',
      far: 4.2,
      landUse: 'Build-to-rent apartments',
      status: 'Operating since 2022',
      performance: 'Occupancy 96%; rent AED 1,210/m²',
      marketTier: 'upper-middle',
      valueAedM2: 3800,
      activityMix: 'Residential 88% · retail 12%',
    },
    {
      plotNumber: '345-0512',
      community: 'Dubai Healthcare City',
      areaM2: 7200,
      zoning: 'MU-2',
      far: 3.8,
      landUse: 'Serviced apartments (140 keys)',
      status: 'Operating since 2021',
      performance: 'Occupancy 83%; ADR AED 395',
      marketTier: 'upper-middle',
      valueAedM2: 3600,
      activityMix: 'Serviced apartments 90% · F&B 10%',
    },
    {
      plotNumber: '612-0077',
      community: 'Business Bay',
      areaM2: 8100,
      zoning: 'MU-4',
      far: 7.0,
      landUse: 'Hotel + serviced apartments',
      status: 'Operating since 2018',
      performance: 'Occupancy 77%; ADR AED 690',
      marketTier: 'premium',
      valueAedM2: 6900,
      activityMix: 'Hotel 60% · serviced apts 40%',
    },
    {
      plotNumber: '364-0219',
      community: 'Al Quoz Industrial',
      coord: [55.2305, 25.1335],
      areaM2: 24500,
      zoning: 'I-1',
      far: 0.8,
      landUse: 'Warehousing',
      status: 'Operating since 2012',
      performance: 'Occupancy 97%; rent AED 420/m²',
      marketTier: 'middle',
      valueAedM2: 1450,
      activityMix: 'Warehousing 100%',
    },
  ],
};

// ---------------------------------------------------------------------------
// Builders

const ROAD_CLASS = { motorway: 'motorway', trunk: 'motorway', primary: 'primary', secondary: 'secondary', tertiary: 'secondary' };
const ROAD_LABEL = {
  motorway: 'highway',
  trunk: 'highway',
  primary: 'arterial',
  secondary: 'distributor',
  tertiary: 'collector',
  residential: 'local street',
  unclassified: 'local street',
  living_street: 'local street',
  service: 'service road',
};

const communityByName = (name) => getRegion().communities.find((c) => c.name === name) ?? null;
const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/** A deterministic point on land inside a named community, near the plot. */
function placeIn(plot, name, seed, maxM = 6000) {
  const c = communityByName(name);
  if (!c) return null;
  const water = getRegion().water.flatMap((w) => w.polygons);
  const rand = seededRandom(hash(`${plot.plotNumber}|${name}|${seed}`));
  const ring = c.polygons[0][0];
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  let fallback = c.labelPoint;
  for (let i = 0; i < 400; i++) {
    const pt = [x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0)];
    if (!c.polygons.some((poly) => pointInPolygon(pt, poly)) || water.some((poly) => pointInPolygon(pt, poly))) continue;
    if (pointInPolygon(pt, [plot.geometry])) continue;
    fallback = pt;
    if (distanceM(plot.center, pt) <= maxM) return pt;
  }
  return fallback;
}

function communitiesFor(plot, area) {
  const region = getRegion();
  const list = area.catchment
    .filter(([id]) => COMMUNITY_PROFILES[id])
    .map(([id, share, dist]) => {
      const c = region.communities.find((x) => x.id === id);
      const profile = COMMUNITY_PROFILES[id];
      const host = c.polygons.some((poly) => pointInPolygon(plot.center, poly));
      return {
        id,
        name: c.name,
        nameAr: c.ar,
        ...profile,
        areaKm2: c.areaKm2,
        catchmentShare: share,
        host,
        source: 'DSC-POP',
        centroid: c.labelPoint,
        polygons: c.polygons,
        density: Math.round(profile.population / c.areaKm2),
        distanceM: Math.round(host ? Math.min(dist, 400) : dist),
      };
    });
  return list.sort((a, b) => b.host - a.host || a.distanceM - b.distanceM);
}

function roadsFor(plot, area) {
  const region = getRegion();
  const all = [...region.roads.map((r) => ({ ...r, scope: 'region' })), ...area.roads.map((r) => ({ ...r, scope: 'area' }))];
  const out = [];
  for (const r of all) {
    // Unnamed collector-class roads still give access; unnamed minor lanes are skipped.
    if (!r.name && !['secondary', 'tertiary'].includes(r.cls)) continue;
    let nearestM = Infinity;
    for (const l of r.lines) nearestM = Math.min(nearestM, lineToRingM(l, plot.geometry));
    if (nearestM > 4000) continue;
    out.push({
      name: r.name ?? 'Unnamed road',
      nameAr: r.ar,
      osmClass: r.cls,
      cls: ROAD_CLASS[r.cls] ?? 'local',
      classLabel: ROAD_LABEL[r.cls] ?? 'road',
      source: 'RTA-NET',
      nearestM: Math.round(nearestM),
    });
  }
  // One entry per road name and class, keeping the nearest stretch.
  const best = new Map();
  for (const r of out) {
    const k = `${r.name}|${r.cls}`;
    if (!best.has(k) || best.get(k).nearestM > r.nearestM) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => a.nearestM - b.nearestM);
}

function poisFor(plot, area) {
  const pois = [];
  let n = 0;
  const R = plot.catchmentRadiusM;
  for (const p of area.places) {
    const d = distanceM(plot.center, p.coord);
    if (d > R) continue;
    const meta = POI_CATEGORIES[p.category];
    const rand = seededRandom(hash(`${p.name}|${p.coord.join(',')}`));
    n += 1;
    pois.push({
      id: `${plot.plotNumber}-poi-${n}`,
      category: p.category,
      source: meta.source,
      name: p.name,
      nameAr: p.ar,
      placeType: p.raw.replace(/_/g, ' '),
      coord: p.coord,
      distanceM: Math.round(d),
      openData: true,
      ...capacity(p, rand),
    });
  }
  area.busStops.forEach((coord, i) => {
    const d = distanceM(plot.center, coord);
    if (d > R) return;
    n += 1;
    pois.push({ id: `${plot.plotNumber}-poi-${n}`, category: 'bus', source: 'RTA', name: `Bus stop ${i + 1}`, placeType: 'bus stop', coord, distanceM: Math.round(d), openData: true });
  });
  // Metro: stations in the catchment plus the nearest operational and planned ones.
  const stations = getRegion()
    .stations.map((s) => ({ ...s, d: distanceM(plot.center, s.coord) }))
    .sort((a, b) => a.d - b.d);
  const pick = new Set(stations.filter((s) => s.d <= R));
  const op = stations.find((s) => s.status === 'operational');
  const planned = stations.find((s) => s.status === 'construction');
  if (op) pick.add(op);
  if (planned) pick.add(planned);
  for (const s of [...pick].sort((a, b) => a.d - b.d)) {
    n += 1;
    pois.push({
      id: `${plot.plotNumber}-poi-${n}`,
      category: 'metro',
      source: 'RTA',
      name: `${s.name} Metro Station`,
      nameAr: s.ar,
      placeType: `${METRO_LINES[s.line]}${s.status === 'construction' ? ' · under construction (opening 2029)' : ''}`,
      line: s.line,
      status: s.status,
      coord: s.coord,
      distanceM: Math.round(s.d),
      openData: true,
    });
  }
  return pois.sort((a, b) => a.distanceM - b.distanceM);
}

const cache = new Map();

/** Full context for a plot, built once and cached. */
export function getContext(plotNumber) {
  if (cache.has(plotNumber)) return cache.get(plotNumber);
  const plot = PLOTS.find((p) => p.plotNumber === plotNumber);
  if (!plot) return null;
  const area = getArea(plot.mapArea);
  const pois = poisFor(plot, area);
  const context = {
    plotNumber,
    area,
    communities: communitiesFor(plot, area),
    roads: roadsFor(plot, area),
    stations: pois.filter((x) => x.category === 'metro'),
    pois,
    market: MARKET[plotNumber],
    transactions: TRANSACTIONS[plotNumber].map((t, i) => {
      const coord = placeIn(plot, t.in, i, plot.catchmentRadiusM);
      return { ...t, community: t.in, coord, distanceM: Math.round(distanceM(plot.center, coord)), aedPerM2: Math.round(t.valueAed / t.areaM2) };
    }),
    comparables: COMPARABLES[plotNumber].map((c, i) => {
      const coord = c.coord ?? placeIn(plot, c.community, `comp-${i}`);
      return { ...c, coord, ring: rectangle(coord, Math.sqrt(c.areaM2) * 1.15, Math.sqrt(c.areaM2) * 0.87, 12), distanceM: Math.round(distanceM(plot.center, coord)) };
    }),
  };
  cache.set(plotNumber, context);
  return context;
}
