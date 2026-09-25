// PowerPoint recommendation pack (16:9) built with pptxgenjs. Charts are native
// and editable; Arabic decks mirror the layout and run right-to-left.

import pptxgen from 'pptxgenjs';

const C = {
  petrol: '0F3D4C',
  petrolSoft: '1B5466',
  gold: 'C9973A',
  goldSoft: 'F3E7CF',
  teal: '1F8A7A',
  ink: '1C2B33',
  muted: '5E6E78',
  tint: 'EEF4F5',
  line: 'D5DFE2',
  neg: 'C0473A',
  white: 'FFFFFF',
  sev: { high: 'C0473A', medium: 'D07A2E', low: 'C9973A' },
};

// Keeps numeric runs (plot numbers, dates, percentages) left-to-right inside
// Arabic sentences regardless of the renderer's bidi handling.
const LRM = '\u200e';
export const bidiNumbers = (text) => String(text).replace(/[-+]?\d[\d.,:/-]*%?/g, (m) => `${LRM}${m}${LRM}`);

const W = 13.333;
const H = 7.5;
const M = 0.6;

export async function buildPptx(report) {
  const ar = report.lang === 'ar';
  const t = report.t;
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = `${t.docTitle} — ${report.meta.plotNumber}`;
  pres.company = 'God’s Eye View';
  pres.subject = report.headline.use;
  if (ar) pres.rtlMode = true;

  const HEAD = ar ? 'Arial' : 'Cambria';
  const BODY = ar ? 'Arial' : 'Calibri';
  const X = (x, w) => (ar ? W - x - w : x);
  const align = ar ? 'right' : 'left';
  const B = (v) => (ar && typeof v === 'string' ? bidiNumbers(v) : v);
  const addText = (slide, text, o) => slide.addText(Array.isArray(text) ? text.map((r) => ({ ...r, text: B(r.text) })) : B(text), o);
  const txt = (o) => ({ fontFace: BODY, color: C.ink, align, valign: 'top', margin: 0, isTextBox: true, rtlMode: ar, lang: ar ? 'ar-AE' : 'en-GB', ...o });

  let page = 0;
  const footer = (slide, dark = false) => {
    page += 1;
    addText(slide, `${t.plot} ${report.meta.plotNumber}  ·  ${t.page} ${page}`, txt({ x: X(M, 4), y: H - 0.45, w: 4, h: 0.25, fontSize: 9, color: dark ? 'A9C1C9' : C.muted }));
    addText(
      slide,
      ar ? 'بيانات تمثيلية ومحاكاة · لا تُعد موافقة استثمارية' : 'Representative, simulated data · not an investment approval',
      txt({ x: X(W - M - 6, 6), y: H - 0.45, w: 6, h: 0.25, fontSize: 9, color: dark ? 'A9C1C9' : C.muted, align: ar ? 'left' : 'right' }),
    );
  };

  const header = (slide, n, title, sub) => {
    slide.background = { color: C.white };
    slide.addShape(pres.shapes.OVAL, { x: X(M, 0.62), y: 0.48, w: 0.62, h: 0.62, fill: { color: C.petrol }, line: { color: C.gold, width: 2.25 } });
    addText(slide, String(n), { x: X(M, 0.62), y: 0.48, w: 0.62, h: 0.62, fontFace: HEAD, fontSize: 20, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    addText(slide, title, txt({ x: X(M + 0.85, 10.5), y: 0.42, w: 10.5, h: 0.55, fontFace: HEAD, fontSize: 28, bold: true, color: C.petrol, valign: 'middle' }));
    if (sub) addText(slide, sub, txt({ x: X(M + 0.85, 10.5), y: 0.98, w: 10.5, h: 0.3, fontSize: 12.5, color: C.muted }));
  };

  const card = (slide, x, y, w, h, fill = C.tint) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: X(x, w), y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08 });

  const label = (slide, text, x, y, w, color = C.teal) =>
    addText(slide, text.toUpperCase ? (ar ? text : text.toUpperCase()) : text, txt({ x: X(x, w), y, w, h: 0.28, fontSize: 10.5, bold: true, color, charSpacing: ar ? 0 : 0.5 }));

  const bullets = (items, o = {}) => items.map((s, i) => ({ text: s, options: { bullet: ar ? { rtl: true } : true, breakLine: i < items.length - 1, paraSpaceAfter: 6, rtlMode: ar, ...o } }));

  const table = (slide, rows, opts) => {
    const data = ar ? rows.map((r) => [...r].reverse()) : rows;
    const colW = ar ? [...opts.colW].reverse() : opts.colW;
    slide.addTable(data, {
      x: X(opts.x, opts.w),
      y: opts.y,
      w: opts.w,
      colW,
      fontFace: BODY,
      fontSize: opts.fontSize ?? 11,
      color: C.ink,
      border: { type: 'solid', pt: 0.75, color: C.line },
      valign: 'middle',
      margin: 0.06,
      rowH: opts.rowH,
      autoPage: false,
    });
  };
  const cell = (text, o = {}) => ({ text: B(String(text)), options: { align, rtlMode: ar, ...o } });
  const headCell = (text, o = {}) => cell(text, { bold: true, color: C.white, fill: { color: C.petrol }, ...o });

  // 1 — Cover --------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.petrol };
    addText(s, t.eyebrow, txt({ x: X(M, 7.6), y: 0.65, w: 7.6, h: 0.3, fontSize: 12, bold: true, color: C.gold, charSpacing: ar ? 0 : 0.5 }));
    addText(s, t.docTitle, txt({ x: X(M, 7.6), y: 1.0, w: 7.6, h: 1.45, fontFace: HEAD, fontSize: 40, valign: 'bottom', bold: true, color: C.white }));
    addText(s, `${t.plot} ${report.meta.plotNumber} · ${report.meta.community}`, txt({ x: X(M, 7.6), y: 2.6, w: 7.6, h: 0.5, fontSize: 22, color: 'DCE8EC' }));
    addText(s, `${report.headline.use}\n${report.headline.structure}`, txt({ x: X(M, 7.6), y: 3.15, w: 7.6, h: 0.8, fontSize: 16, color: 'A9C1C9' }));
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: X(M, 7.2), y: 4.2, w: 7.2, h: 0.7, fill: { color: C.gold }, line: { color: C.gold }, rectRadius: 0.1 });
    addText(s, report.verdict.label, txt({ x: X(M + 0.25, 6.7), y: 4.2, w: 6.7, h: 0.7, fontSize: 16, bold: true, color: C.petrol, valign: 'middle', fit: 'shrink' }));
    addText(s, report.decision.status === 'pending' ? t.aiStatus : `${t.decision}: ${report.decision.label}`, txt({ x: X(M, 7.6), y: 5.1, w: 7.6, h: 0.35, fontSize: 13, color: C.white }));
    addText(s, `${t.confidence}: ${report.confidence}`, txt({ x: X(M, 7.6), y: 5.45, w: 7.6, h: 0.3, fontSize: 12, color: 'A9C1C9' }));
    addText(s, `${t.prepared} ${report.meta.date}\n${t.preparedBy}`, txt({ x: X(M, 7.6), y: 6.05, w: 7.6, h: 0.6, fontSize: 10, color: 'A9C1C9' }));
    plotSketch(pres, s, report, { x: X(8.75, 3.9), y: 1.2, w: 3.9, h: 4.6 });
    page += 1;
  }

  // 2 — Executive summary ----------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addText(s, t.execSummary, txt({ x: X(M, 9), y: 0.42, w: 9, h: 0.6, fontFace: HEAD, fontSize: 28, bold: true, color: C.petrol }));
    addText(s, `${report.verdict.label} · ${report.headline.use}`, txt({ x: X(M, 12), y: 1.0, w: 12, h: 0.32, fontSize: 13, color: C.muted, fit: 'shrink' }));
    const kw = (W - 2 * M - 3 * 0.3) / 4;
    report.kpis.forEach((k, i) => {
      const x = M + i * (kw + 0.3);
      card(s, x, 1.55, kw, 1.45);
      addText(s, k.label, txt({ x: X(x + 0.22, kw - 0.44), y: 1.7, w: kw - 0.44, h: 0.3, fontSize: 12, color: C.muted }));
      addText(s, k.value, txt({ x: X(x + 0.22, kw - 0.44), y: 2.0, w: kw - 0.44, h: 0.6, fontFace: HEAD, fontSize: ar ? 19 : 28, bold: true, color: k.negative ? C.neg : C.petrol, fit: 'shrink' }));
      addText(s, k.sub, txt({ x: X(x + 0.22, kw - 0.44), y: 2.6, w: kw - 0.44, h: 0.3, fontSize: 10.5, color: C.muted }));
    });
    label(s, t.aiLabel, M, 3.3, 7.3);
    addText(s, report.narrative, txt({ x: X(M, 7.3), y: 3.65, w: 7.3, h: 3.2, fontSize: 12.5, color: C.ink, paraSpaceAfter: 4, fit: 'shrink' }));
    card(s, 8.25, 3.3, W - M - 8.25, 3.55);
    label(s, t.whyTitle, 8.5, 3.5, W - M - 8.75, C.petrol);
    addText(s, bullets(report.reasons), txt({ x: X(8.5, W - M - 8.75), y: 3.85, w: W - M - 8.75, h: 2.9, fontSize: 11, color: C.ink, fit: 'shrink' }));
    footer(s);
  }

  // 3 — Site & planning -----------------------------------------------------
  {
    const s = pres.addSlide();
    header(s, 1, t.site, t.siteSub);
    table(
      s,
      report.site.facts.map(([k, v]) => [cell(k, { color: C.muted, fill: { color: C.tint } }), cell(v, { bold: true })]),
      { x: M, y: 1.6, w: 6.3, colW: [2.1, 4.2], rowH: 0.52, fontSize: 12 },
    );
    label(s, t.constraints, 7.3, 1.6, W - M - 7.3, C.petrol);
    report.site.constraints.forEach((c, i) => {
      const y = 2.0 + i * 1.5;
      card(s, 7.3, y, W - M - 7.3, 1.32);
      s.addShape(pres.shapes.OVAL, { x: X(7.5, 0.3), y: y + 0.2, w: 0.3, h: 0.3, fill: { color: C.sev[c.severity] }, line: { color: C.sev[c.severity] } });
      addText(s, `${c.label} · ${c.severityLabel}`, txt({ x: X(7.95, W - M - 8.15), y: y + 0.15, w: W - M - 8.15, h: 0.38, fontSize: 13, bold: true, color: C.ink, fit: 'shrink' }));
      addText(s, c.description, txt({ x: X(7.95, W - M - 8.15), y: y + 0.52, w: W - M - 8.15, h: 0.72, fontSize: 11, color: C.muted, fit: 'shrink' }));
    });
    footer(s);
  }

  // 4 — Market & demand ---------------------------------------------------------
  {
    const s = pres.addSlide();
    header(s, 2, t.market, t.marketSub);
    const kw = (W - 2 * M - 2 * 0.3) / 3;
    report.market.kpis.forEach((k, i) => {
      const x = M + i * (kw + 0.3);
      card(s, x, 1.55, kw, 1.2);
      addText(s, k.label, txt({ x: X(x + 0.22, kw - 0.44), y: 1.68, w: kw - 0.44, h: 0.3, fontSize: 12, color: C.muted }));
      addText(s, k.value, txt({ x: X(x + 0.22, kw - 0.44), y: 1.98, w: kw - 0.44, h: 0.5, fontFace: HEAD, fontSize: 26, bold: true, color: C.petrol }));
      if (k.sub) addText(s, k.sub, txt({ x: X(x + 0.22, kw - 0.44), y: 2.42, w: kw - 0.44, h: 0.25, fontSize: 10.5, color: C.muted }));
    });
    s.addChart(pres.charts.BAR, [{ name: t.gapChart, labels: report.market.gaps.map((g) => g.label), values: report.market.gaps.map((g) => g.value) }], {
      x: X(M, W - 2 * M),
      y: 3.0,
      w: W - 2 * M,
      h: 3.85,
      barDir: 'bar',
      catAxisOrientation: 'maxMin',
      catAxisLabelPos: 'low',
      chartColors: [C.teal],
      showTitle: true,
      title: t.gapChart,
      titleFontFace: BODY,
      titleFontSize: 13,
      titleColor: C.petrol,
      showValue: true,
      dataLabelPosition: 'outEnd',
      dataLabelFormatCode: '0"%"',
      dataLabelFontSize: 11,
      dataLabelColor: C.ink,
      catAxisLabelColor: C.ink,
      catAxisLabelFontSize: 11,
      catAxisLabelFontFace: BODY,
      valAxisLabelColor: C.muted,
      valAxisLabelFontSize: 10,
      valAxisLabelFormatCode: '0"%"',
      valGridLine: { color: 'E4ECEE', size: 0.75 },
      catGridLine: { style: 'none' },
      showLegend: false,
      barGapWidthPct: 60,
    });
    footer(s);
  }

  // 5 — Highest & Best Use --------------------------------------------------------
  {
    const s = pres.addSlide();
    header(s, 3, t.hbu, t.hbuSub);
    const alts = report.hbu.alternatives;
    s.addChart(pres.charts.BAR, [{ name: t.hbuChart, labels: alts.map((a) => `${a.rank}. ${a.name}`), values: alts.map((a) => a.total) }], {
      x: X(M, 5.4),
      y: 1.55,
      w: 5.4,
      h: 4.4,
      barDir: 'bar',
      catAxisOrientation: 'maxMin',
      valAxisMinVal: 0,
      valAxisMaxVal: 100,
      chartColors: [C.petrol],
      showTitle: true,
      title: t.hbuChart,
      titleFontFace: BODY,
      titleFontSize: 13,
      titleColor: C.petrol,
      showValue: true,
      dataLabelPosition: 'outEnd',
      dataLabelFontSize: 11,
      dataLabelColor: C.ink,
      catAxisLabelColor: C.ink,
      catAxisLabelFontSize: 11,
      catAxisLabelFontFace: BODY,
      valAxisLabelColor: C.muted,
      valAxisLabelFontSize: 10,
      valGridLine: { color: 'E4ECEE', size: 0.75 },
      catGridLine: { style: 'none' },
      showLegend: false,
      barGapWidthPct: 55,
    });
    const top = alts.slice(0, 3);
    const rows = [
      [headCell(ar ? 'المعيار' : 'Criterion'), headCell(ar ? 'الوزن' : 'Weight', { align: 'center' }), ...top.map((a) => headCell(a.name, { align: 'center', fontSize: 10 }))],
      ...report.hbu.criteria.map((c, i) => [
        cell(c.label, { fill: { color: C.tint } }),
        cell(`${c.weight}%${c.modified ? ' *' : ''}`, { align: 'center', color: c.modified ? C.gold : C.muted, bold: c.modified }),
        ...top.map((a) => cell(a.scores[i], { align: 'center', bold: a.chosen, color: a.chosen ? C.petrol : C.ink })),
      ]),
      [
        cell(ar ? 'الإجمالي' : 'Total', { bold: true }),
        cell('100%', { align: 'center', color: C.muted }),
        ...top.map((a) => cell(a.total, { align: 'center', bold: true, color: a.chosen ? C.white : C.petrol, fill: { color: a.chosen ? C.petrol : C.goldSoft } })),
      ],
    ];
    table(s, rows, { x: 6.35, y: 1.6, w: W - M - 6.35, colW: [1.95, 0.95, 1.48, 1.48, 1.48].map((v) => (v * (W - M - 6.35)) / 7.34), rowH: 0.42, fontSize: 11 });
    const note = [...report.hbu.screenedOut, report.hbu.criteria.some((c) => c.modified) ? (ar ? '* وزن معدّل من المستخدم' : '* user-modified weight') : null].filter(Boolean).join('  ·  ');
    if (note) addText(s, note, txt({ x: X(6.35, W - M - 6.35), y: 5.65, w: W - M - 6.35, h: 0.6, fontSize: 10, color: C.muted, fit: 'shrink' }));
    footer(s);
  }

  // 6 — Investment structuring ------------------------------------------------
  {
    const s = pres.addSlide();
    header(s, 4, t.structuring, t.structuringSub);
    card(s, M, 1.6, 3.7, 5.2, C.petrol);
    addText(s, t.recommendedStructure, txt({ x: X(M + 0.3, 3.1), y: 1.85, w: 3.1, h: 0.3, fontSize: 11, bold: true, color: C.gold }));
    addText(s, report.structuring.recommended, txt({ x: X(M + 0.3, 3.1), y: 2.2, w: 3.1, h: 1.1, fontFace: HEAD, fontSize: 24, bold: true, color: C.white, fit: 'shrink' }));
    const best = report.structuring.rows.find((r) => r.recommended);
    addText(s, `${best.total}/100`, txt({ x: X(M + 0.3, 3.1), y: 3.35, w: 3.1, h: 0.6, fontFace: HEAD, fontSize: 30, bold: true, color: C.gold }));
    addText(s, report.structuring.summary, txt({ x: X(M + 0.3, 3.1), y: 4.05, w: 3.1, h: 2.5, fontSize: 12, color: 'DCE8EC', fit: 'shrink' }));
    const rows = [
      [headCell(t.structure), headCell(t.score, { align: 'center' }), headCell(ar ? 'الحالة' : 'Status', { align: 'center' }), headCell(ar ? 'مبرر القاعدة' : 'Rule rationale')],
      ...report.structuring.rows.map((r) => {
        const fill = r.recommended ? { color: C.goldSoft } : undefined;
        return [
          cell(r.name, { bold: true, fill, color: r.applicable ? C.ink : C.muted }),
          cell(r.applicable ? r.total : '—', { align: 'center', bold: r.recommended, fill, color: r.applicable ? C.petrol : C.muted }),
          cell(r.applicable ? t.applicable : t.notApplicable, { align: 'center', fill, fontSize: 10, color: r.applicable ? C.teal : C.muted }),
          cell(r.why, { fill, fontSize: 10, color: r.applicable ? C.ink : C.muted }),
        ];
      }),
    ];
    table(s, rows, { x: 4.6, y: 1.6, w: W - M - 4.6, colW: [2.1, 0.8, 1.2, 4.03], rowH: 0.74, fontSize: 11 });
    footer(s);
  }

  // 7 — Financial feasibility ------------------------------------------------------
  {
    const s = pres.addSlide();
    header(s, 5, t.financial, t.financialSub);
    const stats = [...report.kpis.map((k) => [k.label, k.value, k.negative]), ...report.financial.stats.map(([k, v]) => [k, v, false])];
    const sw = (W - 2 * M - 5 * 0.2) / 6;
    stats.forEach(([k, v, neg], i) => {
      const x = M + i * (sw + 0.2);
      card(s, x, 1.55, sw, 0.95);
      addText(s, k, txt({ x: X(x + 0.15, sw - 0.3), y: 1.63, w: sw - 0.3, h: 0.28, fontSize: 10, color: C.muted, fit: 'shrink' }));
      addText(s, v, txt({ x: X(x + 0.15, sw - 0.3), y: 1.93, w: sw - 0.3, h: 0.45, fontFace: HEAD, fontSize: ar ? 14 : 17, bold: true, color: neg ? C.neg : C.petrol, fit: 'shrink' }));
    });
    const cf = report.financial.cashflow;
    s.addChart(pres.charts.BAR, [{ name: t.cashflow, labels: cf.map((r) => String(r.year)), values: cf.map((r) => r.net) }], {
      x: X(M, 7.3),
      y: 2.75,
      w: 7.3,
      h: 4.05,
      barDir: 'col',
      chartColors: [C.teal],
      invertIfNegative: false,
      showTitle: true,
      title: t.cashflow,
      titleFontFace: BODY,
      titleFontSize: 13,
      titleColor: C.petrol,
      catAxisLabelColor: C.muted,
      catAxisLabelFontSize: 9,
      valAxisLabelColor: C.muted,
      valAxisLabelFontSize: 10,
      valGridLine: { color: 'E4ECEE', size: 0.75 },
      catGridLine: { style: 'none' },
      showLegend: false,
      barGapWidthPct: 40,
    });
    addText(s, t.residualNote, txt({ x: X(M, 7.3), y: 6.78, w: 7.3, h: 0.25, fontSize: 9, color: C.muted }));
    const rows = [
      [headCell(t.assumptions), headCell(ar ? 'القيمة' : 'Value', { align: 'center' })],
      ...report.financial.assumptions.map((a) => [
        cell(a.label, { fontSize: 10, fill: a.user ? { color: C.goldSoft } : undefined }),
        cell(a.user ? (ar ? `${a.value} · ${t.was} ${a.original}` : `${a.value}  (${t.was} ${a.original})`) : a.value, {
          align: 'center',
          fontSize: 10,
          bold: a.user,
          color: a.user ? '8A6420' : C.ink,
          fill: a.user ? { color: C.goldSoft } : undefined,
        }),
      ]),
    ];
    table(s, rows, { x: 8.2, y: 2.75, w: W - M - 8.2, colW: [2.75, 1.78], rowH: 0.36, fontSize: 10 });
    footer(s);
  }

  // 8 — Risks & conditions --------------------------------------------------------
  {
    const s = pres.addSlide();
    header(s, 6, `${t.risks} · ${t.conditions}`, t.aiLabel);
    const col = (title, items, x, w, color) => {
      label(s, title, x, 1.6, w, color);
      items.slice(0, 6).forEach((item, i) => {
        const y = 2.0 + i * 0.78;
        s.addShape(pres.shapes.OVAL, { x: X(x, 0.36), y: y + 0.03, w: 0.36, h: 0.36, fill: { color }, line: { color } });
        addText(s, String(i + 1), {
          x: X(x, 0.36),
          y: y + 0.03,
          w: 0.36,
          h: 0.36,
          fontFace: BODY,
          fontSize: 11,
          bold: true,
          color: C.white,
          align: 'center',
          valign: 'middle',
          margin: 0,
          isTextBox: true,
        });
        addText(s, item, txt({ x: X(x + 0.5, w - 0.5), y, w: w - 0.5, h: 0.7, fontSize: 11.5, color: C.ink, fit: 'shrink' }));
      });
    };
    col(t.risks, report.risks, M, 5.85, C.neg);
    col(t.conditions, report.conditions, 6.9, W - M - 6.9, C.teal);
    footer(s);
  }

  // 9 — Scenarios & alternatives --------------------------------------------------
  {
    const s = pres.addSlide();
    header(s, 5, `${t.scenarios} · ${t.alternatives}`, t.financialSub);
    const rows = [
      [headCell(t.scenario), headCell(t.npv, { align: 'center' }), headCell(t.irr, { align: 'center' }), headCell(t.payback, { align: 'center' })],
      ...report.financial.scenarios.map((sc) => [
        cell(sc.label, { bold: true }),
        cell(sc.npv, { align: 'center', color: sc.negative ? C.neg : C.ink }),
        cell(sc.irr, { align: 'center' }),
        cell(sc.payback, { align: 'center' }),
      ]),
    ];
    table(s, rows, { x: M, y: 1.6, w: 6.6, colW: [2.4, 1.6, 1.1, 1.5], rowH: 0.5, fontSize: 11.5 });
    const alts = report.hbu.alternatives;
    const rows2 = [
      [headCell(t.rank, { align: 'center' }), headCell(t.use), headCell(t.score, { align: 'center' })],
      ...alts.map((a) => [
        cell(a.rank, { align: 'center' }),
        cell(a.name, { bold: a.chosen, color: a.chosen ? C.petrol : C.ink }),
        cell(a.total, { align: 'center', bold: a.chosen, fill: a.chosen ? { color: C.goldSoft } : undefined }),
      ]),
    ];
    table(s, rows2, { x: 7.6, y: 1.6, w: W - M - 7.6, colW: [0.8, 3.5, 0.83], rowH: 0.5, fontSize: 11.5 });
    footer(s);
  }

  // 10 — Decision, provenance & sources ------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.petrol };
    addText(s, t.decision, txt({ x: X(M, 6.2), y: 0.6, w: 6.2, h: 0.5, fontFace: HEAD, fontSize: 28, bold: true, color: C.white }));
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: X(M, 6.0), y: 1.3, w: 6.0, h: 1.5, fill: { color: C.petrolSoft }, line: { color: C.gold, width: 1.5 }, rectRadius: 0.1 });
    addText(s, report.decision.label, txt({ x: X(M + 0.3, 5.4), y: 1.45, w: 5.4, h: 0.45, fontSize: 18, bold: true, color: C.gold }));
    addText(
      s,
      report.decision.note ? `“${report.decision.note}”${report.decision.at ? `\n${report.decision.at}` : ''}` : ar ? 'لم تُسجَّل ملاحظة بعد.' : 'No decision note recorded yet.',
      txt({ x: X(M + 0.3, 5.4), y: 1.95, w: 5.4, h: 0.75, fontSize: 12, color: 'DCE8EC', fit: 'shrink' }),
    );
    addText(s, t.provenance, txt({ x: X(M, 6.0), y: 3.1, w: 6.0, h: 0.35, fontSize: 13, bold: true, color: C.gold }));
    addText(s, t.provenanceText, txt({ x: X(M, 6.0), y: 3.5, w: 6.0, h: 1.4, fontSize: 12, color: 'DCE8EC', fit: 'shrink' }));
    addText(s, t.disclaimer, txt({ x: X(M, 6.0), y: 5.1, w: 6.0, h: 1.0, fontSize: 11, italic: !ar, color: 'A9C1C9', fit: 'shrink' }));
    addText(s, t.sources, txt({ x: X(7.2, W - M - 7.2), y: 0.7, w: W - M - 7.2, h: 0.35, fontSize: 13, bold: true, color: C.gold }));
    addText(
      s,
      report.sources
        .slice(0, 11)
        .map((src, i, arr) => ({ text: `${src.source} — ${src.record} (${src.date})`, options: { bullet: ar ? { rtl: true } : true, breakLine: i < arr.length - 1, paraSpaceAfter: 4, rtlMode: ar } })),
      txt({ x: X(7.2, W - M - 7.2), y: 1.15, w: W - M - 7.2, h: 5.4, fontSize: 10.5, color: 'DCE8EC', fit: 'shrink' }),
    );
    footer(s, true);
  }

  return pres.write({ outputType: 'arraybuffer' });
}

