import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, computeFrom, runPipeline, AGENTS, STAGES } from '../src/engine/orchestrator.js';
import { npvAt, irrOf, runModel, buildAssumptions, toInputs } from '../src/engine/finance.js';
import { getContext } from '../src/data/context.js';
import { getPlot, PLOTS } from '../src/data/plots.js';
import { USE_CATALOGUE, HBU_CRITERIA, STRUCTURES } from '../src/data/methodology.js';
import { getCorpus, getPlotCorpus } from '../src/data/sources.js';
import { buildIndex, search } from '../src/engine/retrieval.js';

const sessions = Object.fromEntries(PLOTS.map((p) => [p.plotNumber, computeFrom(createSession(p.plotNumber))]));

test('BRD AC-01: one to two representative plots, located by DM plot number (FR-001, FR-002)', () => {
  assert.ok(PLOTS.length >= 1 && PLOTS.length <= 2);
  assert.equal(getPlot('421-0318').plotNumber, '421-0318');
  assert.equal(getPlot('Plot 326-0914').plotNumber, '326-0914');
  assert.equal(getPlot('4210318').plotNumber, '421-0318');
  assert.equal(getPlot('999-9999'), null);
  for (const p of PLOTS) {
    assert.ok(p.geometry.length >= 4, 'plot has a polygon');
    assert.ok(p.areaM2 > 1000);
  }
});

test('NPV and IRR are computed correctly on known cash flows (FR-046, FR-047)', () => {
  const flows = [-100, 110];
  assert.ok(Math.abs(npvAt(flows, 0.1)) < 1e-9);
  assert.ok(Math.abs(irrOf(flows) - 0.1) < 1e-6);
  const annuity = [-1000, 300, 300, 300, 300, 300];
  const irr = irrOf(annuity);
  assert.ok(Math.abs(npvAt(annuity, irr)) < 1e-4);
  assert.equal(irrOf([100, 100]), null, 'no sign change → no IRR');
});

test('financial model reports NPV, IRR, ROI and payback and reacts to assumptions (FR-048 – FR-053)', () => {
  const plot = getPlot('421-0318');
  const use = USE_CATALOGUE['community-retail'];
  const inputs = toInputs(buildAssumptions(plot, use, getContext(plot.plotNumber)));
  const base = runModel(plot, use, inputs);
  for (const k of ['npv', 'irr', 'roi', 'payback']) assert.ok(Number.isFinite(base[k]), `${k} is finite`);
  assert.ok(base.payback > inputs.constructionYears, 'payback comes after construction');
  const cheaper = runModel(plot, use, { ...inputs, price: inputs.price * 1.1 });
  assert.ok(cheaper.npv > base.npv);
  const dearer = runModel(plot, use, { ...inputs, discountRate: inputs.discountRate + 0.02 });
  assert.ok(dearer.npv < base.npv);
  assert.equal(dearer.irr.toFixed(6), base.irr.toFixed(6), 'IRR is independent of the discount rate');
});

test('user-modified assumptions stay distinguishable from originals (FR-073)', () => {
  const plot = getPlot('421-0318');
  const use = USE_CATALOGUE['community-retail'];
  const list = buildAssumptions(plot, use, getContext(plot.plotNumber), { discountRate: 0.11 });
  const dr = list.find((a) => a.key === 'discountRate');
  assert.equal(dr.kind, 'user');
  assert.equal(dr.original, 0.09);
  assert.equal(dr.value, 0.11);
  const price = list.find((a) => a.key === 'price');
  assert.notEqual(price.kind, 'user');
  assert.ok(price.sources.length > 0, 'price is linked to a market benchmark source');
});

test('HBU: multiple alternatives, screened for permissibility, weighted, scored and ranked (FR-030 – FR-039)', () => {
  for (const s of Object.values(sessions)) {
    const hbu = s.results.hbu;
    assert.ok(hbu.alternatives.length >= 3);
    assert.ok(hbu.screenedOut.length >= 1, 'a prohibited use is screened out with a reason');
    const weightSum = hbu.criteria.reduce((t, c) => t + c.effectiveWeight, 0);
    assert.ok(Math.abs(weightSum - 100) < 0.5);
    for (let i = 1; i < hbu.alternatives.length; i++) assert.ok(hbu.alternatives[i - 1].total.value >= hbu.alternatives[i].total.value);
    for (const a of hbu.alternatives) {
      const expected = HBU_CRITERIA.reduce((t, c) => t + (a.scores[c.id] * c.weight) / 10, 0);
      assert.ok(Math.abs(expected - a.total.value) < 0.2, 'total equals the weighted sum');
      assert.equal(a.rationale.kind, 'ai');
      for (const c of HBU_CRITERIA) assert.ok(a.scores[c.id] >= 0 && a.scores[c.id] <= 10);
    }
  }
});

test('changing HBU weights and rerunning changes scores and marks weights user-modified (FR-066, FR-067)', () => {
  const s = createSession('421-0318');
  s.overrides.weights = { gap: 60 };
  computeFrom(s);
  assert.equal(s.results.hbu.weightsModified, true);
  const gap = s.results.hbu.criteria.find((c) => c.id === 'gap');
  assert.ok(gap.modified && gap.effectiveWeight > 20);
  const base = sessions['421-0318'].results.hbu.alternatives.find((a) => a.use.id === 'sports-wellness').total.value;
  const now = s.results.hbu.alternatives.find((a) => a.use.id === 'sports-wellness').total.value;
  assert.notEqual(now, base);
});

test('the specialist can carry a different use forward (human authority)', () => {
  const s = createSession('326-0914');
  s.overrides.selectedUseId = 'build-to-rent';
  computeFrom(s);
  assert.equal(s.results.financial.useId, 'build-to-rent');
  assert.match(s.results.recommendation.headline, /Build-to-rent/);
});

