// Offline investment analyst: a deterministic, retrieval-grounded responder
// used when no LLM is configured (or it is unreachable). It keeps the chat
// aware of the selected plot and stage (§7.2), cites retrieved evidence
// (FR-078), and turns requests to modify and rerun into actions (FR-066/067).

import { getPlotCorpus, getDoc } from '../data/sources.js';
import { USE_CATALOGUE, HBU_CRITERIA } from '../data/methodology.js';
import { buildIndex, search } from './retrieval.js';
import { compareAlternatives } from './hbu.js';
import { selectedAlternative } from './orchestrator.js';

const indexes = new Map();
export function plotIndex(plotNumber) {
  if (!indexes.has(plotNumber)) indexes.set(plotNumber, buildIndex(getPlotCorpus(plotNumber)));
  return indexes.get(plotNumber);
}

const pct = (x, d = 1) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);
const aedM = (x) => `AED ${(x / 1e6).toFixed(1)}M`;
const n = (x) => Math.round(x).toLocaleString('en-US');
const cite = (...ids) =>
  ids
    .flat()
    .filter(Boolean)
    .map((id) => `[[${id}]]`)
    .join('');

export const ASSUMPTION_ALIASES = [
  { key: 'discountRate', re: /discount(?:\s*rate)?|wacc|hurdle rate/, pct: true },
  { key: 'exitCapRate', re: /exit\s*(?:cap(?:italisation|italization)?\s*)?(?:rate|yield)|cap\s*rate/, pct: true },
  { key: 'escalation', re: /escalation|rent growth|price growth|indexation/, pct: true },
  { key: 'opexRatio', re: /opex|operating cost/, pct: true },
  { key: 'capexPerM2', re: /capex|construction cost|build(?:ing)? cost/ },
  { key: 'utilisation', re: /occupancy|utili[sz]ation|enrol?ment rate/, pct: true },
  { key: 'price', re: /\b(?:rent|price|adr|daily rate|tuition|fee|fees|pricing)\b/ },
  { key: 'horizonYears', re: /horizon|investment period|term|duration/ },
  { key: 'constructionYears', re: /construction (?:period|time)|build period/ },
  { key: 'softCostPct', re: /soft cost|contingency/, pct: true },
];

const CRITERIA_ALIASES = [
  ['demand', /market demand|demand/],
  ['gap', /supply gap|gap/],
  ['location', /location|access/],
  ['planning', /planning/],
  ['financial', /financial|return/],
  ['comparables', /comparable/],
  ['risk', /risk|constraint/],
];

const USE_ALIASES = [
  ['community-retail', /retail|supermarket|community cent(?:re|er)|shopping/],
  ['private-school', /school|education|k-?12/],
  ['sports-wellness', /sport|wellness|fitness|gym/],
  ['polyclinic', /clinic|health|medical/],
  ['midscale-hotel', /hotel|hospitality(?! apart)/],
  ['serviced-apartments', /serviced|hotel apart/],
  ['grade-a-office', /office/],
  ['build-to-rent', /build[- ]to[- ]rent|btr|rental apart|residential/],
];

export function findUses(text) {
  const t = text.toLowerCase();
  const hits = [];
  for (const [id, re] of USE_ALIASES) {
    const m = t.match(re);
    if (m) hits.push({ id, at: m.index });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.id);
}

