// A compact, provenance-labelled digest of the current analysis, given to the
// LLM as grounding context so its answers stay consistent with the computed
// stages (FR-076, FR-078). Record ids are included so it can cite them.

const pct = (x, d = 1) => (x == null ? 'n/a' : `${(x * 100).toFixed(d)}%`);
const aedM = (x) => `AED ${(x / 1e6).toFixed(1)}M`;
const n = (x) => Math.round(x).toLocaleString('en-US');

export function buildDigest(session, stage) {
  const { plot, results: r, overrides } = session;
  const p = plot.plotNumber;
  const lines = [];
  lines.push(`# Session context`);
  lines.push(`Selected plot: ${p} — ${plot.name}. Current journey stage: ${stage ?? 'unknown'}.`);
  lines.push(`All data is representative or simulated for a prototype; there are no live integrations.`);

  lines.push(`\n## Stage 1 — Asset (SOURCED unless marked)`);
  lines.push(`Community ${plot.community}; area ${n(plot.areaM2)} m²; current use: ${plot.currentUse}; classification: ${plot.assetClassification} [DM-GIS:PLOT-${p}]`);
  lines.push(
    `Zoning ${plot.planning.zoningCode} ${plot.planning.zoningName}; permitted: ${plot.planning.permittedUses.join(', ')}; conditional: ${plot.planning.conditionalUses.join(', ')}; prohibited: ${plot.planning.prohibitedUses.join(', ')}; FAR ${plot.planning.controls.far}; height ${plot.planning.controls.maxHeightM} m [DM-PLAN:ZONE-${p}]`,
  );
  lines.push(`Constraints: ${plot.constraints.map((c) => `${c.label} (${c.severity}) — ${c.description}`).join(' | ')} [DM-AFF:${plot.affection.affectionPlanNo}]`);
  if (r.asset) lines.push(`CALCULATED: max GFA ${n(r.asset.metrics.maxGfa)} m²; developable ${n(r.asset.metrics.developable)} m².`);

  if (r.location) {
    const d = r.location.demographics;
    lines.push(`\n## Stage 2 — Location & market`);
    lines.push(
      `CALCULATED catchment residents ${n(d.residents.value)} (growth ${d.growthPct.value}%/yr)${d.workers ? `, workers ${n(d.workers.value)}` : ''}; households ${n(d.households.value)} [${d.residents.sources.slice(0, 2).join(', ')}]`,
    );
    lines.push(`CALCULATED accessibility ${r.location.accessibility.score.value}/10; transit: ${r.location.accessibility.transit.value} [RTA-NET:ACCESS-${p}]`);
    lines.push(`Activity (SOURCED counts): ${r.location.activity.map((a) => `${a.label} ${a.count} [${a.sourceId}]`).join('; ')}`);
    lines.push(`Market (SOURCED): ${r.location.market.benchmarks.map((b) => `${b.label} ${n(b.value)} ${b.unit} [${b.tagged.sources[0]}]`).join('; ')}`);
    lines.push(`Comparables (CALCULATED similarity): ${r.comparables.selected.map((c) => `${c.plotNumber} ${c.score}/100 — ${c.landUse}; ${c.performance} [${c.sourceIds[0]}]`).join(' | ')}`);
    lines.push(
      `Supply-demand (CALCULATED, predefined benchmarks [METHOD:SERVICE-BENCHMARKS]): ${r.supplyDemand.results.map((x) => `${x.label}: demand ${n(x.demand.value)}, supply ${n(x.supply.value)}, pipeline ${n(x.pipeline)} ${x.unit}, gap index ${Math.round(x.gapIndex.value * 100)}%`).join(' | ')}`,
    );
  }
  if (r.hbu) {
    lines.push(`\n## Stage 3 — HBU (CALCULATED with predefined criteria [METHOD:HBU-FRAMEWORK])`);
    lines.push(`Weights: ${r.hbu.criteria.map((c) => `${c.id}=${c.effectiveWeight}%${c.modified ? ' (USER-MODIFIED)' : ''}`).join(', ')}`);
    for (const a of r.hbu.alternatives) {
      lines.push(
        `${a.rank}. ${a.use.name} [use id: ${a.use.id}] total ${a.total.value}/100; scores ${Object.entries(a.scores)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')}; notes: ${Object.entries(a.notes)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' / ')}`,
      );
    }
    for (const s of r.hbu.screenedOut) lines.push(`Screened out: ${s.use.name} — ${s.reason}`);
    if (overrides.selectedUseId) lines.push(`USER SELECTED use for downstream stages: ${overrides.selectedUseId}`);
  }
  if (r.structuring) {
    lines.push(`\n## Stage 4 — Structuring (predefined rules [METHOD:STRUCTURING-RULES])`);
    lines.push(r.structuring.assessed.map((s) => `${s.name}: ${s.applicable ? `applicable, ${s.total.value}/100` : 'not applicable'} — ${s.rule} ${s.why}`).join(' | '));
    lines.push(`Recommended structure: ${r.structuring.recommended.name}`);
  }
  if (r.financial) {
    const f = r.financial;
    const m = f.result;
    lines.push(`\n## Stage 5 — Financials for ${f.selectedAlternative.use.name} (CALCULATED, illustrative [METHOD:FINANCIAL-MODEL])`);
    lines.push(
      `NPV ${aedM(m.npv)}; IRR ${pct(m.irr)}; ROI ${pct(m.roi, 0)} over ${m.horizon} yrs (${pct(m.roiAnnualised)} annualised); payback ${m.payback ? m.payback.toFixed(1) + ' yrs' : 'beyond horizon'}; CAPEX ${aedM(m.totalCapex)}; yield on cost ${pct(m.yieldOnCost)}`,
    );
    lines.push(
      `Assumptions: ${f.assumptions.map((a) => `${a.key}=${a.format === 'pct' ? pct(a.value, 2) : n(a.value)}${a.kind === 'user' ? ` (USER-MODIFIED, original ${a.format === 'pct' ? pct(a.original, 2) : n(a.original)})` : a.kind === 'sourced' ? ' (sourced)' : ' (predefined)'}`).join('; ')}`,
    );
    lines.push(`Sensitivity: ${f.sensitivity.rows.map((x) => `${x.label} ${x.shiftLabel}: NPV ${aedM(x.npvLow)}..${aedM(x.npvHigh)}`).join('; ')}`);
    lines.push(`Scenarios: ${f.scenarios.map((s) => `${s.label}: NPV ${aedM(s.result.npv)}, IRR ${pct(s.result.irr)}`).join('; ')}`);
  }
  if (r.recommendation) {
    const rec = r.recommendation;
    lines.push(`\n## Stage 6 — Recommendation (AI-GENERATED, awaiting specialist decision)`);
    lines.push(`${rec.verdict.label}; confidence ${rec.confidence}; ${rec.robustness}. Risks: ${rec.risks.map((x) => x.text).join(' | ')}. Conditions: ${rec.conditions.join(' | ')}`);
  }
  const reviews = Object.entries(session.reviews ?? {}).filter(([, v]) => v.status !== 'pending');
  if (reviews.length) lines.push(`\nSpecialist reviews so far: ${reviews.map(([k, v]) => `${k}: ${v.status}${v.note ? ` — "${v.note}"` : ''}`).join('; ')}`);
  return lines.join('\n');
}
