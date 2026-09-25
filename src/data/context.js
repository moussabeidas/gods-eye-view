// Representative surrounding context for each prototype plot: communities and
// demographics, road and transit network, points of interest, market
// benchmarks, DLD transactions and comparable plots. All values are simulated
// for demonstration (BRD DP-03) and deterministic between runs.

import { PLOTS } from './plots.js';
import { distanceM, offset, ringFromOffsets, rectangle, seededRandom } from '../engine/geo.js';

// ---------------------------------------------------------------------------
// Communities & demographics (represented as Dubai Statistics Center data)

const WARQAA_COMMUNITIES = [
  {
    id: 'warqaa-3',
    name: 'Al Warqa’a Third',
    at: [0, 0],
    radius: 1150,
    population: 21400,
    areaKm2: 3.1,
    growthPct: 4.1,
    households: 3890,
    householdSize: 5.5,
    ageGroups: { '0-4': 9, '5-17': 24, '18-34': 22, '35-54': 32, '55+': 13 },
    segments: { 'Emirati families': 58, 'Expat families': 34, 'Single professionals': 8 },
    incomeBand: 'Upper-middle',
  },
  {
    id: 'warqaa-2',
    name: 'Al Warqa’a Second',
    at: [-2150, 250],
    radius: 1000,
    population: 18900,
    areaKm2: 2.6,
    growthPct: 2.6,
    households: 3500,
    householdSize: 5.4,
    ageGroups: { '0-4': 8, '5-17': 23, '18-34': 23, '35-54': 31, '55+': 15 },
    segments: { 'Emirati families': 52, 'Expat families': 38, 'Single professionals': 10 },
    incomeBand: 'Upper-middle',
  },
  {
    id: 'warqaa-4',
    name: 'Al Warqa’a Fourth',
    at: [1900, -1500],
    radius: 1050,
    population: 9800,
    areaKm2: 2.9,
    growthPct: 7.8,
    households: 1720,
    householdSize: 5.7,
    ageGroups: { '0-4': 11, '5-17': 26, '18-34': 21, '35-54': 31, '55+': 11 },
    segments: { 'Emirati families': 66, 'Expat families': 29, 'Single professionals': 5 },
    incomeBand: 'Upper-middle',
  },
  {
    id: 'mizhar-1',
    name: 'Mizhar First',
    at: [1700, 1750],
    radius: 1100,
    population: 16200,
    areaKm2: 3.4,
    growthPct: 3.2,
    households: 2950,
    householdSize: 5.5,
    ageGroups: { '0-4': 9, '5-17': 25, '18-34': 21, '35-54': 32, '55+': 13 },
    segments: { 'Emirati families': 61, 'Expat families': 31, 'Single professionals': 8 },
    incomeBand: 'Upper-middle',
  },
  {
    id: 'nad-al-hamar',
    name: 'Nad Al Hamar',
    at: [-1500, 2250],
    radius: 1000,
    population: 14500,
    areaKm2: 2.8,
    growthPct: 1.9,
    households: 2740,
    householdSize: 5.3,
    ageGroups: { '0-4': 7, '5-17': 22, '18-34': 24, '35-54': 31, '55+': 16 },
    segments: { 'Emirati families': 49, 'Expat families': 39, 'Single professionals': 12 },
    incomeBand: 'Middle',
  },
];