/** Parse "modify & rerun" instructions into structured actions. */
export function parseActions(question, session) {
  const q = question.toLowerCase();
  const actions = [];
  const fin = session.results.financial;

  const rel = q.match(/\b(increase|raise|reduce|decrease|cut|lower|drop)\s+(?:the\s+)?([a-z\s-]+?)\s+by\s+(\d+(?:\.\d+)?)\s*(%|percent|pts?|points?)?/);
  if (rel && fin) {
    const alias = ASSUMPTION_ALIASES.find((a) => a.re.test(rel[2]));
    if (alias) {
      const cur = fin.inputs[alias.key];
      const sign = /increase|raise/.test(rel[1]) ? 1 : -1;
      const amt = parseFloat(rel[3]);
      const isPts = /pt|point/.test(rel[4] ?? '');
      const value = alias.pct && isPts ? cur + (sign * amt) / 100 : cur * (1 + (sign * amt) / 100);
      actions.push({ type: 'setAssumption', key: alias.key, value: round(alias.key, value) });
    }
  }
  if (!actions.length && fin) {
    const abs = q.match(/(?:set|change|use|assume|make|what if|what happens if|try)\s+(?:the\s+)?([a-z\s-]+?)\s+(?:to|=|at|is|of|becomes)\s+(?:aed\s*)?(\d[\d,]*(?:\.\d+)?)\s*(%|k|m|years?|yrs?)?/);
    if (abs) {
      const alias = ASSUMPTION_ALIASES.find((a) => a.re.test(abs[1]));
      if (alias) {
        let v = parseFloat(abs[2].replace(/,/g, ''));
        if (abs[3] === 'k') v *= 1e3;
        if (abs[3] === 'm') v *= 1e6;
        if (alias.pct && (abs[3] === '%' || v > 1)) v /= 100;
        actions.push({ type: 'setAssumption', key: alias.key, value: round(alias.key, v) });
      }
    }
  }

  const weight = q.match(/weight\s+(?:of|for|on)?\s*(?:the\s+)?([a-z\s&-]+?)\s+(?:to|=|at)\s+(\d+(?:\.\d+)?)/);
  if (weight) {
    const c = CRITERIA_ALIASES.find(([, re]) => re.test(weight[1]));
    if (c) actions.push({ type: 'setWeight', criterion: c[0], value: parseFloat(weight[2]) });
  }

  if (/\b(proceed|select|choose|switch|go|pick|use)\b.*\b(with|to)\b/.test(q) || /\bselect\b|\bchoose\b/.test(q)) {
    const uses = findUses(q).filter((id) => session.results.hbu?.alternatives.some((a) => a.use.id === id));
    if (uses.length) actions.push({ type: 'selectUse', useId: uses.at(-1) });
  }
  if (/reset (?:all )?(?:assumptions|weights|changes)|restore (?:defaults|original)/.test(q)) {
    actions.push({ type: 'reset', what: /weight/.test(q) ? 'weights' : 'assumptions' });
  }
  if (/\b(re-?run|run again|recalculate|refresh)\b/.test(q) && !actions.length) {
    const stage = /hbu|use|scor/.test(q)
      ? 'hbu'
      : /struct/.test(q)
        ? 'structuring'
        : /financ|npv|irr|model/.test(q)
          ? 'financial'
          : /recommend/.test(q)
            ? 'recommendation'
            : /market|location|comparab|supply|demand/.test(q)
              ? 'location'
              : 'asset';
    actions.push({ type: 'rerun', stage });
  }
  return actions;
}

function round(key, v) {
  if (['horizonYears', 'constructionYears', 'rampYears'].includes(key)) return Math.round(v);
  if (['price', 'capexPerM2'].includes(key)) return Math.round(v);
  return Math.round(v * 10000) / 10000;
}

export function describeAction(a, session) {
  const fin = session.results.financial;
  switch (a.type) {
    case 'setAssumption': {
      const def = fin?.assumptions.find((x) => x.key === a.key);
      const fmtV = (v) => (def?.format === 'pct' ? pct(v, 2) : def?.format === 'years' ? `${v} years` : n(v));
      return `Set ${def?.label ?? a.key} to ${fmtV(a.value)} (was ${fmtV(fin?.inputs[a.key])}) and rerun Financial Analysis → Recommendation`;
    }
    case 'setWeight':
      return `Set HBU weight for ${HBU_CRITERIA.find((c) => c.id === a.criterion)?.label} to ${a.value} and rerun HBU → Recommendation`;
    case 'selectUse':
      return `Proceed with ${USE_CATALOGUE[a.useId]?.name} and rerun Structuring → Recommendation`;
    case 'rerun':
      return `Rerun from ${a.stage}`;
    case 'reset':
      return `Reset ${a.what} to predefined values and rerun`;
    default:
      return a.type;
  }
}

/** Minimum weight on one criterion (others scaled pro rata) that ties two alternatives. */
export function flipWeight(hbu, leader, challenger, criterionId) {
  const w = Object.fromEntries(hbu.criteria.map((c) => [c.id, c.effectiveWeight]));
  const wk = w[criterionId];
  const rest = (alt) => (alt.total.value - (wk * alt.scores[criterionId]) / 10) / (100 - wk);
  const A = rest(leader);
  const B = rest(challenger);
  const denom = leader.scores[criterionId] / 10 - A - (challenger.scores[criterionId] / 10 - B);
  if (Math.abs(denom) < 1e-9) return null;
  const x = (100 * (B - A)) / denom;
  return x > wk && x < 100 ? Math.round(x * 10) / 10 : null;
}

