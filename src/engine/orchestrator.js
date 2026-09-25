// Agentic orchestration (BRD §22, FR-081 – FR-085). Specialised agents run in
// sequence, each consuming earlier outputs (FR-083), and emit business-level
// activity events for the interface. Any stage can be rerun after the
// specialist modifies inputs (FR-066, FR-067); downstream stages then rerun
// and their reviews reset.

import { getPlot } from '../data/plots.js';
import { getContext } from '../data/context.js';
import { USE_CATALOGUE } from '../data/methodology.js';
import { analyseAsset } from './asset.js';
import { analyseLocation } from './location.js';
import { analyseComparables } from './comparables.js';
import { analyseSupplyDemand } from './supplyDemand.js';
import { analyseHbu } from './hbu.js';
import { analyseStructuring } from './structuring.js';
import { buildAssumptions, runModel, sensitivity, scenarios, toInputs } from './finance.js';
import { buildRecommendation } from './recommendation.js';

export const STAGES = [
  { id: 'asset', n: 1, label: 'Asset Intelligence', short: 'Asset' },
  { id: 'location', n: 2, label: 'Location & Market Intelligence', short: 'Location & Market' },
  { id: 'hbu', n: 3, label: 'Highest & Best Use', short: 'HBU' },
  { id: 'structuring', n: 4, label: 'Investment Structuring', short: 'Structuring' },
  { id: 'financial', n: 5, label: 'Financial Feasibility', short: 'Financials' },
  { id: 'recommendation', n: 6, label: 'Investment Recommendation', short: 'Recommendation' },
];

export const AGENTS = {
  orchestrator: { name: 'Investment Orchestrator', icon: 'hub', role: 'Plans the journey and hands work between agents' },
  retrieval: { name: 'Information Retrieval Agent', icon: 'database', role: 'Retrieves records from DM, DLD, RERA, public and third-party sources' },
  asset: { name: 'Asset Intelligence Agent', icon: 'plot', role: 'Consolidates plot, planning, zoning and affection-map information' },
  location: { name: 'Location & Market Intelligence Agent', icon: 'pin', role: 'Analyses demographics, accessibility, activity and market indicators' },
  comparables: { name: 'Comparable Analysis Agent', icon: 'compare', role: 'Identifies and explains comparable plots and areas' },
  supply: { name: 'Supply-Demand Agent', icon: 'scale', role: 'Estimates demand, supply and service gaps' },
  hbu: { name: 'HBU Assessment Agent', icon: 'rank', role: 'Generates, scores and ranks alternative uses' },
  structuring: { name: 'Investment Structuring Agent', icon: 'structure', role: 'Screens and compares investment structures' },
  financial: { name: 'Financial Analysis Agent', icon: 'chart', role: 'Builds cash flows, metrics, sensitivities and scenarios' },
  recommendation: { name: 'Investment Recommendation Agent', icon: 'flag', role: 'Consolidates evidence into a decision-ready recommendation' },
};

export function createSession(plotNumber) {
  const plot = getPlot(plotNumber);
  if (!plot) throw new Error(`Unknown plot ${plotNumber}`);
  return {
    plot,
    ctx: getContext(plot.plotNumber),
    overrides: { weights: {}, selectedUseId: null, assumptions: {}, savedScenarios: {} },
    results: {},
    reviews: Object.fromEntries(STAGES.map((s) => [s.id, { status: 'pending' }])),
    completed: new Set(),
  };
}

export function selectedAlternative(session) {
  const hbu = session.results.hbu;
  const id = session.overrides.selectedUseId;
  return hbu.alternatives.find((a) => a.use.id === id) ?? hbu.alternatives[0];
}

function computeFinancial(session) {
  const { plot, ctx, overrides } = session;
  const alt = selectedAlternative(session);
  const use = alt.use;
  const assumptions = buildAssumptions(plot, use, ctx, overrides.assumptions[use.id] ?? {});
  const inputs = toInputs(assumptions);
  const originalInputs = Object.fromEntries(assumptions.map((a) => [a.key, a.original]));
  return {
    selectedAlternative: alt,
    useId: use.id,
    assumptions,
    inputs,
    originalInputs,
    result: runModel(plot, use, inputs),
    sensitivity: sensitivity(plot, use, inputs),
    scenarios: scenarios(plot, use, originalInputs, inputs, overrides.savedScenarios[use.id] ?? []),
    userModified: assumptions.filter((a) => a.kind === 'user').map((a) => a.key),
  };
}

