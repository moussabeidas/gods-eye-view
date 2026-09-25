// Stage 1 — Asset Intelligence (BRD §10, FR-006 – FR-013).

import { ringAreaM2 } from './geo.js';
import { sourced, calculated, aiText } from './provenance.js';

export const assetDocIds = (plot) => ({
  gis: `DM-GIS:PLOT-${plot.plotNumber}`,
  plan: `DM-PLAN:ZONE-${plot.plotNumber}`,
  aff: `DM-AFF:${plot.affection.affectionPlanNo}`,
});

export function analyseAsset(plot) {
  const ids = assetDocIds(plot);
  const pl = plot.planning;
  const c = pl.controls;

  const noBuild = plot.constraints.filter((k) => k.geometry && k.noBuild).reduce((s, k) => s + ringAreaM2(k.geometry), 0);
  const developable = Math.round((plot.areaM2 - noBuild) / 10) * 10;
  const maxGfa = Math.round(plot.areaM2 * c.far);
  const maxFootprint = Math.round(Math.min(plot.areaM2 * c.plotCoverage, developable));

  const identity = [
    ['Plot number', sourced(plot.plotNumber, [ids.gis])],
    ['Community', sourced(`${plot.community} (${plot.communityCode})`, [ids.gis])],
    ['Coordinates', sourced(`${plot.center[1].toFixed(5)}° N, ${plot.center[0].toFixed(5)}° E`, [ids.gis])],
    ['Plot area', sourced(plot.areaM2, [ids.gis], { unit: 'm²' })],
    ['Geometry', sourced(`${plot.physical.shape}; frontage ${plot.physical.frontageM} m × depth ${plot.physical.depthM} m`, [ids.gis])],
    ['Ownership', sourced(plot.ownership, [ids.gis])],
    ['Current use', sourced(plot.currentUse, [ids.gis])],
    ['Asset classification', sourced(plot.assetClassification, [ids.gis])],
    ['Access', sourced(plot.physical.access, [ids.gis])],
    ['Utilities', sourced(plot.physical.utilities, [ids.gis])],
  ];

  const planning = [
    ['Zoning', sourced(`${pl.zoningCode} — ${pl.zoningName}`, [ids.plan])],
    ['Permitted uses', sourced(pl.permittedUses, [ids.plan])],
    ['Conditional uses', sourced(pl.conditionalUses, [ids.plan])],
    ['Prohibited uses', sourced(pl.prohibitedUses, [ids.plan])],
  ];

  const controls = [
    ['Floor area ratio (FAR)', sourced(c.far, [ids.plan])],
    ['Maximum height', sourced(`${c.maxHeightM} m (${c.maxFloors})`, [ids.plan])],
    ['Plot coverage', sourced(c.plotCoverage, [ids.plan], { unit: '%' })],
    ['Setbacks', sourced(c.setbacks, [ids.plan])],
    ['Parking', sourced(c.parking, [ids.plan])],
    ['Maximum GFA', calculated(maxGfa, 'Plot area × FAR', { unit: 'm²', sources: [ids.gis, ids.plan] })],
    ['Maximum footprint', calculated(maxFootprint, 'min(Plot area × coverage, developable area)', { unit: 'm²', sources: [ids.gis, ids.plan, ids.aff] })],
    ['Developable area', calculated(developable, 'Plot area − no-build easements and reservations', { unit: 'm²', sources: [ids.gis, ids.aff] })],
  ];

  const affection = [
    ['Affection plan', sourced(`${plot.affection.affectionPlanNo} (issued ${plot.affection.issueDate})`, [ids.aff])],
    ['Land-use code', sourced(plot.affection.landUseCode, [ids.aff])],
    ['Road reservation', sourced(plot.affection.roadReservation, [ids.aff])],
    ['Easements', sourced(plot.affection.easements, [ids.aff])],
    ['Utilities', sourced(plot.affection.utilitiesNotes, [ids.aff])],
    ['Notes', sourced(plot.affection.notes, [ids.aff])],
  ];

  const constraints = plot.constraints.map((k) => ({
    ...k,
    areaM2: k.geometry ? Math.round(ringAreaM2(k.geometry)) : null,
    sources: [ids.aff],
  }));

  const high = constraints.filter((k) => k.severity === 'high');
  const summary = aiText(
    `Plot ${plot.plotNumber} is a ${plot.areaM2.toLocaleString('en-US')} m² ${plot.currentUse.toLowerCase()} zoned ${pl.zoningCode} (${pl.zoningName}). Up to ${maxGfa.toLocaleString('en-US')} m² of GFA is permitted at FAR ${c.far}, within ${c.maxFloors}. Easements and reservations leave about ${developable.toLocaleString('en-US')} m² (${Math.round((developable / plot.areaM2) * 100)}%) of the plot developable. ${
      high.length
        ? `The ${high.map((k) => k.label).join(' and ')} is the material constraint and will weigh against sensitive uses.`
        : 'No high-severity constraint was recorded; the recorded constraints are manageable through design and NOCs.'
    } Permitted uses point to ${pl.permittedUses.slice(0, 3).join(', ').toLowerCase()} and related activities.`,
    [ids.gis, ids.plan, ids.aff],
  );

  return {
    identity,
    planning,
    controls,
    affection,
    constraints,
    restrictions: pl.restrictions.map((r) => sourced(r, [ids.plan])),
    metrics: { maxGfa, developable, maxFootprint, noBuild: Math.round(noBuild) },
    sourceIds: Object.values(ids),
    summary,
  };
}
