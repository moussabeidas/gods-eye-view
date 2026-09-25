// Represented source systems (BRD FR-010) and the evidence corpus used for
// retrieval-augmented generation. No live integration exists (FR-011): each
// record is a simulated extract carrying the source metadata of BRD §24.17.

import { PLOTS } from './plots.js';
import { getContext, POI_CATEGORIES } from './context.js';
import { HBU_CRITERIA, USE_CATALOGUE, SERVICE_BENCHMARKS, STRUCTURES } from './methodology.js';

export const SOURCE_SYSTEMS = {
  'DM-GIS': { name: 'Dubai Municipality — GIS Plot Register', owner: 'Dubai Municipality', type: 'Government (DM)', description: 'Plot identifiers, geometry, area, ownership and current use.' },
  'DM-PLAN': {
    name: 'Dubai Municipality — Planning & Zoning Regulations',
    owner: 'Dubai Municipality',
    type: 'Government (DM)',
    description: 'Zoning designations, permitted uses and development controls.',
  },
  'DM-AFF': {
    name: 'Dubai Municipality — Affection Plan (structured)',
    owner: 'Dubai Municipality',
    type: 'Government (DM)',
    description: 'Affection-map fields represented as structured records (AC-13).',
  },
  'DM-PARKS': { name: 'Dubai Municipality — Public Parks Register', owner: 'Dubai Municipality', type: 'Government (DM)', description: 'Public parks and open-space facilities.' },
  'DLD-TXN': { name: 'Dubai Land Department — Transactions Register', owner: 'Dubai Land Department', type: 'Government (DLD)', description: 'Registered sales and lease transactions.' },
  'RERA-RENT': { name: 'RERA — Rental Index & Benchmarks', owner: 'RERA (DLD)', type: 'Government (RERA)', description: 'Rental benchmarks by community and asset type.' },
  'DSC-POP': {
    name: 'Dubai Statistics Center — Population by Community',
    owner: 'Dubai Statistics Center',
    type: 'Approved public source',
    description: 'Population, households, age structure and segments.',
  },
  'RTA-NET': { name: 'RTA — Road & Transit Network', owner: 'Roads & Transport Authority', type: 'Approved public source', description: 'Road hierarchy, transit stations, stops and traffic counts.' },
  RTA: { name: 'RTA — Public Transport Stops', owner: 'Roads & Transport Authority', type: 'Approved public source', description: 'Bus stops and metro stations.' },
  KHDA: { name: 'KHDA — Private Schools Directory', owner: 'Knowledge & Human Development Authority', type: 'Approved public source', description: 'School capacity, enrolment, curriculum and fees.' },
  DHA: { name: 'DHA — Licensed Health Facilities', owner: 'Dubai Health Authority', type: 'Approved public source', description: 'Clinics, hospitals and pharmacies.' },
  'DET-LIC': {
    name: 'Dubai Economy & Tourism — Business Licence Register',
    owner: 'Dubai Economy & Tourism',
    type: 'Approved public source',
    description: 'Licensed commercial activities by category.',
  },
  'DET-TOUR': {
    name: 'Dubai Economy & Tourism — Hospitality Performance',
    owner: 'Dubai Economy & Tourism',
    type: 'Approved public source',
    description: 'Hotel supply, occupancy and ADR statistics.',
  },
  'DSC-SPORT': { name: 'Dubai Sports Council — Facility Register', owner: 'Dubai Sports Council', type: 'Approved public source', description: 'Sports and fitness facilities.' },
  IACAD: { name: 'IACAD — Mosque Register', owner: 'Islamic Affairs & Charitable Activities Dept.', type: 'Approved public source', description: 'Mosque locations.' },
  'TP-MARKET': {
    name: 'Approved third-party market research brief',
    owner: 'Approved third-party consultant',
    type: 'Approved third-party source',
    description: 'Vacancy, pipeline and revenue benchmarks.',
  },
  METHOD: {
    name: 'Prototype methodology register (predefined)',
    owner: 'Prototype configuration',
    type: 'Predefined methodology',
    description: 'HBU criteria and weights, service benchmarks, structuring rules and financial templates configured for the prototype (AC-04, AC-05).',
  },
};

