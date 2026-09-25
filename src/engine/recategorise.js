// Land-use recategorisation screening. For every plot in the land-bank set it
// prices each use under the plot's current zoning and under the other zoning
// categories plausible in its area, using the same cash-flow model as the
// Financial Feasibility stage. Plots are ranked by the value a change of
// category would add, and each gets a plain suggestion. Screening estimates
// are illustrative and do not replace the full six-stage analysis.

import { USE_CATALOGUE } from '../data/methodology.js';
import { ZONING_CATEGORIES, AREA_CATEGORIES, getLandBank } from '../data/landbank.js';
import { PLOTS } from '../data/plots.js';
import { getContext } from '../data/context.js';
import { buildAssumptions, runModel, toInputs } from './finance.js';
import { computeFrom, createSession } from './orchestrator.js';

// Villa compounds have no full-analysis profile; this screening profile
// prices them from the RERA 4-bedroom villa rent benchmark.
const SCREENING_USES = {
  'residential-villas': {
    ...USE_CATALOGUE['residential-villas'],
    finance: {
      farUtilisation: 0.9,
      efficiency: 1,
      unitSizeM2: 420,
      unitLabel: 'villas',
      priceKey: 'villaRent',
      priceFactor: 1,
      priceLabel: 'annual rent per 4-bedroom villa, AED',
      periodsPerYear: 1,
      ancillaryFactor: 1,
      utilisation: 0.93,
      rampYears: 1,
      escalation: 0.025,
      opexRatio: 0.12,
      capexPerM2: 3800,
      softCostPct: 0.1,
      constructionYears: 2,
      horizonYears: 25,
      discountRate: 0.09,
      exitCapRate: 0.065,
    },
  },
};

const useFor = (id) => SCREENING_USES[id] ?? USE_CATALOGUE[id];

// Market context and demand signals come from each area's fully analysed plot.
const areaCache = new Map();
function areaContext(area) {
  if (areaCache.has(area)) return areaCache.get(area);
  const plot = PLOTS.find((p) => p.mapArea === area);
  const session = computeFrom(createSession(plot.plotNumber));
  const value = { plot, ctx: getContext(plot.plotNumber), supplyDemand: session.results.supplyDemand };
  areaCache.set(area, value);
  return value;
}

// Converts a use's capacity units into the unit of its demand benchmark (as in hbu.js).
const DEMAND_UNIT_FACTOR = { polyclinic: 1 / 60, 'build-to-rent': 1 / 85 };

function areaGap(use, supplyDemand) {
  const rows = use.demandKeys.map((k) => supplyDemand.byKey[k]).filter(Boolean);
  if (!rows.length) return null;
  const demand = rows.reduce((s, r) => s + r.demand.value, 0);
  const supply = rows.reduce((s, r) => s + r.supply.value + r.pipeline, 0);
  return { demand, gap: demand - supply, unit: rows[0].unit };
}

/** Demand signal for one project, after higher-ranked plots have taken their share of the gap. */
function demandSignal(use, supplyDemand, capacity, remaining) {
  const g = areaGap(use, supplyDemand);
  if (!g) return { label: 'No benchmark', tone: 'neutral', gapIndex: null };
  const gapIndex = g.demand > 0 ? g.gap / g.demand : 0;
  const base = gapIndex >= 0.25 ? 'Significant gap' : gapIndex >= 0.1 ? 'Moderate gap' : gapIndex > -0.1 ? 'Broadly balanced' : 'Oversupplied';
  const out = { gapIndex: Math.round(gapIndex * 1000) / 1000, unit: g.unit, capacity: Math.round(capacity), remaining: Math.round(remaining ?? g.gap) };
  if (remaining != null && remaining <= 0) return { ...out, label: gapIndex < -0.1 ? base : 'Gap already taken by higher-ranked plots', tone: 'bad' };
  if (gapIndex < 0.1) return { ...out, label: base, tone: gapIndex > -0.1 ? 'neutral' : 'bad' };
  if (capacity > remaining) return { ...out, label: `${base}, partly taken by higher-ranked plots`, tone: 'neutral' };
  return { ...out, label: base, tone: 'good' };
}

function price(item, zoningCode, useId, ctx, supplyDemand, remaining) {
  const zone = ZONING_CATEGORIES[zoningCode];
  const use = useFor(useId);
  if (!use?.finance || !ctx.market.benchmarks[use.finance.priceKey]) return null;
  const plotLike = { plotNumber: item.plotNumber, areaM2: item.areaM2, planning: { zoningCode, controls: { far: zone.far } } };
  const m = runModel(plotLike, use, toInputs(buildAssumptions(plotLike, use, ctx)));
  return {
    zoning: zoningCode,
    zoningName: zone.name,
    far: zone.far,
    useId,
    useName: use.shortName,
    npv: m.npv,
    irr: m.irr,
    revenue: m.stabRevenue,
    gfa: m.gfa,
    units: m.units,
    unitLabel: m.unitLabel,
    npvPerM2: m.npv / item.areaM2,
    capacity: m.units * (DEMAND_UNIT_FACTOR[useId] ?? 1),
    demand: demandSignal(use, supplyDemand, m.units * (DEMAND_UNIT_FACTOR[useId] ?? 1), remaining.get(`${item.area}|${useId}`)),
  };
}

