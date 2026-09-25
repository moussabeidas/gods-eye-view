// Application controller: state, rendering and user interactions for the
// end-to-end journey (BRD §8, §30).

import './styles.css';
import { PLOTS, getPlot } from './data/plots.js';
import { SEED_PORTFOLIO, recordFromSession } from './data/portfolio.js';
import { createSession, runPipeline, computeStage, STAGES, AGENTS } from './engine/orchestrator.js';
import { answer as offlineAnswer, describeAction } from './engine/analyst.js';
import { InvestmentMap } from './ui/map.js';
import { installTooltip } from './ui/charts.js';
import { renderStepper, renderAgents, renderChat, renderEvidence, renderCap, renderLayers, renderLegend } from './ui/shell.js';
import { renderPlotSelection, renderAsset } from './ui/panels/asset.js';
import { renderLocation } from './ui/panels/location.js';
import { renderHbu, renderStructuring } from './ui/panels/hbu.js';
import { renderFinancial } from './ui/panels/financial.js';
import { renderRecommendation } from './ui/panels/recommendation.js';

const $ = (id) => document.getElementById(id);
const PORTFOLIO_KEY = 'gev-cap-portfolio-v1';

function loadPortfolio() {
  try {
    const saved = JSON.parse(localStorage.getItem(PORTFOLIO_KEY) ?? 'null');
    if (Array.isArray(saved)) return saved;
  } catch {
    // Storage unavailable: start from the seed portfolio.
  }
  return structuredClone(SEED_PORTFOLIO);
}

function savePortfolio() {
  try {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(app.portfolio));
  } catch {
    // Non-critical convenience only (AC-10).
  }
}

const app = {
  session: null,
  stage: 'plot',
  sub: { location: 'overview', financial: 'model' },
  stageStatus: {},
  running: false,
  agentLog: [],
  agentsOpen: true,
  chat: [],
  chatOpen: false,
  chatBusy: false,
  layersOpen: false,
  evidence: null,
  capOpen: false,
  capFilter: 'all',
  capSelected: null,
  exportLang: 'en',
  exportBusy: null,
  exportStatus: null,
  portfolio: loadPortfolio(),
  llm: null,
};

const map = new InvestmentMap($('map'), { onSelectPlot: (p) => selectPlot(p) });

// ---------------------------------------------------------------------------
// Rendering

const RENDERERS = {
  plot: renderPlotSelection,
  asset: renderAsset,
  location: renderLocation,
  hbu: renderHbu,
  structuring: renderStructuring,
  financial: renderFinancial,
  recommendation: renderRecommendation,
};

function renderDashboard({ keepScroll = false } = {}) {
  const el = $('dashboard');
  const top = el.scrollTop;
  const ready = app.stage === 'plot' || app.session?.completed.has(app.stage);
  el.innerHTML = ready ? RENDERERS[app.stage](app) : `<div class="landing"><p class="muted">This stage has not run yet.</p></div>`;
  if (keepScroll) el.scrollTop = top;
  else el.scrollTop = 0;
}

function renderAll(opts) {
  $('stepper').innerHTML = renderStepper(app);
  renderDashboard(opts);
  renderAgentsPanel();
  renderChatPanel();
  $('layers').innerHTML = renderLayers(app, map);
  $('cap-count').textContent = app.portfolio.length;
}

function renderAgentsPanel() {
  const el = $('agents');
  el.classList.toggle('collapsed', !app.agentsOpen);
  el.innerHTML = renderAgents(app);
  const log = $('agent-log');
  if (log) log.scrollTop = log.scrollHeight;
}

function renderChatPanel() {
  const el = $('chat');
  el.classList.toggle('open', app.chatOpen);
  const draft = el.querySelector('textarea')?.value ?? '';
  el.innerHTML = renderChat(app);
  const ta = el.querySelector('textarea');
  if (ta) ta.value = draft;
  const body = $('chat-body');
  if (body) body.scrollTop = body.scrollHeight;
}

