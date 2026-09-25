// Stage 2 — Location & Market Intelligence, comparables and supply-demand
// (FR-014 – FR-029).

import { esc, num, pct, aiBlock, chip, tagChip, sourcesLine } from '../format.js';
import { hBars, lineChart, gapChart } from '../charts.js';
import { stageHeader, reviewBar, tabs, tile, section, askButton } from './common.js';

export function renderLocation(app) {
  const sub = app.sub.location;
  const r = app.session.results;
  const body = { overview, demographics, activity, market, comparables, supply }[sub](app, r);
  return `${stageHeader('location', ['retrieval', 'location', 'comparables', 'supply'], 'The geographic, demographic, infrastructure, commercial and market context around the plot. It feeds the Highest & Best Use assessment (FR-019).')}
  ${tabs(
    'location',
    [
      ['overview', 'Overview'],
      ['demographics', 'Demographics'],
      ['activity', 'Activity & services'],
      ['market', 'Market'],
      ['comparables', 'Comparables'],
      ['supply', 'Supply-demand'],
    ],
    sub,
  )}
  ${body}
  ${reviewBar(app, 'location')}`;
}

function overview(app, r) {
  const L = r.location;
  const d = L.demographics;
  const a = L.accessibility;
  const topGap = [...r.supplyDemand.results].sort((x, y) => y.gapIndex.value - x.gapIndex.value)[0];
  return `<div class="tiles">
    ${tile('Catchment residents', num(d.residents.value), d.residents, `+${d.growthPct.value}%/yr`)}
    ${d.workers ? tile('Daytime workers', num(d.workers.value), d.workers) : tile('Households', num(d.households.value), d.households, `avg size ${d.householdSize.value}`)}
    ${tile('Accessibility', `${a.score.value}<small>/10</small>`, a.score)}
    ${tile('Strongest gap', `${Math.round(topGap.gapIndex.value * 100)}%`, topGap.gapIndex, esc(topGap.label))}
  </div>
  ${aiBlock(L.summary, 'AI-generated location & market interpretation')}
  ${section(
    'Infrastructure & accessibility',
    `${hBars(
      a.components.map((c) => ({ label: c.label, value: c.score, tip: `Weight ${Math.round(c.weight * 100)}%` })),
      { max: 10, format: (v) => `${v}/10`, labelWidth: 250, ariaLabel: 'Accessibility components' },
    )}
    <dl class="facts compact">
      <div class="fact"><dt>Frontage road</dt><dd><span>${esc(a.frontRoad?.value ?? '—')}</span>${tagChip(a.frontRoad)}</dd></div>
      <div class="fact"><dt>Arterial</dt><dd><span>${esc(a.arterial?.value ?? '—')}</span>${tagChip(a.arterial)}</dd></div>
      <div class="fact"><dt>Transit</dt><dd><span>${esc(a.transit.value)}</span>${tagChip(a.transit)}</dd></div>
      <div class="fact"><dt>${esc(a.traffic.label)}</dt><dd><span>${esc(a.traffic.value)}</span>${tagChip(a.traffic)}</dd></div>
    </dl>`,
  )}
  ${section('Surrounding communities', `<table class="tbl"><thead><tr><th>Community</th><th class="r">Population</th><th class="r">Growth</th><th class="r">Distance</th><th class="r">Catchment weight</th></tr></thead><tbody>${d.communities.map((c) => `<tr><td>${esc(c.name)}</td><td class="r">${num(c.population)}</td><td class="r">${c.growthPct}%</td><td class="r">${(c.distanceM / 1000).toFixed(1)} km</td><td class="r">${c.weight}</td></tr>`).join('')}</tbody></table>${sourcesLine(d.residents.sources)}<p class="muted small">No fixed catchment or drive-time method is prescribed (§11.2). Communities are weighted by distance.</p>`)}`;
}