// Prefer options the market can absorb; fall back to the highest value.
const pickBest = (options) => {
  const viable = options.filter((o) => o.demand.tone !== 'bad');
  return [...(viable.length ? viable : options)].sort((a, b) => b.npv - a.npv)[0];
};

function conditionsFor(item, from, to) {
  const out = [`DM Planning approval to change the land use from ${from.zoning} to ${to.zoning}, with an amended affection plan`];
  if (to.zoning === 'C-2' || to.zoning === 'C-2 / CF') out.push('Traffic impact study for retail servicing and peak trips');
  if (from.zoning === 'R-V') out.push('Community consultation: the plot sits within a villa neighbourhood');
  if (to.zoning === 'MU-3') out.push('DCAA height NOC (75 m AMSL cap near DXB)');
  if (to.demand.tone === 'neutral') out.push(`Market sounding: demand for ${to.useName.toLowerCase()} is broadly balanced`);
  return out;
}

const aedM = (x) => `AED ${(x / 1e6).toFixed(1)}M`;

/** Rank the land bank by the value a change of zoning category would add. */
export function rankRecategorisation() {
  // Plots take their share of each area's demand gap in turn: the analysed
  // plots first, then the screening parcels by the value they could reach.
  const remaining = new Map();
  const land = getLandBank();
  const potential = (item) => {
    const { ctx, supplyDemand } = areaContext(item.area);
    const zones = [...new Set([item.zoning, ...AREA_CATEGORIES[item.area]])];
    return Math.max(...zones.flatMap((z) => ZONING_CATEGORIES[z].uses.map((u) => price(item, z, u, ctx, supplyDemand, new Map())?.npv ?? -Infinity)));
  };
  const order = [...land.filter((x) => x.analysed), ...land.filter((x) => !x.analysed).sort((a, b) => potential(b) - potential(a))];

  const rows = order.map((item) => {
    const { ctx, supplyDemand, plot: areaPlot } = areaContext(item.area);
    const categories = [...new Set([item.zoning, ...AREA_CATEGORIES[item.area]])];
    const options = categories.flatMap((z) => ZONING_CATEGORIES[z].uses.map((u) => price(item, z, u, ctx, supplyDemand, remaining))).filter(Boolean);
    const current = pickBest(options.filter((o) => o.zoning === item.zoning));
    const best = pickBest(options);
    const change = best.zoning !== item.zoning && best.npv > current.npv * 1.05 + 1e6;
    const chosen = change ? best : current;
    const key = `${item.area}|${chosen.useId}`;
    const gap = areaGap(useFor(chosen.useId), supplyDemand);
    if (gap) remaining.set(key, (remaining.get(key) ?? gap.gap) - chosen.capacity);
    const upliftNpv = change ? best.npv - current.npv : 0;
    const rationale = change
      ? `Recategorising from ${item.zoning} (${ZONING_CATEGORIES[item.zoning].name.toLowerCase()}) to ${best.zoning} (${best.zoningName.toLowerCase()}) lets the plot deliver a ${best.useName.toLowerCase()} of about ${Math.round(best.gfa).toLocaleString('en-US')} m² GFA${best.useId === current.useId ? ' at the higher permitted density' : ` instead of a ${current.useName.toLowerCase()}`}. Indicative NPV rises from ${aedM(current.npv)} to ${aedM(best.npv)}, and stabilised revenue from ${aedM(current.revenue)} to ${aedM(best.revenue)} a year. Area demand for this use: ${best.demand.label.toLowerCase()}.`
      : `The current ${item.zoning} category already supports the highest-value use the area market can absorb: a ${current.useName.toLowerCase()} at an indicative NPV of ${aedM(current.npv)}. No change of category is suggested.`;
    return {
      ...item,
      current,
      best: chosen,
      options: options.sort((a, b) => b.npv - a.npv),
      recategorise: change,
      upliftNpv,
      upliftRevenue: change ? best.revenue - current.revenue : 0,
      upliftPct: change && current.npv > 0 ? upliftNpv / current.npv : null,
      rationale,
      conditions: change ? conditionsFor(item, current, best) : [],
      demandSource: `Demand signal from the ${areaPlot.plotNumber} catchment analysis`,
    };
  });
  rows.sort((a, b) => b.upliftNpv - a.upliftNpv || b.best.npv - a.best.npv);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