const JADDAF_COMMUNITIES = [
  {
    id: 'jaddaf',
    name: 'Al Jaddaf',
    at: [0, 0],
    radius: 900,
    population: 12600,
    areaKm2: 2.2,
    growthPct: 9.4,
    households: 5480,
    householdSize: 2.3,
    ageGroups: { '0-4': 5, '5-17': 9, '18-34': 46, '35-54': 33, '55+': 7 },
    segments: { 'Young professionals': 52, 'Expat families': 31, 'Emirati families': 6, 'Visitors / short-stay': 11 },
    incomeBand: 'Upper-middle',
    daytimeWorkers: 21000,
  },
  {
    id: 'umm-hurair-2',
    name: 'Umm Hurair Second',
    at: [-1500, 900],
    radius: 850,
    population: 21000,
    areaKm2: 2.6,
    growthPct: 2.1,
    households: 7000,
    householdSize: 3.0,
    ageGroups: { '0-4': 6, '5-17': 14, '18-34': 38, '35-54': 32, '55+': 10 },
    segments: { 'Young professionals': 34, 'Expat families': 45, 'Emirati families': 13, 'Visitors / short-stay': 8 },
    incomeBand: 'Middle',
    daytimeWorkers: 26000,
  },
  {
    id: 'oud-metha',
    name: 'Oud Metha',
    at: [-1850, -700],
    radius: 800,
    population: 17500,
    areaKm2: 2.4,
    growthPct: 1.6,
    households: 6250,
    householdSize: 2.8,
    ageGroups: { '0-4': 6, '5-17': 13, '18-34': 40, '35-54': 32, '55+': 9 },
    segments: { 'Young professionals': 41, 'Expat families': 42, 'Emirati families': 9, 'Visitors / short-stay': 8 },
    incomeBand: 'Middle',
    daytimeWorkers: 31000,
  },
  {
    id: 'culture-village',
    name: 'Culture Village',
    at: [1250, 1150],
    radius: 700,
    population: 6200,
    areaKm2: 1.5,
    growthPct: 6.2,
    households: 2580,
    householdSize: 2.4,
    ageGroups: { '0-4': 5, '5-17': 10, '18-34': 44, '35-54': 34, '55+': 7 },
    segments: { 'Young professionals': 48, 'Expat families': 30, 'Emirati families': 7, 'Visitors / short-stay': 15 },
    incomeBand: 'Upper-middle',
    daytimeWorkers: 7000,
  },
  {
    id: 'dhcc',
    name: 'Dubai Healthcare City',
    at: [-500, -1350],
    radius: 750,
    population: 8400,
    areaKm2: 1.9,
    growthPct: 4.8,
    households: 3350,
    householdSize: 2.5,
    ageGroups: { '0-4': 5, '5-17': 11, '18-34': 42, '35-54': 34, '55+': 8 },
    segments: { 'Young professionals': 46, 'Expat families': 37, 'Emirati families': 5, 'Visitors / short-stay': 12 },
    incomeBand: 'Upper-middle',
    daytimeWorkers: 24000,
  },
];

// ---------------------------------------------------------------------------
// Road, transit and water network (schematic; represented as RTA network data)

const WARQAA_ROADS = [
  {
    name: 'Al Warqa’a Distributor (D-81)',
    cls: 'secondary',
    lanes: 4,
    path: [
      [-3200, -80],
      [-900, -78],
      [0, -80],
      [1200, -120],
      [3200, -260],
    ],
  },
  {
    name: 'Local Street 17',
    cls: 'local',
    lanes: 2,
    path: [
      [-92, -600],
      [-92, -78],
      [-95, 520],
      [-60, 1200],
    ],
  },
  {
    name: 'Tripoli Street (arterial)',
    cls: 'primary',
    lanes: 6,
    path: [
      [-3200, 1450],
      [-1000, 1300],
      [800, 1050],
      [3200, 820],
    ],
  },
  {
    name: 'Mizhar Link Road',
    cls: 'secondary',
    lanes: 4,
    path: [
      [1250, -3000],
      [1180, -900],
      [1150, 800],
      [1250, 3000],
    ],
  },
  {
    name: 'Sheikh Mohammed Bin Zayed Rd (E311)',
    cls: 'motorway',
    lanes: 12,
    path: [
      [-2900, -3200],
      [-2500, -800],
      [-2250, 1400],
      [-2000, 3200],
    ],
  },
  {
    name: 'Community Street 4',
    cls: 'local',
    lanes: 2,
    path: [
      [-1800, -700],
      [-300, -650],
      [900, -700],
    ],
  },
  {
    name: 'Community Street 9',
    cls: 'local',
    lanes: 2,
    path: [
      [-1600, 600],
      [0, 560],
      [1100, 500],
    ],
  },
  {
    name: 'Community Street 22',
    cls: 'local',
    lanes: 2,
    path: [
      [500, -1300],
      [520, -80],
      [540, 1000],
    ],
  },
  {
    name: 'Community Street 31',
    cls: 'local',
    lanes: 2,
    path: [
      [-900, -1500],
      [-880, -80],
      [-860, 1250],
    ],
  },
];

