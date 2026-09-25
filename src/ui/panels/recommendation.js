// Stage 6 — Decision-ready recommendation (FR-056 – FR-062) with explicit
// specialist acceptance or rejection (FR-068). AI output is never presented
// as an approval (FR-069).

import { esc, pct, aedM, yrs, aiBlock, chip, tagChip, fmtValue, sourcesLine } from '../format.js';
import { fmtAssumption } from './financial.js';
import { stageHeader, section, askButton } from './common.js';

export function renderRecommendation(app) {
  const rec = app.session.results.recommendation;
  const m = rec.metrics;
  const decision = app.session.reviews.recommendation;
  const decided = decision.status === 'accepted' || decision.status === 'rejected';
  const captured = app.portfolio.find((p) => p.fromSession && p.plotNumber === app.session.plot.plotNumber);
  return `${stageHeader('recommendation', ['recommendation', 'orchestrator'], 'The preceding analysis consolidated into a concise, evidence-based recommendation for your decision.')}
  <div class="verdict tone-${rec.verdict.tone}">
    <div class="verdict-label">AI recommendation · awaiting specialist decision</div>
    <div class="verdict-main">${esc(rec.verdict.label)}</div>
    <div class="verdict-headline">${esc(rec.headline)}</div>
    <div class="verdict-meta"><span>Analytical confidence: <b>${esc(rec.confidence)}</b></span><span>${esc(rec.robustness)}</span></div>
  </div>
  <div class="tiles tiles-4">
    <div class="tile"><div class="tile-label">NPV ${chip('calculated', { formula: 'NPV', sources: ['METHOD:FINANCIAL-MODEL'] })}</div><div class="tile-value">${aedM(m.npv)}</div></div>
    <div class="tile"><div class="tile-label">IRR ${chip('calculated', { formula: 'IRR', sources: ['METHOD:FINANCIAL-MODEL'] })}</div><div class="tile-value">${pct(m.irr)}</div></div>
    <div class="tile"><div class="tile-label">ROI ${chip('calculated', { formula: 'ROI', sources: ['METHOD:FINANCIAL-MODEL'] })}</div><div class="tile-value">${pct(m.roi, 0)}</div><div class="tile-sub">${pct(m.roiAnnualised)} annualised</div></div>
    <div class="tile"><div class="tile-label">Payback ${chip('calculated', { formula: 'Payback', sources: ['METHOD:FINANCIAL-MODEL'] })}</div><div class="tile-value">${yrs(m.payback)}</div></div>
  </div>
  ${aiBlock(rec.narrative, 'AI-generated recommendation rationale')}
  <div class="grid-2">
    ${section('Sourced facts', `<ul class="plain">${rec.facts.map((f) => `<li><span class="muted">${esc(f.label)}:</span> ${esc(f.value)} ${tagChip(f)}</li>`).join('')}</ul>`)}
    ${section('Calculated outputs', `<ul class="plain">${rec.calcs.map((c) => `<li><span class="muted">${esc(c.label)}:</span> ${c.unit === 'AED' ? aedM(c.value) : c.unit === '%' ? pct(c.value) : c.unit === 'years' ? yrs(c.value) : `${fmtValue(c.value)}${esc(c.unit ?? '')}`} ${tagChip(c)}</li>`).join('')}</ul>`)}
  </div>
  ${section('Material assumptions', `<ul class="assump-list">${rec.assumptions.map((a) => `<li class="${a.kind}"><span>${esc(a.label)}</span><b>${fmtAssumption(a)}</b>${chip(a.kind)}${a.kind === 'user' ? `<small>was ${fmtAssumption(a, a.original)}</small>` : ''}</li>`).join('')}</ul>`)}
  <div class="grid-2">
    ${section('Key risks', `<ul class="plain">${rec.risks.map((x) => `<li>${esc(x.text)} ${sourcesLine(x.sources)}</li>`).join('')}</ul>`)}
    ${section('Conditions & next steps', `<ol class="plain-ol">${rec.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>`)}
  </div>
  ${section('Alternatives considered', `<table class="tbl"><thead><tr><th>Use</th><th class="r">HBU</th><th class="r">Indicative IRR</th><th class="r">Indicative NPV</th><th></th></tr></thead><tbody>${rec.alternatives.map((a) => `<tr><td>${a.rank}. ${esc(a.name)}</td><td class="r">${a.score}</td><td class="r">${pct(a.irr)}</td><td class="r">${aedM(a.npv)}</td><td>${askButton(`Why was ${a.name} not recommended?`, 'Why not?')}</td></tr>`).join('')}</tbody></table>`)}
  <section class="decision card">
    <div class="card-head"><h3>Specialist decision</h3></div>
    <p class="muted small">You keep final authority. The AI output is decision support only and is never an approval (FR-069).</p>
    ${decided ? `<div class="decision-state ds-${decision.status}"><b>${decision.status === 'accepted' ? 'You accepted this recommendation' : 'You rejected this recommendation'}</b>${decision.note ? `<span>“${esc(decision.note)}”</span>` : ''}<small>${esc(decision.at ?? '')}</small></div>` : decision.status === 'challenged' ? `<div class="decision-state ds-challenged"><b>Challenged — under discussion</b>${decision.note ? `<span>“${esc(decision.note)}”</span>` : ''}</div>` : ''}
    <label class="note"><span>Decision note (optional)</span><textarea id="decision-note" rows="2" placeholder="Rationale, conditions or concerns"></textarea></label>
    <div class="decision-actions">
      <button type="button" class="btn btn-accept" data-action="decide" data-status="accepted">Accept recommendation</button>
      <button type="button" class="btn btn-ghost" data-action="challenge" data-stage="recommendation">Challenge / request revision</button>
      <button type="button" class="btn btn-reject" data-action="decide" data-status="rejected">Reject recommendation</button>
    </div>
    <div class="capture">
      ${captured ? `<span class="chosen-tag">Captured as ${esc(captured.id)}</span><button type="button" class="btn btn-ghost" data-action="open-cap" data-id="${esc(captured.id)}">View in portfolio</button><button type="button" class="btn btn-link" data-action="capture">Update CAP record</button>` : `<button type="button" class="btn btn-cap" data-action="capture">Capture opportunity in CAP</button><span class="muted small">${decided ? 'The record will carry your decision.' : 'You can capture now as “Under assessment” or decide first.'}</span>`}
    </div>
  </section>
  <p class="disclaimer">${esc(rec.disclaimer)}</p>`;
}
