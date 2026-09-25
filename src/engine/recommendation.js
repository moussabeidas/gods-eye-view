// Stage 6 — Evidence-based investment recommendation (BRD §18, FR-056 – FR-062).
// The recommendation is decision support only: it never approves (FR-069).

import { HURDLE_IRR } from '../data/methodology.js';
import { aiText, sourced, calculated } from './provenance.js';
import { FORMULAS } from './finance.js';

const pct = (x, d = 1) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);
const aedM = (x) => `AED ${(x / 1e6).toFixed(1)}M`;
const lowerFirst = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

export function buildRecommendation(plot, r) {
  const { asset, location, supplyDemand, comparables, hbu, structuring, financial } = r;
  const alt = financial.selectedAlternative;
  const use = alt.use;
  const m = financial.result;
  const sens = financial.sensitivity;
  const downside = financial.scenarios.find((s) => s.id === 'downside')?.result;
  const hbuScore = alt.total.value;

  let verdict;
  if (m.npv > 0 && (m.irr ?? 0) >= HURDLE_IRR && hbuScore >= 65) {
    verdict = { code: 'progress', label: 'Progress to detailed feasibility & market sounding', tone: 'good' };
  } else if (m.npv > 0) {
    verdict = { code: 'conditional', label: 'Progress with conditions', tone: 'warn' };
  } else {
    verdict = { code: 'hold', label: 'Do not progress in current form', tone: 'bad' };
  }
  const robustness = downside ? (downside.npv > 0 ? 'Robust — NPV stays positive in the downside case' : 'Sensitive — NPV turns negative in the downside case') : 'Not tested';
  const confidence = downside && downside.npv > 0 && hbuScore >= 70 ? 'Medium-High' : m.npv > 0 ? 'Medium' : 'Low';

  const sd = use.demandKeys.map((k) => supplyDemand.byKey[k]).filter(Boolean);
  const methodFin = 'METHOD:FINANCIAL-MODEL';

  const facts = [
    sourced(`${plot.areaM2.toLocaleString('en-US')} m² ${plot.planning.zoningCode} plot; ${use.shortName.toLowerCase()} is ${alt.legal.status}`, asset.sourceIds.slice(0, 2), {
      label: 'Asset & planning',
    }),
    sourced(
      `${location.demographics.residents.value.toLocaleString('en-US')} catchment residents growing ${location.demographics.growthPct.value}%/yr`,
      location.demographics.residents.sources.slice(0, 2),
      { label: 'Demographics' },
    ),
    ...sd.map((x) =>
      calculated(`${x.label}: gap index ${Math.round(x.gapIndex.value * 100)}% (${x.rating.label.toLowerCase()})`, x.gapIndex.formula, {
        sources: x.supply.sources.slice(0, 2),
        label: 'Supply-demand',
      }),
    ),
    sourced(
      comparables.selected
        .filter((c) => use.comparableMatch.test(c.landUse))
        .map((c) => `${c.plotNumber}: ${c.performance}`)
        .join('; ') || 'No direct comparable for this use',
      comparables.selected.filter((c) => use.comparableMatch.test(c.landUse)).flatMap((c) => c.sourceIds),
      { label: 'Comparable evidence' },
    ),
  ];

  const calcs = [
    calculated(hbuScore, 'Weighted HBU score (predefined criteria)', { label: `HBU score (rank ${alt.rank} of ${hbu.alternatives.length})`, unit: '/100', sources: ['METHOD:HBU-FRAMEWORK'] }),
    calculated(m.npv, FORMULAS.npv, { label: 'NPV', unit: 'AED', sources: [methodFin] }),
    calculated(m.irr, FORMULAS.irr, { label: 'IRR', unit: '%', sources: [methodFin] }),
    calculated(m.roi, FORMULAS.roi, { label: 'ROI', unit: '%', sources: [methodFin] }),
    calculated(m.payback, FORMULAS.payback, { label: 'Payback', unit: 'years', sources: [methodFin] }),
    calculated(m.totalCapex, FORMULAS.capex, { label: 'Total CAPEX', unit: 'AED', sources: [methodFin] }),
    calculated(structuring.recommended.total.value, 'Weighted structure score (predefined rules)', {
      label: `Structure score — ${structuring.recommended.name}`,
      unit: '/100',
      sources: ['METHOD:STRUCTURING-RULES'],
    }),
  ];

  const risks = [];
  for (const h of alt.constraintHits.filter((x) => x.s >= 0.3)) {
    risks.push({ text: `${h.c.label}: ${h.c.description.replace(/\.$/, '')}`, sources: [`DM-AFF:${plot.affection.affectionPlanNo}`] });
  }
  if (alt.legal.status === 'conditional') risks.push({ text: alt.legal.text, sources: [`DM-PLAN:ZONE-${plot.plotNumber}`] });
  const be = sens.breakevens;
  if (be.priceDrop != null) risks.push({ text: `NPV reaches zero if price/rent falls ${pct(be.priceDrop, 0)} below the assumption`, sources: [methodFin] });
  if (be.capexRise != null) risks.push({ text: `NPV reaches zero if CAPEX rises ${pct(be.capexRise, 0)}`, sources: [methodFin] });
  const topSens = sens.rows[0];
  risks.push({ text: `${topSens.label} is the most sensitive driver (${topSens.shiftLabel} moves NPV from ${aedM(topSens.npvLow)} to ${aedM(topSens.npvHigh)})`, sources: [methodFin] });
  for (const x of sd.filter((x) => x.gapIndex.value < 0)) risks.push({ text: `${x.label} is oversupplied once the pipeline is counted`, sources: x.supply.sources.slice(0, 1) });

  const conditions = [
    ...plot.constraints.filter((c) => c.severity !== 'low' && (use.constraintSensitivity[c.type] ?? 0) > 0).map((c) => `Resolve ${c.label.toLowerCase()} through design and the relevant NOC`),
    alt.legal.status === 'conditional' ? `Obtain ${alt.legal.text.split(': ')[1]}` : null,
    `Test ${use.operatorSpecialised ? 'operator' : 'developer'} appetite for a ${structuring.recommended.name.split(' (')[0]} (market sounding)`,
    'Validate rent, cost and yield assumptions with an independent valuation',
    'Confirm the structuring approach with the legal and investment committees',
  ].filter(Boolean);

  const alternatives = hbu.alternatives.filter((a) => a.use.id !== use.id).map((a) => ({ name: a.use.shortName, score: a.total.value, rank: a.rank, irr: a.quick.irr, npv: a.quick.npv }));

  const assumptions = financial.assumptions.map((a) => ({ label: a.label, value: a.value, original: a.original, format: a.format, kind: a.kind, unit: a.unit }));

  const narrative = aiText(
    `Recommended scenario: develop plot ${plot.plotNumber} as ${article(use.name)} ${use.name} under ${article(structuring.recommended.name)} ${structuring.recommended.name.split(' (')[0]}. ${
      alt.rank === 1
        ? `It ranks first of ${hbu.alternatives.length} HBU alternatives at ${hbuScore}/100`
        : `It was chosen by the specialist and ranks ${alt.rank} of ${hbu.alternatives.length} at ${hbuScore}/100`
    }, supported by ${alt.strengths.map((s) => s.toLowerCase()).join(', ') || 'balanced criteria'}. On illustrative assumptions it returns an NPV of ${aedM(m.npv)} at ${pct(financial.inputs.discountRate)}, an IRR of ${pct(m.irr)} against a ${pct(HURDLE_IRR, 0)} hurdle, ROI of ${pct(m.roi, 0)} and payback of ${m.payback ? `${m.payback.toFixed(1)} years` : 'beyond the horizon'}. ${robustness}. The key risks are ${risks
      .slice(0, 2)
      .map((x) => lowerFirst(x.text))
      .join('; ')}. The investment specialist must decide whether to progress.`,
    [...asset.sourceIds.slice(0, 1), ...sd.flatMap((x) => x.supply.sources).slice(0, 1), methodFin, 'METHOD:HBU-FRAMEWORK', 'METHOD:STRUCTURING-RULES'],
  );

  return {
    verdict,
    confidence,
    robustness,
    use,
    structure: structuring.recommended,
    headline: `${use.name} · ${structuring.recommended.name.split(' (')[0]}`,
    metrics: m,
    inputs: financial.inputs,
    facts,
    calcs,
    risks,
    conditions,
    alternatives,
    assumptions,
    narrative,
    disclaimer: 'Illustrative prototype output using representative and simulated data. Not an investment approval; the investment specialist has final authority.',
  };
}