function openEvidence(ids) {
  app.evidence = { mode: 'docs', ids };
  const el = $('evidence');
  el.hidden = false;
  el.innerHTML = renderEvidence(app);
}

function openLibrary() {
  app.evidence = { mode: 'library', filter: '' };
  const el = $('evidence');
  el.hidden = false;
  el.innerHTML = renderEvidence(app);
}

function renderCapOverlay() {
  const el = $('cap');
  el.hidden = !app.capOpen;
  if (app.capOpen) el.innerHTML = renderCap(app);
  $('stepper').innerHTML = renderStepper(app);
  $('cap-count').textContent = app.portfolio.length;
}

// ---------------------------------------------------------------------------
// Journey

function logEvent(e) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  if (e.type === 'agent') {
    // One agent is active at a time; a new event ends earlier activity.
    for (const prev of app.agentLog) prev.live = false;
    app.agentLog.push({ ...e, time, live: e.status === 'running' });
  }
}

async function selectPlot(plotNumber) {
  const plot = getPlot(plotNumber);
  if (!plot) {
    toast(`Plot “${plotNumber}” is not in the prototype dataset. Try ${PLOTS.map((p) => p.plotNumber).join(' or ')}.`);
    return;
  }
  if (app.running) return;
  if (app.session?.plot.plotNumber === plot.plotNumber) {
    app.stage = 'plot';
    renderAll();
    map.focusPlot();
    return;
  }
  app.session = createSession(plot.plotNumber);
  app.stage = 'plot';
  app.stageStatus = {};
  app.agentLog = [];
  app.chat = [];
  $('plot-input').value = plot.plotNumber;
  logEvent({ type: 'agent', agent: 'orchestrator', status: 'done', message: `Plot ${plot.plotNumber} located and highlighted on the map. Review core information, then start the analysis.` });
  renderAll();
  await map.setPlot(plot, app.session.ctx);
  map.applyStage('plot');
  renderAll();
}

async function run(from = 'asset', { delay = 300 } = {}) {
  if (!app.session || app.running) return;
  app.running = true;
  app.agentsOpen = true;
  const startIdx = STAGES.findIndex((s) => s.id === from);
  for (const s of STAGES.slice(startIdx)) app.stageStatus[s.id] = 'queued';
  renderAll({ keepScroll: true });
  await runPipeline(app.session, {
    from,
    delay,
    onEvent: (e) => {
      if (e.type === 'stage') {
        app.stageStatus[e.stage] = e.status === 'running' ? 'running' : 'done';
        if (e.status === 'done' && (from === 'asset' ? true : e.stage === from)) {
          if (from === 'asset' || app.stage === 'plot') goto(e.stage, { silentMap: e.stage !== 'asset' && e.stage !== 'location' });
          else renderAll({ keepScroll: true });
        } else {
          $('stepper').innerHTML = renderStepper(app);
        }
        if (e.stage === 'location' && e.status === 'done') map.setComparables(app.session.results.comparables.selected.concat(app.session.results.comparables.all.filter((c) => !c.selected)));
      } else {
        logEvent(e);
        renderAgentsPanel();
      }
    },
  });
  app.running = false;
  // On small screens the activity panel would cover the map once work is done.
  if (innerWidth < 900) app.agentsOpen = false;
  if (from === 'asset') goto('recommendation');
  else renderAll({ keepScroll: true });
}

function goto(stage, { silentMap = false } = {}) {
  if (stage !== 'plot' && !app.session?.completed.has(stage)) return;
  app.stage = stage;
  renderAll();
  if (!silentMap) map.applyStage(stage, app.sub[stage]);
}

/** Instant recalculation after an assumption edit (FR-051, FR-053). */
function recalcFinancials(changedLabel) {
  const s = app.session;
  for (const st of ['structuring', 'financial', 'recommendation']) {
    computeStage(s, st);
    s.reviews[st] = { status: 'pending', rerun: true };
  }
  logEvent({
    type: 'agent',
    agent: 'financial',
    status: 'done',
    message: `Recalculated after user change${changedLabel ? `: ${changedLabel}` : ''} · NPV AED ${(s.results.financial.result.npv / 1e6).toFixed(1)}M · IRR ${((s.results.financial.result.irr ?? 0) * 100).toFixed(1)}%`,
  });
  logEvent({ type: 'agent', agent: 'recommendation', status: 'done', message: `Recommendation refreshed: ${s.results.recommendation.verdict.label}` });
}