/** Draw the plot outline and its constraint strips as native freeform shapes. */
function plotSketch(pres, slide, report, box) {
  const ring = report.meta.geometry;
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const minX = Math.min(...lons);
  const maxY = Math.max(...lats);
  const k = Math.cos((lats[0] * Math.PI) / 180);
  const spanX = (Math.max(...lons) - minX) * k;
  const spanY = maxY - Math.min(...lats);
  const scale = Math.min((box.w - 0.4) / spanX, (box.h - 1.0) / spanY);
  const ox = box.x + (box.w - spanX * scale) / 2;
  const oy = box.y + 0.2;
  const pts = (r) => r.map(([lon, lat]) => ({ x: (lon - minX) * k * scale, y: (maxY - lat) * scale }));
  const shape = (r, fill, transparency, line) => {
    const p = pts(r);
    slide.addShape(pres.shapes.CUSTOM_GEOMETRY, {
      x: ox,
      y: oy,
      w: spanX * scale,
      h: spanY * scale,
      points: [...p.map((q, i) => (i === 0 ? { x: q.x, y: q.y, moveTo: true } : { x: q.x, y: q.y })), { close: true }],
      fill: { color: fill, transparency },
      line,
    });
  };
  shape(ring, '1F8A7A', 45, { color: 'C9973A', width: 2.5 });
  for (const c of report.meta.constraintGeometry) {
    const clipped = c.ring.map(([lon, lat]) => [Math.min(Math.max(lon, minX), Math.max(...lons)), Math.min(Math.max(lat, Math.min(...lats)), maxY)]);
    shape(clipped, C.sev[c.severity], 35, { color: C.sev[c.severity], width: 0.75 });
  }
  slide.addText(`${report.t.plot} ${report.lang === 'ar' ? bidiNumbers(report.meta.plotNumber) : report.meta.plotNumber}`, {
    x: box.x,
    y: oy + spanY * scale + 0.2,
    w: box.w,
    h: 0.35,
    fontFace: report.lang === 'ar' ? 'Arial' : 'Calibri',
    fontSize: 13,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    margin: 0,
    isTextBox: true,
  });
  slide.addText(report.lang === 'ar' ? bidiNumbers(report.site.facts[0][1]) : report.site.facts[0][1], {
    x: box.x,
    y: oy + spanY * scale + 0.55,
    w: box.w,
    h: 0.3,
    fontFace: report.lang === 'ar' ? 'Arial' : 'Calibri',
    fontSize: 11,
    color: 'A9C1C9',
    align: 'center',
    margin: 0,
    isTextBox: true,
    rtlMode: report.lang === 'ar',
  });
}
