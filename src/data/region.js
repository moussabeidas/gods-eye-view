// Regional schematic of central-east Dubai for the overview map: water,
// the airport, principal highways and district names. Coordinates are
// approximate and for orientation only (the basemap is schematic).

import { offset } from '../engine/geo.js';

/** Buffer a polyline into a closed polygon of the given width (metres). */
function band(line, widthM) {
  const left = [];
  const right = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const k = Math.cos((line[i][1] * Math.PI) / 180);
    const dx = (b[0] - a[0]) * k;
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push(offset(line[i], (nx * widthM) / 2, (ny * widthM) / 2));
    right.push(offset(line[i], (-nx * widthM) / 2, (-ny * widthM) / 2));
  }
  const ring = [...left, ...right.reverse()];
  return [...ring, ring[0]];
}

const CREEK = [
  [55.2885, 25.269],
  [55.296, 25.2655],
  [55.301, 25.2625],
  [55.308, 25.26],
  [55.315, 25.258],
  [55.3215, 25.2545],
  [55.326, 25.249],
  [55.331, 25.243],
  [55.3365, 25.236],
  [55.3405, 25.229],
  [55.342, 25.222],
  [55.3405, 25.2145],
];

export const REGION = {
  water: [
    { name: 'Dubai Creek', ring: band(CREEK, 320) },
    {
      name: 'Ras Al Khor lagoon',
      ring: [
        [55.3315, 25.2135],
        [55.3455, 25.2155],
        [55.3595, 25.2065],
        [55.3675, 25.1925],
        [55.3605, 25.1805],
        [55.3435, 25.1785],
        [55.3315, 25.1885],
        [55.3275, 25.2005],
        [55.3315, 25.2135],
      ],
    },
  ],
  airport: {
    name: 'Dubai International Airport',
    ring: [
      [55.335, 25.262],
      [55.352, 25.2685],
      [55.392, 25.2455],
      [55.3885, 25.2315],
      [55.37, 25.228],
      [55.3405, 25.2475],
      [55.335, 25.262],
    ],
    runways: [
      [
        [55.3435, 25.2595],
        [55.383, 25.2375],
      ],
      [
        [55.3505, 25.2635],
        [55.389, 25.2415],
      ],
    ],
  },
  roads: [
    {
      name: 'Sheikh Zayed Road (E11)',
      cls: 'motorway',
      coords: [
        [55.295, 25.233],
        [55.282, 25.215],
        [55.27, 25.2],
        [55.25, 25.18],
        [55.22, 25.15],
      ],
    },
    {
      name: 'Al Khail Road (E44)',
      cls: 'motorway',
      coords: [
        [55.332, 25.215],
        [55.315, 25.2],
        [55.295, 25.185],
        [55.27, 25.16],
      ],
    },
    {
      name: 'Ras Al Khor Road',
      cls: 'motorway',
      coords: [
        [55.33, 25.21],
        [55.35, 25.197],
        [55.37, 25.185],
        [55.39, 25.18],
        [55.41, 25.18],
        [55.44, 25.178],
      ],
    },
    {
      name: 'Sheikh Mohammed Bin Zayed Road (E311)',
      cls: 'motorway',
      coords: [
        [55.425, 25.29],
        [55.415, 25.25],
        [55.405, 25.215],
        [55.4, 25.19],
        [55.39, 25.16],
        [55.37, 25.13],
      ],
    },
    {
      name: 'Dubai–Al Ain Road (E66)',
      cls: 'motorway',
      coords: [
        [55.33, 25.19],
        [55.36, 25.17],
        [55.39, 25.15],
        [55.43, 25.13],
      ],
    },
    {
      name: 'Airport Road',
      cls: 'primary',
      coords: [
        [55.33, 25.245],
        [55.35, 25.23],
        [55.37, 25.22],
        [55.39, 25.215],
        [55.42, 25.215],
        [55.45, 25.212],
      ],
    },
    {
      name: 'Oud Metha Road',
      cls: 'primary',
      coords: [
        [55.312, 25.255],
        [55.318, 25.238],
        [55.322, 25.222],
        [55.325, 25.205],
      ],
    },
    {
      name: 'Emirates Road (E611)',
      cls: 'motorway',
      coords: [
        [55.49, 25.3],
        [55.475, 25.24],
        [55.46, 25.19],
        [55.44, 25.14],
      ],
    },
  ],
  labels: [
    { name: 'Deira', coord: [55.322, 25.272] },
    { name: 'Bur Dubai', coord: [55.296, 25.25] },
    { name: 'Dubai Creek', coord: [55.318, 25.2515] },
    { name: 'Dubai International Airport', coord: [55.365, 25.2505] },
    { name: 'Ras Al Khor', coord: [55.35, 25.195] },
    { name: 'Business Bay', coord: [55.284, 25.188] },
    { name: 'Mirdif', coord: [55.42, 25.222] },
    { name: 'Nad Al Sheba', coord: [55.325, 25.162] },
  ],
};
