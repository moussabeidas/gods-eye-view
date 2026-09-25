// Stage 3 — Highest & Best Use (FR-030 – FR-040) and Stage 4 — Investment
// structuring (FR-041 – FR-045).

import { HBU_CRITERIA } from '../../data/methodology.js';
import { selectedAlternative } from '../../engine/orchestrator.js';
import { esc, num, pct, aedM, aiBlock, chip, sourcesLine } from '../format.js';
import { hBars } from '../charts.js';
import { stageHeader, reviewBar, section, askButton } from './common.js';

const heat = (s) => `--h:${Math.max(0, Math.min(1, s / 10)).toFixed(2)}`;

export function renderHbu(app) {
  const hbu = app.session.results.hbu;
  const chosen = selectedAlternative(app.session);
  const userChose = !!app.session.overrides.selectedUseId;
  const [a1, a2] = hbu.alternatives;
  return `${stageHeader('hbu', ['hbu', 'financial'], 'Alternative uses generated from permitted uses, market context and supply gaps. Each is scored on predefined criteria, weighted and ranked, with the rationale shown.')}
  ${aiBlock(hbu.summary, 'AI-generated HBU interpretation')}
  ${section(
    'Criteria & weights',
    `<p class="muted small">The weights are predefined (AC-05). You can change them and rerun: weights are re-normalised to 100 and marked as user-modified (FR-066, FR-073).</p>
    <form class="weights" data-form="weights">${hbu.criteria
      .map(
        (c) =>
          `<label class="weight ${c.modified ? 'user' : ''}" title="${esc(c.description)}"><span>${esc(c.label)}</span><input type="number" min="0" max="100" step="1" name="${c.id}" value="${app.session.overrides.weights[c.id] ?? c.weight}" /><small>${c.effectiveWeight}%${c.modified ? ' · user' : ''}</small></label>`,
      )
      .join('')}
      <div class="weights-actions"><button type="submit" class="btn btn-primary">Apply weights & rerun HBU</button>${hbu.weightsModified ? '<button type="button" class="btn btn-ghost" data-action="reset-weights">Restore predefined weights</button>' : ''}</div>
    </form>`,
    chip('assumption', { sources: ['METHOD:HBU-FRAMEWORK'] }),
  )}
  ${section(
    'Scoring matrix',
    `<div class="table-wrap"><table class="tbl matrix"><thead><tr><th>Alternative</th>${hbu.criteria.map((c) => `<th class="r" title="${esc(c.description)}">${esc(c.label)}<small>${c.effectiveWeight}%</small></th>`).join('')}<th class="r">Total</th></tr></thead><tbody>${hbu.alternatives
      .map(
        (a) =>
          `<tr class="${a.use.id === chosen.use.id ? 'chosen' : ''}"><td><b>${a.rank}. ${esc(a.use.shortName)}</b></td>${hbu.criteria
            .map(
              (c) =>
                `<td class="r heat" style="${heat(a.scores[c.id])}" data-tip="${esc(`<b>${a.use.shortName} — ${c.label}</b><br>${a.scores[c.id]}/10 × ${c.effectiveWeight}%<br>${a.notes[c.id]}`)}">${a.scores[c.id]}</td>`,
            )
            .join('')}<td class="r total">${a.total.value}</td></tr>`,
      )
      .join(
        '',
      )}</tbody></table></div><p class="muted small">Scores 0–10 (Strong ≥ 8 · Favourable ≥ 6 · Moderate ≥ 4 · Weak &lt; 4). Total = Σ score × weight ÷ 10 ${chip('calculated', { formula: 'Σ criterion score × weight ÷ 10', sources: ['METHOD:HBU-FRAMEWORK'] })}. Hover a cell for the evidence note.</p>
    ${hBars(
      hbu.alternatives.map((a) => ({ label: a.use.shortName, value: a.total.value, tip: a.rating })),
      { max: 100, format: (v) => `${v}/100`, labelWidth: 170, ariaLabel: 'HBU totals' },
    )}`,
  )}
  ${section(
    'Ranked alternatives',
    hbu.alternatives
      .map(
        (a) => `<article class="alt ${a.use.id === chosen.use.id ? 'chosen' : ''}">
      <div class="alt-head"><span class="rank">${a.rank}</span><div><b>${esc(a.use.name)}</b><div class="muted small">${esc(a.use.category)} · ${esc(a.legal.text)} · ${num(a.capacity)} ${esc(a.quick.unitLabel.replace('m² NLA', 'm²'))}</div></div><span class="score-pill">${a.total.value}<small>/100</small></span></div>
      <div class="alt-kpis"><span>Yield on cost <b>${pct(a.quick.yieldOnCost)}</b></span><span>IRR <b>${pct(a.quick.irr)}</b></span><span>NPV <b>${aedM(a.quick.npv)}</b></span><span>CAPEX <b>${aedM(a.quick.totalCapex, 0)}</b></span>${chip('calculated', { formula: 'Indicative model on predefined assumptions', sources: [`METHOD:USE-${a.use.id}`] })}</div>
      ${aiBlock(a.rationale, 'AI-generated ranking rationale')}
      <details class="evidence-list"><summary>Criterion evidence & assumptions</summary><ul>${HBU_CRITERIA.map((c) => `<li><b>${esc(c.label)} ${a.scores[c.id]}/10</b> — ${esc(a.notes[c.id])} ${sourcesLine(a.sources[c.id])}</li>`).join('')}</ul></details>
      <div class="alt-actions">${a.use.id === chosen.use.id ? `<span class="chosen-tag">${userChose ? 'Selected by you' : 'Carried forward (top-ranked)'}</span>` : `<button type="button" class="btn btn-ghost" data-action="select-use" data-use="${a.use.id}">Proceed with this use</button>`}${a.rank > 1 ? askButton(`Why does ${a1.use.shortName} rank above ${a.use.shortName}?`, 'Why not first?') : a2 ? askButton(`Why does ${a.use.shortName} rank above ${a2.use.shortName}?`, 'Why first?') : ''}</div>
    </article>`,
      )
      .join('') +
      (hbu.screenedOut.length
        ? `<h4>Screened out (constraints & permissibility, FR-032)</h4><ul class="plain">${hbu.screenedOut.map((s) => `<li><b>${esc(s.use.name)}</b> — ${esc(s.reason)} ${chip('sourced', { sources: s.sources })}</li>`).join('')}</ul>`
        : ''),
  )}
  ${reviewBar(app, 'hbu')}`;
}