function topicAnswer(q, session) {
  const { plot, results: r } = session;
  const a = r.asset;
  const L = r.location;
  const p = plot.plotNumber;
  const zone = `DM-PLAN:ZONE-${p}`;
  const aff = `DM-AFF:${plot.affection.affectionPlanNo}`;
  const gis = `DM-GIS:PLOT-${p}`;

  if (/zon|permit|allowed|far\b|gfa|height|setback|coverage|planning|control/.test(q) && a) {
    const c = plot.planning.controls;
    return `**Planning & zoning — plot ${p}** (sourced)\n- Zoning **${plot.planning.zoningCode}** — ${plot.planning.zoningName} ${cite(zone)}\n- Permitted: ${plot.planning.permittedUses.join(', ')} ${cite(zone)}\n- Conditional: ${plot.planning.conditionalUses.join(', ')}; prohibited: ${plot.planning.prohibitedUses.join(', ')} ${cite(zone)}\n- FAR ${c.far}, max height ${c.maxHeightM} m (${c.maxFloors}), coverage ${Math.round(c.plotCoverage * 100)}%, setbacks ${c.setbacks} ${cite(zone)}\n\n**Calculated:** max GFA ${n(a.metrics.maxGfa)} m² (area × FAR); developable area ${n(a.metrics.developable)} m² after no-build easements ${cite(gis, aff)}`;
  }
  if (/constraint|easement|affection|restriction|power line|cable|transmission|promenade|waterfront|aviation|noc/.test(q)) {
    return `**Constraints recorded for plot ${p}** (sourced from the affection plan)\n${plot.constraints.map((c) => `- **${c.label}** (${c.severity}): ${c.description} ${cite(aff)}`).join('\n')}\n\n*AI interpretation:* ${
      plot.constraints
        .filter((c) => c.severity !== 'low')
        .map((c) => c.label)
        .join(' and ') || 'None of the constraints'
    } ${plot.constraints.filter((c) => c.severity !== 'low').length ? 'are the ones that shape use selection. The HBU agent penalises uses sensitive to them in the planning-fit and risk criteria.' : 'is material.'}`;
  }
  if (/demograph|population|resident|age|household|segment|income|density/.test(q) && L) {
    const d = L.demographics;
    return `**Catchment demographics** (calculated from sourced community data)\n- Residents: **${n(d.residents.value)}** (distance-weighted), growth ${d.growthPct.value}%/yr ${cite(d.residents.sources.slice(0, 2))}\n${d.workers ? `- Daytime workers: ${n(d.workers.value)} ${cite(d.residents.sources.slice(0, 1))}\n` : ''}- Households: ${n(d.households.value)}, average size ${d.householdSize.value}\n- Age: ${Object.entries(
      d.ageGroups.value,
    )
      .map(([k, v]) => `${k} ${v}%`)
      .join(' · ')}\n- Segments: ${Object.entries(d.segments.value)
      .map(([k, v]) => `${k} ${v}%`)
      .join(' · ')}\n\n*AI interpretation:* ${L.summary.value}`;
  }
  if (/access|road|metro|transit|bus|traffic|connect|infrastructure/.test(q) && L) {
    const acc = L.accessibility;
    return `**Infrastructure & accessibility** — score **${acc.score.value}/10** (calculated) ${cite(`RTA-NET:ACCESS-${p}`)}\n${acc.components.map((c) => `- ${c.label}: ${c.score}/10 (weight ${Math.round(c.weight * 100)}%)`).join('\n')}\n- Frontage: ${acc.frontRoad?.value ?? '—'}\n- Arterial: ${acc.arterial?.value ?? '—'}\n- Transit: ${acc.transit.value}\n- ${acc.traffic.label}: ${acc.traffic.value}`;
  }
  const catMatch = q.match(/school|supermarket|grocery|clinic|hospital|pharmac|gym|sport|restaurant|f&b|cafe|hotel|office|mosque|park|retail|shop/);
  if (catMatch && /near|around|how many|surround|nearby|facilit|within|competition|competitor/.test(q) && L) {
    const map = {
      school: 'school',
      supermarket: 'supermarket',
      grocery: 'supermarket',
      clinic: 'clinic',
      hospital: 'clinic',
      pharmac: 'pharmacy',
      gym: 'sports',
      sport: 'sports',
      restaurant: 'fnb',
      'f&b': 'fnb',
      cafe: 'fnb',
      hotel: 'hotel',
      office: 'office',
      mosque: 'mosque',
      park: 'park',
      retail: 'retail',
      shop: 'retail',
    };
    const cat = map[catMatch[0]];
    const act = L.activity.find((x) => x.category === cat);
    if (act) {
      return `**${act.label} within the catchment** — ${act.count} recorded, ${act.within1km} within 1 km ${cite(act.sourceId)}\n${act.items
        .slice(0, 8)
        .map(
          (x) =>
            `- ${x.name} — ${n(x.distanceM)} m${x.capacity ? ` · capacity ${n(x.capacity)}, enrolled ${n(x.enrolled)}` : ''}${x.gla ? ` · ${n(x.gla)} m² GLA` : ''}${x.keys ? ` · ${x.keys} keys` : ''}${x.rooms ? ` · ${x.rooms} rooms` : ''}`,
        )
        .join('\n')}\n\nThese facilities feed the supply side of the supply-demand analysis, so they do more than mark the map (§11.4).`;
    }
  }
  if (/compar/.test(q) && r.comparables) {
    const C = r.comparables;
    return `**Comparable plots** — ${C.selected.length} selected on 6 predefined factors (threshold ${C.threshold}/100)\n${C.selected.map((c) => `- **${c.plotNumber}** ${c.community} — ${c.score}/100: ${c.reasons.join(', ')} ${cite(c.sourceIds)}`).join('\n')}\n${C.all
      .filter((c) => !c.selected)
      .map((c) => `- Excluded ${c.plotNumber}: ${c.weaknesses.join(', ')}`)
      .join('\n')}\n\n*AI interpretation:* ${C.summary.value}`;
  }
  if (/gap|unmet|supply|demand|undersupp|oversupp/.test(q) && r.supplyDemand) {
    const sd = r.supplyDemand;
    return `**Supply-demand analysis** (calculated with predefined benchmarks) ${cite('METHOD:SERVICE-BENCHMARKS')}\n${sd.results.map((x) => `- **${x.label}**: demand ${n(x.demand.value)} vs supply ${n(x.supply.value)}${x.pipeline ? ` + pipeline ${n(x.pipeline)}` : ''} ${x.unit} → gap index **${Math.round(x.gapIndex.value * 100)}%** (${x.rating.label}) ${cite(x.supply.sources.slice(0, 2))}`).join('\n')}\n\n*AI interpretation:* ${sd.summary.value}`;
  }
  if (/market|rent|rera|transaction|dld|price|land value|adr|occupancy|trend/.test(q) && L && !/npv|irr/.test(q)) {
    const m = L.market;
    return `**Market indicators** (sourced)\n${m.benchmarks
      .slice(0, 7)
      .map((b) => `- ${b.label}: ${n(b.value)} ${b.unit}${b.yoyPct != null ? ` (${b.yoyPct > 0 ? '+' : ''}${b.yoyPct}% y/y)` : ''} ${cite(b.tagged.sources)}`)
      .join(
        '\n',
      )}\n- ${m.index.label}: latest ${m.index.series.at(-1)} (${m.index.yoy}% over 4 quarters) ${cite(m.index.sourceId)}\n${m.medianLandAedM2 ? `- Median DLD land sale: AED ${n(m.medianLandAedM2.value)}/m² (calculated) ${cite(m.medianLandAedM2.sources.slice(0, 2))}` : ''}`;
  }
  if (/struct|musataha|lease|bot\b|dbot|concession|ppp/.test(q) && r.structuring) {
    const s = r.structuring;
    return `**Investment structuring** — predefined rules ${cite('METHOD:STRUCTURING-RULES')}\n${s.applicable.map((x) => `- **${x.name}** ${x.total.value}/100 — ${x.rule}: ${x.why}`).join('\n')}\n${s.excluded.map((x) => `- ~~${x.name}~~ — ${x.rule}: ${x.why}`).join('\n')}\n\n*AI interpretation (distinct from the rules above):* ${s.interpretation.value}`;
  }
  if (/sensitiv|tornado|scenario|downside|upside|breakeven|break-even/.test(q) && r.financial) {
    const f = r.financial;
    const be = f.sensitivity.breakevens;
    return `**Sensitivity & scenarios** (calculated) ${cite('METHOD:FINANCIAL-MODEL')}\n${f.sensitivity.rows
      .slice(0, 5)
      .map((x) => `- ${x.label} ${x.shiftLabel}: NPV ${aedM(x.npvLow)} → ${aedM(x.npvHigh)}`)
      .join(
        '\n',
      )}\n\n${f.scenarios.map((s) => `- **${s.label}**: NPV ${aedM(s.result.npv)}, IRR ${pct(s.result.irr)}, payback ${s.result.payback ? s.result.payback.toFixed(1) + ' yrs' : '> horizon'}`).join('\n')}\n\nBreakevens: price −${pct(be.priceDrop, 0)}, CAPEX +${pct(be.capexRise, 0)} before NPV reaches zero.`;
  }
  if (/npv|irr|roi|payback|return|financ|cash ?flow|capex|opex|feasib/.test(q) && r.financial) {
    const f = r.financial;
    const m = f.result;
    const mod = f.assumptions.filter((x) => x.kind === 'user');
    return `**Financial feasibility — ${f.selectedAlternative.use.name}** (calculated, illustrative) ${cite('METHOD:FINANCIAL-MODEL')}\n- NPV **${aedM(m.npv)}** at ${pct(f.inputs.discountRate)}\n- IRR **${pct(m.irr)}**\n- ROI **${pct(m.roi, 0)}** over ${m.horizon} years (${pct(m.roiAnnualised)} annualised)\n- Payback **${m.payback ? m.payback.toFixed(1) + ' years' : 'beyond horizon'}**\n- Total CAPEX ${aedM(m.totalCapex)}; stabilised NOI ${aedM(m.stabNoi)}; yield on cost ${pct(m.yieldOnCost)}\n\nKey assumptions: price ${n(f.inputs.price)} (${f.assumptions[0].unit}) ${cite(f.assumptions[0].sources)}, utilisation ${pct(f.inputs.utilisation, 0)}, CAPEX AED ${n(f.inputs.capexPerM2)}/m², OPEX ${pct(f.inputs.opexRatio, 0)}.${mod.length ? `\n\n**User-modified:** ${mod.map((x) => `${x.label}`).join(', ')}.` : ''}`;
  }
  if (/source|evidence|citation|where.*(from|data)|reference/.test(q)) {
    const ids = [gis, zone, aff, ...(L ? L.demographics.residents.sources.slice(0, 2) : []), `RTA-NET:ACCESS-${p}`];
    return `**Sources used in this analysis** (all simulated extracts, no live integration — FR-011)\n${ids.map((id) => `- ${getDoc(id)?.sourceName ?? id} — ${getDoc(id)?.title ?? ''} ${cite(id)}`).join('\n')}\n\nOpen any citation chip to inspect the record, its date and how it relates to the analysis.`;
  }
  if (/assumption/.test(q) && r.financial) {
    const f = r.financial;
    return `**Assumption register — ${f.selectedAlternative.use.shortName}**\n${f.assumptions.map((x) => `- ${x.label}: **${x.format === 'pct' ? pct(x.value, 2) : x.format === 'years' ? `${x.value} yrs` : x.format === 'mult' ? `×${x.value}` : n(x.value)}** — ${x.kind === 'user' ? `user-modified (original ${x.format === 'pct' ? pct(x.original, 2) : n(x.original)})` : x.kind === 'sourced' ? 'sourced' : 'predefined'}`).join('\n')}`;
  }
  if (/recommend|verdict|should we|decision|proceed|conclusion/.test(q) && r.recommendation) {
    const rec = r.recommendation;
    return `**Recommendation (AI-generated, awaiting your decision):** ${rec.verdict.label}\n\n${rec.narrative.value} ${cite(rec.narrative.sources)}\n\nConditions: ${rec.conditions.join('; ')}.\n\nThis is decision support, not an approval (FR-069). Use **Accept** or **Reject** on the recommendation panel to record your decision.`;
  }
  if (/asset|plot|site|area|size|owner|current use|where|location of/.test(q) && a) {
    return `**Plot ${p}** (sourced) ${cite(gis)}\n- ${plot.community}; ${n(plot.areaM2)} m²; ${plot.physical.shape}\n- Current use: ${plot.currentUse}\n- Classification: ${plot.assetClassification}\n- Access: ${plot.physical.access}\n\n*AI interpretation:* ${a.summary.value}`;
  }
  return null;
}

