// Interactive investment map (BRD §7.1, FR-002/003, FR-014 – FR-018, FR-023).
// A schematic vector basemap is built from the representative dataset so the
// map works without any tile service; imagery and street tiles are optional.

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { POI_CATEGORIES } from '../data/context.js';
import { circle, bounds } from '../engine/geo.js';
import { esc, num } from './format.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const fc = (features) => ({ type: 'FeatureCollection', features });
const poly = (ring, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } });
const line = (coords, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: coords } });
const point = (coord, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: coord } });

export const LAYER_GROUPS = [
  { id: 'context', label: 'Communities, roads & transit', layers: ['communities-fill', 'communities-line', 'water', 'roads-casing', 'roads', 'metro-line'], on: true },
  { id: 'plots', label: 'Surrounding plots', layers: ['neighbours', 'neighbours-3d'], on: true },
  { id: 'constraints', label: 'Plot constraints (affection plan)', layers: ['constraints-fill', 'constraints-line'], on: true },
  { id: 'catchment', label: 'Catchment rings', layers: ['catchment'], on: false },
  { id: 'commercial', label: 'Commercial activity', layers: ['poi-commercial'], on: false },
  { id: 'community', label: 'Community services', layers: ['poi-community'], on: false },
  { id: 'infrastructure', label: 'Transport & infrastructure', layers: ['poi-infrastructure'], on: false },
  { id: 'comparables', label: 'Comparable plots', layers: ['comparables-fill', 'comparables-line'], on: false },
  { id: 'transactions', label: 'DLD transactions', layers: ['transactions'], on: false },
];

