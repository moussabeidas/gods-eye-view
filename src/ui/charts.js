// Small SVG charts. Every mark carries a data-tip for the shared hover
// tooltip; colours come from CSS roles (see styles.css, validated palette).

import { esc } from './format.js';

const W = 520;

export function installTooltip() {
  const tip = document.createElement('div');
  tip.className = 'viz-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  const hide = () => tip.classList.remove('on');
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) return hide();
    tip.innerHTML = el.getAttribute('data-tip');
    tip.classList.add('on');
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14;
    let y = e.clientY + 14;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.transform = `translate(${x}px, ${y}px)`;
  });
  document.addEventListener('scroll', hide, true);
}

const tipAttr = (html) => ` data-tip="${esc(html)}"`;

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? mag * 10;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Rounded-end bar path anchored to the baseline (4px radius at the data end). */
function barPath(x, y0, w, y1) {
  const h = Math.abs(y1 - y0);
  const r = Math.min(4, w / 2, h);
  if (h < 0.5) return '';
  if (y1 < y0) {
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
}

function hBarPath(x0, y, x1, h) {
  const w = Math.abs(x1 - x0);
  const r = Math.min(4, h / 2, w);
  if (w < 0.5) return '';
  if (x1 >= x0) return `M${x0},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${y + h - r} Q${x1},${y + h} ${x1 - r},${y + h} H${x0} Z`;
  return `M${x0},${y} H${x1 + r} Q${x1},${y} ${x1},${y + r} V${y + h - r} Q${x1},${y + h} ${x1 + r},${y + h} H${x0} Z`;
}

/** Horizontal single-series bars with direct value labels. */
export function hBars(items, { max, format = (v) => v, height = 22, labelWidth = 150, color = 'var(--series-1)', ariaLabel = 'Bar chart' } = {}) {
  const m = max ?? Math.max(...items.map((d) => d.value), 1);
  const plotW = W - labelWidth - 56;
  const h = items.length * (height + 8) + 4;
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(ariaLabel)}">${items
    .map((d, i) => {
      const y = i * (height + 8) + 2;
      const w = Math.max(0, (d.value / m) * plotW);
      return `<g${tipAttr(`<b>${esc(d.label)}</b><br>${esc(format(d.value))}${d.tip ? `<br>${esc(d.tip)}` : ''}`)}><rect x="0" y="${y - 3}" width="${W}" height="${height + 6}" fill="transparent"/><text x="${labelWidth - 8}" y="${y + height / 2 + 4}" text-anchor="end" class="t-label">${esc(d.label)}</text><path d="${hBarPath(labelWidth, y, labelWidth + w, height)}" fill="${d.color ?? color}"/><text x="${labelWidth + w + 6}" y="${y + height / 2 + 4}" class="t-value">${esc(format(d.value))}</text></g>`;
    })
    .join('')}</svg>`;
}

/** Annual cash flow bars (diverging around zero) with cumulative line and payback marker. */
export function cashflowChart(rows, { payback } = {}) {
  const H = 230;
  const pad = { l: 52, r: 12, t: 12, b: 26 };
  const vals = rows.map((r) => r.net / 1e6);
  const cum = rows.map((r) => r.cumulative / 1e6);
  const lo = Math.min(0, ...vals, ...cum);
  const hi = Math.max(0, ...vals, ...cum);
  const ticks = niceTicks(lo, hi, 4);
  const min = Math.min(lo, ticks[0]);
  const max = Math.max(hi, ticks.at(-1));
  const y = (v) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / rows.length;
  const x = (i) => pad.l + i * bw;
  const grid = ticks
    .map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end" class="t-axis">${t}</text>`)
    .join('');
  const bars = rows
    .map((r, i) => {
      const v = r.net / 1e6;
      const tip = `<b>Year ${r.year}</b><br>Net cash flow AED ${v.toFixed(1)}M<br>CAPEX AED ${(r.capex / 1e6).toFixed(1)}M · NOI AED ${(r.noi / 1e6).toFixed(1)}M${r.residual ? `<br>Residual value AED ${(r.residual / 1e6).toFixed(1)}M` : ''}<br>Cumulative AED ${(r.cumulative / 1e6).toFixed(1)}M`;
      return `<g${tipAttr(tip)}><rect x="${x(i)}" y="${pad.t}" width="${bw}" height="${H - pad.t - pad.b}" fill="transparent"/><path d="${barPath(x(i) + 1, y(0), Math.max(1, bw - 2), y(v))}" fill="${v >= 0 ? 'var(--pos)' : 'var(--neg)'}"/></g>`;
    })
    .join('');
  const line = cum.map((v, i) => `${i ? 'L' : 'M'}${x(i) + bw / 2},${y(v)}`).join(' ');
  const xl = rows.map((r, i) => (r.year === 1 || r.year % 5 === 0 ? `<text x="${x(i) + bw / 2}" y="${H - 8}" text-anchor="middle" class="t-axis">Y${r.year}</text>` : '')).join('');
  const pb = payback
    ? `<line x1="${pad.l + payback * bw}" x2="${pad.l + payback * bw}" y1="${pad.t}" y2="${H - pad.b}" class="marker"/><text x="${pad.l + payback * bw + 4}" y="${pad.t + 10}" class="t-label">Payback ${payback.toFixed(1)}y</text>`
    : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Annual net cash flow and cumulative cash flow, AED millions">${grid}<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(0)}" y2="${y(0)}" class="baseline"/>${bars}<path d="${line}" class="cum-line"/>${pb}${xl}<text x="${pad.l}" y="${pad.t - 2}" class="t-axis">AED M</text></svg>`;
}

/** Tornado of NPV swings around the base case. */
export function tornadoChart(rows, base) {
  const rowH = 26;
  const labelW = 150;
  const H = rows.length * rowH + 30;
  const all = rows.flatMap((r) => [r.npvLow, r.npvHigh, base]).map((v) => v / 1e6);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const plotW = W - labelW - 20;
  const x = (v) => labelW + ((v / 1e6 - min) / span) * plotW;
  const bx = x(base);
  const body = rows
    .map((r, i) => {
      const yy = i * rowH + 8;
      const lo = Math.min(r.npvLow, r.npvHigh);
      const hi = Math.max(r.npvLow, r.npvHigh);
      const tip = `<b>${esc(r.label)} ${esc(r.shiftLabel)}</b><br>NPV AED ${(r.npvLow / 1e6).toFixed(1)}M (−) / AED ${(r.npvHigh / 1e6).toFixed(1)}M (+)<br>IRR ${r.irrLow != null ? (r.irrLow * 100).toFixed(1) : '—'}% / ${r.irrHigh != null ? (r.irrHigh * 100).toFixed(1) : '—'}%`;
      return `<g${tipAttr(tip)}><rect x="0" y="${yy - 3}" width="${W}" height="${rowH}" fill="transparent"/><text x="${labelW - 8}" y="${yy + 13}" text-anchor="end" class="t-label">${esc(r.label)} <tspan class="t-axis">${esc(r.shiftLabel)}</tspan></text><path d="${hBarPath(bx, yy, x(lo), 18)}" fill="var(--neg)"/><path d="${hBarPath(bx, yy, x(hi), 18)}" fill="var(--pos)"/></g>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="NPV sensitivity tornado">${body}<line x1="${bx}" x2="${bx}" y1="2" y2="${H - 20}" class="marker"/><text x="${bx}" y="${H - 6}" text-anchor="middle" class="t-axis">Base NPV AED ${(base / 1e6).toFixed(1)}M</text></svg>`;
}

/** Single-series line with hover points (trend indices). */
export function lineChart(series, { labels = [], unit = '', height = 150 } = {}) {
  const pad = { l: 36, r: 12, t: 10, b: 22 };
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const ticks = niceTicks(lo - 2, hi + 2, 3);
  const min = ticks[0];
  const max = ticks.at(-1);
  const x = (i) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + ((max - v) / (max - min)) * (height - pad.t - pad.b);
  const grid = ticks
    .map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end" class="t-axis">${t}</text>`)
    .join('');
  const path = series.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const pts = series
    .map(
      (v, i) =>
        `<g${tipAttr(`<b>${esc(labels[i] ?? i)}</b><br>${v}${esc(unit)}`)}><rect x="${x(i) - 12}" y="${pad.t}" width="24" height="${height - pad.t - pad.b}" fill="transparent"/><circle cx="${x(i)}" cy="${y(v)}" r="${i === series.length - 1 ? 4 : 2.5}" class="pt"/></g>`,
    )
    .join('');
  const xl = labels.map((l, i) => (i % 4 === 0 || i === labels.length - 1 ? `<text x="${x(i)}" y="${height - 6}" text-anchor="middle" class="t-axis">${esc(l)}</text>` : '')).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="Trend line">${grid}<path d="${path}" class="line"/>${pts}${xl}</svg>`;
}

/** Demand vs supply (+pipeline) per category, normalised to demand = 100. */
export function gapChart(results) {
  const rowH = 44;
  const labelW = 170;
  const H = results.length * rowH + 34;
  const max = Math.max(...results.map((r) => Math.max(1, (r.supply.value + r.pipeline) / r.demand.value))) * 100;
  const plotW = W - labelW - 60;
  const x = (v) => labelW + (v / max) * plotW;
  const body = results
    .map((r, i) => {
      const yy = i * rowH + 6;
      const d = 100;
      const s = (r.supply.value / r.demand.value) * 100;
      const p = (r.pipeline / r.demand.value) * 100;
      const tip = `<b>${esc(r.label)}</b><br>Demand ${r.demand.value.toLocaleString('en-US')} ${esc(r.unit)}<br>Supply ${r.supply.value.toLocaleString('en-US')} · pipeline ${r.pipeline.toLocaleString('en-US')}<br>Gap index ${Math.round(r.gapIndex.value * 100)}% — ${esc(r.rating.label)}`;
      return `<g${tipAttr(tip)}><rect x="0" y="${yy - 3}" width="${W}" height="${rowH - 2}" fill="transparent"/><text x="${labelW - 8}" y="${yy + 12}" text-anchor="end" class="t-label">${esc(r.label)}</text><text x="${labelW - 8}" y="${yy + 28}" text-anchor="end" class="t-axis">gap ${Math.round(r.gapIndex.value * 100)}%</text><path d="${hBarPath(labelW, yy, x(d), 14)}" fill="var(--series-1)"/><path d="${hBarPath(labelW, yy + 17, x(s), 14)}" fill="var(--series-2)"/>${p > 0 ? `<path d="${hBarPath(x(s) + 2, yy + 17, x(s + p), 14)}" fill="var(--series-3)"/>` : ''}</g>`;
    })
    .join('');
  const legend = `<g transform="translate(${labelW},${H - 14})"><rect width="10" height="10" rx="2" fill="var(--series-1)"/><text x="14" y="9" class="t-axis">Demand (=100)</text><rect x="110" width="10" height="10" rx="2" fill="var(--series-2)"/><text x="124" y="9" class="t-axis">Existing supply</text><rect x="230" width="10" height="10" rx="2" fill="var(--series-3)"/><text x="244" y="9" class="t-axis">Pipeline</text></g>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Demand versus supply by category">${body}<line x1="${x(100)}" x2="${x(100)}" y1="0" y2="${H - 24}" class="marker"/>${legend}</svg>`;
}