const JADDAF_ROADS = [
  {
    name: 'Al Jaddaf Collector',
    cls: 'secondary',
    lanes: 4,
    path: [
      [75, -1800],
      [70, -60],
      [110, 900],
      [400, 1800],
    ],
  },
  {
    name: 'Service Lane 3',
    cls: 'local',
    lanes: 2,
    path: [
      [-70, -300],
      [-75, 60],
      [-40, 400],
    ],
  },
  {
    name: 'Oud Metha Road',
    cls: 'primary',
    lanes: 6,
    path: [
      [-1900, -2200],
      [-1350, -300],
      [-900, 1200],
      [-600, 2400],
    ],
  },
  {
    name: 'Al Khail Road (E44)',
    cls: 'motorway',
    lanes: 10,
    path: [
      [-2600, -1250],
      [-600, -900],
      [900, -650],
      [2600, -500],
    ],
  },
  {
    name: 'Creek Boulevard',
    cls: 'secondary',
    lanes: 4,
    path: [
      [200, 350],
      [900, 800],
      [1700, 1500],
      [2300, 2100],
    ],
  },
  {
    name: 'Healthcare City Road',
    cls: 'secondary',
    lanes: 4,
    path: [
      [-1600, -1250],
      [-400, -1300],
      [600, -1500],
    ],
  },
  {
    name: 'Jaddaf Street 12',
    cls: 'local',
    lanes: 2,
    path: [
      [-900, 250],
      [-100, 230],
      [700, 260],
    ],
  },
  {
    name: 'Jaddaf Street 18',
    cls: 'local',
    lanes: 2,
    path: [
      [-800, -450],
      [0, -420],
      [800, -380],
    ],
  },
];

const JADDAF_METRO = {
  name: 'Metro Green Line',
  path: [
    [-2400, 1900],
    [-1400, 1100],
    [-420, 150],
    [-380, -120],
    [-300, -700],
    [400, -1600],
    [1400, -2400],
  ],
  stations: [
    { name: 'Al Jaddaf Metro Station', at: [-385, -110] },
    { name: 'Dubai Healthcare City Metro Station', at: [-330, -1180] },
    { name: 'Creek Metro Station', at: [-1450, 1130] },
  ],
};

const JADDAF_WATER = [
  [600, 450],
  [1500, 1150],
  [2600, 1900],
  [3200, 2600],
  [3200, 3300],
  [2300, 2800],
  [1300, 1800],
  [300, 900],
  [-600, 1900],
  [-1000, 1700],
  [200, 600],
];

// ---------------------------------------------------------------------------
// Points of interest (represented as licence registers and facility directories)