const fmt = (n) => Math.round(n).toLocaleString('en-US');

function doc(plotNumber, sourceKey, recordId, fields) {
  return {
    id: `${sourceKey}:${recordId}`,
    plotNumber,
    sourceKey,
    sourceName: SOURCE_SYSTEMS[sourceKey].name,
    sourceType: SOURCE_SYSTEMS[sourceKey].type,
    recordId,
    simulated: true,
    ...fields,
  };
}

function buildPlotCorpus(plot) {
  const ctx = getContext(plot.plotNumber);
  const p = plot.plotNumber;
  const docs = [];
  const pl = plot.planning;

  docs.push(
    doc(p, 'DM-GIS', `PLOT-${p}`, {
      title: `Plot register extract — ${p}`,
      date: '2026-07-01',
      category: 'Plot & asset',
      relation: ['asset'],
      content: `Plot ${p} in ${plot.community} (community ${plot.communityCode}). Area ${fmt(plot.areaM2)} m². Shape: ${plot.physical.shape}. Frontage ${plot.physical.frontageM} m, depth ${plot.physical.depthM} m. Ownership: ${plot.ownership}. Current use: ${plot.currentUse}. Asset classification: ${plot.assetClassification}. ${plot.description} Access: ${plot.physical.access}. Utilities: ${plot.physical.utilities}. Topography: ${plot.physical.topography}.`,
      citation: `DM GIS Plot Register, record PLOT-${p} (simulated extract, 1 Jul 2026)`,
    }),
    doc(p, 'DM-PLAN', `ZONE-${p}`, {
      title: `Zoning & development controls — ${p}`,
      date: '2026-01-15',
      category: 'Planning & zoning',
      relation: ['asset', 'hbu'],
      content: `Zoning ${pl.zoningCode} (${pl.zoningName}). Permitted uses: ${pl.permittedUses.join(', ')}. Conditional uses: ${pl.conditionalUses.join(', ')}. Prohibited uses: ${pl.prohibitedUses.join(', ')}. Development controls: FAR ${pl.controls.far}, maximum height ${pl.controls.maxHeightM} m (${pl.controls.maxFloors}), plot coverage ${Math.round(pl.controls.plotCoverage * 100)}%, setbacks ${pl.controls.setbacks}, parking ${pl.controls.parking}. Planning restrictions: ${pl.restrictions.join('; ')}.`,
      citation: `DM Planning & Zoning Regulations, zoning record ZONE-${p} (simulated)`,
    }),
    doc(p, 'DM-AFF', plot.affection.affectionPlanNo, {
      title: `Affection plan ${plot.affection.affectionPlanNo}`,
      date: plot.affection.issueDate,
      category: 'Affection map',
      relation: ['asset', 'hbu', 'structuring'],
      content: `Affection plan ${plot.affection.affectionPlanNo} issued ${plot.affection.issueDate}. Land use code ${plot.affection.landUseCode}. Road reservation: ${plot.affection.roadReservation}. Easements: ${plot.affection.easements.join('; ')}. Utilities: ${plot.affection.utilitiesNotes}. Notes: ${plot.affection.notes} Constraints: ${plot.constraints.map((c) => `${c.label} (${c.severity} severity) — ${c.description}`).join(' ')}`,
      citation: `DM Affection Plan ${plot.affection.affectionPlanNo}, structured fields (simulated)`,
    }),
  );

  for (const c of ctx.communities) {
    docs.push(
      doc(p, 'DSC-POP', `POP-${c.id}`, {
        title: `Population profile — ${c.name}`,
        date: '2026-03-31',
        category: 'Demographics',
        relation: ['location', 'supply-demand'],
        content: `${c.name}: population ${fmt(c.population)}, area ${c.areaKm2} km², density ${fmt(c.density)} per km², annual growth ${c.growthPct}%. Households ${fmt(c.households)}, average household size ${c.householdSize}. Age groups: ${Object.entries(
          c.ageGroups,
        )
          .map(([k, v]) => `${k}: ${v}%`)
          .join(', ')}. Segments: ${Object.entries(c.segments)
          .map(([k, v]) => `${k} ${v}%`)
          .join(', ')}. Income band: ${c.incomeBand}.${c.daytimeWorkers ? ` Daytime workers: ${fmt(c.daytimeWorkers)}.` : ''} Centroid ${fmt(c.distanceM)} m from plot ${p}.`,
        citation: `Dubai Statistics Center, community population table 2026 Q1 — ${c.name} (simulated)`,
      }),
    );
  }

  const byCat = {};
  for (const poi of ctx.pois) (byCat[poi.category] ??= []).push(poi);
  for (const [cat, list] of Object.entries(byCat)) {
    const src = list[0].source === 'RTA' ? 'RTA' : list[0].source;
    const label = POI_CATEGORIES[cat]?.label ?? cat;
    docs.push(
      doc(p, src, `${cat.toUpperCase()}-${p}`, {
        title: `${label} facilities within catchment of ${p}`,
        date: '2026-06-30',
        category: 'Commercial & community activity',
        relation: ['location', 'supply-demand', 'comparables'],
        content: `${list.length} ${label.toLowerCase()} facilities recorded within ${fmt(plot.catchmentRadiusM)} m of plot ${p}: ${list
          .map((x) => {
            const attrs = [
              x.gla && `GLA ${fmt(x.gla)} m²`,
              x.capacity && `capacity ${fmt(x.capacity)}, enrolled ${fmt(x.enrolled)}${x.curriculum ? `, ${x.curriculum}` : ''}`,
              x.rooms && `${x.rooms} consultation rooms`,
              x.keys && `${x.keys} keys${x.stars ? `, ${x.stars}★` : ''}`,
              x.nla && `NLA ${fmt(x.nla)} m²`,
              x.area && `${fmt(x.area)} m²`,
            ].filter(Boolean);
            return `${x.name} (${fmt(x.distanceM)} m${attrs.length ? `; ${attrs.join('; ')}` : ''})`;
          })
          .join('; ')}.`,
        citation: `${SOURCE_SYSTEMS[src].name}, extract ${cat.toUpperCase()}-${p} (simulated, 30 Jun 2026)`,
      }),
    );
  }

  const roads = ctx.roads.filter((r) => r.nearestM < 1600);
  docs.push(
    doc(p, 'RTA-NET', `ACCESS-${p}`, {
      title: `Road & transit accessibility — ${p}`,
      date: '2026-05-31',
      category: 'Infrastructure & accessibility',
      relation: ['location', 'hbu'],
      content: `Road network near plot ${p}: ${roads.map((r) => `${r.name} (${r.cls}, ${r.lanes} lanes, ${fmt(r.nearestM)} m)`).join('; ')}. ${ctx.metro ? `Metro: ${ctx.metro.stations.map((s) => s.name).join(', ')} on the ${ctx.metro.name}; nearest station ${fmt(ctx.pois.find((x) => x.category === 'metro').distanceM)} m.` : 'No metro station within 2.5 km; bus services only.'} ${ctx.market.footfall.label}: ${fmt(ctx.market.footfall.value)} ${ctx.market.footfall.unit}.`,
      citation: `RTA road & transit network extract ACCESS-${p} (simulated)`,
    }),
  );

  for (const [key, b] of Object.entries(ctx.market.benchmarks)) {
    docs.push(
      doc(p, b.source, `${key.toUpperCase()}-${p}`, {
        title: `${b.label} — ${plot.community} catchment`,
        date: '2026-06-30',
        category: 'Market benchmark',
        relation: ['location', 'hbu', 'financial'],
        content: `${b.label}: ${fmt(b.value)} ${b.unit}${b.range ? ` (range ${fmt(b.range[0])}–${fmt(b.range[1])})` : ''}${b.yoyPct != null ? `, year-on-year change ${b.yoyPct > 0 ? '+' : ''}${b.yoyPct}%` : ''}. Applies to the ${plot.community} catchment around plot ${p}.`,
        citation: `${SOURCE_SYSTEMS[b.source].name}, ${b.label} 2026 Q2 (simulated)`,
      }),
    );
  }
  const idx = ctx.market.priceIndex;
  docs.push(
    doc(p, idx.source, `INDEX-${p}`, {
      title: idx.label,
      date: '2026-06-30',
      category: 'Market trend',
      relation: ['location'],
      content: `${idx.label}, quarterly from ${idx.start}: ${idx.series.join(', ')}. Latest ${idx.series.at(-1)}, change over ${idx.series.length - 1} quarters ${Math.round(idx.series.at(-1) - 100)}%.`,
      citation: `${SOURCE_SYSTEMS[idx.source].name}, ${idx.label} (simulated)`,
    }),
  );
  if (ctx.market.visitors) {
    const v = ctx.market.visitors;
    docs.push(
      doc(p, v.source, `VISITORS-${p}`, {
        title: v.label,
        date: '2026-06-30',
        category: 'Market demand',
        relation: ['location', 'supply-demand'],
        content: `${v.label}: ${v.value} ${v.unit}, growing ${v.growthPct}% a year.`,
        citation: `${SOURCE_SYSTEMS[v.source].name}, visitor statistics (simulated)`,
      }),
    );
  }

  for (const t of ctx.transactions) {
    docs.push(
      doc(p, 'DLD-TXN', t.id, {
        title: `${t.type}: ${t.property}, ${t.date}`,
        date: t.date,
        category: 'Transactions',
        relation: ['location', 'comparables'],
        content: `DLD transaction ${t.id} on ${t.date}: ${t.type} of ${t.property.toLowerCase()}, ${fmt(t.areaM2)} m², value AED ${fmt(t.valueAed)} (AED ${fmt(t.aedPerM2)}/m²). Located ${fmt(t.distanceM)} m from plot ${p}.`,
        citation: `Dubai Land Department transaction ${t.id} (simulated)`,
      }),
    );
  }

  for (const c of ctx.comparables) {
    docs.push(
      doc(p, 'DM-GIS', `COMP-${c.plotNumber}`, {
        title: `Comparable plot ${c.plotNumber} — ${c.community}`,
        date: '2026-06-30',
        category: 'Comparables',
        relation: ['comparables', 'hbu'],
        content: `Plot ${c.plotNumber} in ${c.community}, ${fmt(c.areaM2)} m², zoning ${c.zoning}, FAR ${c.far}. Land use: ${c.landUse}. Status: ${c.status}. Performance: ${c.performance}. Indicative value AED ${fmt(c.valueAedM2)}/m². Activity mix: ${c.activityMix}. Distance from ${p}: ${(c.distanceM / 1000).toFixed(1)} km.`,
        citation: `DM GIS register and DLD records for plot ${c.plotNumber} (simulated)`,
      }),
    );
  }
  return docs;
}

