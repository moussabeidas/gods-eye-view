// Interactive investment map (BRD §7.1, FR-002/003, FR-014 – FR-018, FR-023).
// The basemap is drawn from real open map data (OpenStreetMap via Overture
// Maps): community boundaries, roads, Dubai Metro, water, land use and 3D
// building footprints, so it works without any tile service. Imagery and
// street tiles are optional overlays.

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { POI_CATEGORIES, getContext } from '../data/context.js';
import { getRegion, getArea, AREA_KEYS } from '../data/geo/index.js';
import { circle, bounds, distanceM } from '../engine/geo.js';
import { esc, num } from './format.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const fc = (features) => ({ type: 'FeatureCollection', features });
const poly = (rings, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: rings } });
const multiPoly = (polygons, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'MultiPolygon', coordinates: polygons } });
const line = (coords, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: coords } });
const multiLine = (lines, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'MultiLineString', coordinates: lines } });
const point = (coord, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: coord } });

export const LAYER_GROUPS = [
  {
    id: 'context',
    label: 'Communities, roads & Metro',
    layers: ['communities-line', 'neighbourhoods-line', 'catchment-communities', 'roads-minor-casing', 'roads-minor', 'roads-major-casing', 'roads-major', 'rail', 'rail-planned', 'stations'],
    on: true,
  },
  { id: 'landuse', label: 'Land use (open map data)', layers: ['landuse-fill', 'landuse-line'], on: true },
  { id: 'buildings', label: 'Buildings (3D footprints)', layers: ['buildings-3d'], on: true },
  { id: 'constraints', label: 'Plot constraints (affection plan)', layers: ['constraints-fill', 'constraints-line'], on: true },
  { id: 'catchment', label: 'Catchment rings', layers: ['catchment'], on: false },
  { id: 'commercial', label: 'Commercial activity', layers: ['poi-commercial'], on: false },
  { id: 'community', label: 'Community services', layers: ['poi-community'], on: false },
  { id: 'infrastructure', label: 'Transport & infrastructure', layers: ['poi-infrastructure'], on: false },
  { id: 'comparables', label: 'Comparable plots', layers: ['comparables-fill', 'comparables-line'], on: false },
  { id: 'transactions', label: 'DLD transactions', layers: ['transactions'], on: false },
];

/** Land-use classes and their colours, in the manner of a planning map. */
export const LANDUSE_STYLE = {
  residential: { label: 'Residential', color: '#6b5a24' },
  commercial: { label: 'Commercial', color: '#7a3348' },
  industrial: { label: 'Industrial', color: '#4f3b73' },
  education: { label: 'Education', color: '#24557d' },
  medical: { label: 'Healthcare', color: '#7a2f2f' },
  religious: { label: 'Religious', color: '#55555c' },
  park: { label: 'Park & open space', color: '#2c5a34' },
  green: { label: 'Landscaping', color: '#264a2d' },
  sport: { label: 'Sports ground', color: '#35613a' },
  golf: { label: 'Golf', color: '#2f6b3a' },
  leisure: { label: 'Leisure & waterfront', color: '#22595a' },
  plaza: { label: 'Plaza', color: '#474d57' },
  cemetery: { label: 'Cemetery', color: '#3a473a' },
  vacant: { label: 'Vacant / under construction', color: '#7a6a45' },
};

export const METRO_COLORS = { red: '#e0393e', green: '#2fb36b', blue: '#3b8fe0' };

