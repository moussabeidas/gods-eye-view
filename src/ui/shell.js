// Workspace chrome: journey stepper, agent activity, chat, evidence drawer,
// Commercial Assets Portfolio view, map layer control and legend.

import { STAGES, AGENTS } from '../engine/orchestrator.js';
import { KIND_LABEL } from '../engine/provenance.js';
import { getDoc, getPlotCorpus, SOURCE_SYSTEMS } from '../data/sources.js';
import { POI_CATEGORIES } from '../data/context.js';
import { CAP_STATUSES, CAP_STAGES, CAP_PRIORITIES } from '../data/portfolio.js';
import { LAYER_GROUPS } from './map.js';
import { esc, pct, aedM, yrs, renderMarkdown, chip } from './format.js';

// ---------------------------------------------------------------------------
// Stepper (explicit progressive workflow, §5.1, FR-082)

export function renderStepper(app) {
  const s = app.session;
  const reviewIcon = { accepted: '✓', rejected: '✕', challenged: '!', pending: '' };
  const items = [
    `<button type="button" class="step ${app.stage === 'plot' ? 'on' : ''} ${s ? 'done' : ''}" data-action="goto" data-stage="plot"><span class="step-n">0</span><span class="step-l">Plot selection</span></button>`,
    ...STAGES.map((st) => {
      const status = app.stageStatus[st.id] ?? 'idle';
      const rv = s?.reviews[st.id]?.status ?? 'pending';
      const enabled = s?.completed.has(st.id);
      return `<button type="button" class="step ${app.stage === st.id ? 'on' : ''} st-${status} rv-${rv}" data-action="goto" data-stage="${st.id}" ${enabled ? '' : 'disabled'} title="${esc(st.label)}${enabled ? ` — ${rv}` : ''}"><span class="step-n">${status === 'running' ? '<i class="spin"></i>' : reviewIcon[rv] && enabled ? reviewIcon[rv] : st.n}</span><span class="step-l">${esc(st.short)}</span></button>`;
    }),
    `<button type="button" class="step step-cap ${app.capOpen ? 'on' : ''}" data-action="open-cap"><span class="step-n">◆</span><span class="step-l">Portfolio capture</span></button>`,
  ];
  return `<div class="steps">${items.join('<span class="step-sep"></span>')}</div>${s ? `<div class="step-context">Plot <b>${esc(s.plot.plotNumber)}</b> · ${esc(s.plot.community)}${app.running ? ' · <span class="live">agents running</span>' : ''}</div>` : ''}`;
}

// ---------------------------------------------------------------------------
// Agent activity (visible orchestration, §22)

export function renderAgents(app) {
  const running = new Set(app.agentLog.filter((e) => e.status === 'running' && e.live).map((e) => e.agent));
  const done = new Set(app.agentLog.map((e) => e.agent));
  const log = app.agentLog.slice(-60);
  return `<div class="panel-head"><div><b>Agent activity</b><small>${app.running ? 'Orchestrating…' : app.agentLog.length ? 'Idle, awaiting your review' : 'Select a plot to begin'}</small></div><button type="button" class="icon-btn" data-action="toggle-agents" aria-label="${app.agentsOpen ? 'Collapse' : 'Expand'} agent activity">${app.agentsOpen ? '–' : '+'}</button></div>
  ${
    app.agentsOpen
      ? `<div class="agent-roster">${Object.entries(AGENTS)
          .map(([id, a]) => `<span class="ag ${running.has(id) ? 'run' : done.has(id) ? 'done' : ''}" title="${esc(a.role)}"><i></i>${esc(a.name.replace(' Agent', ''))}</span>`)
          .join('')}</div>
    <ol class="agent-log" id="agent-log">${log
      .map(
        (e) =>
          `<li class="ev ev-${e.status}"><div class="ev-top"><span class="ev-agent">${esc(AGENTS[e.agent]?.name ?? e.agent)}</span><time>${esc(e.time)}</time></div><div class="ev-msg">${esc(e.message)}</div>${
            e.sources?.length
              ? `<div class="ev-src">${e.sources
                  .slice(0, 4)
                  .map((id) => `<button type="button" class="src-pill" data-action="evidence" data-ids="${esc(id)}">${esc(getDoc(id)?.recordId ?? id)}</button>`)
                  .join('')}${e.sources.length > 4 ? `<span class="muted">+${e.sources.length - 4}</span>` : ''}</div>`
              : ''
          }</li>`,
      )
      .join('')}</ol>`
      : ''
  }`;
}