function hbuAnswer(q, session) {
  const hbu = session.results.hbu;
  if (!hbu) return null;
  const uses = findUses(q).filter((id) => hbu.alternatives.some((a) => a.use.id === id));
  const why = /why|how come|explain|reason|justif/.test(q);
  const rankWords = /rank|above|higher|over|better|beat|first|top|score|lower|below/.test(q);
  if (why && rankWords && uses.length) {
    let [x, y] = uses;
    const altX = hbu.alternatives.find((a) => a.use.id === x);
    if (!y) {
      const other = altX.rank === 1 ? hbu.alternatives[1] : hbu.alternatives[0];
      y = other.use.id;
    }
    const altY = hbu.alternatives.find((a) => a.use.id === y);
    const [hi, lo] = altX.total.value >= altY.total.value ? [altX, altY] : [altY, altX];
    const cmp = compareAlternatives(hbu, hi.use.id, lo.use.id);
    const rows = cmp.rows.sort((a, b) => Math.abs(b.weightedDiff) - Math.abs(a.weightedDiff));
    const flips = hbu.criteria
      .map((c) => ({ c, x: lo.scores[c.id] > hi.scores[c.id] ? flipWeight(hbu, hi, lo, c.id) : null }))
      .filter((f) => f.x != null)
      .sort((a, b) => a.x - b.x);
    return `**Why ${hi.use.shortName} (${hi.total.value}) ranks above ${lo.use.shortName} (${lo.total.value})** — gap ${cmp.gap} points ${cite('METHOD:HBU-FRAMEWORK')}\n\n| Criterion | Weight | ${hi.use.shortName} | ${lo.use.shortName} | Weighted Δ |\n|---|---|---|---|---|\n${rows.map((r) => `| ${r.criterion} | ${r.weight}% | ${r.a} | ${r.b} | ${r.weightedDiff > 0 ? '+' : ''}${r.weightedDiff} |`).join('\n')}\n\n**Evidence behind the biggest differences:**\n${rows
      .slice(0, 3)
      .map((r) => `- ${r.criterion}: ${hi.use.shortName} — ${r.noteA}; ${lo.use.shortName} — ${r.noteB}`)
      .join('\n')}\n\n*AI interpretation:* the ranking is driven by ${rows
      .filter((r) => r.weightedDiff > 0)
      .slice(0, 2)
      .map((r) => r.criterion.toLowerCase())
      .join(
        ' and ',
      )}. ${flips.length ? `The ranking would flip if the **${flips[0].c.label}** weight rose from ${flips[0].c.effectiveWeight}% to about **${flips[0].x}%** (others scaled pro rata). Ask me to set that weight to test it.` : 'No single weight change within 0–100% flips the order, so the ranking is robust.'}`;
  }
  if (/hbu|highest|best use|score|weight|criteri|rank|alternative|option/.test(q)) {
    return `**HBU ranking** — ${hbu.alternatives.length} alternatives scored 0–10 on 7 predefined criteria ${cite('METHOD:HBU-FRAMEWORK')}\n\nWeights: ${hbu.criteria.map((c) => `${c.label} ${c.effectiveWeight}%${c.modified ? ' (user-modified)' : ''}`).join(' · ')}\n\n${hbu.alternatives.map((a) => `${a.rank}. **${a.use.name}** — ${a.total.value}/100 (${a.rating})`).join('\n')}\n${hbu.screenedOut.map((s) => `- Screened out: ${s.use.name} — ${s.reason} ${cite(s.sources)}`).join('\n')}\n\n*AI interpretation:* ${hbu.summary.value}`;
  }
  return null;
}

