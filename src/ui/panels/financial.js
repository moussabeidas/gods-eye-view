// Stage 5 — Financial feasibility, sensitivity and scenarios (FR-046 – FR-055).

import { FORMULAS } from '../../engine/finance.js';
import { HURDLE_IRR } from '../../data/methodology.js';
import { esc, num, pct, aedM, yrs, chip } from '../format.js';
import { cashflowChart, tornadoChart, hBars } from '../charts.js';
import { stageHeader, reviewBar, tabs, tile, section, askButton } from './common.js';

export function fmtAssumption(a, v = a.value) {
  if (a.format === 'pct') return pct(v, 2);
  if (a.format === 'years') return `${v} yrs`;
  if (a.format === 'mult') return `×${Number(v).toFixed(2)}`;
  return num(v);
}

const toDisplay = (a, v) => (a.format === 'pct' ? Math.round(v * 10000) / 100 : v);

export function renderFinancial(app) {
  const f = app.session.results.financial;
  const sub = app.sub.financial;
  const body = { model, sensitivity, scenarios }[sub](app, f);
  return `${stageHeader('financial', ['financial'], `Preliminary feasibility for ${f.selectedAlternative.use.name}, using illustrative dummy assumptions (AC-06). Results recalculate as soon as you change an assumption (FR-051).`)}
  ${metrics(f)}
  ${tabs(
    'financial',
    [
      ['model', 'Model & assumptions'],
      ['sensitivity', 'Sensitivity'],
      ['scenarios', 'Scenario comparison'],
    ],
    sub,
  )}
  ${body}
  ${reviewBar(app, 'financial')}`;
}

function metrics(f) {
  const m = f.result;
  const c = (formula) => ({ kind: 'calculated', formula, sources: ['METHOD:FINANCIAL-MODEL'] });
  return `<div class="tiles tiles-4">
    ${tile('NPV', aedM(m.npv), c(FORMULAS.npv), `at ${pct(f.inputs.discountRate)} discount rate`)}
    ${tile('IRR', pct(m.irr), c(FORMULAS.irr), `${(m.irr ?? 0) >= HURDLE_IRR ? 'Above' : 'Below'} ${pct(HURDLE_IRR, 0)} hurdle`)}
    ${tile('ROI', pct(m.roi, 0), c(FORMULAS.roi), `${m.horizon}-yr total · ${pct(m.roiAnnualised)} annualised`)}
    ${tile('Payback', yrs(m.payback), c(FORMULAS.payback), 'from start of construction')}
  </div>
  <div class="mini-kpis"><span>CAPEX <b>${aedM(m.totalCapex)}</b></span><span>GFA <b>${num(m.gfa)} m²</b></span><span>${esc(m.unitLabel)} <b>${num(m.units)}</b></span><span>Stabilised NOI <b>${aedM(m.stabNoi)}</b></span><span>Yield on cost <b>${pct(m.yieldOnCost)}</b></span><span>Peak funding <b>${aedM(-m.peakFunding)}</b></span></div>
  ${
    f.userModified.length
      ? `<div class="notice notice-user">User-modified assumptions in effect: ${f.assumptions
          .filter((a) => a.kind === 'user')
          .map((a) => `<b>${esc(a.label)}</b> ${fmtAssumption(a, a.original)} → ${fmtAssumption(a)}`)
          .join(' · ')} <button type="button" class="btn btn-link" data-action="reset-assumptions">Restore all</button></div>`
      : ''
  }`;
}

function model(app, f) {
  const groups = [...new Set(f.assumptions.map((a) => a.group))];
  return `${section('Annual cash flow', `${cashflowChart(f.result.rows, { payback: f.result.payback })}<p class="muted small">Bars show annual net cash flow (CAPEX, then NOI, plus residual value in the final year). The line is the cumulative position. ${chip('calculated', { formula: 'Annual project-level cash flow', sources: ['METHOD:FINANCIAL-MODEL'] })}</p>`)}
  ${section(
    'Assumption register',
    `<p class="muted small">Edit any value to test it. Changed values show in amber as <b>user-modified</b>; the originals stay visible (FR-073).</p>
    <form class="assumptions" data-form="assumptions">${groups
      .map(
        (g) =>
          `<fieldset><legend>${esc(g)}</legend>${f.assumptions
            .filter((a) => a.group === g)
            .map(
              (a) => `<div class="assumption ${a.kind === 'user' ? 'user' : ''}">
          <label for="as-${a.key}">${esc(a.label)}${a.unit ? ` <small>(${esc(a.unit)})</small>` : ''}</label>
          <div class="as-row"><input type="range" min="${toDisplay(a, a.min)}" max="${toDisplay(a, a.max)}" step="${a.format === 'pct' ? Math.max(0.01, toDisplay(a, a.step)) : a.step}" value="${toDisplay(a, a.value)}" data-key="${a.key}" data-format="${a.format}" aria-label="${esc(a.label)}" />
          <input id="as-${a.key}" type="number" step="any" value="${toDisplay(a, a.value)}" data-key="${a.key}" data-format="${a.format}" />${a.format === 'pct' ? '<span class="unit">%</span>' : ''}</div>
          <div class="as-meta">${chip(a.kind, { sources: a.sources, note: a.note })}${a.kind === 'user' ? `<span>original ${fmtAssumption(a, a.original)}</span><button type="button" class="btn btn-link" data-action="reset-assumption" data-key="${a.key}">reset</button>` : a.note ? `<span>${esc(a.note)}</span>` : ''}</div>
        </div>`,
            )
            .join('')}</fieldset>`,
      )
      .join('')}</form>`,
  )}
  ${section(
    'Cash flow table',
    `<div class="table-wrap"><table class="tbl small-tbl"><thead><tr><th>Year</th><th class="r">Util.</th><th class="r">Revenue</th><th class="r">OPEX</th><th class="r">NOI</th><th class="r">CAPEX</th><th class="r">Residual</th><th class="r">Net</th><th class="r">Cumulative</th></tr></thead><tbody>${f.result.rows
      .map(
        (r) =>
          `<tr><td>${r.year}</td><td class="r">${pct(r.util, 0)}</td><td class="r">${(r.revenue / 1e6).toFixed(1)}</td><td class="r">${(r.opex / 1e6).toFixed(1)}</td><td class="r">${(r.noi / 1e6).toFixed(1)}</td><td class="r">${r.capex ? (-r.capex / 1e6).toFixed(1) : '—'}</td><td class="r">${r.residual ? (r.residual / 1e6).toFixed(1) : '—'}</td><td class="r ${r.net < 0 ? 'neg' : ''}">${(r.net / 1e6).toFixed(1)}</td><td class="r ${r.cumulative < 0 ? 'neg' : ''}">${(r.cumulative / 1e6).toFixed(1)}</td></tr>`,
      )
      .join('')}</tbody></table></div><p class="muted small">AED millions.</p>`,
  )}`;
}