test('supply-demand gap index follows its formula and cites evidence (FR-025 – FR-029)', () => {
  for (const s of Object.values(sessions)) {
    for (const r of s.results.supplyDemand.results) {
      const expected = (r.demand.value - r.supply.value - r.pipeline) / r.demand.value;
      // Displayed values are rounded; small-unit benchmarks (rooms) drift slightly.
      assert.ok(Math.abs(expected - r.gapIndex.value) < 0.03, r.label);
      assert.ok(r.evidence.length >= 2);
    }
  }
});

test('comparables are selected with explanations and shown on the map (FR-020 – FR-023)', () => {
  const C = sessions['421-0318'].results.comparables;
  assert.ok(C.selected.length >= 2);
  for (const c of C.selected) {
    assert.ok(c.reasons.length > 0, 'each comparable says why');
    assert.ok(c.ring && c.coord, 'each comparable has geometry');
  }
  assert.ok(
    C.all.some((c) => !c.selected && c.weaknesses.length),
    'exclusions are explained',
  );
});

test('structuring compares relevant structures with predefined rules, separate from AI text (FR-041 – FR-045)', () => {
  const ids = new Set(STRUCTURES.map((s) => s.id));
  for (const id of ['lease', 'musataha', 'bot', 'dbot', 'concession', 'ppp']) assert.ok(ids.has(id));
  for (const s of Object.values(sessions)) {
    const st = s.results.structuring;
    assert.ok(st.applicable.length >= 2);
    assert.ok(st.excluded.every((x) => x.why && x.rule));
    assert.equal(st.interpretation.kind, 'ai');
    assert.ok(st.recommended.applicable);
  }
});

test('recommendation is decision support with evidence, assumptions and no approval language (FR-056 – FR-062, FR-069)', () => {
  for (const s of Object.values(sessions)) {
    const rec = s.results.recommendation;
    assert.ok(rec.facts.every((f) => f.kind === 'sourced' || f.kind === 'calculated'));
    assert.ok(rec.calcs.every((c) => c.kind === 'calculated'));
    assert.equal(rec.narrative.kind, 'ai');
    assert.ok(rec.assumptions.length > 5);
    assert.ok(rec.risks.length > 0 && rec.conditions.length > 0);
    assert.doesNotMatch(`${rec.verdict.label} ${rec.narrative.value}`, /\bapproved\b/i);
    assert.match(rec.narrative.value, /specialist must decide/);
  }
});

test('evidence corpus carries BRD §24.17 source metadata for every record (DP-06)', () => {
  const corpus = getCorpus();
  assert.ok(corpus.length > 50);
  const kinds = new Set(corpus.map((d) => d.sourceKey));
  for (const k of ['DM-GIS', 'DM-PLAN', 'DM-AFF', 'DLD-TXN', 'RERA-RENT', 'DSC-POP', 'TP-MARKET']) assert.ok(kinds.has(k), `represents ${k}`);
  for (const d of corpus) {
    for (const f of ['id', 'sourceName', 'sourceType', 'recordId', 'content', 'date', 'citation', 'category', 'relation']) assert.ok(d[f], `${d.id} has ${f}`);
    // Only open map data records are real; every represented government record is simulated.
    assert.equal(d.simulated, d.sourceKey !== 'OSM', `${d.id} simulated flag`);
  }
  assert.ok(kinds.has('OSM'), 'open map data is cited as a real source');
});

test('retrieval finds the zoning record for a planning question (FR-075)', () => {
  const index = buildIndex(getPlotCorpus('421-0318'));
  const hits = search(index, 'what uses are permitted under the zoning?', { k: 3 });
  assert.equal(hits[0].doc.id, 'DM-PLAN:ZONE-421-0318');
  assert.ok(hits[0].snippet.length > 10);
});

test('all cited sources in stage outputs exist in the corpus (FR-070, FR-071)', () => {
  const ids = new Set(getCorpus().map((d) => d.id));
  for (const s of Object.values(sessions)) {
    const r = s.results;
    const cited = [
      ...r.asset.sourceIds,
      ...r.asset.summary.sources,
      ...r.location.summary.sources,
      ...r.location.demographics.residents.sources,
      ...r.location.activity.map((a) => a.sourceId),
      ...r.supplyDemand.results.flatMap((x) => x.evidence.flatMap((e) => e.sources)),
      ...r.hbu.alternatives.flatMap((a) => Object.values(a.sources).flat()),
      ...r.recommendation.narrative.sources,
      ...r.financial.assumptions.flatMap((a) => a.sources),
    ];
    for (const id of cited) assert.ok(ids.has(id), `missing evidence record ${id}`);
  }
});

test('orchestrator emits visible activity for every specialised agent and resets reviews on rerun (FR-081 – FR-083)', async () => {
  const s = createSession('421-0318');
  const events = [];
  await runPipeline(s, { delay: 0, onEvent: (e) => events.push(e) });
  const agents = new Set(events.filter((e) => e.type === 'agent').map((e) => e.agent));
  for (const id of Object.keys(AGENTS)) assert.ok(agents.has(id), `agent ${id} reported activity`);
  assert.deepEqual(
    events.filter((e) => e.type === 'stage' && e.status === 'done').map((e) => e.stage),
    STAGES.map((x) => x.id),
  );
  s.reviews.hbu = { status: 'accepted' };
  s.reviews.asset = { status: 'accepted' };
  await runPipeline(s, { from: 'hbu', delay: 0 });
  assert.equal(s.reviews.hbu.status, 'pending');
  assert.equal(s.reviews.asset.status, 'accepted', 'upstream reviews are kept');
});