function challengeAnswer(q, session) {
  if (!/challenge|disagree|not convinced|doubt|wrong|push back|devil|counter|really\?|are you sure|weak/.test(q)) return null;
  const { results: r } = session;
  const hbu = r.hbu;
  if (!hbu) return null;
  const lead = selectedAlternative(session);
  const second = hbu.alternatives.find((a) => a.use.id !== lead.use.id);
  const weakest = hbu.criteria
    .map((c) => ({ c, s: lead.scores[c.id], note: lead.notes[c.id] }))
    .sort((a, b) => a.s - b.s)
    .slice(0, 2);
  const flips = hbu.criteria
    .map((c) => ({ c, x: second.scores[c.id] > lead.scores[c.id] ? flipWeight(hbu, lead, second, c.id) : null }))
    .filter((f) => f.x != null)
    .sort((a, b) => a.x - b.x);
  const f = r.financial;
  const down = f?.scenarios.find((s) => s.id === 'downside');
  return `**Challenge review of the current conclusion: ${lead.use.name}**\n\nHere are the weakest points in the case, so you can judge them:\n${weakest.map((w) => `- **${w.c.label}** scores only ${w.s}/10 — ${w.note}`).join('\n')}\n${f ? `- Downside scenario: NPV ${aedM(down.result.npv)}, IRR ${pct(down.result.irr)} ${down.result.npv < 0 ? '— **value is destroyed**, so the case depends on base assumptions holding' : '— still positive'}\n- Most sensitive driver: ${f.sensitivity.rows[0].label} (${f.sensitivity.rows[0].shiftLabel} → NPV ${aedM(f.sensitivity.rows[0].npvLow)} to ${aedM(f.sensitivity.rows[0].npvHigh)})` : ''}\n\n**What would change the conclusion:**\n${
    flips.length
      ? flips
          .slice(0, 2)
          .map((x) => `- Raising the ${x.c.label} weight to ~${x.x}% would put ${second.use.shortName} level with ${lead.use.shortName}`)
          .join('\n')
      : `- No single weight change flips the ranking against ${second.use.shortName}`
  }\n- Setting a lower price or higher CAPEX: NPV reaches zero at price −${pct(f?.sensitivity.breakevens.priceDrop, 0)} or CAPEX +${pct(f?.sensitivity.breakevens.capexRise, 0)}\n\nYou can modify a weight or assumption (e.g. *"set the weight of supply gap to 30"*, *"set rent to 900"*), choose another use (*"proceed with ${second.use.shortName.toLowerCase()}"*), or record your challenge on the stage with **Challenge**. ${cite('METHOD:HBU-FRAMEWORK', 'METHOD:FINANCIAL-MODEL')}`;
}