function setAssumption(key, value) {
  const s = app.session;
  const useId = s.results.financial.useId;
  const a = s.results.financial.assumptions.find((x) => x.key === key);
  if (!a || !Number.isFinite(value)) return;
  const v = Math.min(a.max, Math.max(a.min, value));
  s.overrides.assumptions[useId] ??= {};
  if (v === a.original) delete s.overrides.assumptions[useId][key];
  else s.overrides.assumptions[useId][key] = v;
  return a.label;
}

async function applyActions(actions) {
  const s = app.session;
  let from = null;
  const earliest = (st) => {
    const i = STAGES.findIndex((x) => x.id === st);
    if (from === null || i < STAGES.findIndex((x) => x.id === from)) from = st;
  };
  for (const a of actions) {
    a.label = describeAction(a, s);
    if (a.type === 'setAssumption') {
      setAssumption(a.key, a.value);
      earliest('structuring');
    } else if (a.type === 'setWeight') {
      s.overrides.weights[a.criterion] = a.value;
      earliest('hbu');
    } else if (a.type === 'selectUse') {
      s.overrides.selectedUseId = a.useId;
      earliest('structuring');
    } else if (a.type === 'reset') {
      if (a.what === 'weights') {
        s.overrides.weights = {};
        earliest('hbu');
      } else {
        s.overrides.assumptions = {};
        earliest('structuring');
      }
    } else if (a.type === 'rerun') {
      earliest(a.stage);
    }
  }
  if (from) {
    await run(from, { delay: 160 });
    const target = actions.some((a) => a.type === 'setWeight') ? 'hbu' : actions.some((a) => a.type === 'setAssumption' || a.type === 'reset') ? 'financial' : from;
    goto(target);
  }
}

// ---------------------------------------------------------------------------
// Conversation

async function ask(question) {
  if (!app.session || app.chatBusy || !question.trim()) return;
  if (!app.session.completed.size && !/zon|constraint|plot|area|permit|where/i.test(question)) {
    // The assistant needs at least the asset stage to answer analytical questions.
    await run('asset', { delay: 120 });
  }
  app.chatOpen = true;
  app.chatBusy = true;
  const history = app.chat.filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text }));
  app.chat.push({ role: 'user', text: question });
  app.chat.push({ role: 'assistant', pending: true });
  renderChatPanel();
  let res;
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plotNumber: app.session.plot.plotNumber,
        stage: STAGES.find((s) => s.id === app.stage)?.label ?? 'Plot selection',
        question,
        history,
        overrides: app.session.overrides,
        reviews: app.session.reviews,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    res = await r.json();
  } catch {
    ensureComputed();
    res = { ...offlineAnswer(app.session, question, { stage: app.stage }), notice: 'API unreachable; answered in the browser' };
  }
  app.chat.pop();
  app.chat.push({ role: 'assistant', ...res, actions: [] });
  app.chatBusy = false;
  renderChatPanel();
  if (res.actions?.length) {
    const msg = app.chat.at(-1);
    msg.actions = res.actions;
    await applyActions(res.actions);
    renderChatPanel();
  }
}

function ensureComputed() {
  for (const s of STAGES) if (!app.session.completed.has(s.id)) computeStage(app.session, s.id);
}

// ---------------------------------------------------------------------------
// Review, decision, capture (§19, §23)

function setReview(stage, status, note) {
  app.session.reviews[stage] = { status, note: note || undefined, at: new Date().toLocaleString('en-GB') };
  logEvent({ type: 'agent', agent: 'orchestrator', status: 'done', message: `Specialist ${status} ${STAGES.find((s) => s.id === stage).label}${note ? `: “${note}”` : ''}` });
}

