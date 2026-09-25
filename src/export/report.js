// Language-neutral recommendation pack built from a completed session. The
// PowerPoint and PDF renderers draw the same model, so both formats and both
// languages carry identical figures, sources and provenance.

import { HURDLE_IRR, SERVICE_BENCHMARKS } from '../data/methodology.js';
import { getDoc } from '../data/sources.js';
import { selectedAlternative } from '../engine/orchestrator.js';
import { T, LANGS, USES_AR, STRUCTURES_AR, STRUCTURES_AR_EXCLUDED, CRITERIA_AR, SERVICES_AR, ASSUMPTIONS_AR, SENSITIVITY_AR, SCENARIOS_AR, VERDICTS, PLOTS_AR } from './i18n.js';

const n0 = (x) => Math.round(x).toLocaleString('en-US');

function fmt(lang) {
  const ar = lang === 'ar';
  return {
    pct: (x, d = 1) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`),
    money: (x, d = 1) => (x == null ? '—' : ar ? `${(x / 1e6).toFixed(d)} مليون درهم` : `AED ${(x / 1e6).toFixed(d)}M`),
    years: (x) => (x == null ? (ar ? 'تتجاوز فترة الاستثمار' : 'beyond horizon') : ar ? `${x.toFixed(1)} سنة` : `${x.toFixed(1)} yrs`),
    area: (x) => (ar ? `${n0(x)} متر مربع` : `${n0(x)} m²`),
    num: n0,
  };
}

function joinList(items, lang) {
  if (items.length <= 1) return items.join('');
  return lang === 'ar' ? `${items.slice(0, -1).join('، ')} و${items.at(-1)}` : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function assumptionValue(a, f, v = a.value) {
  if (a.format === 'pct') return f.pct(v, 2);
  if (a.format === 'years') return f.years(v).replace('.0', '');
  if (a.format === 'mult') return `×${Number(v).toFixed(2)}`;
  return n0(v);
}

/** Build the export model for a session whose recommendation has been computed. */
export function buildReport(session, lang = 'en') {
  const t = T[lang];
  const ar = lang === 'ar';
  const f = fmt(lang);
  const { plot, results: r } = session;
  const rec = r.recommendation;
  const fin = r.financial;
  const m = fin.result;
  const alt = selectedAlternative(session);
  const pa = PLOTS_AR[plot.plotNumber];

  const useName = (u) => (ar ? (USES_AR[u.id]?.name ?? u.name) : u.name);
  const useShort = (u) => (ar ? (USES_AR[u.id]?.short ?? u.shortName) : u.shortName);
  const structName = (s) => (ar ? (STRUCTURES_AR[s.id]?.name ?? s.name) : s.name.split(' (')[0]);
  const critLabel = (c) => (ar ? CRITERIA_AR[c.id] : c.label);
  const constraintText = (c) => (ar ? pa.constraints[c.id] : { label: c.label, description: c.description.replace(/\.$/, '') });

  const structure = rec.structure;
  const verdictLabel = VERDICTS[lang][rec.verdict.code];
  const downside = fin.scenarios.find((s) => s.id === 'downside')?.result;
  const robust = downside ? downside.npv > 0 : null;
  const robustnessText =
    robust == null ? '—' : ar ? (robust ? 'متينة: تبقى صافي القيمة الحالية موجبة في السيناريو المتحفظ' : 'حساسة: تصبح صافي القيمة الحالية سالبة في السيناريو المتحفظ') : rec.robustness;

  const strengths = alt.strengths.map((label) => {
    const c = r.hbu.criteria.find((x) => x.label === label);
    return ar ? CRITERIA_AR[c.id] : label.toLowerCase();
  });

  const community = ar ? pa.community : plot.community;
  const narrative = ar
    ? `السيناريو الموصى به: تطوير القطعة ${plot.plotNumber} في ${community} بوصفها ${useName(alt.use)} وفق صيغة ${structName(structure)}. ${
        alt.rank === 1 ? `يحتل هذا الاستخدام المرتبة الأولى بين ${r.hbu.alternatives.length} بدائل` : `اختاره أخصائي الاستثمار، ويحتل المرتبة ${alt.rank} بين ${r.hbu.alternatives.length} بدائل`
      } بنتيجة ${alt.total.value} من 100${strengths.length ? `، مدعوماً بقوة ${joinList(strengths, 'ar')}` : ''}. وفق الافتراضات التوضيحية يحقق المشروع صافي قيمة حالية قدره ${f.money(m.npv)} عند معدل خصم ${f.pct(fin.inputs.discountRate)}، ومعدل عائد داخلي ${f.pct(m.irr)} مقابل عتبة ${f.pct(HURDLE_IRR, 0)}، وعائداً على الاستثمار بنسبة ${f.pct(m.roi, 0)}، وفترة استرداد ${f.years(m.payback)}. النتائج ${robustnessText}. القرار النهائي بشأن المضي قدماً يعود إلى أخصائي الاستثمار.`
    : rec.narrative.value;

  const sdKeys = alt.use.demandKeys.filter((k) => r.supplyDemand.byKey[k]);
  const reasons = [
    ...alt.strengths.slice(0, 3).map((label) => {
      const c = r.hbu.criteria.find((x) => x.label === label);
      return ar ? `${CRITERIA_AR[c.id]}: ${alt.scores[c.id]} من 10` : `${label}: ${alt.scores[c.id]}/10 — ${alt.notes[c.id]}`;
    }),
    ...sdKeys.map((k) => {
      const x = r.supplyDemand.byKey[k];
      return ar ? `مؤشر فجوة ${SERVICES_AR[k]}: ${Math.round(x.gapIndex.value * 100)}%` : `${x.label}: gap index ${Math.round(x.gapIndex.value * 100)}% (${x.rating.label.toLowerCase()})`;
    }),
    ar
      ? `الصيغة الموصى بها ${structName(structure)} بنتيجة ${structure.total.value} من 100: ${STRUCTURES_AR[structure.id].why}`
      : `${structName(structure)} scores ${structure.total.value}/100: ${structure.why}`,
  ];

  // Risks, rebuilt per language from structured inputs.
  const risks = [];
  for (const h of alt.constraintHits.filter((x) => x.s >= 0.3)) {
    const c = constraintText(h.c);
    risks.push(`${c.label}: ${c.description}`);
  }
  if (alt.legal.status === 'conditional') risks.push(ar ? `الاستخدام مشروط: ${pa.conditional}` : alt.legal.text);
  const be = fin.sensitivity.breakevens;
  if (be.priceDrop != null)
    risks.push(
      ar ? `تصل صافي القيمة الحالية إلى الصفر إذا انخفض السعر أو الإيجار بنسبة ${f.pct(be.priceDrop, 0)}` : `NPV reaches zero if price/rent falls ${f.pct(be.priceDrop, 0)} below the assumption`,
    );
  if (be.capexRise != null) risks.push(ar ? `تصل صافي القيمة الحالية إلى الصفر إذا ارتفعت تكلفة الإنشاء بنسبة ${f.pct(be.capexRise, 0)}` : `NPV reaches zero if CAPEX rises ${f.pct(be.capexRise, 0)}`);
  const top = fin.sensitivity.rows[0];
  risks.push(
    ar
      ? `${SENSITIVITY_AR[top.key]} هو المحرك الأكثر حساسية، إذ ينقل تغيّر بمقدار ${top.shiftLabel.replace('pts', 'نقطة')} صافي القيمة الحالية بين ${f.money(top.npvLow)} و${f.money(top.npvHigh)}`
      : `${top.label} is the most sensitive driver (${top.shiftLabel} moves NPV from ${f.money(top.npvLow)} to ${f.money(top.npvHigh)})`,
  );
  for (const k of sdKeys.filter((k) => r.supplyDemand.byKey[k].gapIndex.value < 0)) {
    risks.push(ar ? `يوجد فائض في ${SERVICES_AR[k]} بعد احتساب المشاريع قيد التطوير` : `${SERVICE_BENCHMARKS[k].label} is oversupplied once the pipeline is counted`);
  }

  const conditions = [
    ...plot.constraints
      .filter((c) => c.severity !== 'low' && (alt.use.constraintSensitivity[c.type] ?? 0) > 0)
      .map((c) => (ar ? `معالجة ${constraintText(c).label} عبر التصميم والحصول على شهادة عدم الممانعة من الجهة المختصة` : `Resolve ${c.label.toLowerCase()} through design and the relevant NOC`)),
    ...(alt.legal.status === 'conditional' ? [ar ? pa.conditional : `Obtain ${alt.legal.text.split(': ')[1]}`] : []),
    ar
      ? `استطلاع اهتمام ${alt.use.operatorSpecialised ? 'المشغلين' : 'المطورين'} بصيغة ${structName(structure)}`
      : `Test ${alt.use.operatorSpecialised ? 'operator' : 'developer'} appetite for a ${structName(structure)} (market sounding)`,
    ar ? 'التحقق من افتراضات الإيجار والتكلفة والعائد عبر تقييم مستقل' : 'Validate rent, cost and yield assumptions with an independent valuation',
    ar ? 'تأكيد نهج الهيكلة مع لجنتي الشؤون القانونية والاستثمار' : 'Confirm the structuring approach with the legal and investment committees',
  ];

  const d = r.location.demographics;
  const review = session.reviews.recommendation ?? { status: 'pending' };

  const scenarioLabel = (s) => (ar ? (SCENARIOS_AR[s.id] ?? s.label) : s.label);
  const sources = [
    ...new Set([
      ...r.asset.sourceIds,
      ...d.residents.sources.slice(0, 2),
      `RTA-NET:ACCESS-${plot.plotNumber}`,
      ...rec.narrative.sources,
      ...alt.sources.gap.slice(0, 2),
      ...alt.sources.comparables.slice(0, 2),
    ]),
  ]
    .map(getDoc)
    .filter(Boolean)
    .map((doc) => ({ source: doc.sourceName, record: doc.recordId, date: doc.date, type: doc.sourceType }));

  return {
    lang,
    dir: LANGS[lang].dir,
    t,
    f,
    meta: {
      plotNumber: plot.plotNumber,
      plotName: ar ? pa.name : plot.name,
      community,
      date: new Date().toISOString().slice(0, 10),
      geometry: plot.geometry,
      constraintGeometry: plot.constraints.filter((c) => c.geometry).map((c) => ({ ring: c.geometry, severity: c.severity })),
    },
    verdict: { code: rec.verdict.code, tone: rec.verdict.tone, label: verdictLabel },
    confidence: t.confidenceLevel[rec.confidence] ?? rec.confidence,
    robustness: robustnessText,
    headline: { use: useName(alt.use), structure: structName(structure) },
    decision: { status: review.status, label: t.decisionStatus[review.status] ?? review.status, note: review.note ?? '', at: review.at ?? '' },
    kpis: [
      { key: 'npv', label: t.npv, value: f.money(m.npv), sub: t.atDiscount(f.pct(fin.inputs.discountRate)), negative: m.npv < 0 },
      { key: 'irr', label: t.irr, value: f.pct(m.irr), sub: t.vsHurdle((m.irr ?? 0) >= HURDLE_IRR, f.pct(HURDLE_IRR, 0)) },
      { key: 'roi', label: t.roi, value: f.pct(m.roi, 0), sub: t.annualised(f.pct(m.roiAnnualised), m.horizon) },
      { key: 'payback', label: t.payback, value: f.years(m.payback), sub: t.fromStart },
    ],
    narrative,
    reasons,
    site: {
      facts: [
        [t.area, f.area(plot.areaM2)],
        [t.zoning, `${plot.planning.zoningCode} · ${ar ? pa.zoningName : plot.planning.zoningName}`],
        [
          t.far,
          ar
            ? `${plot.planning.controls.far} / ${plot.planning.controls.maxFloors} · ${plot.planning.controls.maxHeightM} متر`
            : `${plot.planning.controls.far} / ${plot.planning.controls.maxFloors} (${plot.planning.controls.maxHeightM} m)`,
        ],
        [t.currentUse, ar ? pa.currentUse : plot.currentUse],
        [t.maxGfa, f.area(r.asset.metrics.maxGfa)],
        [t.developable, f.area(r.asset.metrics.developable)],
        [t.ownership, ar ? pa.ownership : plot.ownership],
      ],
      constraints: plot.constraints.map((c) => ({ ...constraintText(c), severity: c.severity, severityLabel: t.severity[c.severity] })),
    },
    market: {
      kpis: [
        { label: t.catchment, value: n0(d.residents.value), sub: `${t.growth} ${d.growthPct.value}%` },
        d.workers ? { label: t.workers, value: n0(d.workers.value), sub: '' } : { label: ar ? 'الأسر' : 'Households', value: n0(d.households.value), sub: '' },
        { label: t.accessibility, value: `${r.location.accessibility.score.value}/10`, sub: '' },
      ],
      gaps: r.supplyDemand.results.map((x) => ({ label: ar ? SERVICES_AR[x.key] : x.label, value: Math.round(x.gapIndex.value * 100), highlight: alt.use.demandKeys.includes(x.key) })),
    },
    hbu: {
      alternatives: r.hbu.alternatives.map((a) => ({ name: useShort(a.use), total: a.total.value, rank: a.rank, chosen: a.use.id === alt.use.id, scores: r.hbu.criteria.map((c) => a.scores[c.id]) })),
      criteria: r.hbu.criteria.map((c) => ({ label: critLabel(c), weight: c.effectiveWeight, modified: c.modified })),
      screenedOut: r.hbu.screenedOut.map((s) => (ar ? `${useShort(s.use)}: غير مسموح وفق التصنيف ${plot.planning.zoningCode}` : `${s.use.shortName}: ${s.reason}`)),
    },
    structuring: {
      rows: r.structuring.assessed
        .map((s) => ({
          name: structName(s),
          applicable: s.applicable,
          total: s.total.value,
          recommended: s.id === structure.id,
          why: ar ? (s.applicable ? STRUCTURES_AR[s.id].why : STRUCTURES_AR_EXCLUDED[s.id]) : s.why,
        }))
        .sort((a, b) => Number(b.applicable) - Number(a.applicable) || b.total - a.total),
      recommended: structName(structure),
      summary: ar ? STRUCTURES_AR[structure.id].why : structure.summary,
    },
    financial: {
      stats: [
        [t.capex, f.money(m.totalCapex)],
        [t.yieldOnCost, f.pct(m.yieldOnCost)],
      ],
      cashflow: m.rows.map((row) => ({ year: row.year, net: Math.round((row.net / 1e6) * 10) / 10 })),
      assumptions: fin.assumptions
        .filter((a) => ['price', 'utilisation', 'escalation', 'opexRatio', 'capexPerM2', 'constructionYears', 'horizonYears', 'discountRate', 'exitCapRate'].includes(a.key) || a.kind === 'user')
        .map((a) => ({
          label: ar ? ASSUMPTIONS_AR[a.key] : a.label.replace(/^Price — /, 'Price: '),
          value: assumptionValue(a, f),
          original: assumptionValue(a, f, a.original),
          user: a.kind === 'user',
        })),
      scenarios: fin.scenarios.map((s) => ({ label: scenarioLabel(s), npv: f.money(s.result.npv), irr: f.pct(s.result.irr), payback: f.years(s.result.payback), negative: s.result.npv < 0 })),
    },
    risks,
    conditions,
    sources,
  };
}

export function reportFilename(report, ext) {
  return `Investment-Recommendation_${report.meta.plotNumber}_${report.lang.toUpperCase()}.${ext}`;
}
