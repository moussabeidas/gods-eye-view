// Comparable plot & area analysis (BRD §12, FR-020 – FR-024). The similarity
// factors and weights are predefined prototype logic, shown to the user.

import { USE_CATALOGUE } from '../data/methodology.js';
import { calculated, aiText } from './provenance.js';

export const COMPARABILITY_FACTORS = [
  { id: 'zoning', label: 'Zoning', weight: 25 },
  { id: 'size', label: 'Plot size', weight: 20 },
  { id: 'proximity', label: 'Proximity', weight: 20 },
  { id: 'far', label: 'Planning intensity (FAR)', weight: 15 },
  { id: 'market', label: 'Market tier', weight: 10 },
  { id: 'use', label: 'Relevant land use', weight: 10 },
];

export const COMPARABLE_THRESHOLD = 55;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const family = (z) => z.split(/[\s/-]/)[0];

export function analyseComparables(plot, ctx, marketTier = 'upper-middle') {
  const uses = plot.candidateUses.map((id) => USE_CATALOGUE[id]).filter((u) => u.finance);
  const scored = ctx.comparables.map((c) => {
    const f = {
      zoning: c.zoning === plot.planning.zoningCode ? 1 : family(c.zoning) === family(plot.planning.zoningCode) ? 0.7 : 0.15,
      size: clamp01(1 - Math.abs(Math.log(c.areaM2 / plot.areaM2)) / Math.log(3)),
      proximity: clamp01(1 - c.distanceM / 12000),
      far: clamp01(1 - Math.abs(c.far - plot.planning.controls.far) / plot.planning.controls.far),
      market: c.marketTier === marketTier ? 1 : 0.5,
      use: uses.some((u) => u.comparableMatch.test(c.landUse)) ? 1 : 0.25,
    };
    const score = Math.round(COMPARABILITY_FACTORS.reduce((s, x) => s + f[x.id] * x.weight, 0));
    const reasons = [];
    if (f.zoning === 1) reasons.push(`same zoning (${c.zoning})`);
    else if (f.zoning >= 0.7) reasons.push(`related zoning family (${c.zoning})`);
    if (f.size >= 0.75) reasons.push(`similar plot size (${c.areaM2.toLocaleString('en-US')} m² vs ${plot.areaM2.toLocaleString('en-US')} m²)`);
    if (f.proximity >= 0.7) reasons.push(`nearby (${(c.distanceM / 1000).toFixed(1)} km)`);
    if (f.far >= 0.8) reasons.push(`comparable FAR (${c.far})`);
    if (f.use === 1) reasons.push(`delivers a candidate use (${c.landUse.toLowerCase()})`);
    if (f.market === 1) reasons.push('same market tier');
    const weaknesses = [];
    if (f.zoning < 0.5) weaknesses.push(`different zoning (${c.zoning})`);
    if (f.size < 0.4) weaknesses.push('plot size differs materially');
    if (f.proximity < 0.3) weaknesses.push(`distant (${(c.distanceM / 1000).toFixed(1)} km)`);
    if (f.use < 1) weaknesses.push('use not relevant to candidate uses');
    return {
      ...c,
      factors: f,
      score,
      selected: score >= COMPARABLE_THRESHOLD,
      reasons,
      weaknesses,
      sourceIds: [`DM-GIS:COMP-${c.plotNumber}`],
    };
  });
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.filter((c) => c.selected);
  const values = selected.map((c) => c.valueAedM2).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : null;

  const summary = aiText(
    `${selected.length} of ${scored.length} candidate plots pass the comparability threshold (${COMPARABLE_THRESHOLD}/100). The strongest is ${selected[0].plotNumber} in ${selected[0].community} (${selected[0].score}/100): ${selected[0].reasons.slice(0, 3).join(', ')}. Across the selected comparables, the median indicative value is AED ${median?.toLocaleString('en-US')}/m².${scored
      .filter((c) => !c.selected)
      .map((c) => ` ${c.plotNumber} was excluded (${c.weaknesses.join(', ') || 'low overall similarity'}).`)
      .join('')}`,
    selected.slice(0, 3).flatMap((c) => c.sourceIds),
  );

  return {
    factors: COMPARABILITY_FACTORS,
    threshold: COMPARABLE_THRESHOLD,
    all: scored,
    selected,
    medianValue: median && calculated(median, 'Median indicative value of selected comparables', { sources: selected.flatMap((c) => c.sourceIds), unit: 'AED/m²' }),
    summary,
  };
}
