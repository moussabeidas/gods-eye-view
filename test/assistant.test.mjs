import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createSession, computeFrom } from '../src/engine/orchestrator.js';
import { answer, parseActions, flipWeight } from '../src/engine/analyst.js';
import { handleApi, sanitiseOverrides } from '../server/api.js';
import { setClient } from '../server/claude.js';

const session = computeFrom(createSession('421-0318'));

test('parses modify-and-rerun instructions into actions (FR-066, FR-067)', () => {
  assert.deepEqual(parseActions('What if the discount rate is 10%?', session), [{ type: 'setAssumption', key: 'discountRate', value: 0.1 }]);
  const rent = parseActions('Reduce rent by 10%', session)[0];
  assert.equal(rent.key, 'price');
  assert.equal(rent.value, Math.round(session.results.financial.inputs.price * 0.9));
  assert.deepEqual(parseActions('set the weight of supply gap to 30', session), [{ type: 'setWeight', criterion: 'gap', value: 30 }]);
  assert.deepEqual(parseActions('Proceed with the private school', session), [{ type: 'selectUse', useId: 'private-school' }]);
  assert.deepEqual(parseActions('please rerun the HBU', session), [{ type: 'rerun', stage: 'hbu' }]);
  assert.deepEqual(parseActions('What is the zoning?', session), []);
});

test('explains why one alternative ranks above another with a criterion table (FR-039, FR-064)', () => {
  const res = answer(session, 'Why does the community retail centre rank above the private school?');
  assert.match(res.text, /\| Criterion \| Weight \|/);
  assert.match(res.text, /AI interpretation/);
  assert.ok(res.citations.includes('METHOD:HBU-FRAMEWORK'));
  assert.ok(res.retrieved.length > 0, 'retrieved evidence is exposed (RAG)');
});

test('answers stay grounded in retrieved, cited records (FR-077, FR-078)', () => {
  const res = answer(session, 'What is this plot zoned for?', { stage: 'asset' });
  assert.ok(res.citations.includes('DM-PLAN:ZONE-421-0318'));
  assert.equal(res.mode, 'offline');
});

test('challenge responses surface the weakest evidence and what would change the conclusion (FR-065)', () => {
  const res = answer(session, 'I challenge this recommendation');
  assert.match(res.text, /weakest points/);
  assert.match(res.text, /What would change the conclusion/);
});

test('flip-weight analysis finds the weight that ties two alternatives', () => {
  const hbu = session.results.hbu;
  const [lead, second] = hbu.alternatives;
  const c = hbu.criteria.find((x) => second.scores[x.id] > lead.scores[x.id]);
  const x = flipWeight(hbu, lead, second, c.id);
  assert.ok(x > c.effectiveWeight && x < 100);
  const s = createSession('421-0318');
  s.overrides.weights = Object.fromEntries(hbu.criteria.map((k) => [k.id, k.id === c.id ? x + 1 : (k.effectiveWeight * (100 - x - 1)) / (100 - c.effectiveWeight)]));
  computeFrom(s);
  assert.notEqual(s.results.hbu.alternatives[0].use.id, lead.use.id, 'the ranking flips just past the computed weight');
});

test('API sanitises client overrides', () => {
  const o = sanitiseOverrides({ weights: { gap: 30, bogus: 5, demand: 'x' }, selectedUseId: 'nope', assumptions: { 'community-retail': { price: 900, 'bad key': 1, rent: NaN } } });
  assert.deepEqual(o.weights, { gap: 30 });
  assert.equal(o.selectedUseId, null);
  assert.deepEqual(o.assumptions['community-retail'], { price: 900 });
});

const server = http.createServer(handleApi);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test('API health and offline chat', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  const h = await (await fetch(`${base}/api/health`)).json();
  assert.equal(h.ok, true);
  assert.deepEqual(h.plots, ['421-0318', '326-0914']);
  const r = await fetch(`${base}/api/chat`, { method: 'POST', body: JSON.stringify({ plotNumber: '326-0914', question: 'What are the NPV and IRR?', stage: 'Financial Feasibility' }) });
  const body = await r.json();
  assert.equal(body.mode, 'offline');
  assert.match(body.text, /NPV/);
  const bad = await fetch(`${base}/api/chat`, { method: 'POST', body: JSON.stringify({ plotNumber: '000', question: 'hi' }) });
  assert.equal(bad.status, 400);
});

test('Claude path: server-side evidence search, queued actions and citation filtering', async () => {
  const calls = [];
  const turns = [
    {
      stop_reason: 'tool_use',
      model: 'claude-test',
      content: [
        { type: 'tool_use', id: 't1', name: 'search_evidence', input: { query: 'supermarket supply' } },
        { type: 'tool_use', id: 't2', name: 'set_assumption', input: { key: 'discountRate', value: 0.1 } },
      ],
    },
    {
      stop_reason: 'end_turn',
      model: 'claude-test',
      content: [{ type: 'text', text: 'Zoning is C-2 [[DM-PLAN:ZONE-421-0318]] and an invented record [[FAKE:1]].\n\nAI interpretation: retail fits.' }],
    },
  ];
  setClient({ beta: { messages: { create: async (params) => (calls.push(params), turns.shift()) } } });
  const r = await fetch(`${base}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({ plotNumber: '421-0318', question: 'Test discount rate 10%', stage: 'Financial Feasibility', history: [{ role: 'assistant', text: 'hello' }] }),
  });
  const body = await r.json();
  assert.equal(body.mode, 'claude');
  assert.deepEqual(body.actions, [{ type: 'setAssumption', key: 'discountRate', value: 0.1 }]);
  assert.deepEqual(body.citations, ['DM-PLAN:ZONE-421-0318'], 'unknown record ids are dropped');
  assert.ok(
    body.retrieved.some((x) => /SUPERMARKET/.test(x.id)),
    'tool search results are exposed as retrieved evidence',
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].messages[0].role, 'user', 'history never starts with an assistant turn');
  assert.ok(calls[0].system[1].text.includes('Stage 3 — HBU'), 'the analysis digest grounds the model');
  assert.equal(calls[1].messages.at(-1).content[0].type, 'tool_result');
  setClient(undefined);
});