async function exportPack(format) {
  if (app.exportBusy || !app.session?.results.recommendation) return;
  const label = `${format === 'pptx' ? 'PowerPoint deck' : 'PDF report'} (${app.exportLang === 'ar' ? 'Arabic' : 'English'})`;
  app.exportBusy = label;
  app.exportStatus = null;
  renderDashboard({ keepScroll: true });
  try {
    const { exportRecommendation } = await import('./export/index.js');
    const { status, filename } = await exportRecommendation(app.session, { format, lang: app.exportLang });
    app.exportStatus =
      status === 'saved'
        ? { ok: true, text: `${filename} is ready.` }
        : status === 'declined'
          ? { ok: false, text: 'The download was declined. Choose a format to try again.' }
          : { ok: false, text: 'Another download is waiting for confirmation. Finish it, then try again.' };
    if (status === 'saved') logEvent({ type: 'agent', agent: 'recommendation', status: 'done', message: `Exported ${label}: ${filename}` });
  } catch (error) {
    console.error(error);
    app.exportStatus = { ok: false, text: `The ${label} could not be created. Try again, or try the other format.` };
  }
  app.exportBusy = null;
  renderAll({ keepScroll: true });
}

function capture() {
  const s = app.session;
  const existing = app.portfolio.find((p) => p.fromSession && p.plotNumber === s.plot.plotNumber);
  const nextNo = Math.max(0, ...app.portfolio.map((p) => Number(p.id.split('-')[2]) || 0)) + 1;
  const id = existing?.id ?? `CAP-2026-${String(nextNo).padStart(3, '0')}`;
  const record = recordFromSession(s, s.reviews.recommendation, id);
  if (existing) Object.assign(existing, record);
  else app.portfolio.unshift(record);
  savePortfolio();
  logEvent({ type: 'agent', agent: 'orchestrator', status: 'done', message: `Opportunity ${existing ? 'updated' : 'captured'} in the simulated CAP as ${id} (${record.status})` });
  app.capOpen = true;
  app.capFilter = 'all';
  app.capSelected = id;
  renderAll({ keepScroll: true });
  renderCapOverlay();
}

