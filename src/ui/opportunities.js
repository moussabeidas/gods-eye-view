// Recategorisation opportunities: the land bank ranked by the value a change
// of zoning category would add, with a clear suggestion for each plot.

import { esc, num, aedM, pct } from './format.js';

const tone = (d) => `<span class="dm dm-${d.tone}">${esc(d.label)}</span>`;

export function renderOpportunities(app) {
  const rows = app.opps ?? [];
  const sel = rows.find((r) => r.plotNumber === app.oppSelected) ?? rows[0];
  const changes = rows.filter((r) => r.recategorise);
  const npvUp = changes.reduce((s, r) => s + r.upliftNpv, 0);
  const revUp = changes.reduce((s, r) => s + r.upliftRevenue, 0);
  return `<div class="cap-shell opp-shell">
    <header class="cap-head"><div><div class="eyebrow">Land-bank screening</div><h2>Recategorisation opportunities</h2></div><button type="button" class="icon-btn" data-action="close-opps" aria-label="Close opportunities">✕</button></header>
    <p class="muted small opp-intro">Each plot's uses are priced under its current zoning and under the other categories plausible in its area, using the same cash-flow model as the Financial Feasibility stage. Plots are ranked by the value a change of category would add. Each area's demand gap is shared out plot by plot, so a suggestion never assumes more demand than the market has.</p>
    <div class="tiles tiles-4">
      <div class="tile"><div class="tile-label">Plots screened</div><div class="tile-value">${rows.length}</div></div>
      <div class="tile"><div class="tile-label">Recategorise</div><div class="tile-value">${changes.length}</div></div>
      <div class="tile"><div class="tile-label">NPV uplift</div><div class="tile-value">${aedM(npvUp, 0)}</div></div>
      <div class="tile"><div class="tile-label">Extra revenue / yr</div><div class="tile-value">${aedM(revUp, 0)}</div></div>
    </div>
    <div class="cap-grid">
      <div class="table-wrap"><table class="tbl cap-tbl opp-tbl"><thead><tr><th class="r">#</th><th>Plot</th><th>Now</th><th>Suggested</th><th class="r">NPV uplift</th><th>Demand</th></tr></thead><tbody>${rows
        .map(
          (r) => `<tr class="${sel?.plotNumber === r.plotNumber ? 'sel' : ''}" data-action="opp-select" data-plot="${esc(r.plotNumber)}">
            <td class="r mono">${r.rank}</td>
            <td><b class="mono">${esc(r.plotNumber)}</b><small class="muted">${esc(r.community)} · ${num(r.areaM2)} m²${r.analysed ? ' · fully analysed' : ''}</small></td>
            <td><span class="zone-tag">${esc(r.zoning)}</span><small class="muted">${esc(r.current.useName)} · ${aedM(r.current.npv)}</small></td>
            <td>${r.recategorise ? `<span class="zone-tag to">${esc(r.best.zoning)}</span><small><b>${esc(r.best.useName)}</b> · ${aedM(r.best.npv)}</small>` : '<span class="keep">Keep current zoning</span>'}</td>
            <td class="r ${r.upliftNpv > 0 ? 'pos' : ''}">${r.upliftNpv > 0 ? `+${aedM(r.upliftNpv)}${r.upliftPct != null ? `<small>+${pct(r.upliftPct, 0)}</small>` : ''}` : '—'}</td>
            <td>${tone(r.best.demand)}</td>
          </tr>`,
        )
        .join('')}</tbody></table></div>
      ${sel ? detail(sel) : ''}
    </div>
    <p class="disclaimer">Screening estimates on illustrative assumptions, not planning advice or an investment approval. Parcel outlines and areas are real open map data; plot numbers and the current zoning of screening parcels are simulated. A change of land use needs DM Planning approval, and the fully analysed plots should be taken through the six-stage journey before any decision.</p>
  </div>`;
}

function detail(r) {
  return `<aside class="cap-detail opp-detail">
    <div class="eyebrow">Rank ${r.rank} · plot ${esc(r.plotNumber)}</div>
    <h3>${r.recategorise ? `Recategorise ${esc(r.zoning)} → ${esc(r.best.zoning)}` : `Keep ${esc(r.zoning)}`}</h3>
    <p class="opp-headline">${r.recategorise ? `Develop a <b>${esc(r.best.useName.toLowerCase())}</b> under ${esc(r.best.zoningName.toLowerCase())} (FAR ${r.best.far}).` : `Best use under the current category: <b>${esc(r.best.useName.toLowerCase())}</b>.`}</p>
    <dl class="facts opp-facts">
      <div class="fact"><dt>NPV now → suggested</dt><dd>${aedM(r.current.npv)} → <b>${aedM(r.best.npv)}</b></dd></div>
      <div class="fact"><dt>Stabilised revenue / yr</dt><dd>${aedM(r.current.revenue)} → <b>${aedM(r.best.revenue)}</b></dd></div>
      <div class="fact"><dt>IRR</dt><dd>${pct(r.current.irr)} → <b>${pct(r.best.irr)}</b></dd></div>
      <div class="fact"><dt>Scale</dt><dd>${num(Math.round(r.best.gfa))} m² GFA · ${num(Math.round(r.best.units))} ${esc(r.best.unitLabel)}</dd></div>
      <div class="fact"><dt>Area demand</dt><dd>${tone(r.best.demand)}${r.best.demand.remaining != null ? `<small class="muted"> ${num(Math.max(0, r.best.demand.remaining))} ${esc(r.best.demand.unit)} of gap left before this plot</small>` : ''}</dd></div>
    </dl>
    <p class="small">${esc(r.rationale)}</p>
    ${r.conditions.length ? `<h4>Conditions</h4><ul class="plain small">${r.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    <h4>Every option priced</h4>
    <div class="table-wrap"><table class="tbl small"><thead><tr><th>Zoning</th><th>Use</th><th class="r">NPV</th><th class="r">Revenue / yr</th></tr></thead><tbody>${r.options
      .map(
        (o) =>
          `<tr class="${o.zoning === r.best.zoning && o.useId === r.best.useId ? 'best' : o.zoning === r.current.zoning && o.useId === r.current.useId ? 'now' : ''}"><td>${esc(o.zoning)}</td><td>${esc(o.useName)}</td><td class="r">${aedM(o.npv)}</td><td class="r">${aedM(o.revenue)}</td></tr>`,
      )
      .join('')}</tbody></table></div>
    <p class="muted tiny">${esc(r.demandSource)}. Current zoning ${r.analysed ? 'from the plot record' : 'simulated for this screening parcel'}.</p>
    <div class="opp-actions">
      <button type="button" class="btn btn-ghost" data-action="opp-map" data-plot="${esc(r.plotNumber)}">Show on map</button>
      ${r.analysed ? `<button type="button" class="btn btn-primary" data-action="opp-analyse" data-plot="${esc(r.plotNumber)}">Open full analysis</button>` : ''}
    </div>
  </aside>`;
}