const BASEMAPS = {
  vector: { label: 'Open data' },
  imagery: { label: 'Imagery', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  streets: {
    label: 'Streets',
    tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors © CARTO',
  },
};
export const BASEMAP_LABELS = Object.fromEntries(Object.entries(BASEMAPS).map(([k, v]) => [k, v.label]));

const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · <a href="https://overturemaps.org" target="_blank" rel="noopener">Overture Maps</a>';
const MAJOR_WIDTH = { motorway: [2.2, 12], trunk: [2, 10], primary: [1.6, 8], secondary: [1.1, 6] };
const MINOR_WIDTH = { tertiary: [0.7, 5], residential: [0.4, 3.2], unclassified: [0.4, 3.2], living_street: [0.3, 2.6], service: [0.2, 1.8] };
const widthExpr = (table, scale = 1) => [
  'interpolate',
  ['exponential', 1.6],
  ['zoom'],
  11,
  ['match', ['get', 'cls'], ...Object.entries(table).flatMap(([k, [lo]]) => [k, lo * scale]), 0.5 * scale],
  16.5,
  ['match', ['get', 'cls'], ...Object.entries(table).flatMap(([k, [, hi]]) => [k, hi * scale]), 2 * scale],
];

export class InvestmentMap {
  constructor(container, { onSelectPlot } = {}) {
    this.visible = Object.fromEntries(LAYER_GROUPS.map((g) => [g.id, g.on]));
    this.basemap = 'vector';
    this.markers = [];
    this.onSelectPlot = onSelectPlot;
    this.ready = new Promise((resolve) => (this._resolveReady = resolve));
    try {
      this.map = new maplibregl.Map({
        container,
        style: this.style(),
        center: [55.37, 25.205],
        zoom: 12,
        pitch: 0,
        attributionControl: { compact: true, customAttribution: ATTRIBUTION },
        maxPitch: 70,
      });
    } catch (error) {
      container.innerHTML = `<div class="map-fallback">The interactive map needs WebGL, which is unavailable in this browser. The analysis dashboards still work.</div>`;
      this.map = null;
      this._resolveReady();
      return;
    }
    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    this.map.on('load', () => {
      this.map.setPadding(this.padding());
      this.addLayers();
      this._resolveReady();
    });
    this.map.on('zoom', () => this.updateLabelZoom());
    if (import.meta.env.DEV) window.__investmentMap = this;
    this.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px', className: 'map-popup' });
  }

  style() {
    const sources = {};
    const layers = [{ id: 'background', type: 'background', paint: { 'background-color': '#10151c' } }];
    for (const [id, b] of Object.entries(BASEMAPS)) {
      if (!b.tiles) continue;
      sources[`base-${id}`] = { type: 'raster', tiles: b.tiles, tileSize: 256, attribution: b.attribution, maxzoom: 19 };
      layers.push({ id: `base-${id}`, type: 'raster', source: `base-${id}`, layout: { visibility: 'none' }, paint: { 'raster-opacity': id === 'imagery' ? 0.85 : 1 } });
    }
    return { version: 8, sources, layers };
  }

  addLayers() {
    const m = this.map;
    const region = getRegion();
    const areas = AREA_KEYS.map(getArea);

    // Static open-data layers.
    m.addSource('water', { type: 'geojson', data: fc(region.water.map((w) => multiPoly(w.polygons, { kind: 'water', name: w.name }))) });
    m.addSource('airport', { type: 'geojson', data: fc(region.airport.filter((a) => a.polygons).map((a) => multiPoly(a.polygons, { cls: a.cls }))) });
    m.addSource('runways', { type: 'geojson', data: fc(region.airport.filter((a) => a.lines).map((a) => multiLine(a.lines))) });
    m.addSource('communities', {
      type: 'geojson',
      data: fc(region.communities.map((c) => multiPoly(c.polygons, { kind: 'area', name: c.name, ar: c.ar ?? '', macro: c.macro, km2: c.areaKm2 }))),
    });
    m.addSource('landuse', {
      type: 'geojson',
      data: fc(areas.flatMap((a) => a.landuse.map((l) => multiPoly(l.polygons, { kind: 'landuse', cls: l.cls, name: l.name ?? '', color: LANDUSE_STYLE[l.cls]?.color ?? '#333' })))),
    });
    m.addSource('roads-major', { type: 'geojson', data: fc(region.roads.map((r) => multiLine(r.lines, { kind: 'road', cls: r.cls, name: r.name ?? '', ar: r.ar ?? '' }))) });
    m.addSource('roads-minor', { type: 'geojson', data: fc(areas.flatMap((a) => a.roads.map((r) => multiLine(r.lines, { kind: 'road', cls: r.cls, name: r.name ?? '', ar: r.ar ?? '' })))) });
    m.addSource('rail', { type: 'geojson', data: fc(region.rail.map((r) => multiLine(r.lines, { line: r.line, status: r.status, color: METRO_COLORS[r.line] }))) });
    m.addSource('stations', {
      type: 'geojson',
      data: fc(region.stations.map((s) => point(s.coord, { kind: 'station', name: s.name, ar: s.ar ?? '', line: s.line, status: s.status, color: METRO_COLORS[s.line] }))),
    });
    m.addSource('buildings', {
      type: 'geojson',
      data: fc(areas.flatMap((a) => a.buildings.map((b) => poly([b.ring], { kind: 'building', h: b.h, estimated: b.estimated })))),
    });
    // Plot-specific layers.
    for (const s of ['catchment-communities', 'plot', 'constraints', 'catchment', 'pois', 'comparables', 'transactions', 'plots-all']) m.addSource(s, { type: 'geojson', data: EMPTY });

    const fadeIn = (z0, z1, to = 1) => ['interpolate', ['linear'], ['zoom'], z0, 0, z1, to];
    m.addLayer({ id: 'landuse-fill', type: 'fill', source: 'landuse', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': fadeIn(12.8, 14, 0.5) } });
    m.addLayer({
      id: 'landuse-line',
      type: 'line',
      source: 'landuse',
      filter: ['==', ['get', 'cls'], 'vacant'],
      paint: { 'line-color': '#b39a62', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': fadeIn(12.5, 14, 0.8) },
    });
    m.addLayer({ id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': '#12324a' } });
    m.addLayer({ id: 'airport', type: 'fill', source: 'airport', paint: { 'fill-color': '#1b222d', 'fill-opacity': 0.9 } });
    m.addLayer({ id: 'runways', type: 'line', source: 'runways', paint: { 'line-color': '#3b4757', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 22] } });
    m.addLayer({ id: 'catchment-communities', type: 'fill', source: 'catchment-communities', paint: { 'fill-color': ['case', ['get', 'host'], '#2a4a6e', '#1d2d40'], 'fill-opacity': 0.28 } });
    m.addLayer({ id: 'communities-line', type: 'line', source: 'communities', filter: ['get', 'macro'], paint: { 'line-color': '#55687f', 'line-width': 1.2, 'line-dasharray': [4, 2] } });
    m.addLayer({
      id: 'neighbourhoods-line',
      type: 'line',
      source: 'communities',
      minzoom: 13,
      filter: ['!', ['get', 'macro']],
      paint: { 'line-color': '#3f4d60', 'line-width': 0.9, 'line-dasharray': [2, 2] },
    });
    m.addLayer({ id: 'catchment', type: 'line', source: 'catchment', layout: { visibility: 'none' }, paint: { 'line-color': '#7c8ea5', 'line-width': 1.2, 'line-dasharray': [2, 2] } });
    const roadLayers = (id, source, table, color) => {
      m.addLayer({
        id: `${id}-casing`,
        type: 'line',
        source,
        minzoom: source === 'roads-minor' ? 12 : 0,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0b0f14', 'line-width': widthExpr(table, 1.6), 'line-opacity': source === 'roads-minor' ? fadeIn(12, 13) : 1 },
      });
      m.addLayer({
        id,
        type: 'line',
        source,
        minzoom: source === 'roads-minor' ? 12 : 0,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': widthExpr(table), 'line-opacity': source === 'roads-minor' ? fadeIn(12, 13) : 1 },
      });
    };
    roadLayers('roads-minor', 'roads-minor', MINOR_WIDTH, ['match', ['get', 'cls'], 'tertiary', '#5b6b80', 'service', '#333e4c', '#46536a']);
    roadLayers('roads-major', 'roads-major', MAJOR_WIDTH, ['match', ['get', 'cls'], 'motorway', '#c08f45', 'trunk', '#b08545', 'primary', '#8e9db3', '#708199']);
    const railWidth = ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 5];
    m.addLayer({
      id: 'rail',
      type: 'line',
      source: 'rail',
      filter: ['==', ['get', 'status'], 'operational'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': railWidth },
    });
    m.addLayer({
      id: 'rail-planned',
      type: 'line',
      source: 'rail',
      filter: ['==', ['get', 'status'], 'construction'],
      paint: { 'line-color': ['get', 'color'], 'line-width': railWidth, 'line-opacity': 0.8, 'line-dasharray': [2, 1.5] },
    });
    m.addLayer({
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: 'buildings',
      minzoom: 13.5,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'h'], 4, '#27313f', 20, '#2f3b4d', 60, '#3a4a61'],
        'fill-extrusion-height': ['get', 'h'],
        'fill-extrusion-opacity': 0.82,
      },
    });
    m.addLayer({
      id: 'stations',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 16, 8],
        'circle-color': ['case', ['==', ['get', 'status'], 'construction'], '#10151c', ['get', 'color']],
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2.5,
      },
    });
    m.addLayer({
      id: 'comparables-fill',
      type: 'fill',
      source: 'comparables',
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#eda100', 'fill-opacity': ['case', ['get', 'selected'], 0.35, 0.12] },
    });
    m.addLayer({
      id: 'comparables-line',
      type: 'line',
      source: 'comparables',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#eda100', 'line-width': ['case', ['get', 'selected'], 2.2, 1], 'line-opacity': ['case', ['get', 'selected'], 1, 0.5] },
    });
    m.addLayer({ id: 'plots-all', type: 'fill', source: 'plots-all', paint: { 'fill-color': '#3987e5', 'fill-opacity': 0.45 } });
    m.addLayer({ id: 'plots-all-line', type: 'line', source: 'plots-all', paint: { 'line-color': '#9ccbff', 'line-width': 2 } });
    m.addLayer({ id: 'plot-glow', type: 'line', source: 'plot', paint: { 'line-color': '#58a6ff', 'line-width': 10, 'line-blur': 8, 'line-opacity': 0.7 } });
    m.addLayer({ id: 'plot-fill', type: 'fill', source: 'plot', paint: { 'fill-color': '#3987e5', 'fill-opacity': 0.28 } });
    m.addLayer({ id: 'plot-3d', type: 'fill-extrusion', source: 'plot', paint: { 'fill-extrusion-color': '#58a6ff', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.28 } });
    m.addLayer({ id: 'plot-line', type: 'line', source: 'plot', paint: { 'line-color': '#9ccbff', 'line-width': 2.5 } });
    m.addLayer({
      id: 'constraints-fill',
      type: 'fill',
      source: 'constraints',
      paint: { 'fill-color': ['match', ['get', 'severity'], 'high', '#e66767', 'medium', '#d95926', '#c98500'], 'fill-opacity': 0.5 },
    });
    m.addLayer({
      id: 'constraints-line',
      type: 'line',
      source: 'constraints',
      paint: { 'line-color': ['match', ['get', 'severity'], 'high', '#e66767', 'medium', '#d95926', '#c98500'], 'line-width': 1.5, 'line-dasharray': [1, 1] },
    });
    for (const g of ['commercial', 'community', 'infrastructure']) {
      m.addLayer({
        id: `poi-${g}`,
        type: 'circle',
        source: 'pois',
        filter: ['==', ['get', 'group'], g],
        layout: { visibility: 'none' },
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 7], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#0c1016', 'circle-stroke-width': 1.5 },
      });
    }
    m.addLayer({
      id: 'transactions',
      type: 'circle',
      source: 'transactions',
      layout: { visibility: 'none' },
      paint: { 'circle-radius': 7, 'circle-color': '#e87ba4', 'circle-stroke-color': '#0c1016', 'circle-stroke-width': 2 },
    });

    // Most specific first: the first feature under the pointer opens its card.
    const clickable = [
      'poi-commercial',
      'poi-community',
      'poi-infrastructure',
      'transactions',
      'stations',
      'plots-all',
      'plot-fill',
      'constraints-fill',
      'comparables-fill',
      'buildings-3d',
      'roads-major',
      'roads-minor',
      'landuse-fill',
      'catchment-communities',
      'water',
    ];
    m.on('click', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: clickable.filter((l) => m.getLayer(l)) })[0];
      if (!f) return;
      if (f.layer.id === 'plots-all' && this.onSelectPlot) return this.onSelectPlot(f.properties.plotNumber);
      this.popup.setLngLat(e.lngLat).setHTML(popupHtml(f)).addTo(m);
    });
    for (const l of ['poi-commercial', 'poi-community', 'poi-infrastructure', 'transactions', 'stations', 'plots-all', 'plot-fill', 'constraints-fill', 'comparables-fill']) {
      m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', l, () => (m.getCanvas().style.cursor = ''));
    }
  }

  /** Demographic catchment communities for the selected plot (or plots). */
  setCatchment(entries) {
    this.map.getSource('catchment-communities').setData(
      fc(
        entries.flatMap(({ ctx }) =>
          ctx.communities.map((c) =>
            multiPoly(c.polygons, {
              kind: 'community',
              host: c.host,
              name: c.name,
              population: c.population,
              growth: c.growthPct,
              density: c.density,
              share: Math.round(c.catchmentShare * 100),
              source: `DSC-POP:POP-${c.id}`,
            }),
          ),
        ),
      ),
    );
  }

  /** Homepage view: both prototype plots in their real city context. */
  async showOverview(plots) {
    await this.ready;
    if (!this.map) return;
    this.plot = null;
    this.ctx = null;
    const entries = plots.map((plot) => ({ plot, ctx: getContext(plot.plotNumber) }));
    this.setCatchment(entries.map(({ plot, ctx }) => ({ plot, ctx: { communities: ctx.communities.filter((c) => c.host) } })));
    for (const id of ['plot', 'constraints', 'catchment', 'pois', 'comparables', 'transactions']) this.map.getSource(id).setData(EMPTY);
    for (const g of LAYER_GROUPS) this.setGroup(g.id, ['context', 'landuse', 'buildings'].includes(g.id));
    this.map.getSource('plots-all').setData(fc(plots.map((p) => poly([p.geometry], { plotNumber: p.plotNumber }))));
    this.map.setPadding(this.padding());
    this.clearMarkers();
    const view = bounds(plots.flatMap((p) => circle(p.center, 3200, 12)));
    this.addCommunityLabels((c) => c.macro && inBounds(c.labelPoint, view), 1300);
    for (const s of getRegion().stations.filter((s) => inBounds(s.coord, view))) this.addStationLabel(s, true);
    for (const p of plots) {
      const el = document.createElement('button');
      el.className = 'map-label map-label-plot map-label-pick';
      el.innerHTML = `<b>Plot ${esc(p.plotNumber)}</b><span>${esc(p.community)}</span>`;
      el.addEventListener('click', () => this.onSelectPlot?.(p.plotNumber));
      this.addMarker(p.center, el, 'bottom', [0, -10]);
    }
    this.map.fitBounds(view, { padding: 30, duration: 900, pitch: 0, bearing: 0, maxZoom: 13 });
  }

  async setPlot(plot, ctx) {
    await this.ready;
    if (!this.map) return;
    const m = this.map;
    this.plot = plot;
    this.ctx = ctx;
    m.setPadding(this.padding());
    m.getSource('plots-all').setData(EMPTY);
    this.setCatchment([{ plot, ctx }]);
    m.getSource('plot').setData(
      fc([
        poly([plot.geometry], {
          kind: 'plot',
          plotNumber: plot.plotNumber,
          h: plot.planning.controls.maxHeightM,
          area: plot.areaM2,
          zoning: plot.planning.zoningCode,
          source: `DM-GIS:PLOT-${plot.plotNumber}`,
        }),
      ]),
    );
    m.getSource('constraints').setData(
      fc(
        plot.constraints
          .filter((c) => c.geometry)
          .map((c) => poly([c.geometry], { kind: 'constraint', label: c.label, severity: c.severity, description: c.description, source: `DM-AFF:${plot.affection.affectionPlanNo}` })),
      ),
    );
    m.getSource('catchment').setData(fc([1000, plot.catchmentRadiusM].map((r) => line(circle(plot.center, r), { r }))));
    m.getSource('pois').setData(
      fc(
        ctx.pois
          .filter((x) => x.category !== 'metro')
          .map((x) =>
            point(x.coord, {
              kind: 'poi',
              name: x.name,
              category: x.category,
              placeType: x.placeType ?? '',
              label: POI_CATEGORIES[x.category]?.label,
              group: POI_CATEGORIES[x.category]?.group,
              color: POI_CATEGORIES[x.category]?.color,
              distance: x.distanceM,
              detail: [
                x.tier,
                x.gla && `GLA ${num(x.gla)} m²`,
                x.capacity && `Capacity ${num(x.capacity)} · enrolled ${num(x.enrolled)}`,
                x.keys && `${x.keys} keys`,
                x.rooms && `${x.rooms} consultation rooms`,
                x.nla && `NLA ${num(x.nla)} m²`,
                x.area && `${num(x.area)} m²`,
              ]
                .filter(Boolean)
                .join(' · '),
              source: `${x.source}:${x.category.toUpperCase()}-${plot.plotNumber}`,
            }),
          ),
      ),
    );
    m.getSource('transactions').setData(
      fc(
        ctx.transactions.map((t) =>
          point(t.coord, {
            kind: 'txn',
            id: t.id,
            date: t.date,
            type: t.type,
            property: t.property,
            community: t.community,
            value: t.valueAed,
            area: t.areaM2,
            rate: t.aedPerM2,
            source: `DLD-TXN:${t.id}`,
          }),
        ),
      ),
    );
    this.setComparables(null);

    this.clearMarkers();
    const el = document.createElement('div');
    el.className = 'map-label map-label-plot';
    el.innerHTML = `<b>Plot ${esc(plot.plotNumber)}</b><span>${esc(plot.planning.zoningCode)} · ${num(plot.areaM2)} m²</span>`;
    this.addMarker(plot.center, el, 'bottom', [0, -26]);
    const R = plot.catchmentRadiusM;
    const names = new Set(ctx.communities.map((c) => c.name));
    this.addCommunityLabels((c) => names.has(c.name) || (!c.macro && distanceM(plot.center, c.labelPoint) < R * 0.8), 700);
    for (const s of ctx.stations) this.addStationLabel(s, false);
    this.focusPlot();
  }

  /** Decluttered HTML labels for real community names (no glyph server needed). */
  addCommunityLabels(filter, minGapM) {
    const placed = [];
    const list = getRegion()
      .communities.filter(filter)
      .sort((a, b) => b.macro - a.macro || b.areaKm2 - a.areaKm2);
    for (const c of list) {
      if (placed.some((p) => distanceM(p, c.labelPoint) < minGapM)) continue;
      placed.push(c.labelPoint);
      const el = document.createElement('div');
      el.className = `map-label map-label-community${c.macro ? '' : ' map-label-minor'}`;
      el.textContent = c.name;
      this.addMarker(c.labelPoint, el, 'center');
    }
    this.updateLabelZoom();
  }

  addStationLabel(s, compact) {
    const el = document.createElement('div');
    el.className = `map-label map-label-station${compact ? ' map-label-minor' : ''}`;
    el.style.setProperty('--c', METRO_COLORS[s.line]);
    const name = s.name.replace(/ Metro Station$/, '');
    el.innerHTML = `<i></i>${esc(name)}${s.status === 'construction' ? ' <em>(u/c)</em>' : ''}`;
    this.addMarker(s.coord, el, 'left', [8, 0]);
  }

  /** Hide minor labels at city scale so the overview stays legible. */
  updateLabelZoom() {
    const c = this.map?.getContainer();
    if (c) c.classList.toggle('map-zoomed-out', this.map.getZoom() < 12.6);
  }

  setComparables(comparables) {
    if (!this.map || !this.ctx) return;
    const list = comparables ?? this.ctx.comparables.map((c) => ({ ...c, selected: false, score: null }));
    this.map.getSource('comparables').setData(
      fc(
        list.map((c) =>
          poly([c.ring], {
            kind: 'comparable',
            plotNumber: c.plotNumber,
            community: c.community,
            landUse: c.landUse,
            score: c.score,
            selected: !!c.selected,
            performance: c.performance,
            reasons: (c.reasons ?? []).join(', '),
            source: `DM-GIS:COMP-${c.plotNumber}`,
          }),
        ),
      ),
    );
    this.compMarkers?.forEach((mk) => mk.remove());
    this.compMarkers = [];
    if (comparables && this.visible.comparables) {
      for (const c of comparables.filter((x) => x.selected)) {
        const el = document.createElement('div');
        el.className = 'map-label map-label-comp';
        el.innerHTML = `<b>${esc(c.plotNumber)}</b><span>${c.score}/100</span>`;
        this.compMarkers.push(new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -8] }).setLngLat(c.coord).addTo(this.map));
      }
    }
    this.comparablesData = comparables;
  }

  addMarker(coord, el, anchor = 'center', offset = [0, 0]) {
    this.markers.push(new maplibregl.Marker({ element: el, anchor, offset }).setLngLat(coord).addTo(this.map));
  }

  clearMarkers() {
    this.markers.forEach((mk) => mk.remove());
    this.markers = [];
  }

  focusPlot() {
    if (!this.map || !this.plot) return;
    this.map.flyTo({ center: this.plot.center, zoom: 16.4, pitch: 55, bearing: -18, duration: 1600, essential: true });
  }

  focusCatchment() {
    if (!this.map || !this.plot) return;
    const ring = circle(this.plot.center, this.plot.catchmentRadiusM, 16);
    this.map.fitBounds(bounds(ring), { padding: 30, pitch: 0, bearing: 0, duration: 1400 });
  }

  focusComparables() {
    if (!this.map || !this.comparablesData) return;
    const pts = this.comparablesData.filter((c) => c.selected && c.distanceM < 15000).map((c) => c.coord);
    pts.push(this.plot.center);
    this.map.fitBounds(bounds(pts), { padding: 60, pitch: 20, bearing: 0, duration: 1400, maxZoom: 14 });
  }

  /** Keep the plot clear of the floating agent panel on wide screens (it is collapsed until a plot is chosen). */
  padding() {
    const wide = this.map.getContainer().clientWidth > 760;
    return { left: wide && this.plot ? 380 : 20, right: 20, top: 20, bottom: 20 };
  }

  setGroup(id, on) {
    this.visible[id] = on;
    if (!this.map?.getLayer('background')) return;
    const g = LAYER_GROUPS.find((x) => x.id === id);
    for (const l of g.layers) if (this.map.getLayer(l)) this.map.setLayoutProperty(l, 'visibility', on && this.basemapAllows(l) ? 'visible' : 'none');
    if (id === 'comparables') this.setComparables(this.comparablesData);
  }

  /** Raster basemaps replace the drawn land use and (for streets) the drawn roads. */
  basemapAllows(layer) {
    if (this.basemap === 'vector') return true;
    if (layer.startsWith('landuse')) return false;
    if (this.basemap === 'streets' && layer.startsWith('roads')) return false;
    return true;
  }

  setBasemap(id) {
    this.basemap = id;
    if (!this.map) return;
    for (const b of Object.keys(BASEMAPS)) if (this.map.getLayer(`base-${b}`)) this.map.setLayoutProperty(`base-${b}`, 'visibility', b === id ? 'visible' : 'none');
    for (const l of ['water', 'airport', 'runways']) this.map.setLayoutProperty(l, 'visibility', id === 'vector' ? 'visible' : 'none');
    this.map.setPaintProperty('catchment-communities', 'fill-opacity', id === 'vector' ? 0.28 : 0.1);
    for (const g of LAYER_GROUPS) this.setGroup(g.id, this.visible[g.id]);
  }

  /** Map layers relevant to a journey stage (§7.1: continuous geographic context). */
  applyStage(stage, sub) {
    const base = ['context', 'landuse', 'buildings'];
    const want = {
      plot: [...base, 'constraints'],
      asset: [...base, 'constraints'],
      location:
        sub === 'comparables'
          ? ['context', 'comparables']
          : sub === 'market'
            ? ['context', 'landuse', 'transactions', 'catchment']
            : sub === 'supply'
              ? ['context', 'commercial', 'community', 'catchment']
              : ['context', 'commercial', 'community', 'infrastructure', 'catchment'],
      hbu: [...base, 'constraints', 'commercial', 'community'],
      structuring: [...base, 'constraints'],
      financial: [...base, 'constraints'],
      recommendation: [...base, 'constraints', 'comparables'],
    }[stage];
    if (!want) return;
    for (const g of LAYER_GROUPS) this.setGroup(g.id, want.includes(g.id));
    if (stage === 'location' && sub === 'comparables') this.focusComparables();
    else if (stage === 'location') this.focusCatchment();
    else this.focusPlot();
  }

  resize() {
    if (!this.map) return;
    this.map.resize();
    this.map.setPadding(this.padding());
  }
}

