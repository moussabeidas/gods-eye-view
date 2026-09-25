// A4 PDF recommendation report drawn with jsPDF. IBM Plex Sans Arabic is
// embedded for both languages. Arabic lines are laid out word by word:
// each Arabic word and each Latin/number run is drawn on its own and placed
// right-to-left, so jsPDF's bidi engine never has to reorder mixed text.

import { jsPDF } from 'jspdf';

const C = {
  petrol: '#0F3D4C',
  petrolSoft: '#1B5466',
  gold: '#C9973A',
  goldSoft: '#F3E7CF',
  teal: '#1F8A7A',
  ink: '#1C2B33',
  muted: '#5E6E78',
  pale: '#A9C1C9',
  tint: '#EEF4F5',
  line: '#D5DFE2',
  neg: '#C0473A',
  white: '#FFFFFF',
  sev: { high: '#C0473A', medium: '#D07A2E', low: '#C9973A' },
};

const PW = 595.28;
const PH = 841.89;
const M = 44;
const CW = PW - 2 * M;
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/**
 * Render the report. `fonts` holds base64 TTF data: {regular, bold}.
 * Returns an ArrayBuffer.
 */
export function buildPdf(report, fonts) {
  const ar = report.lang === 'ar';
  const t = report.t;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('Plex-Regular.ttf', fonts.regular);
  doc.addFileToVFS('Plex-Bold.ttf', fonts.bold);
  doc.addFont('Plex-Regular.ttf', 'Plex', 'normal');
  doc.addFont('Plex-Bold.ttf', 'Plex', 'bold');
  doc.setFont('Plex', 'normal');
  doc.setProperties({ title: `${t.docTitle} — ${report.meta.plotNumber}`, subject: report.headline.use, creator: 'God’s Eye View Investment Agentic AI' });
  if (ar) doc.setLanguage?.('ar');

  const X = (x, w = 0) => (ar ? PW - x - w : x);
  const clean = (s) => String(s ?? '').replace(/[‎‏]/g, '');

  // ---- text engine -------------------------------------------------------
  const style = (size, bold, color) => {
    doc.setFont('Plex', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const width = (s) => doc.getTextWidth(s);

  function wrap(text, w) {
    const out = [];
    for (const para of clean(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = [];
      let lw = 0;
      const sp = width(' ');
      for (const word of words) {
        const ww = width(word);
        if (line.length && lw + sp + ww > w) {
          out.push(line);
          line = [word];
          lw = ww;
        } else {
          lw += (line.length ? sp : 0) + ww;
          line.push(word);
        }
      }
      out.push(line);
    }
    return out;
  }

  function drawLine(words, x, y, w, align) {
    const sp = width(' ');
    if (!ar) {
      const s = words.join(' ');
      const lw = width(s);
      const lx = align === 'center' ? x + (w - lw) / 2 : align === 'end' ? x + w - lw : x;
      doc.text(s, lx, y);
      return;
    }
    // Right-to-left: group consecutive Latin/number words into runs.
    const runs = [];
    for (const word of words) {
      const rtl = ARABIC.test(word);
      const last = runs.at(-1);
      if (!rtl && last && !last.rtl) last.words.push(word);
      else runs.push({ rtl, words: [word] });
    }
    const total = words.reduce((s, wd) => s + width(wd), 0) + sp * Math.max(0, words.length - 1);
    let cursor = align === 'center' ? x + (w + total) / 2 : align === 'end' ? x + total : x + w;
    for (const run of runs) {
      if (run.rtl) {
        for (const word of run.words) {
          const ww = width(word);
          doc.text(word, cursor - ww, y);
          cursor -= ww + sp;
        }
      } else {
        const rw = run.words.reduce((s, wd) => s + width(wd), 0) + sp * (run.words.length - 1);
        let lx = cursor - rw;
        for (const word of run.words) {
          doc.text(word, lx, y);
          lx += width(word) + sp;
        }
        cursor -= rw + sp;
      }
    }
  }

  /** Paragraph in logical coordinates (x from the reading start edge). Returns height used. */
  function para(text, x, y, w, { size = 10, bold = false, color = C.ink, lead = 1.45, align = 'start', maxLines } = {}) {
    style(size, bold, color);
    let lines = wrap(text, w);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = [...lines[maxLines - 1], '…'];
    }
    const lh = size * lead;
    lines.forEach((ln, i) => drawLine(ln, X(x, w), y + size + i * lh, w, align));
    return lines.length * lh;
  }
  const measure = (text, w, size = 10, bold = false, lead = 1.45) => {
    style(size, bold, C.ink);
    return wrap(text, w).length * size * lead;
  };

  // ---- primitives ---------------------------------------------------------
  const box = (x, y, w, h, fill, r = 6) => {
    doc.setFillColor(fill);
    doc.roundedRect(X(x, w), y, w, h, r, r, 'F');
  };
  const dot = (x, y, r, fill) => {
    doc.setFillColor(fill);
    doc.circle(X(x, 0), y, r, 'F');
  };

  // ---- pagination --------------------------------------------------------
  let y = 0;
  const bottom = PH - 58;
  const newPage = () => {
    doc.addPage();
    y = M;
  };
  const ensure = (h) => {
    if (y + h > bottom) newPage();
  };

  let sectionNo = 0;
  const section = (n, title, sub) => {
    ensure(90);
    sectionNo = n;
    y += 14;
    doc.setFillColor(C.petrol);
    doc.setDrawColor(C.gold);
    doc.setLineWidth(1.6);
    doc.circle(X(M + 13), y + 13, 13, 'FD');
    style(12, true, C.white);
    const nw = width(String(n));
    doc.text(String(n), X(M + 13) - nw / 2, y + 17.5);
    para(title, M + 36, y - 2, CW - 36, { size: 17, bold: true, color: C.petrol, lead: 1.2 });
    y += 26;
    if (sub) y += para(sub, M + 36, y, CW - 36, { size: 9, color: C.muted }) + 4;
    y += 8;
  };
  const label = (text, x, w, color = C.teal, keep = 60) => {
    ensure(keep);
    y += para(ar ? text : text.toUpperCase(), x, y, w, { size: 8.5, bold: true, color, lead: 1.3 }) + 4;
  };

  /** Table with wrapped cells; columns given in logical order. */
  function table(cols, rows, { head = true, size = 8.8, pad = 5 } = {}) {
    ensure(60); // keep the header with at least its first rows
    const tw = cols.reduce((s, c) => s + c.w, 0);
    const scale = CW / tw;
    const ws = cols.map((c) => c.w * scale);
    const drawRow = (cells, isHead, fill) => {
      const heights = cells.map((c, i) => measure(c.text ?? c, ws[i] - 2 * pad, size, isHead || c.bold) + 2 * pad);
      const h = Math.max(20, ...heights);
      ensure(h);
      let cx = M;
      cells.forEach((c, i) => {
        const cell = typeof c === 'object' ? c : { text: c };
        const bg = isHead ? C.petrol : (cell.fill ?? fill);
        if (bg) {
          doc.setFillColor(bg);
          doc.rect(X(cx, ws[i]), y, ws[i], h, 'F');
        }
        para(cell.text, cx + pad, y + pad - 1.5, ws[i] - 2 * pad, { size, bold: isHead || cell.bold, color: isHead ? C.white : (cell.color ?? C.ink), align: cols[i].align ?? 'start', lead: 1.35 });
        cx += ws[i];
      });
      doc.setDrawColor(C.line);
      doc.setLineWidth(0.6);
      doc.line(M, y + h, M + CW, y + h);
      y += h;
    };
    if (head) drawRow(rows[0], true);
    rows.slice(head ? 1 : 0).forEach((r) => drawRow(r, false));
  }

  function hbars(items, { max = 100, suffix = '', color = C.teal, labelW = 170 } = {}) {
    const barW = CW - labelW - 44;
    items.forEach((it) => {
      ensure(22);
      para(it.label, M, y + 2, labelW - 10, { size: 8.8, color: C.ink, maxLines: 1, align: 'end' });
      const w = Math.max(1.5, (Math.abs(it.value) / max) * barW);
      box(M + labelW, y + 3, w, 13, it.value < 0 ? C.neg : it.highlight ? C.gold : color, 3);
      style(8.8, true, C.ink);
      const v = `${it.value}${suffix}`;
      const vx = ar ? X(M + labelW + w + 6) - width(v) : M + labelW + w + 6;
      doc.text(v, vx, y + 13);
      y += 21;
    });
  }

  function columns(values, { h = 150, labels = [] } = {}) {
    ensure(h + 44);
    y += 14; // headroom for the tallest bar's value label
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const sy = (v) => y + ((hi - v) / (hi - lo || 1)) * h;
    const bw = CW / values.length;
    doc.setDrawColor(C.line);
    doc.setLineWidth(0.6);
    doc.line(M, sy(0), M + CW, sy(0));
    style(7, false, C.muted);
    values.forEach((v, i) => {
      const top = Math.min(sy(v), sy(0));
      const hh = Math.max(0.8, Math.abs(sy(v) - sy(0)));
      doc.setFillColor(v < 0 ? C.neg : C.teal);
      doc.rect(M + i * bw + 1.5, top, bw - 3, hh, 'F');
      if (labels[i] && (i === 0 || (i + 1) % 5 === 0)) doc.text(labels[i], M + i * bw + bw / 2 - width(labels[i]) / 2, y + h + 12);
    });
    style(7.5, true, C.ink);
    const last = values.length - 1;
    const lv = `${values[last]}`;
    doc.text(lv, M + last * bw + bw / 2 - width(lv) / 2, sy(values[last]) - 4);
    y += h + 20;
  }

  // ---- page 1: cover band --------------------------------------------------
  doc.setFillColor(C.petrol);
  doc.rect(0, 0, PW, 262, 'F');
  y = 40;
  const bandW = CW - 160;
  y += para(t.eyebrow, M, y, bandW, { size: 9, bold: true, color: C.gold });
  y += para(t.docTitle, M, y + 2, bandW, { size: 26, bold: true, color: C.white, lead: 1.2 }) + 4;
  y += para(`${t.plot} ${report.meta.plotNumber} · ${report.meta.community}`, M, y, bandW, { size: 13, color: '#DCE8EC' });
  y += para(`${report.headline.use} · ${report.headline.structure}`, M, y + 2, bandW, { size: 10.5, color: C.pale }) + 10;
  const pillH = measure(report.verdict.label, bandW - 24, 11, true) + 14;
  box(M, y, bandW, pillH, C.gold, 7);
  para(report.verdict.label, M + 12, y + 5, bandW - 24, { size: 11, bold: true, color: C.petrol });
  y += pillH + 8;
  y += para(report.decision.status === 'pending' ? t.aiStatus : `${t.decision}: ${report.decision.label}`, M, y, bandW, { size: 9.5, color: C.white });
  para(`${t.confidence}: ${report.confidence} · ${t.prepared} ${report.meta.date}`, M, y, bandW, { size: 8.5, color: C.pale });
  plotSketch(doc, report, { x: X(PW - M - 130, 130), y: 40, w: 130, h: 160 }, ar, style, width);

  // KPIs
  y = 282;
  const kw = (CW - 3 * 10) / 4;
  report.kpis.forEach((k, i) => {
    const x = M + i * (kw + 10);
    box(x, y, kw, 70, C.tint);
    para(k.label, x + 10, y + 8, kw - 20, { size: 8.5, color: C.muted, maxLines: 1 });
    para(k.value, x + 10, y + 22, kw - 20, { size: ar ? 13 : 16, bold: true, color: k.negative ? C.neg : C.petrol, maxLines: 1 });
    para(k.sub, x + 10, y + 46, kw - 20, { size: 7.2, color: C.muted, maxLines: 2, lead: 1.25 });
  });
  y += 88;
  label(t.aiLabel, M, CW);
  y += para(report.narrative, M, y, CW, { size: 9.8, lead: 1.5 }) + 12;

  const reasonsH = report.reasons.reduce((s, r) => s + measure(r, CW - 40, 9) + 4, 0) + 34;
  ensure(reasonsH);
  box(M, y, CW, reasonsH, C.tint);
  y += 12;
  label(t.whyTitle, M + 14, CW - 28, C.petrol);
  report.reasons.forEach((r) => {
    dot(M + 18, y + 6.5, 2.2, C.gold);
    y += para(r, M + 28, y, CW - 42, { size: 9 }) + 4;
  });
  y += 12;

  // ---- 1 Site & planning ---------------------------------------------------
  section(1, t.site, t.siteSub);
  table(
    [{ w: 1 }, { w: 2.2 }],
    report.site.facts.map(([k, v]) => [
      { text: k, color: C.muted, fill: C.tint },
      { text: v, bold: true },
    ]),
    { head: false },
  );
  y += 12;
  label(t.constraints, M, CW, C.petrol);
  for (const c of report.site.constraints) {
    const h = measure(c.description, CW - 44, 8.8) + 32;
    ensure(h + 6);
    box(M, y, CW, h, C.tint);
    dot(M + 16, y + 15, 5, C.sev[c.severity]);
    para(`${c.label} · ${c.severityLabel}`, M + 30, y + 6, CW - 44, { size: 9.8, bold: true });
    para(c.description, M + 30, y + 21, CW - 44, { size: 8.8, color: C.muted });
    y += h + 6;
  }

  // ---- 2 Market & demand -------------------------------------------------------
  section(2, t.market, t.marketSub);
  ensure(62);
  const mw = (CW - 2 * 10) / 3;
  report.market.kpis.forEach((k, i) => {
    const x = M + i * (mw + 10);
    box(x, y, mw, 54, C.tint);
    para(k.label, x + 10, y + 7, mw - 20, { size: 8.5, color: C.muted, maxLines: 1 });
    para(k.value, x + 10, y + 21, mw - 20, { size: 15, bold: true, color: C.petrol, maxLines: 1 });
    if (k.sub) para(k.sub, x + 10, y + 40, mw - 20, { size: 7.5, color: C.muted, maxLines: 1 });
  });
  y += 68;
  label(t.gapChart, M, CW, C.petrol, 20 + 21 * report.market.gaps.length);
  hbars(
    report.market.gaps.map((g) => ({ ...g, value: g.value })),
    { max: Math.max(100, ...report.market.gaps.map((g) => g.value)), suffix: '%' },
  );

  // ---- 3 HBU -------------------------------------------------------------
  section(3, t.hbu, t.hbuSub);
  label(t.hbuChart, M, CW, C.petrol, 20 + 21 * report.hbu.alternatives.length);
  hbars(
    report.hbu.alternatives.map((a) => ({ label: `${a.rank}. ${a.name}`, value: a.total, highlight: a.chosen })),
    { max: 100, color: C.petrol },
  );
  y += 8;
  const top = report.hbu.alternatives.slice(0, 3);
  table(
    [{ w: 2.2 }, { w: 0.9, align: 'center' }, ...top.map(() => ({ w: 1.3, align: 'center' }))],
    [
      [ar ? 'المعيار' : 'Criterion', ar ? 'الوزن' : 'Weight', ...top.map((a) => a.name)],
      ...report.hbu.criteria.map((c, i) => [
        { text: c.label, fill: C.tint },
        { text: `${c.weight}%${c.modified ? ' *' : ''}`, color: c.modified ? C.gold : C.muted },
        ...top.map((a) => ({ text: String(a.scores[i]), bold: a.chosen })),
      ]),
      [{ text: ar ? 'الإجمالي' : 'Total', bold: true }, { text: '100%', color: C.muted }, ...top.map((a) => ({ text: String(a.total), bold: true, fill: a.chosen ? C.goldSoft : undefined }))],
    ],
  );
  if (report.hbu.screenedOut.length) {
    y += 6;
    y += para(report.hbu.screenedOut.join(' · '), M, y, CW, { size: 8, color: C.muted });
  }

  // ---- 4 Structuring -------------------------------------------------------
  section(4, t.structuring, t.structuringSub);
  const best = report.structuring.rows.find((r) => r.recommended);
  const recH = measure(report.structuring.summary, CW - 150, 9) + 30;
  ensure(recH);
  box(M, y, CW, Math.max(recH, 56), C.petrol);
  para(t.recommendedStructure, M + 14, y + 8, 120, { size: 8, bold: true, color: C.gold });
  para(report.structuring.recommended, M + 14, y + 20, 120, { size: 12, bold: true, color: C.white, lead: 1.2 });
  para(`${best.total}/100`, M + 14, y + Math.max(recH, 56) - 22, 120, { size: 12, bold: true, color: C.gold });
  para(report.structuring.summary, M + 146, y + 10, CW - 160, { size: 9, color: '#DCE8EC' });
  y += Math.max(recH, 56) + 10;
  table(
    [{ w: 1.6 }, { w: 0.6, align: 'center' }, { w: 0.9, align: 'center' }, { w: 3.2 }],
    [
      [t.structure, t.score, ar ? 'الحالة' : 'Status', ar ? 'مبرر القاعدة' : 'Rule rationale'],
      ...report.structuring.rows.map((r) => {
        const fill = r.recommended ? C.goldSoft : undefined;
        return [
          { text: r.name, bold: true, fill, color: r.applicable ? C.ink : C.muted },
          { text: r.applicable ? String(r.total) : '—', fill, color: r.applicable ? C.petrol : C.muted, bold: r.recommended },
          { text: r.applicable ? t.applicable : t.notApplicable, fill, color: r.applicable ? C.teal : C.muted },
          { text: r.why, fill, color: r.applicable ? C.ink : C.muted },
        ];
      }),
    ],
    { size: 8.3 },
  );

  // ---- 5 Financials ----------------------------------------------------------
  section(5, t.financial, t.financialSub);
  ensure(56);
  const stats = [...report.kpis.map((k) => [k.label, k.value, k.negative]), ...report.financial.stats.map(([k, v]) => [k, v, false])];
  const sw = (CW - 5 * 6) / 6;
  stats.forEach(([k, v, neg], i) => {
    const x = M + i * (sw + 6);
    box(x, y, sw, 46, C.tint, 5);
    para(k, x + 7, y + 5, sw - 14, { size: 7, color: C.muted, maxLines: 1 });
    para(v, x + 7, y + 20, sw - 14, { size: ar ? 8.8 : 10.5, bold: true, color: neg ? C.neg : C.petrol, maxLines: 1 });
  });
  y += 58;
  label(t.cashflow, M, CW, C.petrol, 190);
  columns(
    report.financial.cashflow.map((r) => r.net),
    { labels: report.financial.cashflow.map((r) => String(r.year)) },
  );
  y += para(t.residualNote, M, y - 8, CW, { size: 7.5, color: C.muted }) + 4;
  table(
    [{ w: 2.4 }, { w: 1.6, align: 'center' }],
    [
      [t.assumptions, ar ? 'القيمة' : 'Value'],
      ...report.financial.assumptions.map((a) => [
        { text: a.label, fill: a.user ? C.goldSoft : undefined },
        {
          text: a.user ? (ar ? `${a.value} · ${t.was} ${a.original}` : `${a.value} (${t.was} ${a.original})`) : a.value,
          bold: a.user,
          color: a.user ? '#8A6420' : C.ink,
          fill: a.user ? C.goldSoft : undefined,
        },
      ]),
    ],
  );
  y += 12;
  table(
    [{ w: 2 }, { w: 1.4, align: 'center' }, { w: 1, align: 'center' }, { w: 1.2, align: 'center' }],
    [[t.scenario, t.npv, t.irr, t.payback], ...report.financial.scenarios.map((s) => [{ text: s.label, bold: true }, { text: s.npv, color: s.negative ? C.neg : C.ink }, s.irr, s.payback])],
  );

  // ---- 6 Risks & conditions ------------------------------------------------------
  section(6, `${t.risks} · ${t.conditions}`, t.aiLabel);
  const list = (title, items, color) => {
    label(title, M, CW, color);
    items.forEach((item, i) => {
      const h = measure(item, CW - 30, 9.2) + 8;
      ensure(h);
      dot(M + 8, y + 8, 8, color);
      style(8, true, C.white);
      const nw = width(String(i + 1));
      doc.text(String(i + 1), X(M + 8) - nw / 2, y + 10.8);
      para(item, M + 24, y, CW - 24, { size: 9.2 });
      y += h;
    });
    y += 8;
  };
  list(t.risks, report.risks, C.neg);
  list(t.conditions, report.conditions, C.teal);

  // ---- Decision, provenance, sources -----------------------------------------------
  const decH = 64 + measure(report.decision.note || '—', CW - 28, 9.5);
  ensure(decH + 12);
  y += 6;
  box(M, y, CW, decH, C.petrol);
  para(t.decision, M + 14, y + 10, CW - 28, { size: 9, bold: true, color: C.gold });
  para(report.decision.label, M + 14, y + 24, CW - 28, { size: 13, bold: true, color: C.white });
  para(
    report.decision.note ? `“${report.decision.note}”${report.decision.at ? ` · ${report.decision.at}` : ''}` : ar ? 'لم تُسجَّل ملاحظة بعد.' : 'No decision note recorded yet.',
    M + 14,
    y + 44,
    CW - 28,
    { size: 9.5, color: '#DCE8EC' },
  );
  y += decH + 14;
  label(t.provenance, M, CW, C.petrol);
  y += para(t.provenanceText, M, y, CW, { size: 8.8, color: C.muted }) + 10;
  label(t.sources, M, CW, C.petrol);
  table(
    [{ w: 2.4 }, { w: 1.8 }, { w: 0.9, align: 'center' }],
    [[ar ? 'المصدر' : 'Source', ar ? 'السجل' : 'Record', ar ? 'التاريخ' : 'Date'], ...report.sources.map((s) => [s.source, s.record, s.date])],
    { size: 7.8, pad: 4 },
  );
  y += 10;
  ensure(40);
  para(t.disclaimer, M, y, CW, { size: 8.5, color: C.muted });

  // ---- footers --------------------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(C.line);
    doc.setLineWidth(0.5);
    doc.line(M, PH - 36, PW - M, PH - 36);
    const left = `${t.plot} ${report.meta.plotNumber} · ${t.docTitle}`;
    const right = `${t.page} ${p} ${t.of} ${pages}`;
    style(7.5, false, C.muted);
    const saveY = y;
    y = 0;
    para(left, M, PH - 33, CW / 2, { size: 7.5, color: C.muted });
    para(right, M + CW / 2, PH - 33, CW / 2, { size: 7.5, color: C.muted, align: 'end' });
    y = saveY;
  }

  return doc.output('arraybuffer');
}

function plotSketch(doc, report, box, ar, style, width) {
  const ring = report.meta.geometry;
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const minX = Math.min(...lons);
  const maxX = Math.max(...lons);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const k = Math.cos((lats[0] * Math.PI) / 180);
  const spanX = (maxX - minX) * k;
  const spanY = maxY - minY;
  const scale = Math.min(box.w / spanX, (box.h - 40) / spanY);
  const ox = box.x + (box.w - spanX * scale) / 2;
  const pts = (r) => r.map(([lon, lat]) => [ox + (Math.min(Math.max(lon, minX), maxX) - minX) * k * scale, box.y + (maxY - Math.min(Math.max(lat, minY), maxY)) * scale]);
  const poly = (r, fill, stroke, lw) => {
    const p = pts(r);
    const segs = p.slice(1).map((q, i) => [q[0] - p[i][0], q[1] - p[i][1]]);
    doc.setFillColor(fill);
    doc.setDrawColor(stroke);
    doc.setLineWidth(lw);
    doc.lines(segs, p[0][0], p[0][1], [1, 1], 'FD', true);
  };
  poly(ring, '#1F6E68', '#C9973A', 2);
  for (const c of report.meta.constraintGeometry)
    poly(c.ring, { high: '#8A4A45', medium: '#8C6440', low: '#8A7A4A' }[c.severity], { high: '#C0473A', medium: '#D07A2E', low: '#C9973A' }[c.severity], 0.6);
  style(9.5, true, '#FFFFFF');
  const label = `${report.meta.plotNumber}`;
  doc.text(label, box.x + box.w / 2 - width(label) / 2, box.y + spanY * scale + 18);
  style(8, false, '#A9C1C9');
  const area = String(report.site.facts[0][1]);
  if (ar) {
    // Arabic unit words are drawn separately to keep number-first order.
    const parts = area.split(' ');
    const num = parts[0];
    const unit = parts.slice(1).join(' ');
    const total = width(num) + width(' ') + width(unit);
    const start = box.x + box.w / 2 + total / 2;
    doc.text(num, start - width(num), box.y + spanY * scale + 32);
    doc.text(unit, start - width(num) - width(' ') - width(unit), box.y + spanY * scale + 32);
  } else {
    doc.text(area, box.x + box.w / 2 - width(area) / 2, box.y + spanY * scale + 32);
  }
}