function buildMethodologyCorpus() {
  const docs = [];
  docs.push(
    doc(null, 'METHOD', 'HBU-FRAMEWORK', {
      title: 'Highest & Best Use scoring framework (prototype)',
      date: '2026-08-01',
      category: 'Methodology',
      relation: ['hbu'],
      content: `Alternative uses are screened for legal permissibility against zoning, then scored 0–10 on each criterion and weighted to an overall score out of 100. Criteria and weights: ${HBU_CRITERIA.map((c) => `${c.label} ${c.weight}% — ${c.description}`).join('; ')}. The four HBU tests are applied in order: legally permissible, physically possible, financially feasible, maximally productive.`,
      citation: 'Prototype methodology register — HBU framework v1 (predefined, illustrative)',
    }),
    doc(null, 'METHOD', 'SERVICE-BENCHMARKS', {
      title: 'Service provision benchmarks for supply-demand analysis',
      date: '2026-08-01',
      category: 'Methodology',
      relation: ['supply-demand'],
      content: `Demand is estimated from resident, worker or visitor population using per-capita provision benchmarks and compared with recorded supply. Benchmarks: ${Object.values(SERVICE_BENCHMARKS)
        .map((b) => `${b.label}: ${b.benchmarkText}`)
        .join('; ')}. Gap index = (demand − supply) ÷ demand. A positive index means unmet demand.`,
      citation: 'Prototype methodology register — service benchmarks v1 (predefined, illustrative)',
    }),
    doc(null, 'METHOD', 'STRUCTURING-RULES', {
      title: 'Investment structuring rules (prototype)',
      date: '2026-08-01',
      category: 'Methodology',
      relation: ['structuring'],
      content: `Structures considered: ${STRUCTURES.map((s) => `${s.name} — ${s.summary} Typical term ${s.termYears}.`).join(' ')} Structures are screened for applicability using predefined rules. Applicable structures are then scored on capital efficiency for DM, risk transfer, value capture, public-service control, market appetite and term fit.`,
      citation: 'Prototype methodology register — structuring rules v1 (predefined, illustrative)',
    }),
    doc(null, 'METHOD', 'FINANCIAL-MODEL', {
      title: 'Preliminary financial model conventions',
      date: '2026-08-01',
      category: 'Methodology',
      relation: ['financial'],
      content:
        'Annual project-level cash flows. Construction CAPEX is spread evenly over the construction period. Revenue = units × price × utilisation, ramping linearly to stabilised utilisation and escalating annually. OPEX is a percentage of revenue. Residual value at the end of the horizon = final-year NOI ÷ exit capitalisation rate. NPV is discounted at the stated discount rate. IRR is the rate at which NPV = 0. ROI = (total net cash inflows − total CAPEX) ÷ total CAPEX. Payback = years until cumulative cash flow turns positive. All assumptions are illustrative dummy values (AC-06, AC-07).',
      citation: 'Prototype methodology register — financial model v1 (predefined, illustrative)',
    }),
  );
  for (const u of Object.values(USE_CATALOGUE).filter((x) => x.finance)) {
    docs.push(
      doc(null, 'METHOD', `USE-${u.id}`, {
        title: `Use profile — ${u.name}`,
        date: '2026-08-01',
        category: 'Methodology',
        relation: ['hbu', 'financial'],
        content: `${u.name} (${u.category}). ${u.description} Revenue model: ${u.finance.unitLabel} at ${u.finance.priceLabel}. Stabilised utilisation ${Math.round(u.finance.utilisation * 100)}%, OPEX ${Math.round(u.finance.opexRatio * 100)}% of revenue, construction cost AED ${fmt(u.finance.capexPerM2)}/m² GFA, ${u.finance.constructionYears}-year build. Sensitive constraints: ${Object.keys(u.constraintSensitivity).join(', ') || 'none'}.`,
        citation: `Prototype methodology register — use profile ${u.id} (predefined, illustrative)`,
      }),
    );
  }
  return docs;
}

let corpus = null;

/** Every evidence record across both plots plus the methodology register. */
export function getCorpus() {
  if (!corpus) corpus = [...PLOTS.flatMap(buildPlotCorpus), ...buildMethodologyCorpus()];
  return corpus;
}

/** Evidence records relevant to one plot (its own records and shared methodology). */
export function getPlotCorpus(plotNumber) {
  return getCorpus().filter((d) => d.plotNumber === plotNumber || d.plotNumber === null);
}

export function getDoc(id) {
  return getCorpus().find((d) => d.id === id) ?? null;
}