/** Synchronously compute one stage from the outputs of earlier stages. */
export function computeStage(session, stageId) {
  const { plot, ctx, results: r } = session;
  switch (stageId) {
    case 'asset':
      r.asset = analyseAsset(plot);
      break;
    case 'location':
      r.location = analyseLocation(plot, ctx);
      r.comparables = analyseComparables(plot, ctx);
      r.supplyDemand = analyseSupplyDemand(plot, ctx, r.location);
      break;
    case 'hbu':
      r.hbu = analyseHbu(plot, ctx, r, { weights: session.overrides.weights });
      if (session.overrides.selectedUseId && !r.hbu.alternatives.some((a) => a.use.id === session.overrides.selectedUseId)) {
        session.overrides.selectedUseId = null;
      }
      break;
    case 'structuring': {
      r.financial = computeFinancial(session);
      r.structuring = analyseStructuring(plot, ctx, r.financial.selectedAlternative.use, r.financial.result);
      break;
    }
    case 'financial':
      r.financial = computeFinancial(session);
      break;
    case 'recommendation':
      r.recommendation = buildRecommendation(plot, r);
      break;
    default:
      throw new Error(`Unknown stage ${stageId}`);
  }
  session.completed.add(stageId);
}

/** Compute every stage from `from` onwards without animation (tests, API). */
export function computeFrom(session, from = 'asset') {
  const start = STAGES.findIndex((s) => s.id === from);
  for (const s of STAGES.slice(start)) computeStage(session, s.id);
  return session;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const n = (x) => Math.round(x).toLocaleString('en-US');
const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);

/** Activity script per stage: business-readable steps around the computation. */
function script(session, stageId) {
  const { plot, ctx, results: r } = session;
  const p = plot.plotNumber;
  switch (stageId) {
    case 'asset':
      return {
        before: [
          ['retrieval', `Querying DM GIS Plot Register for plot ${p}`, ['DM-GIS:PLOT-' + p]],
          ['retrieval', 'Querying DM Planning & Zoning Regulations', ['DM-PLAN:ZONE-' + p]],
          ['retrieval', `Retrieving structured affection plan ${plot.affection.affectionPlanNo}`, [`DM-AFF:${plot.affection.affectionPlanNo}`]],
        ],
        run: ['asset', 'Consolidating plot, planning, zoning and affection-map fields'],
        after: () => [['asset', `Plot ${n(plot.areaM2)} m² · ${plot.planning.zoningCode} · max GFA ${n(r.asset.metrics.maxGfa)} m² · ${r.asset.constraints.length} constraints recorded`, []]],
      };
    case 'location':
      return {
        before: [
          ['retrieval', `Querying Dubai Statistics Center — ${ctx.communities.length} communities`, ctx.communities.map((c) => `DSC-POP:POP-${c.id}`)],
          ['retrieval', 'Querying RTA road & transit network', [`RTA-NET:ACCESS-${p}`]],
          ['retrieval', `Querying licence and facility registers (DET, KHDA, DHA, DSC) — ${ctx.pois.length} facilities`, []],
          ['retrieval', `Querying RERA benchmarks and ${ctx.transactions.length} DLD transactions`, ctx.transactions.slice(0, 3).map((t) => `DLD-TXN:${t.id}`)],
        ],
        run: ['location', 'Analysing demographics, accessibility, activity mix and market momentum'],
        after: () => [
          [
            'location',
            `Catchment ${n(r.location.demographics.residents.value)} residents (+${r.location.demographics.growthPct.value}%/yr) · accessibility ${r.location.accessibility.score.value}/10`,
            [],
          ],
          [
            'comparables',
            `Screened ${r.comparables.all.length} candidate plots on 6 factors → ${r.comparables.selected.length} comparables (threshold ${r.comparables.threshold})`,
            r.comparables.selected.slice(0, 2).flatMap((c) => c.sourceIds),
          ],
          ['supply', `Using demographics from the Location agent and facility supply from the Retrieval agent`, []],
          [
            'supply',
            `${r.supplyDemand.results.length} service categories assessed · strongest gap: ${[...r.supplyDemand.results].sort((a, b) => b.gapIndex.value - a.gapIndex.value)[0].label} (${Math.round([...r.supplyDemand.results].sort((a, b) => b.gapIndex.value - a.gapIndex.value)[0].gapIndex.value * 100)}%)`,
            ['METHOD:SERVICE-BENCHMARKS'],
          ],
        ],
      };
    case 'hbu':
      return {
        before: [
          ['hbu', `Generating candidate uses from permitted uses, supply gaps and market context`, [`DM-PLAN:ZONE-${p}`]],
          ['hbu', 'Requesting indicative yields from the Financial Analysis Agent', []],
        ],
        run: ['hbu', 'Scoring alternatives on 7 predefined criteria'],
        after: () => [
          ...(r.hbu.screenedOut.length ? [['hbu', `Screened out: ${r.hbu.screenedOut.map((s) => `${s.use.shortName} (${s.reason})`).join('; ')}`, [`DM-PLAN:ZONE-${p}`]]] : []),
          [
            'hbu',
            `Ranked ${r.hbu.alternatives.length} alternatives: ${r.hbu.alternatives.map((a) => `${a.rank}. ${a.use.shortName} ${a.total.value}`).join(' · ')}${r.hbu.weightsModified ? ' (user-modified weights)' : ''}`,
            ['METHOD:HBU-FRAMEWORK'],
          ],
        ],
      };
    case 'structuring':
      return {
        before: [['structuring', `Receiving selected use: ${selectedAlternative(session).use.shortName}${session.overrides.selectedUseId ? ' (chosen by specialist)' : ''}`, []]],
        run: ['structuring', 'Screening Lease, Musataha, BOT, DBOT, Concession and PPP against predefined rules'],
        after: () => [
          [
            'structuring',
            `${r.structuring.applicable.length} applicable · ${r.structuring.excluded.length} screened out · recommended ${r.structuring.recommended.name} (${r.structuring.recommended.total.value}/100)`,
            ['METHOD:STRUCTURING-RULES'],
          ],
        ],
      };
    case 'financial':
      return {
        before: [['financial', `Building assumption register for ${selectedAlternative(session).use.shortName}`, [`METHOD:USE-${selectedAlternative(session).use.id}`]]],
        run: ['financial', 'Running annual cash-flow model, sensitivities and scenarios'],
        after: () => [
          ['financial', `${r.financial.assumptions.length} assumptions (${r.financial.userModified.length} user-modified) · ${r.financial.result.horizon}-year horizon`, ['METHOD:FINANCIAL-MODEL']],
          [
            'financial',
            `NPV AED ${(r.financial.result.npv / 1e6).toFixed(1)}M · IRR ${pct(r.financial.result.irr)} · ROI ${pct(r.financial.result.roi)} · payback ${r.financial.result.payback ? r.financial.result.payback.toFixed(1) + ' yrs' : '> horizon'}`,
            [],
          ],
        ],
      };
    case 'recommendation':
      return {
        before: [['recommendation', 'Consolidating outputs from asset, market, HBU, structuring and financial agents', []]],
        run: ['recommendation', 'Drafting evidence-based recommendation'],
        after: () => [['recommendation', `${r.recommendation.verdict.label} — awaiting specialist decision`, []]],
      };
    default:
      return { before: [], run: ['orchestrator', stageId], after: () => [] };
  }
}

