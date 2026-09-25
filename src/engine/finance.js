// Stage 5 — Preliminary financial feasibility and sensitivity analysis
// (BRD §16 – §17, FR-046 – FR-055). Illustrative only (AC-06, AC-07).

import { SCENARIO_PRESETS } from '../data/methodology.js';
import { KIND } from './provenance.js';

const DEFS = [
  { key: 'price', group: 'Revenue', format: 'aed', step: 10 },
  { key: 'utilisation', group: 'Revenue', label: 'Stabilised utilisation / occupancy', format: 'pct', min: 0.3, max: 1, step: 0.01 },
  { key: 'rampYears', group: 'Revenue', label: 'Ramp-up to stabilisation', format: 'years', min: 1, max: 8, step: 1 },
  { key: 'escalation', group: 'Revenue', label: 'Annual price escalation', format: 'pct', min: 0, max: 0.08, step: 0.005 },
  { key: 'ancillaryFactor', group: 'Revenue', label: 'Ancillary revenue uplift', format: 'mult', min: 1, max: 1.6, step: 0.01 },
  { key: 'opexRatio', group: 'Costs', label: 'OPEX (% of revenue)', format: 'pct', min: 0.05, max: 0.9, step: 0.01 },
  { key: 'capexPerM2', group: 'Costs', label: 'Construction CAPEX', format: 'aed', unit: 'AED/m² GFA', min: 2000, max: 15000, step: 100 },
  { key: 'softCostPct', group: 'Costs', label: 'Soft costs & contingency', format: 'pct', min: 0, max: 0.3, step: 0.01 },
  { key: 'farUtilisation', group: 'Development', label: 'Share of permitted GFA used', format: 'pct', min: 0.3, max: 1, step: 0.01 },
  { key: 'efficiency', group: 'Development', label: 'Net-to-gross efficiency', format: 'pct', min: 0.5, max: 1, step: 0.01 },
  { key: 'constructionYears', group: 'Timing', label: 'Construction period', format: 'years', min: 1, max: 5, step: 1 },
  { key: 'horizonYears', group: 'Timing', label: 'Investment period', format: 'years', min: 10, max: 50, step: 1 },
  { key: 'discountRate', group: 'Valuation', label: 'Discount rate', format: 'pct', min: 0.04, max: 0.16, step: 0.0025 },
  { key: 'exitCapRate', group: 'Valuation', label: 'Exit capitalisation rate', format: 'pct', min: 0.04, max: 0.14, step: 0.0025 },
];

/** Assumption register for a use on a plot, with provenance and user overrides. */
export function buildAssumptions(plot, use, ctx, overrides = {}) {
  const f = use.finance;
  const bench = ctx.market.benchmarks[f.priceKey];
  const benchDoc = `${bench.source}:${f.priceKey.toUpperCase()}-${plot.plotNumber}`;
  const methodDoc = `METHOD:USE-${use.id}`;
  const originals = {
    price: Math.round(bench.value * f.priceFactor),
    utilisation: f.utilisation,
    rampYears: f.rampYears,
    escalation: f.escalation,
    ancillaryFactor: f.ancillaryFactor,
    opexRatio: f.opexRatio,
    capexPerM2: f.capexPerM2,
    softCostPct: f.softCostPct,
    farUtilisation: f.farUtilisation,
    efficiency: f.efficiency,
    constructionYears: f.constructionYears,
    horizonYears: f.horizonYears,
    discountRate: f.discountRate,
    exitCapRate: f.exitCapRate,
  };
  return DEFS.map((d) => {
    const original = originals[d.key];
    const hasOverride = overrides[d.key] != null && overrides[d.key] !== original;
    const isPrice = d.key === 'price';
    const baseKind = isPrice && f.priceFactor === 1 ? KIND.SOURCED : KIND.ASSUMPTION;
    return {
      ...d,
      label: isPrice ? `Price — ${f.priceLabel}` : d.label,
      unit: isPrice ? bench.unit : d.unit,
      min: isPrice ? Math.round(original * 0.4) : d.min,
      max: isPrice ? Math.round(original * 1.8) : d.max,
      original,
      value: hasOverride ? overrides[d.key] : original,
      kind: hasOverride ? KIND.USER : baseKind,
      baseKind,
      sources: isPrice ? [benchDoc, methodDoc] : [methodDoc],
      note: isPrice && f.priceFactor !== 1 ? `${bench.label} ${bench.value.toLocaleString('en-US')} ${bench.unit} × ${f.priceFactor} blend factor` : undefined,
    };
  });
}