const POI_SPECS = {
  '426-0318': [
    {
      category: 'supermarket',
      source: 'DET-LIC',
      items: [
        { name: 'Warqa Fresh Market', gla: 1800, at: [-1650, 420] },
        { name: 'Mizhar Family Grocer', gla: 650, at: [1500, 1480] },
      ],
    },
    {
      category: 'convenience',
      source: 'DET-LIC',
      count: 8,
      gla: 120,
      names: ['Al Noor Baqala', 'Corner Mini Mart', 'Daily Needs Grocery', 'Al Warqa Baqala', 'Quick Stop', 'Family Mart Express', 'Green Leaf Grocery', 'Mizhar Mini Market'],
      minR: 400,
      maxR: 2400,
    },
    {
      category: 'retail',
      source: 'DET-LIC',
      items: [
        { name: 'Warqa Strip Retail A', gla: 1600, at: [-2050, -30] },
        { name: 'Mizhar Parade Shops', gla: 2100, at: [1600, 1250] },
        { name: 'Nad Al Hamar Row Retail', gla: 900, at: [-1400, 2050] },
      ],
    },
    {
      category: 'fnb',
      source: 'DET-LIC',
      count: 9,
      names: ['Karak House', 'Shawarma Corner', 'Café Qahwa', 'Pizza Point', 'Grill & Greens', 'Tea Time Cafeteria', 'Burger Yard', 'Al Fanar Kitchen', 'Juice Lab'],
      minR: 600,
      maxR: 2400,
    },
    {
      category: 'school',
      source: 'KHDA',
      items: [
        { name: 'Warqa International School', capacity: 1650, enrolled: 1605, curriculum: 'British', at: [-1750, -650] },
        { name: 'Al Mizhar American Academy', capacity: 1200, enrolled: 1188, curriculum: 'American', at: [2000, 1950] },
        { name: 'Nad Al Hamar Model School', capacity: 2100, enrolled: 1995, curriculum: 'MoE', at: [-1250, 2450] },
      ],
    },
    {
      category: 'nursery',
      source: 'KHDA',
      items: [
        { name: 'Little Pearls Nursery', capacity: 140, enrolled: 138, at: [-520, 780] },
        { name: 'Sunshine Early Learning', capacity: 110, enrolled: 106, at: [2100, -1300] },
      ],
    },
    {
      category: 'clinic',
      source: 'DHA',
      items: [
        { name: 'Al Warqa Health Centre (DHA)', rooms: 12, at: [-2200, 700] },
        { name: 'Mizhar Family Clinic', rooms: 6, at: [1850, 1600] },
      ],
    },
    { category: 'pharmacy', source: 'DHA', count: 4, names: ['Life Care Pharmacy', 'Warqa Pharmacy', 'Mizhar Pharmacy', 'Aster-style Pharmacy'], minR: 500, maxR: 2300 },
    { category: 'sports', source: 'DSC-SPORT', items: [{ name: 'Warqa Community Gym', area: 450, at: [-1900, 350] }] },
    {
      category: 'park',
      source: 'DM-PARKS',
      items: [
        { name: 'Al Warqa’a Pond Park', area: 42000, at: [700, 700] },
        { name: 'Mizhar Neighbourhood Park', area: 18000, at: [1800, 2150] },
        { name: 'Warqa Second Community Park', area: 15000, at: [-2300, -400] },
      ],
    },
    { category: 'mosque', source: 'IACAD', count: 5, names: ['Al Warqa Mosque', 'Mizhar Grand Mosque', 'Nad Al Hamar Mosque', 'Al Rahma Mosque', 'Al Taqwa Mosque'], minR: 300, maxR: 2400 },
    {
      category: 'fuel',
      source: 'DET-LIC',
      items: [
        { name: 'Fuel Station — Tripoli St', at: [-600, 1350] },
        { name: 'Fuel Station — Mizhar Link', at: [1220, -1100] },
      ],
    },
    { category: 'bus', source: 'RTA', count: 6, names: ['Bus Stop W31', 'Bus Stop W32', 'Bus Stop W40', 'Bus Stop M12', 'Bus Stop M15', 'Bus Stop N07'], minR: 250, maxR: 1800 },
  ],
  '332-0914': [
    {
      category: 'hotel',
      source: 'DET-TOUR',
      items: [
        { name: 'Creekside Grand Hotel', keys: 420, stars: 5, at: [720, 780] },
        { name: 'Jaddaf Waterfront Hotel', keys: 310, stars: 4, at: [480, 520] },
        { name: 'Culture Village Resort', keys: 380, stars: 5, at: [1350, 1300] },
        { name: 'Healthcare City Inn', keys: 190, stars: 3, at: [-420, -1450] },
        { name: 'Oud Metha Suites Hotel', keys: 260, stars: 4, at: [-1650, -520] },
        { name: 'Umm Hurair Business Hotel', keys: 240, stars: 4, at: [-1300, 780] },
        { name: 'Metro Link Hotel', keys: 280, stars: 3, at: [-520, 150] },
        { name: 'Creek Heights Hotel', keys: 330, stars: 4, at: [950, 400] },
        { name: 'Grand Boulevard Hotel', keys: 210, stars: 4, at: [-1100, 1400] },
      ],
    },
    {
      category: 'serviced-apartments',
      source: 'DET-TOUR',
      items: [
        { name: 'Jaddaf Residences (hotel apartments)', keys: 180, at: [300, -320] },
        { name: 'Creek View Hotel Apartments', keys: 220, at: [820, 1050] },
        { name: 'DHCC Stay Apartments', keys: 140, at: [-700, -1100] },
      ],
    },
    {
      category: 'office',
      source: 'DET-LIC',
      items: [
        { name: 'Jaddaf Business Tower', nla: 24000, at: [250, 180] },
        { name: 'Creek Business Centre', nla: 18000, at: [-250, 420] },
        { name: 'Healthcare City Offices', nla: 31000, at: [-600, -1500] },
        { name: 'Oud Metha Commercial Tower', nla: 21000, at: [-1500, -350] },
        { name: 'Umm Hurair Plaza Offices', nla: 16000, at: [-1400, 1050] },
        { name: 'Al Khail Gate Offices', nla: 27000, at: [1100, -700] },
      ],
    },
    {
      category: 'retail',
      source: 'DET-LIC',
      items: [
        { name: 'Jaddaf Walk Retail', gla: 6500, at: [520, 250] },
        { name: 'Wafi-style Lifestyle Mall', gla: 42000, at: [-1750, 250] },
        { name: 'Culture Village Promenade', gla: 5200, at: [1400, 1050] },
      ],
    },
    {
      category: 'fnb',
      source: 'DET-LIC',
      count: 24,
      names: [
        'Creek Café',
        'Dhow & Co.',
        'Metro Bites',
        'Levant Kitchen',
        'Sushi Bar Jaddaf',
        'Espresso Lab',
        'Biryani House',
        'Healthy Bowl',
        'Rooftop Grill',
        'Bakery 21',
        'Karak Station',
        'Noodle Point',
        'Pasta Mia',
        'Tea Lounge',
        'Burger Station',
        'Mezze Terrace',
        'Juice Corner',
        'Chai Walla',
        'Crepe House',
        'Falafel Stop',
        'Steak Room',
        'Pizza Forno',
        'Taco Stand',
        'Waffle Co.',
      ],
      minR: 150,
      maxR: 1900,
    },
    {
      category: 'supermarket',
      source: 'DET-LIC',
      items: [
        { name: 'Jaddaf Daily Supermarket', gla: 900, at: [380, -150] },
        { name: 'Oud Metha Hypermarket', gla: 5200, at: [-1700, 50] },
        { name: 'Culture Village Market', gla: 700, at: [1150, 1350] },
        { name: 'DHCC Grocer', gla: 450, at: [-650, -1250] },
      ],
    },
    {
      category: 'clinic',
      source: 'DHA',
      items: [
        { name: 'City Hospital (DHCC)', rooms: 140, at: [-550, -1550] },
        { name: 'Creek Medical Centre', rooms: 18, at: [420, 620] },
        { name: 'Jaddaf Family Clinic', rooms: 8, at: [-150, -520] },
        { name: 'Oud Metha Specialist Clinic', rooms: 22, at: [-1400, -800] },
        { name: 'Healthcare City Day Surgery', rooms: 36, at: [-250, -1650] },
      ],
    },
    {
      category: 'school',
      source: 'KHDA',
      items: [
        { name: 'Creek International School', capacity: 1400, enrolled: 1260, curriculum: 'IB', at: [-1200, 1600] },
        { name: 'Oud Metha Indian School', capacity: 2400, enrolled: 2330, curriculum: 'CBSE', at: [-1850, -1050] },
      ],
    },
    {
      category: 'sports',
      source: 'DSC-SPORT',
      items: [
        { name: 'Jaddaf Fitness Club', area: 1200, at: [600, -380] },
        { name: 'Creek Sports Courts', area: 3400, at: [1000, 950] },
        { name: 'Oud Metha Sports Complex', area: 9500, at: [-1650, -1250] },
      ],
    },
    {
      category: 'attraction',
      source: 'DET-TOUR',
      items: [
        { name: 'Creek Waterfront Promenade', at: [800, 900] },
        { name: 'Jaddaf Arts & Culture Venue', at: [1500, 1500] },
        { name: 'Dhow Heritage Wharf', at: [300, 850] },
      ],
    },
    { category: 'bus', source: 'RTA', count: 7, names: ['Bus Stop J02', 'Bus Stop J05', 'Bus Stop J09', 'Bus Stop O14', 'Bus Stop O21', 'Bus Stop H03', 'Bus Stop C11'], minR: 150, maxR: 1500 },
  ],
};