const BASEMAPS = {
  schematic: { label: 'Schematic' },
  imagery: { label: 'Imagery', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  streets: {
    label: 'Streets',
    tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors © CARTO',
  },
};

export class InvestmentMap {
  constructor(container, { onSelectPlot } = {}) {
    this.visible = Object.fromEntries(LAYER_GROUPS.map((g) => [g.id, g.on]));
    this.basemap = 'schematic';
    this.markers = [];
    this.onSelectPlot = onSelectPlot;
    this.ready = new Promise((resolve) => (this._resolveReady = resolve));
    try {
      this.map = new maplibregl.Map({
        container,
        style: this.style(),
        center: [55.38, 25.205],
        zoom: 11.2,
        pitch: 0,
        attributionControl: { compact: true },
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
    this.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px', className: 'map-popup' });
  }

  style() {
    const sources = {};
    const layers = [{ id: 'background', type: 'background', paint: { 'background-color': '#0c1016' } }];
    for (const [id, b] of Object.entries(BASEMAPS)) {
      if (!b.tiles) continue;
      sources[`base-${id}`] = { type: 'raster', tiles: b.tiles, tileSize: 256, attribution: b.attribution, maxzoom: 19 };
      layers.push({ id: `base-${id}`, type: 'raster', source: `base-${id}`, layout: { visibility: 'none' }, paint: { 'raster-opacity': id === 'imagery' ? 0.85 : 1 } });
    }
    return { version: 8, sources, layers };
  }

  addLayers() {
    const m = this.map;
    const src = ['communities', 'water', 'roads', 'metro', 'neighbours', 'plot', 'constraints', 'catchment', 'pois', 'comparables', 'transactions', 'plots-all'];
    for (const s of src) m.addSource(s, { type: 'geojson', data: EMPTY });

    m.addLayer({ id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': '#0f2a3d', 'fill-opacity': 0.9 } });
    m.addLayer({ id: 'communities-fill', type: 'fill', source: 'communities', paint: { 'fill-color': ['case', ['get', 'host'], '#1b2a3a', '#141c26'], 'fill-opacity': 0.55 } });
    m.addLayer({ id: 'communities-line', type: 'line', source: 'communities', paint: { 'line-color': '#3b4b5e', 'line-width': 1, 'line-dasharray': [3, 2] } });
    m.addLayer({ id: 'catchment', type: 'line', source: 'catchment', layout: { visibility: 'none' }, paint: { 'line-color': '#7c8ea5', 'line-width': 1.2, 'line-dasharray': [2, 2] } });
    m.addLayer({
      id: 'roads-casing',
      type: 'line',
      source: 'roads',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0c1016', 'line-width': ['match', ['get', 'cls'], 'motorway', 11, 'primary', 8, 'secondary', 6, 3] },
    });
    m.addLayer({
      id: 'roads',
      type: 'line',
      source: 'roads',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'cls'], 'motorway', '#b98a3e', 'primary', '#8b9bb0', 'secondary', '#65758a', '#3a4656'],
        'line-width': ['match', ['get', 'cls'], 'motorway', 7, 'primary', 5, 'secondary', 3.5, 1.6],
      },
    });
    m.addLayer({ id: 'metro-line', type: 'line', source: 'metro', paint: { 'line-color': '#1baf7a', 'line-width': 3, 'line-dasharray': [2, 1] } });
    m.addLayer({ id: 'neighbours', type: 'fill', source: 'neighbours', paint: { 'fill-color': '#1f2835', 'fill-outline-color': '#2f3b4b' } });
    m.addLayer({
      id: 'neighbours-3d',
      type: 'fill-extrusion',
      source: 'neighbours',
      paint: { 'fill-extrusion-color': '#273244', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.75 },
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
    m.addLayer({ id: 'plots-all', type: 'fill', source: 'plots-all', paint: { 'fill-color': '#3987e5', 'fill-opacity': 0.25 } });
    m.addLayer({ id: 'plot-glow', type: 'line', source: 'plot', paint: { 'line-color': '#58a6ff', 'line-width': 10, 'line-blur': 8, 'line-opacity': 0.7 } });
    m.addLayer({ id: 'plot-fill', type: 'fill', source: 'plot', paint: { 'fill-color': '#3987e5', 'fill-opacity': 0.28 } });
    m.addLayer({ id: 'plot-3d', type: 'fill-extrusion', source: 'plot', paint: { 'fill-extrusion-color': '#58a6ff', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.28 } });
    m.addLayer({ id: 'plot-line', type: 'line', source: 'plot', paint: { 'line-color': '#9ccbff', 'line-width': 2.5 } });
    m.addLayer({
      id: 'constraints-fill',
      type: 'fill',
      source: 'constraints',
      paint: { 'fill-color': ['match', ['get', 'severity'], 'high', '#e66767', 'medium', '#d95926', '#c98500'], 'fill-opacity': 0.45 },
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
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 8], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#0c1016', 'circle-stroke-width': 2 },
      });
    }
    m.addLayer({
      id: 'transactions',
      type: 'circle',
      source: 'transactions',
      layout: { visibility: 'none' },
      paint: { 'circle-radius': 7, 'circle-color': '#e87ba4', 'circle-stroke-color': '#0c1016', 'circle-stroke-width': 2 },
    });

    const clickable = ['poi-commercial', 'poi-community', 'poi-infrastructure', 'transactions', 'comparables-fill', 'plot-fill', 'plots-all', 'constraints-fill', 'communities-fill'];
    m.on('click', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: clickable.filter((l) => m.getLayer(l)) })[0];
      if (!f) return;
      if (f.layer.id === 'plots-all' && this.onSelectPlot) return this.onSelectPlot(f.properties.plotNumber);
      this.popup.setLngLat(e.lngLat).setHTML(popupHtml(f)).addTo(m);
    });
    for (const l of clickable) {
      m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', l, () => (m.getCanvas().style.cursor = ''));
    }
  }

  /** Show the prototype plots before one is selected. */
  async showOverview(plots) {
    await this.ready;
    if (!this.map) return;
    this.map.getSource('plots-all').setData(fc(plots.map((p) => poly(p.geometry, { plotNumber: p.plotNumber }))));
    this.clearMarkers();
    for (const p of plots) {
      const el = document.createElement('button');
      el.className = 'map-label map-label-plot map-label-pick';
      el.innerHTML = `<b>Plot ${esc(p.plotNumber)}</b><span>${esc(p.community)}</span>`;
      el.addEventListener('click', () => this.onSelectPlot?.(p.plotNumber));
      this.addMarker(p.center, el, 'bottom');
    }
    this.map.fitBounds(bounds(plots.map((p) => p.center)), { padding: 80, duration: 900, pitch: 0, maxZoom: 12 });
  }

  async setPlot(plot, ctx) {
    await this.ready;
    if (!this.map) return;
    const m = this.map;
    this.plot = plot;
    this.ctx = ctx;
    m.getSource('plots-all').setData(EMPTY);
    m.getSource('communities').setData(
      fc(
        ctx.communities.map((c, i) =>
          poly(c.ring, { kind: 'community', host: i === 0, name: c.name, population: c.population, growth: c.growthPct, density: c.density, source: `DSC-POP:POP-${c.id}` }),
        ),
      ),
    );
    m.getSource('water').setData(ctx.water ? fc([poly(ctx.water)]) : EMPTY);
    m.getSource('roads').setData(fc(ctx.roads.map((r) => line(r.coords, { name: r.name, cls: r.cls }))));
    m.getSource('metro').setData(ctx.metro ? fc([line(ctx.metro.coords, { name: ctx.metro.name })]) : EMPTY);
    const nh = plot.plotNumber === '426-0318' ? () => 7 : (i) => 18 + ((i * 37) % 50);
    m.getSource('neighbours').setData(fc(ctx.neighbours.map((n, i) => poly(n.ring, { kind: 'neighbour', use: n.use, plotNumber: n.plotNumber, h: n.use === 'Open space' ? 0 : nh(i) }))));
    m.getSource('plot').setData(
      fc([
        poly(plot.geometry, {
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
          .map((c) => poly(c.geometry, { kind: 'constraint', label: c.label, severity: c.severity, description: c.description, source: `DM-AFF:${plot.affection.affectionPlanNo}` })),
      ),
    );
    m.getSource('catchment').setData(fc([1000, plot.catchmentRadiusM].map((r) => line(circle(plot.center, r), { r }))));
    m.getSource('pois').setData(
      fc(
        ctx.pois.map((x) =>
          point(x.coord, {
            kind: 'poi',
            name: x.name,
            category: x.category,
            label: POI_CATEGORIES[x.category]?.label,
            group: POI_CATEGORIES[x.category]?.group,
            color: POI_CATEGORIES[x.category]?.color,
            distance: x.distanceM,
            detail: [
              x.gla && `GLA ${num(x.gla)} m²`,
              x.capacity && `Capacity ${num(x.capacity)} · enrolled ${num(x.enrolled)}`,
              x.keys && `${x.keys} keys`,
              x.rooms && `${x.rooms} rooms`,
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
          point(t.coord, { kind: 'txn', id: t.id, date: t.date, type: t.type, property: t.property, value: t.valueAed, area: t.areaM2, rate: t.aedPerM2, source: `DLD-TXN:${t.id}` }),
        ),
      ),
    );
    this.setComparables(null);

    this.clearMarkers();
    const el = document.createElement('div');
    el.className = 'map-label map-label-plot';
    el.innerHTML = `<b>Plot ${esc(plot.plotNumber)}</b><span>${esc(plot.planning.zoningCode)} · ${num(plot.areaM2)} m²</span>`;
    this.addMarker(plot.center, el, 'bottom', [0, -26]);
    for (const c of ctx.communities) {
      const ce = document.createElement('div');
      ce.className = 'map-label map-label-community';
      ce.textContent = c.name;
      this.addMarker(c.centroid, ce, 'center');
    }
    this.focusPlot();
  }

  setComparables(comparables) {
    if (!this.map || !this.ctx) return;
    const list = comparables ?? this.ctx.comparables.map((c) => ({ ...c, selected: false, score: null }));
    this.map.getSource('comparables').setData(
      fc(
        list.map((c) =>
          poly(c.ring, {
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
    this.map.flyTo({ center: this.plot.center, zoom: 16.2, pitch: 52, bearing: -18, duration: 1600, essential: true });
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

  /** Keep the plot clear of the floating agent panel on wide screens. */
  padding() {
    const wide = this.map.getContainer().clientWidth > 760;
    return { left: wide ? 380 : 20, right: 20, top: 20, bottom: 20 };
  }

  setGroup(id, on) {
    this.visible[id] = on;
    if (!this.map?.getLayer('background')) return;
    const g = LAYER_GROUPS.find((x) => x.id === id);
    for (const l of g.layers) if (this.map.getLayer(l)) this.map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none');
    if (id === 'comparables') this.setComparables(this.comparablesData);
  }

  setBasemap(id) {
    this.basemap = id;
    if (!this.map) return;
    for (const b of Object.keys(BASEMAPS)) if (this.map.getLayer(`base-${b}`)) this.map.setLayoutProperty(`base-${b}`, 'visibility', b === id ? 'visible' : 'none');
    const schematicOpacity = id === 'schematic' ? 0.55 : 0.12;
    this.map.setPaintProperty('communities-fill', 'fill-opacity', schematicOpacity);
    for (const l of ['roads', 'roads-casing']) this.map.setLayoutProperty(l, 'visibility', id === 'schematic' && this.visible.context ? 'visible' : 'none');
  }

  /** Map layers relevant to a journey stage (§7.1: continuous geographic context). */
  applyStage(stage, sub) {
    const want = {
      plot: ['context', 'plots', 'constraints'],
      asset: ['context', 'plots', 'constraints'],
      location:
        sub === 'comparables'
          ? ['context', 'comparables']
          : sub === 'market'
            ? ['context', 'transactions', 'catchment']
            : sub === 'supply'
              ? ['context', 'commercial', 'community', 'catchment']
              : ['context', 'commercial', 'community', 'infrastructure', 'catchment'],
      hbu: ['context', 'plots', 'constraints', 'commercial', 'community'],
      structuring: ['context', 'plots', 'constraints'],
      financial: ['context', 'plots', 'constraints'],
      recommendation: ['context', 'plots', 'constraints', 'comparables'],
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

function popupHtml(f) {
  const p = f.properties;
  const src = p.source ? `<button type="button" class="src-pill" data-action="evidence" data-ids="${esc(p.source)}">View source record</button>` : '';
  switch (p.kind) {
    case 'poi':
      return `<div class="pop"><div class="pop-k" style="--c:${esc(p.color)}">${esc(p.label)}</div><b>${esc(p.name)}</b><div>${num(p.distance)} m from plot</div>${p.detail ? `<div>${esc(p.detail)}</div>` : ''}<div class="pop-note">Feeds supply-demand analysis</div>${src}</div>`;
    case 'txn':
      return `<div class="pop"><div class="pop-k" style="--c:#e87ba4">DLD transaction</div><b>${esc(p.type)} · ${esc(p.property)}</b><div>${esc(p.date)} · ${num(p.area)} m²</div><div>AED ${num(p.value)} (AED ${num(p.rate)}/m²)</div>${src}</div>`;
    case 'comparable':
      return `<div class="pop"><div class="pop-k" style="--c:#eda100">Comparable plot${p.selected ? ` · ${p.score}/100` : ''}</div><b>${esc(p.plotNumber)} — ${esc(p.community)}</b><div>${esc(p.landUse)}</div><div>${esc(p.performance)}</div>${p.reasons ? `<div class="pop-note">Why comparable: ${esc(p.reasons)}</div>` : ''}${src}</div>`;
    case 'plot':
      return `<div class="pop"><div class="pop-k" style="--c:#58a6ff">Selected plot</div><b>${esc(p.plotNumber)}</b><div>${esc(p.zoning)} · ${num(p.area)} m²</div><div class="pop-note">Extrusion shows the maximum permitted height envelope</div>${src}</div>`;
    case 'constraint':
      return `<div class="pop"><div class="pop-k" style="--c:#e66767">Constraint · ${esc(p.severity)}</div><b>${esc(p.label)}</b><div>${esc(p.description)}</div>${src}</div>`;
    case 'community':
      return `<div class="pop"><div class="pop-k" style="--c:#7c8ea5">Community</div><b>${esc(p.name)}</b><div>Population ${num(p.population)} · ${esc(p.growth)}%/yr</div><div>Density ${num(p.density)} /km²</div>${src}</div>`;
    default:
      return `<div class="pop"><b>${esc(p.name ?? p.plotNumber ?? '')}</b></div>`;
  }
}