// ---------------------------------------------------------------------------
// Conversational assistant (§7.2, §21)

const SUGGESTIONS = {
  plot: ['What is this plot zoned for?', 'What constraints apply to this plot?'],
  asset: ['Summarise the planning constraints', 'Which sources did you use for the asset information?'],
  location: ['What gaps did you find in local services?', 'Why are these plots comparable?', 'How accessible is the plot?'],
  hbu: ['Why did the top use rank first?', 'I challenge the HBU ranking', 'Set the weight of supply gap to 30'],
  structuring: ['Why is this structure recommended?', 'Why was PPP screened out?'],
  financial: ['What if the discount rate is 10%?', 'Reduce rent by 10%', 'Which assumption matters most?'],
  recommendation: ['What are the key risks?', 'I challenge this recommendation', 'What evidence supports this?'],
};

export function renderChat(app) {
  const stage = STAGES.find((s) => s.id === app.stage);
  const plot = app.session?.plot;
  if (!app.chatOpen) {
    return `<button type="button" class="chat-fab" data-action="toggle-chat"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 4h16v12H7l-3 3zM7 8v2h10V8zm0 3v2h7v-2z"/></svg>Ask the investment assistant</button>`;
  }
  const citeIndex = new Map();
  const msgs = app.chat
    .map((m) => {
      if (m.role === 'user') return `<div class="msg user"><p>${esc(m.text)}</p></div>`;
      if (m.pending) return `<div class="msg ai pending"><div class="msg-label">AI-generated · retrieving evidence…</div><div class="typing"><i></i><i></i><i></i></div></div>`;
      return `<div class="msg ai"><div class="msg-label">AI-generated · ${m.mode === 'claude' ? `Claude${m.model ? ` (${esc(m.model)})` : ''}` : 'offline analyst'}${m.notice ? ` · ${esc(m.notice)}` : ''}</div>${renderMarkdown(m.text, citeIndex)}${
        m.retrieved?.length
          ? `<details class="rag"><summary>Retrieved ${m.retrieved.length} evidence record${m.retrieved.length > 1 ? 's' : ''} (RAG)</summary><ol>${m.retrieved
              .map(
                (x) =>
                  `<li><button type="button" class="src-pill" data-action="evidence" data-ids="${esc(x.id)}">${esc(x.sourceName?.split(' — ')[0] ?? '')} · ${esc(getDoc(x.id)?.recordId ?? x.id)}</button><span>${esc(x.title)}</span><small>relevance ${x.score}${m.citations?.includes(x.id) ? ' · cited' : ''}</small></li>`,
              )
              .join('')}</ol></details>`
          : ''
      }${m.actions?.length ? `<div class="applied">${m.actions.map((a) => `<div>⟳ ${esc(a.label ?? a.type)}</div>`).join('')}</div>` : ''}</div>`;
    })
    .join('');
  return `<div class="panel-head"><div><b>Investment assistant</b><small>${plot ? `Context: plot ${esc(plot.plotNumber)} · ${esc(stage?.label ?? 'Plot selection')}` : 'Select a plot to give the assistant context'}</small></div><button type="button" class="icon-btn" data-action="toggle-chat" aria-label="Minimise assistant">–</button></div>
  <div class="chat-body" id="chat-body">${msgs || `<div class="chat-empty"><p>Ask about the plot, the evidence or any conclusion. You can also challenge a result, change an assumption or ask for a rerun. Answers cite the retrieved source records.</p></div>`}</div>
  ${plot ? `<div class="suggest">${(SUGGESTIONS[app.stage] ?? SUGGESTIONS.plot).map((q) => `<button type="button" data-action="ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
  <form class="chat-input" data-form="chat"><textarea name="q" rows="1" placeholder="${plot ? 'Ask, challenge, or say e.g. “set discount rate to 10%”' : 'Select a plot first'}" ${plot ? '' : 'disabled'}></textarea><button type="submit" class="btn btn-primary" ${plot && !app.chatBusy ? '' : 'disabled'}>Send</button></form>`;
}

// ---------------------------------------------------------------------------
// Evidence drawer and library (FR-013, FR-071, FR-077)

export function renderEvidence(app) {
  if (app.evidence?.mode === 'library') return renderLibrary(app);
  const docs = (app.evidence?.ids ?? []).map(getDoc).filter(Boolean);
  return `<div class="drawer-head"><b>Source evidence</b><button type="button" class="icon-btn" data-action="close-evidence" aria-label="Close">✕</button></div>
  <div class="drawer-body">${docs.map(docCard).join('') || '<p class="muted">No record found.</p>'}
  <button type="button" class="btn btn-ghost" data-action="library">Open the full evidence library</button></div>`;
}

function docCard(d) {
  const sys = SOURCE_SYSTEMS[d.sourceKey];
  return `<article class="doc">
    <div class="doc-src"><span class="doc-type">${esc(d.sourceType)}</span><span class="sim">Simulated extract</span></div>
    <h4>${esc(d.title)}</h4>
    <dl class="doc-meta"><div><dt>Source</dt><dd>${esc(d.sourceName)}</dd></div><div><dt>Owner</dt><dd>${esc(sys.owner)}</dd></div><div><dt>Record ID</dt><dd class="mono">${esc(d.recordId)}</dd></div><div><dt>Date</dt><dd>${esc(d.date)}</dd></div><div><dt>Category</dt><dd>${esc(d.category)}</dd></div><div><dt>Used by</dt><dd>${esc(d.relation.map((r) => STAGES.find((s) => s.id === r)?.label ?? r).join(', '))}</dd></div></dl>
    <p class="doc-content">${esc(d.content)}</p>
    <p class="doc-cite"><b>Citation:</b> ${esc(d.citation)}</p>
    <p class="muted small">${esc(sys.description)}</p>
  </article>`;
}

function renderLibrary(app) {
  const docs = app.session ? getPlotCorpus(app.session.plot.plotNumber) : [];
  const q = (app.evidence.filter ?? '').toLowerCase();
  const filtered = docs.filter((d) => !q || `${d.title} ${d.sourceName} ${d.content}`.toLowerCase().includes(q));
  const bySource = {};
  for (const d of filtered) (bySource[d.sourceName] ??= []).push(d);
  return `<div class="drawer-head"><b>Evidence library${app.session ? ` · plot ${esc(app.session.plot.plotNumber)}` : ''}</b><button type="button" class="icon-btn" data-action="close-evidence" aria-label="Close">✕</button></div>
  <div class="drawer-body">${
    app.session
      ? `<input class="lib-filter" data-input="library" placeholder="Filter ${docs.length} records…" value="${esc(app.evidence.filter ?? '')}" />
    ${Object.entries(bySource)
      .map(
        ([src, list]) =>
          `<details class="lib-group" ${q ? 'open' : ''}><summary>${esc(src)} <span class="muted">(${list.length})</span></summary><ul>${list.map((d) => `<li><button type="button" class="link" data-action="evidence" data-ids="${esc(d.id)}">${esc(d.title)}</button><small class="muted">${esc(d.recordId)} · ${esc(d.date)}</small></li>`).join('')}</ul></details>`,
      )
      .join('')}`
      : '<p class="muted">Select a plot to browse its evidence records.</p>'
  }</div>`;
}

// ---------------------------------------------------------------------------
// Commercial Assets Portfolio (§23)

export function renderCap(app) {
  const f = app.capFilter ?? 'all';
  const list = app.portfolio.filter((p) => f === 'all' || p.status === f);
  const total = app.portfolio.reduce((s, p) => s + (p.indicativeValue ?? 0), 0);
  const active = app.portfolio.filter((p) => !['Not progressed', 'Operating'].includes(p.status)).length;
  const high = app.portfolio.filter((p) => p.priority === 'High').length;
  const sel = app.portfolio.find((p) => p.id === app.capSelected) ?? list[0];
  const statuses = [...new Set(app.portfolio.map((p) => p.status))];
  return `<div class="cap-shell">
    <header class="cap-head"><div><div class="eyebrow">Simulated Commercial Assets Portfolio</div><h2>Opportunity pipeline</h2></div><button type="button" class="icon-btn" data-action="close-cap" aria-label="Close portfolio">✕</button></header>
    <div class="tiles tiles-4">
      <div class="tile"><div class="tile-label">Opportunities</div><div class="tile-value">${app.portfolio.length}</div></div>
      <div class="tile"><div class="tile-label">Active pipeline</div><div class="tile-value">${active}</div></div>
      <div class="tile"><div class="tile-label">High priority</div><div class="tile-value">${high}</div></div>
      <div class="tile"><div class="tile-label">Indicative value</div><div class="tile-value">${aedM(total, 0)}</div></div>
    </div>
    <div class="cap-filters"><button type="button" class="${f === 'all' ? 'on' : ''}" data-action="cap-filter" data-f="all">All</button>${statuses.map((s) => `<button type="button" class="${f === s ? 'on' : ''}" data-action="cap-filter" data-f="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="cap-grid">
      <div class="table-wrap"><table class="tbl cap-tbl"><thead><tr><th>ID</th><th>Opportunity</th><th>Class</th><th>Structure</th><th>Status</th><th>Priority</th><th class="r">NPV</th><th class="r">IRR</th></tr></thead><tbody>${list
        .map(
          (p) =>
            `<tr class="${sel?.id === p.id ? 'sel' : ''} ${p.fromSession ? 'new' : ''}" data-action="cap-select" data-id="${esc(p.id)}"><td class="mono">${esc(p.id)}${p.fromSession ? '<span class="new-tag">new</span>' : ''}</td><td><b>${esc(p.name)}</b><small class="muted">Plot ${esc(p.plotNumber)}</small></td><td>${esc(p.assetClass)}</td><td>${esc(p.structure)}</td><td><span class="status s-${esc(slug(p.status))}">${esc(p.status)}</span></td><td><span class="prio p-${esc(p.priority.toLowerCase())}">${esc(p.priority)}</span></td><td class="r ${p.npv < 0 ? 'neg' : ''}">${aedM(p.npv)}</td><td class="r">${pct(p.irr)}</td></tr>`,
        )
        .join('')}</tbody></table></div>
      ${sel ? capDetail(sel) : ''}
    </div>
  </div>`;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-');

function capDetail(p) {
  const opt = (list, v) => list.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  return `<aside class="cap-detail">
    <div class="eyebrow">${esc(p.id)} · ${esc(p.source)}</div>
    <h3>${esc(p.name)}</h3>
    <div class="cap-class"><span>${esc(p.assetClass)}</span><span>${esc(p.investmentType)}</span><span>${esc(p.structure)}</span></div>
    <h4>Classification & monitoring</h4>
    <div class="cap-fields">
      <label>Status<select data-cap-field="status" data-id="${esc(p.id)}">${opt(CAP_STATUSES, p.status)}</select></label>
      <label>Stage<select data-cap-field="stage" data-id="${esc(p.id)}">${opt(CAP_STAGES, p.stage)}</select></label>
      <label>Priority<select data-cap-field="priority" data-id="${esc(p.id)}">${opt(CAP_PRIORITIES, p.priority)}</select></label>
      <label>Next review<input type="date" data-cap-field="nextReview" data-id="${esc(p.id)}" value="${esc(p.nextReview)}" /></label>
    </div>
    <dl class="facts compact">
      <div class="fact"><dt>Plot</dt><dd>${esc(p.plotNumber)} · ${esc(p.community)}</dd></div>
      <div class="fact"><dt>Recommended use</dt><dd>${esc(p.recommendedUse)}</dd></div>
      <div class="fact"><dt>Indicative value</dt><dd>${aedM(p.indicativeValue, 0)} ${p.fromSession ? chip('calculated', { formula: 'Stabilised NOI ÷ exit cap rate' }) : ''}</dd></div>
      <div class="fact"><dt>NPV · IRR</dt><dd>${aedM(p.npv)} · ${pct(p.irr)}</dd></div>
      <div class="fact"><dt>ROI · Payback</dt><dd>${pct(p.roi, 0)} · ${yrs(p.payback)}</dd></div>
      ${p.hbuScore ? `<div class="fact"><dt>HBU score</dt><dd>${p.hbuScore}/100</dd></div>` : ''}
      <div class="fact"><dt>Risk flags</dt><dd>${p.riskFlags}</dd></div>
      <div class="fact"><dt>Owner</dt><dd>${esc(p.owner)}</dd></div>
      <div class="fact"><dt>Last updated</dt><dd>${esc(p.updated)}</dd></div>
    </dl>
    <h4>Recommendation</h4><p>${esc(p.recommendation)}</p>
    ${p.decisionNote ? `<p class="muted">Specialist note: “${esc(p.decisionNote)}”</p>` : ''}
    ${p.conditions?.length ? `<h4>Conditions</h4><ul class="plain small">${p.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${p.userModified?.length ? `<p class="small">User-modified assumptions carried into the record: ${esc(p.userModified.join(', '))}</p>` : ''}
    ${p.fromSession ? `<button type="button" class="btn btn-ghost" data-action="reopen-analysis" data-plot="${esc(p.plotNumber)}">Open linked analysis</button>` : ''}
  </aside>`;
}

// ---------------------------------------------------------------------------
// Map layer control & legend

export function renderLayers(app, map) {
  if (!app.layersOpen) return `<button type="button" class="layers-fab" data-action="toggle-layers">Layers</button>`;
  return `<div class="panel-head"><b>Map layers</b><button type="button" class="icon-btn" data-action="toggle-layers" aria-label="Close layers">✕</button></div>
  <div class="basemaps">${['schematic', 'imagery', 'streets'].map((b) => `<button type="button" class="${map.basemap === b ? 'on' : ''}" data-action="basemap" data-b="${b}">${b[0].toUpperCase() + b.slice(1)}</button>`).join('')}</div>
  <p class="muted tiny">The schematic basemap is drawn from the representative dataset. Imagery and street tiles are for orientation only.</p>
  ${LAYER_GROUPS.map((g) => `<label class="layer-row"><input type="checkbox" data-layer="${g.id}" ${map.visible[g.id] ? 'checked' : ''} ${app.session ? '' : 'disabled'} />${esc(g.label)}</label>`).join('')}
  <div class="poi-legend">${Object.entries(POI_CATEGORIES)
    .map(([, c]) => `<span><i style="--c:${c.color}"></i>${esc(c.label)}</span>`)
    .join('')}<span><i class="sq" style="--c:#e66767"></i>Constraint</span><span><i class="sq" style="--c:#eda100"></i>Comparable</span><span><i style="--c:#e87ba4"></i>DLD transaction</span></div>`;
}

export function renderLegend() {
  const kinds = ['sourced', 'assumption', 'user', 'calculated', 'ai'];
  const desc = {
    sourced: 'Information attributed to a represented source (DM, DLD, RERA, public or approved third-party). Click to inspect the record.',
    assumption: 'Assumptions and methodology configured for the prototype (weights, benchmarks, financial inputs).',
    user: 'Assumptions or weights you changed. The original value stays visible.',
    calculated: 'Results of predefined calculations (formulas shown on hover).',
    ai: 'AI interpretation, explanation, scoring commentary, comparison or recommendation.',
  };
  return `<div class="modal-card" role="dialog" aria-label="Legend"><div class="panel-head"><b>How to read this platform</b><button type="button" class="icon-btn" data-action="legend" aria-label="Close">✕</button></div>
  <p class="muted">Every material value carries a tag showing where it came from (BRD §20):</p>
  <ul class="legend-list">${kinds.map((k) => `<li>${chip(k)}<div><b>${esc(KIND_LABEL[k])}</b><span>${esc(desc[k])}</span></div></li>`).join('')}</ul>
  <p class="muted small">Specialist review: every stage can be accepted, challenged, rejected or rerun. The recommendation needs your explicit decision, and the AI never approves an investment.</p>
  <p class="muted small">Data: representative and simulated for demonstration. Simulated retrieval stands in for future DM, DLD and RERA integrations.</p></div>`;
}