function sensitivity(app, f) {
  const s = f.sensitivity;
  const be = s.breakevens;
  return `${section('NPV sensitivity (tornado)', `${tornadoChart(s.rows, s.base.npv)}<p class="muted small">Each driver is moved on its own (${s.rows.map((r) => `${esc(r.label)} ${esc(r.shiftLabel)}`).join(', ')}). Blue raises NPV and red lowers it. ${chip('calculated', { formula: 'One-at-a-time sensitivity', sources: ['METHOD:FINANCIAL-MODEL'] })}</p>`)}
  ${section(
    'Breakeven tests',
    `<div class="tiles">
    ${tile('Price / rent can fall', be.priceDrop == null ? '> 95%' : pct(be.priceDrop, 0), { kind: 'calculated', formula: 'Price reduction at which NPV = 0' }, 'before NPV reaches zero')}
    ${tile('Utilisation can fall', be.utilisationDrop == null ? '> 95%' : pct(be.utilisationDrop, 0), { kind: 'calculated', formula: 'Utilisation reduction at which NPV = 0' }, 'before NPV reaches zero')}
    ${tile('CAPEX can rise', be.capexRise == null ? '> 300%' : pct(be.capexRise, 0), { kind: 'calculated', formula: 'CAPEX increase at which NPV = 0' }, 'before NPV reaches zero')}
  </div>${askButton('Which assumption is the biggest risk to this investment case, and why?', 'Ask the assistant')}`,
  )}
  ${section(
    'IRR range by driver',
    `<table class="tbl"><thead><tr><th>Driver</th><th>Shift</th><th class="r">NPV (−)</th><th class="r">NPV (+)</th><th class="r">IRR (−)</th><th class="r">IRR (+)</th></tr></thead><tbody>${s.rows
      .map(
        (r) =>
          `<tr><td>${esc(r.label)}</td><td>${esc(r.shiftLabel)}</td><td class="r">${aedM(r.npvLow)}</td><td class="r">${aedM(r.npvHigh)}</td><td class="r">${pct(r.irrLow)}</td><td class="r">${pct(r.irrHigh)}</td></tr>`,
      )
      .join('')}</tbody></table>`,
  )}`;
}

function scenarios(app, f) {
  const list = f.scenarios;
  return `${section(
    'Scenario comparison',
    `<div class="table-wrap"><table class="tbl"><thead><tr><th>Scenario</th><th class="r">NPV</th><th class="r">IRR</th><th class="r">ROI</th><th class="r">Payback</th><th class="r">CAPEX</th></tr></thead><tbody>${list
      .map(
        (s) =>
          `<tr class="${s.kind === 'user' ? 'user-row' : ''}"><td><b>${esc(s.label)}</b><small class="muted">${esc(s.description ?? '')}</small></td><td class="r ${s.result.npv < 0 ? 'neg' : ''}">${aedM(s.result.npv)}</td><td class="r">${pct(s.result.irr)}</td><td class="r">${pct(s.result.roi, 0)}</td><td class="r">${yrs(s.result.payback)}</td><td class="r">${aedM(s.result.totalCapex, 0)}</td></tr>`,
      )
      .join('')}</tbody></table></div>
    ${hBars(
      list.map((s) => ({
        label: s.label,
        value: Math.max(0, s.result.npv / 1e6),
        tip: `NPV AED ${(s.result.npv / 1e6).toFixed(1)}M`,
        color: s.result.npv < 0 ? 'var(--neg)' : s.kind === 'user' || s.kind === 'saved' ? 'var(--series-4)' : 'var(--series-1)',
      })),
      { format: (v) => `AED ${v.toFixed(1)}M`, labelWidth: 190, ariaLabel: 'NPV by scenario' },
    )}
    <p class="muted small">Negative NPVs are drawn at zero and flagged red in the table.</p>`,
  )}
  ${section(
    'Save the current assumptions as a scenario',
    `<form class="inline-form" data-form="save-scenario"><input name="label" placeholder="Scenario name, e.g. Operator-led case" maxlength="40" required /><button type="submit" class="btn btn-primary">Save scenario</button></form><p class="muted small">Change assumptions on the Model tab, then save here to compare side by side (FR-055).</p>`,
  )}`;
}