const inBounds = ([x, y], [[x0, y0], [x1, y1]]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const ROAD_KIND = { motorway: 'Highway', trunk: 'Highway', primary: 'Arterial road', secondary: 'Distributor road', tertiary: 'Collector road', service: 'Service road' };
const OPEN_DATA = '<div class="pop-note">Open map data · © OpenStreetMap contributors</div>';

function popupHtml(f) {
  const p = f.properties;
  const src = p.source ? `<button type="button" class="src-pill" data-action="evidence" data-ids="${esc(p.source)}">View source record</button>` : '';
  switch (p.kind) {
    case 'poi':
      return `<div class="pop"><div class="pop-k" style="--c:${esc(p.color)}">${esc(p.label)}</div><b>${esc(p.name)}</b>${p.placeType ? `<div class="muted">${esc(p.placeType)}</div>` : ''}<div>${num(p.distance)} m from plot</div>${p.detail ? `<div>${esc(p.detail)} <span class="muted">(simulated)</span></div>` : ''}<div class="pop-note">Name and location: open map data. Feeds supply-demand analysis.</div>${src}</div>`;
    case 'txn':
      return `<div class="pop"><div class="pop-k" style="--c:#e87ba4">DLD transaction</div><b>${esc(p.type)} · ${esc(p.property)}</b><div>${esc(p.community)} · ${esc(p.date)} · ${num(p.area)} m²</div><div>AED ${num(p.value)} (AED ${num(p.rate)}/m²)</div>${src}</div>`;
    case 'comparable':
      return `<div class="pop"><div class="pop-k" style="--c:#eda100">Comparable plot${p.selected ? ` · ${p.score}/100` : ''}</div><b>${esc(p.plotNumber)} — ${esc(p.community)}</b><div>${esc(p.landUse)}</div><div>${esc(p.performance)}</div>${p.reasons ? `<div class="pop-note">Why comparable: ${esc(p.reasons)}</div>` : ''}${src}</div>`;
    case 'plot':
      return `<div class="pop"><div class="pop-k" style="--c:#58a6ff">Selected plot</div><b>${esc(p.plotNumber)}</b><div>${esc(p.zoning)} · ${num(p.area)} m²</div><div class="pop-note">Drawn on a real vacant parcel from open land-use data. Extrusion shows the maximum permitted height envelope.</div>${src}</div>`;
    case 'constraint':
      return `<div class="pop"><div class="pop-k" style="--c:#e66767">Constraint · ${esc(p.severity)}</div><b>${esc(p.label)}</b><div>${esc(p.description)}</div>${src}</div>`;
    case 'community':
      return `<div class="pop"><div class="pop-k" style="--c:#7c8ea5">Community${p.host ? ' · host' : ''}</div><b>${esc(p.name)}</b><div>Population ${num(p.population)} · ${esc(p.growth)}%/yr</div><div>Density ${num(p.density)} /km² · ${esc(p.share)}% of the area inside the catchment</div><div class="pop-note">Boundary: open map data. Demographics simulated.</div>${src}</div>`;
    case 'station':
      return `<div class="pop"><div class="pop-k" style="--c:${esc(p.color)}">Dubai Metro · ${esc(p.line[0].toUpperCase() + p.line.slice(1))} Line</div><b>${esc(p.name)}</b>${p.ar ? `<div lang="ar">${esc(p.ar)}</div>` : ''}<div>${p.status === 'construction' ? 'Under construction (RTA target opening 2029)' : 'In operation'}</div>${OPEN_DATA}</div>`;
    case 'road':
      return `<div class="pop"><div class="pop-k" style="--c:#8e9db3">${esc(ROAD_KIND[p.cls] ?? 'Local street')}</div><b>${esc(p.name || 'Unnamed road')}</b>${p.ar && p.ar !== p.name ? `<div lang="ar">${esc(p.ar)}</div>` : ''}${OPEN_DATA}</div>`;
    case 'landuse':
      return `<div class="pop"><div class="pop-k" style="--c:${esc(p.color)}">Land use · ${esc(LANDUSE_STYLE[p.cls]?.label ?? p.cls)}</div>${p.name ? `<b>${esc(p.name)}</b>` : ''}${OPEN_DATA}</div>`;
    case 'building':
      return `<div class="pop"><div class="pop-k" style="--c:#3a4a61">Building footprint</div><div>Height ${num(p.h)} m${p.estimated ? ' (estimated)' : ''}</div>${OPEN_DATA}</div>`;
    case 'water':
      return `<div class="pop"><b>${esc(p.name || 'Water')}</b>${OPEN_DATA}</div>`;
    case 'area':
      return `<div class="pop"><div class="pop-k" style="--c:#7c8ea5">Community</div><b>${esc(p.name)}</b>${p.ar ? `<div lang="ar">${esc(p.ar)}</div>` : ''}<div>${esc(p.km2)} km²</div>${OPEN_DATA}</div>`;
    default:
      return `<div class="pop"><b>${esc(p.name ?? p.plotNumber ?? '')}</b></div>`;
  }
}