export const POI_CATEGORIES = {
  supermarket: { label: 'Supermarket', group: 'commercial', color: '#22c55e' },
  convenience: { label: 'Convenience store', group: 'commercial', color: '#4ade80' },
  retail: { label: 'Retail', group: 'commercial', color: '#10b981' },
  fnb: { label: 'Food & beverage', group: 'commercial', color: '#f59e0b' },
  hotel: { label: 'Hotel', group: 'commercial', color: '#e879f9' },
  'serviced-apartments': { label: 'Serviced apartments', group: 'commercial', color: '#c084fc' },
  office: { label: 'Office', group: 'commercial', color: '#60a5fa' },
  school: { label: 'School', group: 'community', color: '#38bdf8' },
  nursery: { label: 'Nursery', group: 'community', color: '#7dd3fc' },
  clinic: { label: 'Healthcare', group: 'community', color: '#f87171' },
  pharmacy: { label: 'Pharmacy', group: 'community', color: '#fca5a5' },
  sports: { label: 'Sports facility', group: 'community', color: '#fb923c' },
  park: { label: 'Park', group: 'community', color: '#84cc16' },
  mosque: { label: 'Mosque', group: 'community', color: '#a3a3a3' },
  attraction: { label: 'Attraction', group: 'community', color: '#facc15' },
  fuel: { label: 'Fuel station', group: 'infrastructure', color: '#94a3b8' },
  bus: { label: 'Bus stop', group: 'infrastructure', color: '#cbd5e1' },
  metro: { label: 'Metro station', group: 'infrastructure', color: '#ef4444' },
};

