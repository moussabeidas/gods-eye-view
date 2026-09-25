// Stage 3 — Highest & Best Use generation, scoring and ranking (BRD §14,
// FR-030 – FR-040). Criteria, weights and scoring rules are predefined
// prototype logic (AC-05); users may modify weights and rerun (FR-066).

import { HBU_CRITERIA, USE_CATALOGUE, SCORING_SCALE, TARGET_YIELD } from '../data/methodology.js';
import { buildAssumptions, runModel, toInputs } from './finance.js';
import { calculated, aiText } from './provenance.js';

const clamp = (x, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, x));
const r1 = (x) => Math.round(x * 10) / 10;
const SEVERITY = { high: 2, medium: 1, low: 0.5 };

// Converts a use's capacity units into the unit of its demand benchmark.
const DEMAND_UNIT_FACTOR = { polyclinic: 1 / 60, 'build-to-rent': 1 / 85 };

export const scaleLabel = (s) => SCORING_SCALE.find((x) => s >= x.min).label;

export function normaliseWeights(weights) {
  const total = HBU_CRITERIA.reduce((s, c) => s + (weights?.[c.id] ?? c.weight), 0) || 1;
  return Object.fromEntries(HBU_CRITERIA.map((c) => [c.id, ((weights?.[c.id] ?? c.weight) / total) * 100]));
}

function screen(plot, use) {
  const pl = plot.planning;
  const permitted = use.permittedMatch.some((m) => pl.permittedUses.includes(m));
  const conditional = (use.conditionalMatch ?? []).some((m) => pl.conditionalUses.some((c) => c.startsWith(m)));
  const prohibited = use.permittedMatch.some((m) => pl.prohibitedUses.includes(m));
  if (permitted) return { status: 'permitted', text: `Permitted under ${pl.zoningCode}` };
  if (conditional) {
    const cond = pl.conditionalUses.find((c) => use.conditionalMatch.some((m) => c.startsWith(m)));
    return { status: 'conditional', text: `Conditional under ${pl.zoningCode}: ${cond}` };
  }
  return {
    status: 'excluded',
    text: prohibited ? `Prohibited under ${pl.zoningCode} (${pl.zoningName})` : `Not listed as permitted under ${pl.zoningCode}`,
  };
}