/**
 * Run the pipeline from a stage with visible agent activity.
 * onEvent receives {type: 'stage'|'agent'|'done', ...}.
 */
export async function runPipeline(session, { from = 'asset', onEvent = () => {}, delay = 320 } = {}) {
  const start = STAGES.findIndex((s) => s.id === from);
  const todo = STAGES.slice(start);
  const rerun = start > 0 || session.completed.size > 0;
  onEvent({
    type: 'agent',
    agent: 'orchestrator',
    status: 'running',
    message: rerun
      ? `Rerunning from ${todo[0].label}: ${todo.length} stage(s) affected`
      : `Plan: ${STAGES.length} stages across ${Object.keys(AGENTS).length - 1} specialised agents for plot ${session.plot.plotNumber}`,
  });
  await sleep(delay);
  for (const stage of todo) {
    session.reviews[stage.id] = { status: 'pending', rerun };
    onEvent({ type: 'stage', stage: stage.id, status: 'running' });
    const s = script(session, stage.id);
    for (const [agent, message, sources] of s.before) {
      onEvent({ type: 'agent', agent, stage: stage.id, status: 'running', message, sources });
      await sleep(delay);
    }
    onEvent({ type: 'agent', agent: s.run[0], stage: stage.id, status: 'running', message: s.run[1] });
    await sleep(delay * 1.4);
    computeStage(session, stage.id);
    for (const [agent, message, sources] of s.after()) {
      onEvent({ type: 'agent', agent, stage: stage.id, status: 'done', message, sources });
      await sleep(delay * 0.6);
    }
    onEvent({ type: 'stage', stage: stage.id, status: 'done' });
  }
  onEvent({ type: 'agent', agent: 'orchestrator', status: 'done', message: 'Analysis complete. Human review required before any decision.' });
  onEvent({ type: 'done' });
  return session;
}

export function useName(id) {
  return USE_CATALOGUE[id]?.name ?? id;
}