export const toInputs = (assumptions) => Object.fromEntries(assumptions.map((a) => [a.key, a.value]));

/** Run the annual cash-flow model and derive NPV, IRR, ROI and payback. */
export function runModel(plot, use, inputs) {
  const f = use.finance;
  const a = inputs;
  const C = Math.max(1, Math.round(a.constructionYears));
  const H = Math.max(C + 2, Math.round(a.horizonYears));
  const gfa = plot.areaM2 * plot.planning.controls.far * a.farUtilisation;
  const units = (gfa * a.efficiency) / f.unitSizeM2;
  const totalCapex = gfa * a.capexPerM2 * (1 + a.softCostPct);
  const stabRevenue = units * a.price * f.periodsPerYear * a.utilisation * a.ancillaryFactor;
  const stabNoi = stabRevenue * (1 - a.opexRatio);

  const rows = [];
  let cumulative = 0;
  for (let t = 1; t <= H; t++) {
    const capex = t <= C ? totalCapex / C : 0;
    const opYear = t - C;
    const util = opYear > 0 ? a.utilisation * Math.min(1, opYear / Math.max(1, a.rampYears)) : 0;
    const revenue = opYear > 0 ? units * a.price * (1 + a.escalation) ** (t - 1) * f.periodsPerYear * util * a.ancillaryFactor : 0;
    const opex = revenue * a.opexRatio;
    const noi = revenue - opex;
    const residual = t === H ? (noi * (1 + a.escalation)) / a.exitCapRate : 0;
    const net = noi + residual - capex;
    cumulative += net;
    rows.push({ year: t, util, capex, revenue, opex, noi, residual, net, cumulative });
  }
  const flows = [0, ...rows.map((r) => r.net)];
  const npv = npvAt(flows, a.discountRate);
  const irr = irrOf(flows);
  const inflows = rows.reduce((s, r) => s + r.noi + r.residual, 0);
  const roi = (inflows - totalCapex) / totalCapex;
  const roiAnnualised = roi > -1 ? (1 + roi) ** (1 / H) - 1 : null;
  const payback = paybackOf(rows);
  const peakFunding = Math.min(0, ...rows.map((r) => r.cumulative));

  return {
    gfa,
    units,
    unitLabel: f.unitLabel,
    totalCapex,
    stabRevenue,
    stabNoi,
    yieldOnCost: stabNoi / totalCapex,
    rows,
    npv,
    irr,
    roi,
    roiAnnualised,
    payback,
    peakFunding,
    horizon: H,
    construction: C,
  };
}

export function npvAt(flows, rate) {
  return flows.reduce((s, cf, t) => s + cf / (1 + rate) ** t, 0);
}

export function irrOf(flows) {
  let lo = -0.9;
  let hi = 1;
  const f = (r) => npvAt(flows, r);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-7) break;
  }
  return (lo + hi) / 2;
}

function paybackOf(rows) {
  let prev = 0;
  for (const r of rows) {
    if (r.cumulative >= 0 && prev < 0) return r.year - 1 + -prev / r.net;
    prev = r.cumulative;
  }
  return null;
}

export const FORMULAS = {
  npv: 'NPV = Σ net cash flowₜ ÷ (1 + discount rate)ᵗ',
  irr: 'IRR = discount rate at which NPV = 0',
  roi: 'ROI = (Σ NOI + residual value − total CAPEX) ÷ total CAPEX, over the investment period',
  roiAnnualised: 'Annualised ROI = (1 + ROI)^(1 ÷ years) − 1',
  payback: 'Payback = years from start until cumulative net cash flow turns positive',
  yieldOnCost: 'Yield on cost = stabilised NOI ÷ total CAPEX',
  capex: 'Total CAPEX = GFA × CAPEX/m² × (1 + soft costs)',
  gfa: 'GFA = plot area × FAR × share of permitted GFA used',
};