function demographics(app, r) {
  const d = r.location.demographics;
  const ages = Object.entries(d.ageGroups.value).map(([k, v]) => ({ label: `Age ${k}`, value: v }));
  const segs = Object.entries(d.segments.value).map(([k, v]) => ({ label: k, value: v }));
  return `<div class="tiles">
    ${tile('Residents', num(d.residents.value), d.residents)}
    ${tile('Households', num(d.households.value), d.households)}
    ${tile('Household size', d.householdSize.value, d.householdSize)}
    ${tile('Host density', `${num(d.density.value)}<small>/km²</small>`, d.density)}
  </div>
  ${section('Age structure', hBars(ages, { max: Math.max(...ages.map((x) => x.value)) * 1.15, format: (v) => `${v}%`, labelWidth: 100, ariaLabel: 'Age structure' }), chip('calculated', { sources: d.ageGroups.sources, formula: d.ageGroups.formula }))}
  ${section('Demographic segments', hBars(segs, { max: 100, format: (v) => `${v}%`, labelWidth: 170, color: 'var(--series-3)', ariaLabel: 'Segments' }), chip('calculated', { sources: d.segments.sources, formula: d.segments.formula }))}
  ${section('By community', `<table class="tbl"><thead><tr><th>Community</th><th class="r">Pop.</th><th class="r">Density</th><th class="r">HH size</th><th class="r">Age 5–17</th><th>Income</th></tr></thead><tbody>${d.communities.map((c) => `<tr><td>${esc(c.name)}</td><td class="r">${num(c.population)}</td><td class="r">${num(c.density)}</td><td class="r">${c.householdSize}</td><td class="r">${c.ageGroups['5-17']}%</td><td>${esc(c.incomeBand)}</td></tr>`).join('')}</tbody></table>${sourcesLine(d.residents.sources)}`)}`;
}

function activity(app, r) {
  const act = r.location.activity;
  const groups = { commercial: 'Commercial activity', community: 'Community services', infrastructure: 'Transport & infrastructure' };
  return `<p class="muted">Facilities are drawn on the map by category. Their counts and capacities feed the supply side of the supply-demand analysis, so they do more than mark the map (§11.4).</p>
  ${Object.entries(groups)
    .map(([g, label]) => {
      const rows = act.filter((x) => x.group === g);
      if (!rows.length) return '';
      return section(
        label,
        `<table class="tbl"><thead><tr><th>Category</th><th class="r">In catchment</th><th class="r">Within 1 km</th><th>Nearest</th><th></th></tr></thead><tbody>${rows
          .map(
            (x) =>
              `<tr><td><span class="swatch" style="--c:${x.color}"></span>${esc(x.label)}</td><td class="r">${x.count}</td><td class="r">${x.within1km}</td><td>${esc(x.nearest.name)} · ${num(x.nearest.distanceM)} m</td><td><button type="button" class="src-pill" data-action="evidence" data-ids="${esc(x.sourceId)}">${esc(x.sourceName?.split(' — ')[0] ?? 'Source')}</button></td></tr>`,
          )
          .join('')}</tbody></table>`,
      );
    })
    .join('')}`;
}

function market(app, r) {
  const m = r.location.market;
  const labels = m.index.series.map((_, i) => {
    const q = (i % 4) + 1;
    const y = 2023 + Math.floor(i / 4);
    return `${y} Q${q}`;
  });
  return `${section(
    'Market benchmarks',
    `<table class="tbl"><thead><tr><th>Indicator</th><th class="r">Value</th><th class="r">Range</th><th class="r">Y/Y</th><th></th></tr></thead><tbody>${m.benchmarks
      .map(
        (b) =>
          `<tr><td>${esc(b.label)}</td><td class="r">${num(b.value)} <small>${esc(b.unit)}</small></td><td class="r">${b.range ? `${num(b.range[0])}–${num(b.range[1])}` : '—'}</td><td class="r">${b.yoyPct != null ? `${b.yoyPct > 0 ? '+' : ''}${b.yoyPct}%` : '—'}</td><td>${tagChip(b.tagged)}</td></tr>`,
      )
      .join('')}</tbody></table>`,
  )}
  ${section(`${m.index.label}`, `${lineChart(m.index.series, { labels })}<p class="muted small">${m.index.change}% since ${esc(m.index.start)} · ${m.index.yoy}% over the last 4 quarters ${chip('sourced', { sources: [m.index.sourceId] })}</p>`)}
  ${section(
    'DLD transactions near the plot',
    `<table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Property</th><th class="r">Area</th><th class="r">AED/m²</th><th class="r">Dist.</th></tr></thead><tbody>${m.transactions
      .map(
        (t) =>
          `<tr><td>${esc(t.date)}</td><td>${esc(t.type)}</td><td>${esc(t.property)}</td><td class="r">${num(t.areaM2)} m²</td><td class="r">${num(t.aedPerM2)}</td><td class="r"><button type="button" class="src-pill" data-action="evidence" data-ids="DLD-TXN:${esc(t.id)}">${(t.distanceM / 1000).toFixed(1)} km</button></td></tr>`,
      )
      .join('')}</tbody></table>${m.medianLandAedM2 ? `<p class="small">Median land sale: <b>AED ${num(m.medianLandAedM2.value)}/m²</b> ${tagChip(m.medianLandAedM2)}</p>` : ''}`,
  )}`;
}