// ---------------------------------------------------------------------------
// Events

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const act = el.dataset.action;
  switch (act) {
    case 'select-plot':
      return selectPlot(el.dataset.plot);
    case 'clear-plot':
      app.session = null;
      app.agentLog = [];
      app.stageStatus = {};
      app.stage = 'plot';
      map.clearMarkers();
      renderAll();
      return map.showOverview(PLOTS);
    case 'run':
      return run('asset');
    case 'goto':
      if (el.dataset.stage === 'plot') {
        app.stage = 'plot';
        renderAll();
        return app.session ? map.focusPlot() : null;
      }
      return goto(el.dataset.stage);
    case 'tab':
      app.sub[el.dataset.group] = el.dataset.tab;
      renderDashboard({ keepScroll: false });
      return map.applyStage(app.stage, el.dataset.tab);
    case 'evidence':
      return openEvidence(el.dataset.ids.split('|'));
    case 'library':
      return openLibrary();
    case 'close-evidence':
      $('evidence').hidden = true;
      app.evidence = null;
      return;
    case 'legend': {
      const m = $('legend');
      m.hidden = !m.hidden;
      m.innerHTML = renderLegend();
      return;
    }
    case 'toggle-agents':
      app.agentsOpen = !app.agentsOpen;
      return renderAgentsPanel();
    case 'toggle-chat':
      app.chatOpen = !app.chatOpen;
      renderChatPanel();
      return $('chat').querySelector('textarea')?.focus();
    case 'toggle-layers':
      app.layersOpen = !app.layersOpen;
      $('layers').innerHTML = renderLayers(app, map);
      return;
    case 'basemap':
      map.setBasemap(el.dataset.b);
      $('layers').innerHTML = renderLayers(app, map);
      return;
    case 'ask':
      return ask(el.dataset.q);
    case 'review':
      setReview(el.dataset.stage, el.dataset.status);
      return renderAll({ keepScroll: true });
    case 'challenge': {
      const stage = el.dataset.stage;
      const label = STAGES.find((s) => s.id === stage).label;
      const note = await askNote(`What do you challenge in ${label}?`);
      if (note === null) return;
      setReview(stage, 'challenged', note);
      renderAll({ keepScroll: true });
      return ask(`I challenge the ${label} conclusion${note ? `: ${note}` : ''}. What is the weakest evidence and what would change the conclusion?`);
    }
    case 'rerun':
      return run(el.dataset.stage, { delay: 200 });
    case 'select-use':
      return applyActions([{ type: 'selectUse', useId: el.dataset.use }]);
    case 'reset-weights':
      return applyActions([{ type: 'reset', what: 'weights' }]);
    case 'reset-assumptions':
      app.session.overrides.assumptions = {};
      recalcFinancials('all assumptions restored');
      return renderAll({ keepScroll: true });
    case 'reset-assumption': {
      const useId = app.session.results.financial.useId;
      delete app.session.overrides.assumptions[useId]?.[el.dataset.key];
      recalcFinancials(`${el.dataset.key} restored`);
      return renderAll({ keepScroll: true });
    }
    case 'decide': {
      const note = $('decision-note')?.value.trim();
      setReview('recommendation', el.dataset.status, note);
      return renderAll({ keepScroll: true });
    }
    case 'capture':
      return capture();
    case 'export-lang':
      app.exportLang = el.dataset.lang;
      app.exportStatus = null;
      return renderDashboard({ keepScroll: true });
    case 'export':
      return exportPack(el.dataset.format);
    case 'open-cap':
      app.capOpen = true;
      if (el.dataset.id) app.capSelected = el.dataset.id;
      return renderCapOverlay();
    case 'close-cap':
      app.capOpen = false;
      return renderCapOverlay();
    case 'cap-filter':
      app.capFilter = el.dataset.f;
      return renderCapOverlay();
    case 'cap-select':
      app.capSelected = el.dataset.id;
      return renderCapOverlay();
    case 'reopen-analysis':
      app.capOpen = false;
      renderCapOverlay();
      if (app.session?.plot.plotNumber === el.dataset.plot && app.session.completed.has('recommendation')) return goto('recommendation');
      await selectPlot(el.dataset.plot);
      return run('asset', { delay: 120 });
    default:
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id === 'plot-search') {
    e.preventDefault();
    return selectPlot($('plot-input').value);
  }
  const kind = form.dataset.form;
  if (!kind) return;
  e.preventDefault();
  if (kind === 'chat') {
    const q = form.q.value;
    form.q.value = '';
    return ask(q);
  }
  if (kind === 'weights') {
    const actions = [...new FormData(form).entries()].map(([criterion, v]) => ({ type: 'setWeight', criterion, value: Number(v) })).filter((a) => Number.isFinite(a.value));
    return applyActions(actions);
  }
  if (kind === 'save-scenario') {
    const s = app.session;
    const f = s.results.financial;
    const label = form.label.value.trim().slice(0, 40);
    (s.overrides.savedScenarios[f.useId] ??= []).push({
      id: `saved-${Date.now()}`,
      label,
      description: f.userModified.length ? `Saved with ${f.userModified.join(', ')} modified` : 'Saved copy of the predefined assumptions',
      inputs: { ...f.inputs },
    });
    computeStage(s, 'financial');
    return renderAll({ keepScroll: true });
  }
});