// ---------------------------------------------------------------------------
// Market data (represented as RERA indices, DLD transactions and third-party research)

const MARKET = {
  '426-0318': {
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
    footfall: { label: 'Average daily traffic, distributor road', value: 18400, unit: 'vehicles/day', source: 'RTA-NET' },
  },
  '332-0914': {
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
      hotelPipeline: { label: 'Hotel keys pipeline (3 yrs, catchment)', value: 520, unit: 'keys', source: 'TP-MARKET' },
      officePipeline: { label: 'Office NLA pipeline (3 yrs, catchment)', value: 64000, unit: 'm²', source: 'TP-MARKET' },
      residentialPipeline: { label: 'Apartment pipeline (3 yrs, catchment)', value: 2600, unit: 'units', source: 'TP-MARKET' },
      servicedPipeline: { label: 'Serviced apartment pipeline (3 yrs)', value: 360, unit: 'keys', source: 'TP-MARKET' },
    },
    priceIndex: {
      label: 'Creek corridor hotel RevPAR index (2023 Q1 = 100)',
      source: 'DET-TOUR',
      series: [100, 96, 104, 112, 108, 103, 111, 119, 116, 110, 118, 126, 123, 117],
      start: '2023 Q1',
    },
    footfall: { label: 'Al Jaddaf Metro daily ridership', value: 14800, unit: 'passengers/day', source: 'RTA-NET' },
    visitors: { label: 'Annual overnight visitors, Creek corridor', value: 1.9, unit: 'million', growthPct: 7.5, source: 'DET-TOUR' },
  },
};

const TRANSACTIONS = {
  '426-0318': [
    { id: 'DLD-2026-118204', date: '2026-06-12', type: 'Sale', property: 'Commercial land', areaM2: 9200, valueAed: 15.2e6, at: [2300, 1650] },
    { id: 'DLD-2026-103551', date: '2026-04-03', type: 'Sale', property: 'Commercial land', areaM2: 14100, valueAed: 21.8e6, at: [-2600, 500] },
    { id: 'DLD-2025-287713', date: '2025-12-19', type: 'Sale', property: 'Villa', areaM2: 780, valueAed: 4.6e6, at: [450, 950] },
    { id: 'DLD-2025-276190', date: '2025-11-25', type: 'Sale', property: 'Villa', areaM2: 820, valueAed: 4.9e6, at: [-700, -900] },
    { id: 'DLD-2026-099812', date: '2026-03-20', type: 'Lease registration', property: 'Retail unit', areaM2: 320, valueAed: 352e3, at: [1620, 1300] },
    { id: 'DLD-2026-121007', date: '2026-06-30', type: 'Lease registration', property: 'Retail unit', areaM2: 180, valueAed: 207e3, at: [-2000, 40] },
    { id: 'DLD-2025-244588', date: '2025-09-14', type: 'Sale', property: 'Villa', areaM2: 760, valueAed: 4.3e6, at: [1900, -1700] },
    { id: 'DLD-2026-110734', date: '2026-05-08', type: 'Sale', property: 'Residential land', areaM2: 1400, valueAed: 3.1e6, at: [2200, -1100] },
  ],
  '332-0914': [
    { id: 'DLD-2026-120588', date: '2026-06-25', type: 'Sale', property: 'Mixed-use land', areaM2: 7800, valueAed: 148e6, at: [600, 1100] },
    { id: 'DLD-2026-097340', date: '2026-03-11', type: 'Sale', property: 'Hotel apartment', areaM2: 62, valueAed: 1.45e6, at: [820, 1050] },
    { id: 'DLD-2025-281115', date: '2025-12-05', type: 'Sale', property: 'Office floor', areaM2: 1450, valueAed: 27.6e6, at: [250, 180] },
    { id: 'DLD-2026-104221', date: '2026-04-16', type: 'Sale', property: 'Apartment', areaM2: 118, valueAed: 2.35e6, at: [1250, 1180] },
    { id: 'DLD-2026-112930', date: '2026-05-21', type: 'Lease registration', property: 'Office unit', areaM2: 410, valueAed: 615e3, at: [-250, 420] },
    { id: 'DLD-2025-259602', date: '2025-10-02', type: 'Sale', property: 'Mixed-use land', areaM2: 11200, valueAed: 196e6, at: [-1300, 1300] },
    { id: 'DLD-2026-116478', date: '2026-06-03', type: 'Sale', property: 'Apartment', areaM2: 86, valueAed: 1.68e6, at: [-150, 650] },
    { id: 'DLD-2026-101776', date: '2026-03-28', type: 'Lease registration', property: 'Retail unit', areaM2: 140, valueAed: 245e3, at: [520, 250] },
  ],
};