const SENSITIVITY_VARS = [
  { key: 'price', label: 'Price / rent', mode: 'rel', delta: 0.1 },
  { key: 'utilisation', label: 'Utilisation', mode: 'rel', delta: 0.1 },
  { key: 'capexPerM2', label: 'CAPEX', mode: 'rel', delta: 0.1 },
  { key: 'opexRatio', label: 'OPEX ratio', mode: 'rel', delta: 0.1 },
  { key: 'discountRate', label: 'Discount rate', mode: 'abs', delta: 0.01 },
  { key: 'escalation', label: 'Escalation', mode: 'abs', delta: 0.01 },
  { key: 'exitCapRate', label: 'Exit cap rate', mode: 'abs', delta: 0.005 },
];

/** One-at-a-time sensitivity (tornado) on NPV and IRR. */
export function sensitivity(plot, use, inputs) {
  const base = runModel(plot, use, inputs);
  const rows = SENSITIVITY_VARS.map((v) => {
    const shift = (dir) => {
      const x = { ...inputs };
      x[v.key] = v.mode === 'rel' ? inputs[v.key] * (1 + dir * v.delta) : inputs[v.key] + dir * v.delta;
      return runModel(plot, use, x);
    };
    const lo = shift(-1);
    const hi = shift(1);
    return {
      ...v,
      shiftLabel: v.mode === 'rel' ? `±${v.delta * 100}%` : `±${(v.delta * 100).toFixed(1)} pts`,
      npvLow: lo.npv,
      npvHigh: hi.npv,
      irrLow: lo.irr,
      irrHigh: hi.irr,
      swing: Math.abs(hi.npv - lo.npv),
    };
  }).sort((a, b) => b.swing - a.swing);
  return { base, rows, breakevens: breakevens(plot, use, inputs) };
}

/** How far a driver can move before NPV reaches zero. */
export function breakevens(plot, use, inputs) {
  const solve = (key, dir) => {
    const at = (k) => runModel(plot, use, { ...inputs, [key]: inputs[key] * (1 + dir * k) }).npv;
    const base = at(0);
    if (base <= 0) return 0;
    let lo = 0;
    let hi = 0.95;
    if (at(hi) > 0) return null;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  return {
    priceDrop: solve('price', -1),
    utilisationDrop: solve('utilisation', -1),
    capexRise: (() => {
      const at = (k) => runModel(plot, use, { ...inputs, capexPerM2: inputs.capexPerM2 * (1 + k) }).npv;
      if (at(0) <= 0) return 0;
      let lo = 0;
      let hi = 3;
      if (at(hi) > 0) return null;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (at(mid) > 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    })(),
  };
}

export function applyDeltas(inputs, deltas) {
  const x = { ...inputs };
  for (const [k, d] of Object.entries(deltas)) {
    if (d.rel != null) x[k] = inputs[k] * (1 + d.rel);
    if (d.abs != null) x[k] = inputs[k] + d.abs;
  }
  return x;
}

/** Compare predefined scenarios with the specialist's current and saved cases (FR-055). */
export function scenarios(plot, use, originalInputs, currentInputs, saved = []) {
  const list = Object.entries(SCENARIO_PRESETS).map(([id, s]) => ({
    id,
    label: s.label,
    description: s.description,
    kind: 'preset',
    inputs: applyDeltas(originalInputs, s.deltas),
  }));
  const changed = Object.keys(currentInputs).filter((k) => currentInputs[k] !== originalInputs[k]);
  if (changed.length) {
    list.push({ id: 'specialist', label: 'Specialist case (current)', description: `User-modified: ${changed.join(', ')}`, kind: 'user', inputs: currentInputs });
  }
  for (const s of saved) list.push({ ...s, kind: 'saved' });
  return list.map((s) => ({ ...s, result: runModel(plot, use, s.inputs) }));
}