function comparables(app, r) {
  const C = r.comparables;
  return `${aiBlock(C.summary, 'AI-generated comparable analysis')}
  ${section('Comparability factors (predefined)', `<div class="weights-line">${C.factors.map((f) => `<span>${esc(f.label)} <b>${f.weight}%</b></span>`).join('')}</div><p class="muted small">Plots scoring at least ${C.threshold}/100 are treated as comparable. The prototype logic is predefined, not a formal valuation method (§12.2).</p>`)}
  ${section(
    'Comparable plots & areas',
    `<div class="comp-list">${C.all
      .map(
        (c) => `<div class="comp ${c.selected ? 'on' : 'off'}">
      <div class="comp-head"><b>${esc(c.plotNumber)}</b><span>${esc(c.community)}</span><span class="score">${c.score}<small>/100</small></span></div>
      <div class="comp-meta">${esc(c.landUse)} · ${num(c.areaM2)} m² · ${esc(c.zoning)} · FAR ${c.far} · ${(c.distanceM / 1000).toFixed(1)} km</div>
      <div class="comp-perf">${esc(c.performance)} · AED ${num(c.valueAedM2)}/m² ${chip('sourced', { sources: c.sourceIds })}</div>
      <div class="comp-why">${c.selected ? `<b>Why comparable:</b> ${esc(c.reasons.join('; '))}` : `<b>Excluded:</b> ${esc(c.weaknesses.join('; ') || 'low overall similarity')}`}</div>
      <div class="factor-bar">${Object.entries(c.factors)
        .map(([k, v]) => `<span title="${esc(k)} ${Math.round(v * 100)}%" style="--v:${v}"></span>`)
        .join('')}</div>
    </div>`,
      )
      .join('')}</div>`,
  )}
  ${C.medianValue ? `<p class="small">Median indicative value of selected comparables: <b>AED ${num(C.medianValue.value)}/m²</b> ${tagChip(C.medianValue)}</p>` : ''}`;
}

function supply(app, r) {
  const sd = r.supplyDemand;
  return `${aiBlock(sd.summary, 'AI-generated supply-demand interpretation')}
  ${section('Demand vs supply', gapChart(sd.results))}
  ${sd.results
    .map((x) =>
      section(
        x.label,
        `<div class="gap-head"><span class="gap-idx tone-${x.rating.tone}">${Math.round(x.gapIndex.value * 100)}%</span><div><b>${esc(x.rating.label)}</b><div class="muted small">Demand ${num(x.demand.value)} · supply ${num(x.supply.value)}${x.pipeline ? ` · pipeline ${num(x.pipeline)}` : ''} ${esc(x.unit)} ${chip('calculated', { formula: x.gapIndex.formula, sources: x.demand.sources })}</div></div></div>
        <details class="evidence-list"><summary>Evidence behind this conclusion (${x.evidence.length})</summary><ul>${x.evidence
          .map(
            (e) =>
              `<li>${esc(e.label)}: <b>${e.unit === '%' && e.value <= 1 ? pct(e.value, 1) : num(e.value, e.value < 1 && e.value > 0 ? 4 : 0)}${e.unit && !(e.unit === '%' && e.value <= 1) ? ` ${esc(e.unit)}` : ''}</b> ${tagChip(e)}</li>`,
          )
          .join('')}${x.supplyItems.length ? `<li>Facilities counted: ${x.supplyItems.map((s) => `${esc(s.name)} (${s.value != null ? num(s.value) : 'n/a'})`).join(', ')}</li>` : ''}</ul></details>`,
        askButton(`Why is there a ${x.rating.label.toLowerCase()} in ${x.label.toLowerCase()}?`, 'Question this'),
      ),
    )
    .join('')}
  <p class="muted small">Benchmarks: ${sd.results.map((x) => `${esc(x.label)} — ${esc(x.benchmarkText)}`).join(' · ')} ${chip('assumption', { sources: ['METHOD:SERVICE-BENCHMARKS'] })}</p>`;
}
