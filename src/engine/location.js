// Stage 2 — Location & Market Intelligence (BRD §11, FR-014 – FR-019).

import { POI_CATEGORIES } from '../data/context.js';
import { catchmentWeight } from '../data/methodology.js';
import { SOURCE_SYSTEMS } from '../data/sources.js';
import { sourced, calculated, aiText } from './provenance.js';

const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export function poiDocId(plot, category, source) {
  return `${source}:${category.toUpperCase()}-${plot.plotNumber}`;
}

export function analyseLocation(plot, ctx) {
  const p = plot.plotNumber;
  const R = plot.catchmentRadiusM;

  // Demographics — distance-weighted catchment (no fixed methodology required, §11.2).
  const weighted = ctx.communities.map((c) => ({ ...c, weight: round(catchmentWeight(c.distanceM, R), 2) }));
  const residents = weighted.reduce((s, c) => s + c.population * c.weight, 0);
  const workers = weighted.reduce((s, c) => s + (c.daytimeWorkers ?? 0) * c.weight, 0);
  const households = weighted.reduce((s, c) => s + c.households * c.weight, 0);
  const wAvg = (fn) => weighted.reduce((s, c) => s + fn(c) * c.population * c.weight, 0) / residents;
  const ageGroups = Object.fromEntries(
    Object.keys(weighted[0].ageGroups).map((k) => [
      k,
      round(
        wAvg((c) => c.ageGroups[k]),
        1,
      ),
    ]),
  );
  const segKeys = [...new Set(weighted.flatMap((c) => Object.keys(c.segments)))];
  const segments = Object.fromEntries(
    segKeys.map((k) => [
      k,
      round(
        wAvg((c) => c.segments[k] ?? 0),
        1,
      ),
    ]),
  );
  const growthPct = round(
    wAvg((c) => c.growthPct),
    1,
  );
  const popDocs = weighted.map((c) => `DSC-POP:POP-${c.id}`);

  const demographics = {
    communities: weighted,
    residents: calculated(Math.round(residents), 'Σ community population × catchment weight', { sources: popDocs }),
    workers: workers ? calculated(Math.round(workers), 'Σ daytime workers × catchment weight', { sources: popDocs }) : null,
    households: calculated(Math.round(households), 'Σ households × catchment weight', { sources: popDocs }),
    householdSize: calculated(
      round(
        wAvg((c) => c.householdSize),
        1,
      ),
      'Population-weighted average',
      { sources: popDocs },
    ),
    density: sourced(weighted[0].density, [`DSC-POP:POP-${weighted[0].id}`], { unit: 'per km²' }),
    growthPct: calculated(growthPct, 'Population-weighted annual growth', { sources: popDocs, unit: '%' }),
    ageGroups: calculated(ageGroups, 'Population-weighted age structure', { sources: popDocs }),
    segments: calculated(segments, 'Population-weighted segments', { sources: popDocs }),
    incomeBand: sourced(weighted[0].incomeBand, [`DSC-POP:POP-${weighted[0].id}`]),
  };

  // Infrastructure & accessibility.
  const accessDoc = `RTA-NET:ACCESS-${p}`;
  const nearest = (cls) => ctx.roads.filter((r) => cls.includes(r.cls)).sort((a, b) => a.nearestM - b.nearestM)[0];
  const frontRoad = nearest(['secondary', 'primary']);
  const arterial = nearest(['primary', 'motorway']);
  const metro = ctx.pois.find((x) => x.category === 'metro');
  const busStops800 = ctx.pois.filter((x) => x.category === 'bus' && x.distanceM <= 800).length;
  const components = [
    { label: 'Frontage to distributor or collector road', score: frontRoad && frontRoad.nearestM <= 150 ? 10 : frontRoad && frontRoad.nearestM <= 500 ? 6 : 3, weight: 0.35 },
    { label: 'Arterial / highway within 1.5 km', score: arterial && arterial.nearestM <= 1500 ? (arterial.nearestM <= 800 ? 9 : 7) : 4, weight: 0.25 },
    { label: 'Metro station within 800 m', score: metro ? (metro.distanceM <= 500 ? 10 : metro.distanceM <= 800 ? 8 : 5) : 2, weight: 0.25 },
    { label: 'Bus stops within 800 m', score: Math.min(10, 3 + busStops800 * 2), weight: 0.15 },
  ];
  const accessScore = round(
    components.reduce((s, x) => s + x.score * x.weight, 0),
    1,
  );
  const accessibility = {
    score: calculated(accessScore, 'Weighted accessibility components (0–10)', { sources: [accessDoc] }),
    components,
    frontRoad: frontRoad && sourced(`${frontRoad.name} — ${frontRoad.lanes} lanes, ${frontRoad.nearestM} m`, [accessDoc]),
    arterial: arterial && sourced(`${arterial.name} — ${arterial.nearestM.toLocaleString('en-US')} m`, [accessDoc]),
    transit: sourced(metro ? `${metro.name} — ${metro.distanceM} m` : 'No metro within catchment; bus only', [accessDoc]),
    busStops800: sourced(busStops800, [accessDoc]),
    traffic: sourced(`${ctx.market.footfall.value.toLocaleString('en-US')} ${ctx.market.footfall.unit}`, [`RTA-NET:ACCESS-${p}`], { label: ctx.market.footfall.label }),
    roads: ctx.roads.filter((r) => r.nearestM < 2500).sort((a, b) => a.nearestM - b.nearestM),
  };

  // Commercial & community activity (feeds supply-demand and HBU, §11.4).
  const byCat = {};
  for (const x of ctx.pois) (byCat[x.category] ??= []).push(x);
  const activity = Object.entries(byCat)
    .map(([category, list]) => ({
      category,
      label: POI_CATEGORIES[category]?.label ?? category,
      group: POI_CATEGORIES[category]?.group ?? 'other',
      color: POI_CATEGORIES[category]?.color,
      count: list.length,
      within1km: list.filter((x) => x.distanceM <= 1000).length,
      nearest: list[0],
      sourceId: poiDocId(plot, category, list[0].source),
      sourceName: SOURCE_SYSTEMS[list[0].source]?.name,
      items: list,
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || b.count - a.count);

  // Market indicators.
  const b = ctx.market.benchmarks;
  const benchmarks = Object.entries(b).map(([key, x]) => ({
    key,
    ...x,
    tagged: sourced(x.value, [`${x.source}:${key.toUpperCase()}-${p}`], { unit: x.unit, label: x.label }),
  }));
  const land = ctx.transactions.filter((t) => /land/i.test(t.property) && t.type === 'Sale');
  const medianLand = land.length ? land.map((t) => t.aedPerM2).sort((a, z) => a - z)[Math.floor(land.length / 2)] : null;
  const idx = ctx.market.priceIndex;
  const market = {
    benchmarks,
    index: { ...idx, sourceId: `${idx.source}:INDEX-${p}`, change: round(idx.series.at(-1) - 100, 0), yoy: round(((idx.series.at(-1) - idx.series.at(-5)) / idx.series.at(-5)) * 100, 1) },
    transactions: ctx.transactions,
    medianLandAedM2: medianLand && calculated(medianLand, 'Median AED/m² of DLD land sales in catchment', { sources: land.map((t) => `DLD-TXN:${t.id}`) }),
    visitors: ctx.market.visitors ? sourced(ctx.market.visitors.value, [`${ctx.market.visitors.source}:VISITORS-${p}`], { unit: 'million / yr', label: ctx.market.visitors.label }) : null,
  };

  const topCommunity = weighted[0];
  const dominantSeg = Object.entries(segments).sort((a, z) => z[1] - a[1])[0];
  const summary = aiText(
    `The catchment has about ${Math.round(residents).toLocaleString('en-US')} residents${workers ? ` and ${Math.round(workers).toLocaleString('en-US')} daytime workers` : ''}, growing ${growthPct}% a year and led by ${dominantSeg[0]} (${dominantSeg[1]}%). ${topCommunity.name} is ${topCommunity.incomeBand.toLowerCase()} income with an average household of ${topCommunity.householdSize}. Accessibility scores ${accessScore}/10${metro ? `, helped by ${metro.name} at ${metro.distanceM} m` : ', road-led with no metro in the catchment'}. The ${idx.label.replace(/^./, (c) => c.toLowerCase())} is up ${market.index.change}% since ${idx.start} (${market.index.yoy}% over the last 4 quarters), which signals ${market.index.yoy > 5 ? 'firm' : 'stable'} market momentum.`,
    [...popDocs.slice(0, 2), accessDoc, market.index.sourceId],
  );

  return { demographics, accessibility, activity, market, summary, catchmentRadiusM: R };
}
