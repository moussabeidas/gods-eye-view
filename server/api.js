// HTTP API shared by the Vite dev server and the production server.
//   GET  /api/health — reports whether an LLM is configured
//   POST /api/chat   — context-aware assistant turn (Claude, or the offline analyst)

import { createSession, computeFrom } from '../src/engine/orchestrator.js';
import { answer as offlineAnswer } from '../src/engine/analyst.js';
import { PLOTS } from '../src/data/plots.js';
import { HBU_CRITERIA, USE_CATALOGUE } from '../src/data/methodology.js';
import { chatWithClaude, llmConfigured, MODEL } from './claude.js';

const MAX_BODY = 64 * 1024;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Accept only known keys and finite numbers from the client. */
export function sanitiseOverrides(raw = {}) {
  const out = { weights: {}, selectedUseId: null, assumptions: {}, savedScenarios: {} };
  for (const c of HBU_CRITERIA) if (finite(raw.weights?.[c.id])) out.weights[c.id] = Math.max(0, Math.min(100, raw.weights[c.id]));
  if (typeof raw.selectedUseId === 'string' && USE_CATALOGUE[raw.selectedUseId]) out.selectedUseId = raw.selectedUseId;
  for (const [useId, a] of Object.entries(raw.assumptions ?? {})) {
    if (!USE_CATALOGUE[useId] || typeof a !== 'object' || a === null) continue;
    out.assumptions[useId] = Object.fromEntries(Object.entries(a).filter(([k, v]) => /^[a-zA-Z]{1,24}$/.test(k) && finite(v)));
  }
  return out;
}

export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, { ok: true, llm: llmConfigured(), model: llmConfigured() ? MODEL : null, plots: PLOTS.map((p) => p.plotNumber) });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const body = await readJson(req);
      const question = String(body.question ?? '')
        .trim()
        .slice(0, 2000);
      if (!question) return send(res, 400, { error: 'Question is required' });
      if (!PLOTS.some((p) => p.plotNumber === body.plotNumber)) return send(res, 400, { error: 'Unknown plot' });
      const session = createSession(body.plotNumber);
      session.overrides = sanitiseOverrides(body.overrides);
      if (body.reviews && typeof body.reviews === 'object') {
        for (const [k, v] of Object.entries(body.reviews)) {
          if (session.reviews[k] && typeof v?.status === 'string') session.reviews[k] = { status: v.status.slice(0, 20), note: typeof v.note === 'string' ? v.note.slice(0, 300) : undefined };
        }
      }
      computeFrom(session);
      const stage = typeof body.stage === 'string' ? body.stage.slice(0, 40) : undefined;
      const history = Array.isArray(body.history) ? body.history.filter((m) => m && typeof m.text === 'string').slice(-8) : [];
      if (!llmConfigured()) return send(res, 200, offlineAnswer(session, question, { stage }));
      try {
        return send(res, 200, await chatWithClaude(session, { question, stage, history }));
      } catch (error) {
        console.error('[chat] Claude request failed; using offline analyst:', error?.status ?? '', error?.message);
        return send(res, 200, { ...offlineAnswer(session, question, { stage }), notice: 'The LLM was unavailable, so the offline analyst answered.' });
      }
    }
    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    return send(res, error.status ?? 500, { error: error.status ? error.message : 'Internal error' });
  }
}