const COMPARABLES = {
  '426-0318': [
    {
      plotNumber: '427-0122',
      community: 'Mizhar First',
      at: [2350, 1800],
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
      plotNumber: '425-0547',
      community: 'Al Warqa’a Second',
      at: [-2500, 600],
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
      plotNumber: '428-0915',
      community: 'Al Warqa’a Fourth',
      at: [2100, -1900],
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
      plotNumber: '421-0376',
      community: 'Nad Al Hamar',
      at: [-1700, 2700],
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
      plotNumber: '263-0741',
      community: 'Mirdif',
      at: [-4200, 4800],
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
      at: [-26000, -9000],
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
      plotNumber: '426-0402',
      community: 'Al Warqa’a Third',
      at: [650, -1150],
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
  '332-0914': [
    {
      plotNumber: '332-0661',
      community: 'Al Jaddaf',
      at: [600, 1100],
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
      plotNumber: '332-0288',
      community: 'Al Jaddaf',
      at: [480, 520],
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
      community: 'Umm Hurair Second',
      at: [-1300, 1300],
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
      plotNumber: '332-0120',
      community: 'Al Jaddaf',
      at: [250, 180],
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
      plotNumber: '334-0935',
      community: 'Culture Village',
      at: [1250, 1180],
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
      at: [-700, -1100],
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
      at: [-9500, -3200],
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
      at: [-14200, -9800],
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

function poisFor(plot) {
  const specs = POI_SPECS[plot.plotNumber] ?? [];
  const rand = seededRandom(Number(plot.plotNumber.replace('-', '')));
  const pois = [];
  let n = 0;
  for (const spec of specs) {
    const entries = spec.items
      ? spec.items
      : spec.names.slice(0, spec.count).map((name) => {
          const angle = rand() * Math.PI * 2;
          const r = spec.minR + rand() * (spec.maxR - spec.minR);
          return { name, gla: spec.gla, at: [Math.cos(angle) * r, Math.sin(angle) * r] };
        });
    for (const e of entries) {
      n += 1;
      const coord = offset(plot.center, e.at[0], e.at[1]);
      const { at, ...attrs } = e;
      pois.push({
        id: `${plot.plotNumber}-poi-${n}`,
        category: spec.category,
        source: spec.source,
        coord,
        distanceM: Math.round(distanceM(plot.center, coord)),
        ...attrs,
      });
    }
  }
  if (plot.plotNumber === '332-0914') {
    for (const s of JADDAF_METRO.stations) {
      n += 1;
      const coord = offset(plot.center, s.at[0], s.at[1]);
      pois.push({ id: `${plot.plotNumber}-poi-${n}`, category: 'metro', source: 'RTA', name: s.name, coord, distanceM: Math.round(distanceM(plot.center, coord)) });
    }
  }
  return pois.sort((a, b) => a.distanceM - b.distanceM);
}

function communityRing(center, at, radius, seed) {
  const rand = seededRandom(seed);
  const offsets = [];
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 + 0.3;
    const r = radius * (0.82 + rand() * 0.3);
    offsets.push([at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r]);
  }
  return ringFromOffsets(center, offsets);
}

function neighbourPlots(plot, roads) {
  const rand = seededRandom(Number(plot.plotNumber.replace('-', '')) + 7);
  const out = [];
  const isVilla = plot.plotNumber === '426-0318';
  const w = isVilla ? 34 : 70;
  const h = isVilla ? 28 : 60;
  const gap = isVilla ? 8 : 18;
  const extent = isVilla ? 420 : 520;
  const roadPts = roads.flatMap((r) => densify(r.path, 20));
  for (let x = -extent; x <= extent; x += w + gap) {
    for (let y = -extent; y <= extent; y += h + gap) {
      if (Math.abs(x) < 125 && Math.abs(y) < 110) continue;
      const nearRoad = roadPts.some(([rx, ry]) => Math.abs(rx - x) < w / 2 + 12 && Math.abs(ry - y) < h / 2 + 12);
      if (nearRoad) continue;
      if (rand() < 0.12) continue;
      const use = isVilla ? (rand() < 0.88 ? 'Residential villa' : 'Open space') : ['Residential apartments', 'Office', 'Hotel', 'Mixed use', 'Open space'][Math.floor(rand() * 5)];
      out.push({ ring: rectangle(offset(plot.center, x, y), w, h, isVilla ? 0 : 28), use, plotNumber: `${plot.communityCode}-${String(Math.floor(rand() * 9000) + 1000)}` });
    }
  }
  return out;
}

function densify(path, stepM) {
  const pts = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [x1, y1] = path[i];
    const [x2, y2] = path[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.ceil(len / stepM));
    for (let k = 0; k <= n; k++) pts.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n]);
  }
  return pts;
}

const cache = new Map();

/** Full representative context for a plot, built once and cached. */
export function getContext(plotNumber) {
  if (cache.has(plotNumber)) return cache.get(plotNumber);
  const plot = PLOTS.find((p) => p.plotNumber === plotNumber);
  if (!plot) return null;
  const isWarqaa = plot.plotNumber === '426-0318';
  const communitiesRaw = isWarqaa ? WARQAA_COMMUNITIES : JADDAF_COMMUNITIES;
  const roadsRaw = isWarqaa ? WARQAA_ROADS : JADDAF_ROADS;

  const communities = communitiesRaw.map((c, i) => {
    const centroid = offset(plot.center, c.at[0], c.at[1]);
    return {
      ...c,
      source: 'DSC-POP',
      centroid,
      ring: communityRing(plot.center, c.at, c.radius, i + 11),
      density: Math.round(c.population / c.areaKm2),
      distanceM: Math.round(distanceM(plot.center, centroid)),
    };
  });

  const roads = roadsRaw.map((r) => ({
    ...r,
    source: 'RTA-NET',
    coords: r.path.map(([x, y]) => offset(plot.center, x, y)),
    nearestM: Math.round(Math.min(...densify(r.path, 10).map(([x, y]) => Math.hypot(x, y)))),
  }));

  const metro = isWarqaa ? null : { ...JADDAF_METRO, source: 'RTA-NET', coords: JADDAF_METRO.path.map(([x, y]) => offset(plot.center, x, y)) };

  const water = isWarqaa ? null : ringFromOffsets(plot.center, JADDAF_WATER);

  const context = {
    plotNumber,
    communities,
    roads,
    metro,
    water,
    pois: poisFor(plot),
    neighbours: neighbourPlots(plot, roadsRaw),
    market: MARKET[plotNumber],
    transactions: TRANSACTIONS[plotNumber].map((t) => {
      const coord = offset(plot.center, t.at[0], t.at[1]);
      return { ...t, coord, distanceM: Math.round(distanceM(plot.center, coord)), aedPerM2: Math.round(t.valueAed / t.areaM2) };
    }),
    comparables: COMPARABLES[plotNumber].map((c) => {
      const coord = offset(plot.center, c.at[0], c.at[1]);
      return { ...c, coord, ring: rectangle(coord, Math.sqrt(c.areaM2) * 1.15, Math.sqrt(c.areaM2) * 0.87, 12), distanceM: Math.round(distanceM(plot.center, coord)) };
    }),
  };
  cache.set(plotNumber, context);
  return context;
}
