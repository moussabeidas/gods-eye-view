// Shared dashboard building blocks: stage header, human review bar, tabs, tiles.

import { STAGES, AGENTS } from '../../engine/orchestrator.js';
import { esc, chip } from '../format.js';

const REVIEW_LABEL = {
  pending: 'Awaiting specialist review',
  accepted: 'Accepted by specialist',
  rejected: 'Rejected by specialist',
  challenged: 'Challenged — under discussion',
};

export function stageHeader(stageId, agents, blurb) {
  const s = STAGES.find((x) => x.id === stageId);
  return `<header class="stage-head"><div class="stage-num">${s.n}</div><div><h2>${esc(s.label)}</h2><p>${esc(blurb)}</p><div class="agent-tags">${agents.map((a) => `<span class="agent-tag">${esc(AGENTS[a].name)}</span>`).join('')}</div></div></header>`;
}

/** Human review controls (FR-063 – FR-068): the AI never self-approves. */
export function reviewBar(app, stageId) {
  const rv = app.session.reviews[stageId] ?? { status: 'pending' };
  return `<footer class="review-bar review-${rv.status}">
    <div class="review-state"><span class="dot"></span><div><b>${REVIEW_LABEL[rv.status]}</b>${rv.rerun && rv.status === 'pending' ? '<small>Updated by a rerun; please review again</small>' : ''}${rv.note ? `<small>“${esc(rv.note)}”</small>` : ''}</div></div>
    <div class="review-actions">
      <button type="button" class="btn btn-accept" data-action="review" data-stage="${stageId}" data-status="accepted">Accept</button>
      <button type="button" class="btn btn-ghost" data-action="challenge" data-stage="${stageId}">Challenge</button>
      <button type="button" class="btn btn-reject" data-action="review" data-stage="${stageId}" data-status="rejected">Reject</button>
      <button type="button" class="btn btn-ghost" data-action="rerun" data-stage="${stageId}" title="Rerun this stage and everything downstream">Rerun</button>
    </div>
  </footer>`;
}

export function tabs(group, items, active) {
  return `<div class="tabs" role="tablist">${items.map(([id, label]) => `<button type="button" role="tab" aria-selected="${id === active}" class="tab${id === active ? ' on' : ''}" data-action="tab" data-group="${group}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>`;
}

export function tile(label, value, t, sub) {
  return `<div class="tile"><div class="tile-label">${esc(label)} ${t ? chip(t.kind, { sources: t.sources, formula: t.formula }) : ''}</div><div class="tile-value">${value}</div>${sub ? `<div class="tile-sub">${sub}</div>` : ''}</div>`;
}

export function section(title, body, extra = '') {
  return `<section class="card"><div class="card-head"><h3>${esc(title)}</h3>${extra}</div>${body}</section>`;
}

export function askButton(question, label = 'Ask why') {
  return `<button type="button" class="btn btn-link" data-action="ask" data-q="${esc(question)}">${esc(label)} →</button>`;
}
