// Supply-demand and service-gap analysis (BRD §13, FR-025 – FR-029). Demand
// is derived from demographic, worker and visitor indicators with predefined
// provision benchmarks; supply comes from the facility and pipeline records.

import { SERVICE_BENCHMARKS, PLOT_SERVICE_KEYS } from '../data/methodology.js';
import { poiDocId } from './location.js';
import { calculated, sourced, assumed, aiText } from './provenance.js';

const round = (n) => Math.round(n);

export function gapRating(index) {
  if (index >= 0.25) return { label: 'Significant gap', tone: 'good' };
  if (index >= 0.1) return { label: 'Moderate gap', tone: 'good' };
  if (index > -0.1) return { label: 'Broadly balanced', tone: 'neutral' };
  return { label: 'Oversupplied', tone: 'bad' };
}

export function analyseSupplyDemand(plot, ctx, location) {
  const p = plot.plotNumber;
  const residents = location.demographics.residents.value;
  const popSources = location.demographics.residents.sources;
  const b = ctx.market.benchmarks;
  const methodDoc = 'METHOD:SERVICE-BENCHMARKS';

  const results = PLOT_SERVICE_KEYS[p].map((key) => {
    const bm = SERVICE_BENCHMARKS[key];
    const evidence = [];
    let demand;
    let supply = 0;
    let supplyItems = [];

    const supplyFromPois = () => {
      for (const cat of bm.supplyCategories ?? []) {
        const items = ctx.pois.filter((x) => x.category === cat);
        if (!items.length) continue;
        const sum = items.reduce((s, x) => s + (x[bm.supplyAttr] ?? bm.defaultUnitSize?.[cat] ?? 0), 0);
        supply += sum;
        supplyItems.push(...items);
        evidence.push(sourced(round(sum), [poiDocId(plot, cat, items[0].source)], { label: `Recorded supply — ${items.length} ${cat} facilities`, unit: bm.unit }));
      }
    };

    if (bm.model === 'perCapita') {
      demand = residents * bm.perCapita;
      evidence.push(calculated(round(residents), 'Catchment residents (weighted)', { sources: popSources, label: 'Catchment residents' }));
      evidence.push(assumed(bm.perCapita, { label: 'Provision benchmark per resident', sources: [methodDoc], unit: bm.unit }));
      supplyFromPois();
    } else if (bm.model === 'schoolAge') {
      const share = location.demographics.ageGroups.value['5-17'] / 100;
      const schoolAge = residents * share;
      demand = schoolAge * bm.privateShare;
      evidence.push(calculated(round(schoolAge), `Residents × ${Math.round(share * 1000) / 10}% aged 5–17`, { sources: popSources, label: 'School-age residents' }));
      evidence.push(assumed(bm.privateShare, { label: 'Private-school participation', sources: [methodDoc], unit: '%' }));
      supplyFromPois();
      const enrolled = supplyItems.reduce((s, x) => s + (x.enrolled ?? 0), 0);
      evidence.push(
        calculated(Math.round((enrolled / supply) * 1000) / 10, 'Enrolled ÷ capacity across catchment schools', {
          sources: [poiDocId(plot, 'school', 'KHDA')],
          label: 'Current school utilisation',
          unit: '%',
        }),
      );
    } else if (bm.model === 'occupancy') {
      supplyFromPois();
      const occ = b[bm.occupancyKey].value / 100;
      const growth = ctx.market[bm.growthKey].growthPct / 100;
      demand = supply * (occ / bm.targetOccupancy) * (1 + growth) ** 3;
      evidence.push(sourced(b[bm.occupancyKey].value, [`${b[bm.occupancyKey].source}:${bm.occupancyKey.toUpperCase()}-${p}`], { label: b[bm.occupancyKey].label, unit: '%' }));
      evidence.push(sourced(ctx.market[bm.growthKey].growthPct, [`${ctx.market[bm.growthKey].source}:VISITORS-${p}`], { label: 'Visitor growth per year', unit: '%' }));
      evidence.push(assumed(bm.targetOccupancy, { label: 'Equilibrium occupancy', sources: [methodDoc], unit: '%' }));
    } else if (bm.model === 'vacancy') {
      supplyFromPois();
      const vac = b[bm.vacancyKey].value / 100;
      demand = (supply * (1 - vac) * (1 + bm.workerGrowthPct / 100) ** 3) / (1 - bm.targetVacancy);
      evidence.push(sourced(b[bm.vacancyKey].value, [`${b[bm.vacancyKey].source}:${bm.vacancyKey.toUpperCase()}-${p}`], { label: b[bm.vacancyKey].label, unit: '%' }));
      evidence.push(assumed(bm.workerGrowthPct / 100, { label: 'Worker growth per year', sources: [methodDoc], unit: '%' }));
      evidence.push(assumed(bm.targetVacancy, { label: 'Equilibrium vacancy', sources: [methodDoc], unit: '%' }));
    } else if (bm.model === 'households') {
      const hh = location.demographics.households.value;
      const g = location.demographics.growthPct.value / 100;
      const vac = b[bm.vacancyKey].value / 100;
      const newHh = hh * ((1 + g) ** 3 - 1);
      const restore = Math.max(0, hh * (bm.targetVacancy - vac));
      demand = newHh + restore;
      evidence.push(calculated(round(hh), 'Catchment households (weighted)', { sources: popSources, label: 'Catchment households' }));
      evidence.push(calculated(round(newHh), `Households × ((1 + ${location.demographics.growthPct.value}%)³ − 1)`, { sources: popSources, label: 'New households over 3 years' }));
      evidence.push(sourced(b[bm.vacancyKey].value, [`${b[bm.vacancyKey].source}:${bm.vacancyKey.toUpperCase()}-${p}`], { label: b[bm.vacancyKey].label, unit: '%' }));
      evidence.push(calculated(round(restore), `Households × (${bm.targetVacancy * 100}% equilibrium − current vacancy)`, { sources: [methodDoc], label: 'Homes to restore equilibrium vacancy' }));
    }

    let pipeline = 0;
    if (bm.pipelineKey && b[bm.pipelineKey]) {
      pipeline = b[bm.pipelineKey].value;
      evidence.push(sourced(pipeline, [`${b[bm.pipelineKey].source}:${bm.pipelineKey.toUpperCase()}-${p}`], { label: b[bm.pipelineKey].label, unit: bm.unit }));
    }
    const totalSupply = supply + pipeline;
    const gap = demand - totalSupply;
    const gapIndex = demand > 0 ? gap / demand : 0;
    const rating = gapRating(gapIndex);

    return {
      key,
      label: bm.label,
      unit: bm.unit,
      benchmarkText: bm.benchmarkText,
      demand: calculated(round(demand), bm.benchmarkText, { sources: [methodDoc, ...popSources.slice(0, 1)] }),
      supply: calculated(round(supply), 'Σ recorded facility capacity in catchment', { sources: evidence.filter((e) => e.kind === 'sourced').flatMap((e) => e.sources) }),
      pipeline: round(pipeline),
      gap: calculated(round(gap), 'Demand − (supply + pipeline)'),
      gapIndex: calculated(Math.round(gapIndex * 1000) / 1000, '(Demand − supply − pipeline) ÷ demand'),
      rating,
      evidence,
      supplyItems: supplyItems.map((x) => ({ id: x.id, name: x.name, category: x.category, distanceM: x.distanceM, value: x[bm.supplyAttr] })),
    };
  });

  const sorted = [...results].sort((a, z) => z.gapIndex.value - a.gapIndex.value);
  const top = sorted[0];
  const worst = sorted.at(-1);
  const summary = aiText(
    `The strongest unmet demand is in ${top.label.toLowerCase()}: estimated demand of ${top.demand.value.toLocaleString('en-US')} ${top.unit} against ${(top.supply.value + top.pipeline).toLocaleString('en-US')} ${top.unit} of existing and pipeline supply, a gap index of ${Math.round(top.gapIndex.value * 100)}% (${top.rating.label.toLowerCase()}). ${
      sorted[1] ? `${sorted[1].label} follows at ${Math.round(sorted[1].gapIndex.value * 100)}%. ` : ''
    }${worst.gapIndex.value < -0.1 ? `${worst.label} looks oversupplied (${Math.round(worst.gapIndex.value * 100)}%) once the pipeline is counted, so new supply there faces absorption risk.` : `No category is materially oversupplied.`} These gaps come from representative benchmarks and should be tested with operator soundings.`,
    [methodDoc, ...top.evidence.flatMap((e) => e.sources).slice(0, 3)],
  );

  return { results, byKey: Object.fromEntries(results.map((r) => [r.key, r])), summary };
}