export function analyseHbu(plot, ctx, { location, supplyDemand, comparables }, { weights } = {}) {
  const w = normaliseWeights(weights);
  const zoneDoc = `DM-PLAN:ZONE-${plot.plotNumber}`;
  const affDoc = `DM-AFF:${plot.affection.affectionPlanNo}`;
  const accessDoc = `RTA-NET:ACCESS-${plot.plotNumber}`;
  const methodDoc = 'METHOD:HBU-FRAMEWORK';
  const access = location.accessibility.score.value;

  const candidates = plot.candidateUses.map((id) => USE_CATALOGUE[id]);
  const alternatives = [];
  const screenedOut = [];

  for (const use of candidates) {
    const legal = screen(plot, use);
    if (legal.status === 'excluded' || !use.finance) {
      screenedOut.push({ use, reason: legal.text, sources: [zoneDoc] });
      continue;
    }
    const quick = runModel(plot, use, toInputs(buildAssumptions(plot, use, ctx)));
    const sd = use.demandKeys.map((k) => supplyDemand.byKey[k]).filter(Boolean);
    const capacity = quick.units * (DEMAND_UNIT_FACTOR[use.id] ?? 1);
    const growth = location.demographics.growthPct.value;
    const visitorGrowth = ctx.market.visitors?.growthPct;
    const growthSignal = use.category === 'Hospitality' && visitorGrowth ? visitorGrowth : growth;
    // Benchmarks sharing a unit (e.g. grocery + neighbourhood retail GLA) add up.
    const demandBase = sd.reduce((s, x) => s + x.demand.value, 0);
    const totalSupply = sd.reduce((s, x) => s + x.supply.value + x.pipeline, 0);
    const gapAbs = demandBase - totalSupply;
    const gapIdx = demandBase > 0 ? gapAbs / demandBase : 0;

    const constraintHits = plot.constraints.map((c) => ({ c, s: use.constraintSensitivity[c.type] ?? 0 })).filter((x) => x.s > 0);
    const constraintLoad = constraintHits.reduce((s, x) => s + x.s * SEVERITY[x.c.severity], 0);
    const compMatches = comparables.selected.filter((c) => use.comparableMatch.test(c.landUse));
    const strongComp = compMatches.some((c) => (c.performance.match(/(\d{2})%/)?.[1] ?? 0) >= 90);

    const scores = {};
    const notes = {};
    const sources = {};

    // Market demand: growth of the demand base and depth relative to project size.
    const growthFactor = clamp(growthSignal / 8, 0, 1);
    const depthFactor = clamp(demandBase / (capacity * 2), 0, 1);
    scores.demand = r1(clamp(10 * (0.5 * growthFactor + 0.5 * depthFactor)));
    notes.demand = `${use.category === 'Hospitality' && visitorGrowth ? `Visitor growth ${visitorGrowth}%/yr` : `Catchment growth ${growth}%/yr`}; demand base ${Math.round(demandBase).toLocaleString('en-US')} ${sd[0]?.unit ?? ''} vs project ${Math.round(capacity).toLocaleString('en-US')} ${sd[0]?.unit ?? ''}`;
    sources.demand = [...location.demographics.residents.sources.slice(0, 2), ...sd.flatMap((x) => x.demand.sources).slice(0, 2)];

    // Supply gap: gap index, penalised if the project would overshoot the unmet demand.
    let gapScore = clamp(5 + gapIdx * 12);
    const overshoot = gapAbs > 0 && capacity > gapAbs * 1.5;
    if (overshoot) gapScore = clamp(gapScore - 1.5);
    scores.gap = r1(gapScore);
    notes.gap = `Gap index ${Math.round(gapIdx * 100)}% (${sd.map((x) => x.rating.label.toLowerCase()).join(', ')})${overshoot ? '; project capacity exceeds 1.5× the identified gap' : ''}`;
    sources.gap = ['METHOD:SERVICE-BENCHMARKS', ...sd.flatMap((x) => x.supply.sources).slice(0, 3)];

    // Location & accessibility, scaled by how much the use needs access.
    scores.location = r1(clamp(10 - use.accessNeed * (10 - access)));
    notes.location = `Accessibility ${access}/10; the use needs ${use.accessNeed >= 0.8 ? 'high' : use.accessNeed >= 0.6 ? 'moderate' : 'limited'} access`;
    sources.location = [accessDoc];

    // Planning fit: permissibility, constraints, GFA take-up.
    let planning = legal.status === 'permitted' ? 9 : 6;
    planning -= Math.min(4, constraintLoad * 1.2);
    if (use.finance.farUtilisation < 0.6) planning -= 1;
    scores.planning = r1(clamp(planning));
    notes.planning = `${legal.text}${constraintHits.length ? `; affected by ${constraintHits.map((x) => x.c.label).join(', ')}` : ''}; uses ${Math.round(use.finance.farUtilisation * 100)}% of permitted GFA`;
    sources.planning = [zoneDoc, affDoc];

    // Financial return potential: indicative yield on cost vs target.
    scores.financial = r1(clamp(5 + (quick.yieldOnCost - TARGET_YIELD) * 100));
    notes.financial = `Indicative yield on cost ${(quick.yieldOnCost * 100).toFixed(1)}% vs ${TARGET_YIELD * 100}% target; IRR ${quick.irr != null ? (quick.irr * 100).toFixed(1) : '—'}%`;
    sources.financial = [`METHOD:USE-${use.id}`, `${ctx.market.benchmarks[use.finance.priceKey].source}:${use.finance.priceKey.toUpperCase()}-${plot.plotNumber}`];

    // Comparable evidence.
    scores.comparables = r1(clamp((compMatches.length === 0 ? 3 : compMatches.length === 1 ? 6.5 : 8.5) + (strongComp ? 1 : 0)));
    notes.comparables = compMatches.length
      ? `${compMatches.length} comparable(s): ${compMatches.map((c) => `${c.plotNumber} — ${c.performance}`).join('; ')}`
      : 'No selected comparable delivers this use';
    sources.comparables = compMatches.flatMap((c) => c.sourceIds);

    // Constraints & risk (higher = lower risk).
    scores.risk = r1(clamp(10 - constraintLoad * 2.5 - (legal.status === 'conditional' ? 1.5 : 0)));
    notes.risk = constraintHits.length ? constraintHits.map((x) => `${x.c.label} (${x.c.severity}, sensitivity ${x.s})`).join('; ') : 'No material constraint exposure';
    sources.risk = [affDoc];

    const total = r1(HBU_CRITERIA.reduce((s, c) => s + (scores[c.id] * w[c.id]) / 10, 0));
    alternatives.push({
      use,
      legal,
      scores,
      notes,
      sources,
      total: calculated(total, 'Σ criterion score × weight ÷ 10', { sources: [methodDoc] }),
      quick,
      capacity,
      constraintHits,
    });
  }

  alternatives.sort((a, b) => b.total.value - a.total.value);
  alternatives.forEach((a, i) => {
    a.rank = i + 1;
    a.rating = scaleLabel(a.total.value / 10);
    const contrib = HBU_CRITERIA.map((c) => ({ c, v: (a.scores[c.id] * w[c.id]) / 10, s: a.scores[c.id] }));
    const strengths = contrib
      .filter((x) => x.s >= 7)
      .sort((x, y) => y.v - x.v)
      .slice(0, 3);
    const weaknesses = contrib
      .filter((x) => x.s < 5)
      .sort((x, y) => x.s - y.s)
      .slice(0, 2);
    a.strengths = strengths.map((x) => x.c.label);
    a.weaknesses = weaknesses.map((x) => x.c.label);
    const next = alternatives[i + 1];
    let vsNext = '';
    if (next) {
      const diffs = HBU_CRITERIA.map((c) => ({ c, d: ((a.scores[c.id] - next.scores[c.id]) * w[c.id]) / 10 })).sort((x, y) => y.d - x.d);
      const lead = diffs.filter((x) => x.d > 0.05).slice(0, 2);
      const lag = diffs.filter((x) => x.d < -0.05).slice(-1);
      vsNext = ` It ranks above ${next.use.shortName.toLowerCase()} by ${r1(a.total.value - next.total.value)} points, mainly on ${lead.map((x) => `${x.c.label.toLowerCase()} (+${r1(x.d)})`).join(' and ') || 'overall balance'}${lag.length ? `, despite trailing on ${lag[0].c.label.toLowerCase()} (${r1(lag[0].d)})` : ''}.`;
    }
    a.rationale = aiText(
      `${a.use.name} scores ${a.total.value}/100 (${a.rating.toLowerCase()}). ${
        strengths.length ? `Strengths: ${strengths.map((x) => `${x.c.label.toLowerCase()} ${x.s}/10`).join(', ')}.` : 'It has no criterion scoring 7 or above.'
      }${weaknesses.length ? ` Weaknesses: ${weaknesses.map((x) => `${x.c.label.toLowerCase()} ${x.s}/10`).join(', ')}.` : ''}${vsNext}`,
      [methodDoc, ...a.sources.gap.slice(0, 1), ...a.sources.financial.slice(0, 1)],
    );
  });

  const lead = alternatives[0];
  const second = alternatives[1];
  const summary = aiText(
    `${alternatives.length} alternative uses passed legal-permissibility screening${screenedOut.length ? ` (${screenedOut.map((s) => s.use.shortName.toLowerCase()).join(', ')} screened out: ${screenedOut.map((s) => s.reason).join('; ')})` : ''}. ${lead.use.name} ranks first at ${lead.total.value}/100, ahead of ${second.use.shortName.toLowerCase()} at ${second.total.value}. The margin is ${r1(lead.total.value - second.total.value)} points, so the ranking is ${lead.total.value - second.total.value < 3 ? 'sensitive to weights and should be challenged' : 'reasonably robust to modest weight changes'}. The lead use combines ${lead.strengths.map((s) => s.toLowerCase()).join(', ') || 'balanced performance'}.`,
    [methodDoc, zoneDoc],
  );

  return {
    criteria: HBU_CRITERIA.map((c) => ({ ...c, effectiveWeight: r1(w[c.id]), modified: weights?.[c.id] != null && weights[c.id] !== c.weight })),
    alternatives,
    screenedOut,
    summary,
    weightsModified: HBU_CRITERIA.some((c) => weights?.[c.id] != null && weights[c.id] !== c.weight),
  };
}

/** Explain, criterion by criterion, why one alternative outranks another (FR-039). */
export function compareAlternatives(hbu, idA, idB) {
  const a = hbu.alternatives.find((x) => x.use.id === idA);
  const b = hbu.alternatives.find((x) => x.use.id === idB);
  if (!a || !b) return null;
  const rows = hbu.criteria.map((c) => ({
    criterion: c.label,
    weight: c.effectiveWeight,
    a: a.scores[c.id],
    b: b.scores[c.id],
    weightedDiff: r1(((a.scores[c.id] - b.scores[c.id]) * c.effectiveWeight) / 10),
    noteA: a.notes[c.id],
    noteB: b.notes[c.id],
  }));
  return { a, b, rows, gap: r1(a.total.value - b.total.value) };
}