export function renderStructuring(app) {
  const s = app.session.results.structuring;
  const alt = selectedAlternative(app.session);
  return `${stageHeader('structuring', ['structuring', 'financial'], 'Investment structures relevant to the selected use, screened and compared using predefined rules. The AI interpretation is kept separate from the methodology (FR-045).')}
  ${section('Opportunity characteristics', `<dl class="facts compact">${s.facts.map((f) => `<div class="fact"><dt>${esc(f.label)}</dt><dd><span>${esc(f.value)}</span></dd></div>`).join('')}</dl><p class="muted small">Selected use: <b>${esc(alt.use.name)}</b>${app.session.overrides.selectedUseId ? ' (chosen by you)' : ' (top-ranked HBU)'}.</p>`)}
  <div class="method-block">
    <div class="method-head">Predefined methodology output ${chip('calculated', { sources: ['METHOD:STRUCTURING-RULES'], formula: 'Rule screening, then weighted criteria' })}</div>
    <div class="table-wrap"><table class="tbl matrix"><thead><tr><th>Structure</th>${s.criteria.map((c) => `<th class="r">${esc(c.label)}<small>${c.effectiveWeight}%</small></th>`).join('')}<th class="r">Total</th></tr></thead><tbody>${s.applicable
      .map(
        (x, i) =>
          `<tr class="${i === 0 ? 'chosen' : ''}"><td><b>${esc(x.name.split(' (')[0])}</b><small class="muted">${esc(x.termYears)}</small></td>${s.criteria.map((c) => `<td class="r heat" style="${heat(x.scores[c.id])}">${x.scores[c.id]}</td>`).join('')}<td class="r total">${x.total.value}</td></tr>`,
      )
      .join('')}</tbody></table></div>
    <div class="struct-list">${s.applicable
      .map(
        (x, i) =>
          `<div class="struct ${i === 0 ? 'best' : ''}"><div class="struct-head"><b>${esc(x.name)}</b>${i === 0 ? '<span class="chosen-tag">Highest-scoring structure</span>' : ''}</div><p>${esc(x.summary)}</p><p class="rule"><span class="rule-id">${esc(x.rule)}</span>${esc(x.why)}</p><ul class="plain small">${x.adjustments.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`,
      )
      .join('')}</div>
    <h4>Screened out by rule</h4>
    <ul class="plain">${s.excluded.map((x) => `<li><b>${esc(x.name)}</b> <span class="rule-id">${esc(x.rule)}</span> ${esc(x.why)}</li>`).join('')}</ul>
  </div>
  ${aiBlock(s.interpretation, 'AI-generated interpretation (not part of the predefined rules)')}
  <p class="muted small">Structuring logic is illustrative and is not a production-approved methodology (§15.2).</p>
  ${reviewBar(app, 'structuring')}`;
}
