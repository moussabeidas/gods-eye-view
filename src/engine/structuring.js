// Stage 4 — Investment structuring (BRD §15, FR-041 – FR-045). Applicability
// rules and scoring are predefined (FR-043) and reported separately from the
// AI-generated interpretation (FR-045). Illustrative only.

import { STRUCTURES, STRUCTURE_CRITERIA, HURDLE_IRR } from '../data/methodology.js';
import { aiText, calculated } from './provenance.js';

const r1 = (x) => Math.round(x * 10) / 10;
const clamp = (x) => Math.max(0, Math.min(10, x));
const fmtM = (n) => `AED ${(n / 1e6).toFixed(0)}M`;

export function analyseStructuring(plot, ctx, use, fin) {
  const capex = fin.totalCapex;
  const payback = fin.payback ?? fin.horizon + 5;
  const irr = fin.irr ?? 0;
  const landYoy = ctx.market.benchmarks.landValue?.yoyPct ?? 0;
  const methodDoc = 'METHOD:STRUCTURING-RULES';

  const facts = [
    { label: 'Use type', value: use.publicService ? 'Public-facing service (community outcome matters)' : 'Commercial', rule: 'R-00' },
    { label: 'Operator specialisation', value: use.operatorSpecialised ? 'Specialist operator required' : 'General developer / landlord', rule: 'R-00' },
    { label: 'Indicative CAPEX', value: fmtM(capex), rule: 'R-00' },
    { label: 'Indicative payback', value: fin.payback ? `${fin.payback.toFixed(1)} years` : `beyond ${fin.horizon} years`, rule: 'R-00' },
    { label: 'Indicative project IRR', value: `${(irr * 100).toFixed(1)}% (hurdle ${HURDLE_IRR * 100}%)`, rule: 'R-00' },
    { label: 'Land value momentum', value: `${landYoy}% year-on-year`, rule: 'R-00' },
  ];

  const rules = {
    lease: () => ({
      ok: true,
      rule: 'R-L1',
      why: use.publicService ? 'Always available, but gives DM weak control over service outcomes' : 'Commercial use with market-standard tenancy; simplest to procure',
    }),
    musataha: () =>
      capex >= 50e6 && payback <= 45
        ? { ok: true, rule: 'R-M1', why: `CAPEX of ${fmtM(capex)} needs a long registered right to be financeable, and improvements revert to DM` }
        : { ok: false, rule: 'R-M1', why: 'CAPEX below AED 50M, or payback beyond the maximum Musataha term' },
    bot: () =>
      use.publicService || use.operatorSpecialised
        ? { ok: true, rule: 'R-B1', why: 'An operating asset with long-term public value that DM should get back at the end of the term' }
        : { ok: false, rule: 'R-B1', why: 'Generic commercial property; a transfer-back structure adds complexity without benefit' },
    dbot: () =>
      use.operatorSpecialised
        ? { ok: true, rule: 'R-D1', why: 'Design is integral to how the operator runs the asset, so design risk is best held by the operator' }
        : { ok: false, rule: 'R-D1', why: 'Standard building typology; design risk transfer not required' },
    concession: () =>
      use.publicService
        ? { ok: true, rule: 'R-C1', why: 'A public-facing service where DM wants performance standards and a revenue share' }
        : { ok: false, rule: 'R-C1', why: 'Not a public service; concession terms not appropriate' },
    ppp: () =>
      use.publicService && irr < HURDLE_IRR
        ? { ok: true, rule: 'R-P1', why: `Public service with project IRR ${(irr * 100).toFixed(1)}% below the ${HURDLE_IRR * 100}% hurdle; availability payments may be needed` }
        : {
            ok: false,
            rule: 'R-P1',
            why: use.publicService
              ? `Project is commercially self-financing (IRR ${(irr * 100).toFixed(1)}% ≥ ${HURDLE_IRR * 100}%), so availability payments are not justified`
              : 'Commercial use; government availability payments not justified',
          },
  };

  const weights = Object.fromEntries(STRUCTURE_CRITERIA.map((c) => [c.id, c.weight]));
  if (use.publicService) {
    weights.publicOutcome = 25;
    weights.capitalEfficiency = 20;
    weights.valueCapture = 15;
  }

  const assessed = STRUCTURES.map((s) => {
    const app = rules[s.id]();
    const sc = { ...s.profile };
    const adj = [];
    if (s.id === 'lease' && landYoy > 10) {
      sc.valueCapture -= 1.5;
      adj.push(`R-L2: land values rising ${landYoy}%/yr, so a fixed ground rent under-captures the upside (−1.5 value capture)`);
    }
    if (s.id === 'musataha' && capex > 200e6) {
      sc.valueCapture += 1;
      adj.push('R-M2: large improvements revert to DM at expiry (+1 value capture)');
    }
    if (s.id === 'dbot' && use.operatorSpecialised) {
      sc.riskTransfer += 0.5;
      adj.push('R-D2: design and operating risk held by one party (+0.5 risk transfer)');
    }
    if ((s.id === 'bot' || s.id === 'dbot') && !use.publicService) {
      sc.marketAppetite -= 1;
      adj.push('R-B2: transfer-back terms are less familiar for commercial investors (−1 market appetite)');
    }
    if (s.id === 'concession' && use.publicService) {
      sc.publicOutcome += 0.5;
      adj.push('R-C2: KPIs and service standards can be written into the concession (+0.5 control)');
    }
    const [minT, maxT] = s.termRange;
    const need = payback + 5;
    sc.termFit = need <= maxT && fin.horizon >= minT ? 9 : need <= maxT + 5 ? 6 : 3;
    adj.push(`R-T1: payback ${payback.toFixed(1)} yrs + 5-yr buffer vs ${s.termYears} term → term fit ${sc.termFit}/10`);

    for (const k of Object.keys(sc)) sc[k] = r1(clamp(sc[k]));
    const total = r1(STRUCTURE_CRITERIA.reduce((sum, c) => sum + (sc[c.id] * weights[c.id]) / 10, 0));
    return { ...s, applicable: app.ok, rule: app.rule, why: app.why, scores: sc, adjustments: adj, total: calculated(total, 'Σ criterion score × weight ÷ 10', { sources: [methodDoc] }) };
  });

  const applicable = assessed.filter((s) => s.applicable).sort((a, b) => b.total.value - a.total.value);
  const excluded = assessed.filter((s) => !s.applicable);
  const best = applicable[0];
  const alt = applicable[1];

  const interpretation = aiText(
    `${best.name} fits a ${use.shortName.toLowerCase()} on plot ${plot.plotNumber} best, scoring ${best.total.value}/100 on the predefined criteria. It lets DM keep the land, move construction and ${use.operatorSpecialised ? 'operating' : 'leasing'} risk to the private party, and ${best.id === 'musataha' || best.id === 'bot' || best.id === 'dbot' ? 'take the improvements back at the end of the term' : 'keep a performance-linked income'}. ${
      alt ? `${alt.name} (${alt.total.value}) is the fallback: ${alt.why.charAt(0).toLowerCase()}${alt.why.slice(1)}. ` : ''
    }${excluded.length ? `${excluded.map((s) => s.name.split(' (')[0]).join(', ')} ${excluded.length > 1 ? 'were' : 'was'} screened out by rule. ` : ''}These scores apply the illustrative prototype rules and do not replace a structuring review by the investment and legal teams.`,
    [methodDoc],
  );

  return { facts, criteria: STRUCTURE_CRITERIA.map((c) => ({ ...c, effectiveWeight: weights[c.id] })), assessed, applicable, excluded, recommended: best, interpretation };
}