let editTimer;
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.input === 'library') {
    app.evidence.filter = t.value;
    const pos = t.selectionStart;
    $('evidence').innerHTML = renderEvidence(app);
    const nt = $('evidence').querySelector('.lib-filter');
    nt.focus();
    nt.setSelectionRange(pos, pos);
    return;
  }
  if (t.dataset.key && t.closest('[data-form="assumptions"]')) {
    const raw = Number(t.value);
    if (!Number.isFinite(raw)) return;
    const value = t.dataset.format === 'pct' ? raw / 100 : raw;
    const sibling = t.closest('.as-row').querySelectorAll('input');
    for (const s of sibling) if (s !== t) s.value = t.value;
    clearTimeout(editTimer);
    editTimer = setTimeout(
      () => {
        const label = setAssumption(t.dataset.key, value);
        recalcFinancials(label);
        const focusKey = document.activeElement?.dataset?.key;
        const isRange = document.activeElement?.type === 'range';
        renderAll({ keepScroll: true });
        const again = document.querySelector(`[data-form="assumptions"] input[data-key="${focusKey}"]${isRange ? '[type="range"]' : '[type="number"]'}`);
        again?.focus();
      },
      t.type === 'range' ? 120 : 450,
    );
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.layer) {
    map.setGroup(t.dataset.layer, t.checked);
    return;
  }
  if (t.dataset.capField) {
    const p = app.portfolio.find((x) => x.id === t.dataset.id);
    if (!p) return;
    p[t.dataset.capField] = t.value;
    p.updated = new Date().toISOString().slice(0, 10);
    savePortfolio();
    renderCapOverlay();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('evidence').hidden) $('evidence').hidden = true;
    else if (!$('legend').hidden) {
      const cancel = $('legend').querySelector('[data-cancel]');
      if (cancel) cancel.click();
      else $('legend').hidden = true;
    } else if (app.capOpen) {
      app.capOpen = false;
      renderCapOverlay();
    }
  }
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.chat-input textarea')) {
    e.preventDefault();
    e.target.form.requestSubmit();
  }
});

/** In-page note dialog (browser prompt() is unavailable in sandboxed viewers). */
function askNote(title) {
  return new Promise((resolve) => {
    const m = $('legend');
    m.innerHTML = `<form class="modal-card note-dialog" role="dialog" aria-label="${title.replace(/"/g, '&quot;')}"><div class="panel-head"><b></b></div><label class="note" for="challenge-note"><span>Your challenge is recorded on the stage and sent to the assistant.</span><textarea id="challenge-note" rows="3" placeholder="e.g. The school demand looks understated"></textarea></label><div class="decision-actions"><button type="submit" class="btn btn-primary">Record challenge</button><button type="button" class="btn btn-ghost" data-cancel>Cancel</button></div></form>`;
    m.querySelector('b').textContent = title;
    m.hidden = false;
    const done = (v) => {
      m.hidden = true;
      m.innerHTML = '';
      resolve(v);
    };
    m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      done(m.querySelector('textarea').value.trim());
    });
    m.querySelector('[data-cancel]').addEventListener('click', (e) => {
      e.stopPropagation();
      done(null);
    });
    m.querySelector('textarea').focus();
  });
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// ---------------------------------------------------------------------------
// Boot

$('plot-options').innerHTML = PLOTS.map((p) => `<option value="${p.plotNumber}">${p.community}</option>`).join('');
installTooltip();
renderAll();
map.showOverview(PLOTS);

fetch('/api/health')
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .then((h) => {
    app.llm = h;
    $('llm-pill').textContent = h.llm ? `Assistant: Claude · ${h.model}` : 'Assistant: offline analyst';
    $('llm-pill').classList.add(h.llm ? 'on' : 'off');
    $('llm-pill').title = h.llm
      ? 'Answers are generated by Claude, grounded in retrieved evidence'
      : 'Set ANTHROPIC_API_KEY on the server to enable Claude; the offline analyst answers from retrieved evidence';
  })
  .catch(() => {
    $('llm-pill').textContent = 'Assistant: in-browser analyst';
    $('llm-pill').classList.add('off');
  });

const params = new URLSearchParams(location.search);
if (params.get('plot')) {
  selectPlot(params.get('plot')).then(() => {
    if (params.has('run')) run('asset', { delay: Number(params.get('delay') ?? 300) });
  });
}

window.addEventListener('resize', () => map.resize());
export { app, AGENTS };
