# God’s Eye View — Investment Agentic AI

A map-centric decision-support platform for Dubai Municipality investment specialists. It is built to the **Business Requirements Document: Investment Agentic AI Prototype**.

You start from a DM plot number. Specialised AI agents take the plot through a six-stage journey:

**Asset Intelligence → Location & Market Intelligence → Highest & Best Use → Investment Structuring → Financial Feasibility → Investment Recommendation**

You then review, challenge and decide, and capture the opportunity in a simulated **Commercial Assets Portfolio (CAP)**.

> Prototype. The map is real open data; everything a government system would hold is simulated. Source retrieval from DM, DLD, RERA, public and approved third-party systems is simulated. Outputs are illustrative and are **not** investment approvals: the investment specialist keeps final authority.

## The map: real Dubai, from open data

The map is built from [Overture Maps](https://overturemaps.org) (OpenStreetMap and other open sources), so it shows Dubai as it is:

- **Real:** community boundaries (Al Warqa 1–5, Al Jaddaf, Culture Village, Umm Hurair and others), major roads and local streets, Dubai Metro Red and Green Lines with their stations, the Blue Line under construction, Dubai Creek and other water, DXB runways, land use, about 3,300 building footprints in 3D, and named facilities (schools, clinics, hotels, supermarkets and more).
- **Real parcels:** both prototype plots are drawn on real vacant parcels from open land-use data. Plot **421-0318** is an 18,950 m² parcel in Al Warqa 1, inside the community's private-school cluster and about 850 m from the Blue Line's Al Warqa'a station. Plot **326-0914** is an 8,800 m² waterfront parcel in Culture Village on the Al Jaddaf waterfront, about 700 m from Al Jadaf Metro Station.
- **Simulated:** plot numbers, zoning and affection-plan records, demographics, facility capacities, market benchmarks, DLD transactions and comparable-plot records. Heights the source does not record are estimated.

Official DM cadastral plot boundaries (GeoDubai / Dubai Plot Finder) are not open data, so the prototype does not claim to reproduce them. Swapping in the licensed DM plot layer is a data change: `src/data/geo/` holds the geometry, and `tools/` rebuilds it:

```bash
pip install pyarrow shapely
python tools/overture_extract.py   # fetch the Overture extract into .cache/overture/
python tools/build_geo.py          # compact it into src/data/geo/*.js
```

Map data © OpenStreetMap contributors (ODbL) and © Overture Maps Foundation. See `src/data/geo/ATTRIBUTION.md`.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173 (front end + API)
```

Production build:

```bash
npm run build
npm start              # http://127.0.0.1:4173 (serves dist/ and the API)
```

Single-file static build (JS, CSS and assets inlined; tile basemaps hidden; the assistant runs in the browser as the offline analyst). It suits sandboxed static hosting such as a claude.ai artifact:

```bash
npm run build:artifact # dist-artifact/gods-eye-view.html
```

### Deploy on Vercel

The repository is ready for Vercel: `vercel.json` builds the Vite front end, and `api/health.js` and `api/chat.js` run the API as serverless functions.

1. On vercel.com choose **Add New… → Project**, then import this GitHub repository. The settings are read from `vercel.json`.
2. Optional: add the environment variable `ANTHROPIC_API_KEY` to turn on the Claude assistant. Without it, the offline analyst answers.
3. Deploy. Production deployments are public. Preview deployments of other branches may sit behind Vercel's deployment protection.

### Password protection

Set the Vercel environment variable `SITE_PASSWORD` (at least 12 characters) and redeploy. The build then publishes only a password page: the whole app is gzipped and encrypted with AES-256-GCM under a key derived from the password (PBKDF2-SHA256, 600,000 iterations), so nothing readable is served until the password is entered. In this mode the app runs as the static build with the in-browser analyst, so leave `ANTHROPIC_API_KEY` unset. The same page can be built locally for any static host:

```bash
SITE_PASSWORD='…' npm run build:protected   # dist-artifact/gods-eye-view-protected.html
```

The password is read from the environment only and is never written to the repository.

To enable the Claude-powered assistant, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Without a key, the **offline analyst** answers instead. It is deterministic and retrieval-grounded, and it still cites evidence and can apply modify-and-rerun commands. The header pill shows which mode is active.

## What you can do

| Journey step           | What the platform shows                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Plot selection      | Enter `421-0318` (Al Warqa 1, community facilities) or `326-0914` (Al Jaddaf waterfront, mixed use), or click a plot on the map. Review core plot facts before starting.                                                                                                                                                                                             |
| 2. Plot identification | The plot is highlighted on the real map among 3D building footprints, with a 3D extrusion of its maximum permitted height and affection-plan constraints drawn along its edges.                                                                                                                                                                                      |
| 3. Asset Intelligence  | Plot, planning, zoning, development controls, constraints and structured affection-map fields, retrieved from several represented sources, each with inspectable evidence.                                                                                                                                                                                           |
| 4. Location & Market   | Demographics by real community (weighted by distance and by the share of each community inside the catchment), accessibility from the real road and Metro network, real named facilities on the map, RERA benchmarks, DLD transactions and market trend.                                                                                                             |
| 5. Comparables         | Comparable plots scored on six predefined factors, with “why comparable” and “why excluded” explanations, shown on the map.                                                                                                                                                                                                                                          |
| 6. Supply-demand       | Demand from population, worker or visitor indicators against recorded supply and pipeline, expressed as a gap index with its evidence.                                                                                                                                                                                                                               |
| 7–8. HBU               | Alternative uses screened for legal permissibility, scored 0–10 on seven weighted criteria, ranked, and explained. Weights can be edited.                                                                                                                                                                                                                            |
| 9. Structuring         | Lease, Musataha, BOT, DBOT, Concession and PPP screened by predefined rules and compared. The AI interpretation is shown separately from the methodology.                                                                                                                                                                                                            |
| 10–11. Financials      | NPV, IRR, ROI and payback from an annual cash-flow model. There is an editable assumption register, a sensitivity tornado, breakevens and scenario comparison.                                                                                                                                                                                                       |
| 12. Recommendation     | A decision-ready summary that separates sourced facts, calculations, assumptions and AI analysis, with risks, conditions and alternatives.                                                                                                                                                                                                                           |
| 13. Human review       | Accept, challenge, reject or rerun any stage. The recommendation needs your explicit decision.                                                                                                                                                                                                                                                                       |
| Export                 | Download the recommendation as a designed **PowerPoint deck** (native, editable charts) or **PDF report**, in **English or Arabic**. Arabic packs are fully right-to-left, written from the structured results rather than machine-translated, and embed IBM Plex Sans Arabic in the PDF. The BRD does not require a downloadable pack (§18.2); this is an addition. |
| 14. Portfolio capture  | Capture the opportunity into the simulated CAP with its classification, monitoring fields and financial summary.                                                                                                                                                                                                                                                     |

Throughout the journey:

- **Visible agentic orchestration.** The agent activity panel shows ten specialised agents working in sequence. Each shows the sources it retrieved and the earlier outputs it used.
- **Visible RAG.** Every assistant answer lists the evidence records it retrieved and cites them inline. Any citation chip opens the source record, with its metadata and how it relates to the analysis. The **Evidence library** lists all records.
- **Explainability.** Every material value carries a provenance tag: _Sourced_, _Assumption_, _User-modified_, _Calculated_ or _AI analysis_ (see **Legend**).
- **Conversational challenge.** Ask “why does X rank above Y?”, “I challenge this recommendation”, “set discount rate to 10%”, “reduce rent by 10%”, “set the weight of supply gap to 30” or “proceed with the private school”. The assistant explains, or queues the change and reruns the affected agents.

## Architecture

```
index.html, src/main.js     Application controller (state, events, rendering)
src/ui/                     Map (MapLibre GL, drawn from open data), panels, charts, chat, evidence, CAP
src/engine/                 Analysis engine, runs in the browser and in Node
  orchestrator.js           Agents, stage pipeline, rerun semantics
  asset.js, location.js     Stage 1 and 2 agents
  comparables.js            Comparable Analysis agent
  supplyDemand.js           Supply-Demand agent
  hbu.js                    HBU Assessment agent (screening, scoring, ranking)
  structuring.js            Investment Structuring agent (rules + comparison)
  finance.js                Cash flows, NPV/IRR/ROI/payback, sensitivity, scenarios
  recommendation.js         Recommendation agent
  retrieval.js              BM25 retrieval over the evidence corpus (RAG)
  analyst.js                Offline conversational analyst and action parser
  digest.js                 Grounding digest handed to the LLM
  provenance.js             Sourced / assumption / user / calculated / AI tags
src/data/                   Dataset and predefined methodology
  geo/                      Real open map data (Overture / OpenStreetMap), compact and delta-encoded
  plots.js, context.js      Plots on real parcels; communities, roads, facilities, market, comparables
  sources.js                Source systems and the evidence corpus (§24.17 metadata)
  methodology.js            HBU criteria and weights, benchmarks, structures, templates
  portfolio.js              Simulated CAP records and capture
server/                     API: /api/health, /api/chat (Claude or offline analyst)
tools/                      Map data pipeline (Overture extract and compaction)
test/                       Node test suite mapped to BRD requirements
```

The analysis is deterministic predefined logic, so it is transparent and testable (AC-04, AC-05). The LLM sits on top as the conversational layer. It receives the same computed digest plus retrieved evidence, can search for more evidence through a tool, and can queue modify-and-rerun actions. It cannot approve anything.

The assistant uses the Anthropic SDK with `claude-opus-5` by default (override with `ANTHROPIC_MODEL`), adaptive thinking, and server-side refusal fallbacks (`fallbacks: "default"`). Set `CLAUDE_FALLBACKS=off` to disable the fallbacks.

## Checks

```bash
npm test               # engine, BRD rules, analyst, API and Claude tool loop
npm run build
```

`docs/BRD-TRACEABILITY.md` maps each BRD requirement to where it is implemented.

## Licence

MIT for the source code (see `LICENSE`). Map data © OpenStreetMap contributors (ODbL) and © Overture Maps Foundation (see `src/data/geo/ATTRIBUTION.md`). All other bundled data is simulated and is for demonstration only.