/**
 * Answer a question about the current session.
 * Returns {text, citations, retrieved, actions, mode}.
 */
export function answer(session, question, { stage } = {}) {
  const q = question.toLowerCase();
  const retrieved = search(plotIndex(session.plot.plotNumber), `${question} ${stage ?? ''}`, { k: 5 }).map((x) => ({
    id: x.doc.id,
    title: x.doc.title,
    sourceName: x.doc.sourceName,
    score: Math.round(x.score * 100) / 100,
    snippet: x.snippet,
  }));
  const actions = parseActions(question, session);

  let text;
  if (actions.length) {
    text = `Understood. I will apply the following change${actions.length > 1 ? 's' : ''} and rerun the affected agents:\n${actions.map((a) => `- ${describeAction(a, session)}`).join('\n')}\n\nThe change will be marked as **user-modified** and kept distinct from the predefined assumptions (FR-073). Downstream stage reviews will reset to *pending*.`;
  } else {
    text = challengeAnswer(q, session) ?? hbuAnswer(q, session) ?? topicAnswer(q, session);
  }
  if (!text) {
    if (retrieved.length) {
      text = `Here is what the retrieved evidence says about "${question}":\n${retrieved
        .slice(0, 3)
        .map((x) => `- **${x.title}** — ${x.snippet} ${cite(x.id)}`)
        .join('\n')}\n\n*AI note:* this answer summarises retrieved records only. Ask about zoning, demographics, gaps, HBU scores, structures or financials for a structured explanation.`;
    } else {
      text = `I couldn't find evidence on that in the plot ${session.plot.plotNumber} records. Try asking about zoning, constraints, demographics, nearby facilities, comparables, supply gaps, HBU scores, structures, NPV/IRR or the recommendation.`;
    }
  }
  const citations = [...new Set([...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]))];
  return { text, citations, retrieved, actions, mode: 'offline' };
}
