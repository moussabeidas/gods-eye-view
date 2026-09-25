// Plot selection (FR-001 – FR-005) and Stage 1 Asset Intelligence (FR-006 – FR-013).

import { PLOTS } from '../../data/plots.js';
import { STAGES, AGENTS } from '../../engine/orchestrator.js';
import { getDoc, SOURCE_SYSTEMS } from '../../data/sources.js';
import { sourced } from '../../engine/provenance.js';
import { esc, num, factRows, aiBlock, chip } from '../format.js';
import { stageHeader, reviewBar, section } from './common.js';

export function renderPlotSelection(app) {
  const plot = app.session?.plot;
  if (!plot) {
    return `<div class="landing">
      <h2>Start from a Dubai Municipality plot</h2>
      <p class="lede">Enter or select a representative DM plot number. Specialised AI agents then take it through a six-stage investment journey, from asset intelligence to an evidence-based recommendation. You review, challenge and decide at each step, then capture the opportunity in the Commercial Assets Portfolio.</p>
      <div class="plot-cards">${PLOTS.map(
        (p) => `<button type="button" class="plot-card" data-action="select-plot" data-plot="${p.plotNumber}">
          <div class="plot-card-top"><span class="plot-no">Plot ${esc(p.plotNumber)}</span><span class="zone">${esc(p.planning.zoningCode)}</span></div>
          <b>${esc(p.name)}</b>
          <span>${esc(p.community)} · ${num(p.areaM2)} m²</span>
          <span class="muted">${esc(p.currentUse)}</span>
        </button>`,
      ).join('')}</div>
      <h3 class="sub">The journey</h3>
      <ol class="journey-list">${STAGES.map((s) => `<li><b>${s.n}. ${esc(s.label)}</b></li>`).join('')}<li><b>Human review → Portfolio capture</b></li></ol>
      <h3 class="sub">Specialised agents</h3>
      <ul class="agent-list">${Object.values(AGENTS)
        .map((a) => `<li><b>${esc(a.name)}</b><span>${esc(a.role)}</span></li>`)
        .join('')}</ul>
      <p class="disclaimer">Prototype using representative, simulated data. Source retrieval from DM, DLD, RERA and public or third-party systems is simulated; there is no live integration. Outputs are illustrative and are not investment approvals.</p>
    </div>`;
  }
  const gis = `DM-GIS:PLOT-${plot.plotNumber}`;
  const zone = `DM-PLAN:ZONE-${plot.plotNumber}`;
  return `<div class="landing">
    <div class="eyebrow">Plot identified on the map</div>
    <h2>Plot ${esc(plot.plotNumber)}</h2>
    <p class="lede">${esc(plot.name)}</p>
    ${factRows([
      ['Community', sourced(plot.community, [gis])],
      ['Plot area', sourced(plot.areaM2, [gis], { unit: 'm²' })],
      ['Current use', sourced(plot.currentUse, [gis])],
      ['Zoning', sourced(`${plot.planning.zoningCode} — ${plot.planning.zoningName}`, [zone])],
      ['FAR / height', sourced(`${plot.planning.controls.far} / ${plot.planning.controls.maxFloors}`, [zone])],
      ['Ownership', sourced(plot.ownership, [gis])],
    ])}
    <p class="muted small">Review the core plot information above before starting (FR-005). The plot is highlighted on the map and its 3D extrusion shows the maximum permitted height.</p>
    <div class="cta-row">
      <button type="button" class="btn btn-primary btn-lg" data-action="run" ${app.running ? 'disabled' : ''}>${app.session.completed.size ? 'Rerun full analysis' : 'Start agentic analysis'}</button>
      <button type="button" class="btn btn-ghost" data-action="clear-plot">Choose another plot</button>
    </div>
  </div>`;
}

export function renderAsset(app) {
  const r = app.session.results.asset;
  const plot = app.session.plot;
  const docs = r.sourceIds.map(getDoc);
  return `${stageHeader('asset', ['retrieval', 'asset'], 'Consolidated plot, planning, zoning, development-control and affection-map information, retrieved from several represented sources.')}
  ${aiBlock(r.summary, 'AI-generated asset summary')}
  ${section(
    'Multi-source retrieval',
    `<table class="tbl"><thead><tr><th>Source system</th><th>Type</th><th>Record</th><th>Date</th><th></th></tr></thead><tbody>${docs
      .map(
        (d) =>
          `<tr><td>${esc(d.sourceName)}</td><td>${esc(d.sourceType)}</td><td class="mono">${esc(d.recordId)}</td><td>${esc(d.date)}</td><td><button type="button" class="src-pill" data-action="evidence" data-ids="${esc(d.id)}">Inspect</button></td></tr>`,
      )
      .join('')}</tbody></table><p class="muted small">Retrieval is simulated (FR-011). Each record carries source metadata (§24.17).</p>`,
  )}
  ${section('Plot & asset', factRows(r.identity))}
  ${section('Planning & zoning', factRows(r.planning))}
  ${section('Development controls', factRows(r.controls))}
  ${section('Affection plan (structured)', factRows(r.affection))}
  ${section(
    'Constraints',
    `<div class="constraints">${r.constraints
      .map(
        (c) =>
          `<div class="constraint sev-${c.severity}"><div class="c-head"><b>${esc(c.label)}</b><span class="sev">${esc(c.severity)}</span></div><p>${esc(c.description)}</p><div class="c-foot">${c.areaM2 ? `${num(c.areaM2)} m² on plan · ` : ''}${c.noBuild ? 'No-build' : 'Build with conditions'} ${chip('sourced', { sources: c.sources })}</div></div>`,
      )
      .join('')}</div>
    <h4>Planning restrictions</h4><ul class="plain">${r.restrictions.map((x) => `<li>${esc(x.value)} ${chip('sourced', { sources: x.sources })}</li>`).join('')}</ul>`,
  )}
  <p class="muted small">Sources: ${Object.keys(SOURCE_SYSTEMS).filter((k) => k.startsWith('DM')).length} DM systems represented. Plot ${esc(plot.plotNumber)} is associated with its structured test-case dataset (FR-004).</p>
  ${reviewBar(app, 'asset')}`;
}
