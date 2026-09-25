# BRD traceability

This matrix maps each requirement in _Business Requirements Document — Investment Agentic AI Prototype_ to its implementation. Paths are relative to the repository root. Tests live in `test/`.

## Business objectives

| ID             | Implementation                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| OBJ-01         | Map-centric workspace (`index.html`, `src/ui/map.js`) with the selected plot highlighted and extruded                       |
| OBJ-02         | Asset, planning, market, demographic, infrastructure and commercial data (`src/data/*`, Stages 1–2)                         |
| OBJ-03         | Simulated multi-source retrieval: 17 represented source systems (`src/data/sources.js`), Information Retrieval Agent events |
| OBJ-04         | Location & Market Intelligence agent (`src/engine/location.js`)                                                             |
| OBJ-05         | Comparable Analysis agent (`src/engine/comparables.js`); market benchmarks and DLD transactions                             |
| OBJ-06         | Supply-Demand agent (`src/engine/supplyDemand.js`)                                                                          |
| OBJ-07, OBJ-08 | HBU agent: generation, screening, numerical weighted scoring (`src/engine/hbu.js`)                                          |
| OBJ-09         | Structuring agent (`src/engine/structuring.js`)                                                                             |
| OBJ-10, OBJ-11 | Financial model, editable assumptions, sensitivity, scenarios (`src/engine/finance.js`, `src/ui/panels/financial.js`)       |
| OBJ-12         | Recommendation agent (`src/engine/recommendation.js`)                                                                       |
| OBJ-13         | Provenance tags on every material value (`src/engine/provenance.js`, chips in `src/ui/format.js`)                           |
| OBJ-14         | Agent activity panel and orchestrator events (`src/engine/orchestrator.js`, `src/ui/shell.js`)                              |
| OBJ-15         | Review bar (accept / challenge / reject / rerun) on every stage; chat challenge and modify-and-rerun                        |
| OBJ-16         | Simulated CAP capture and portfolio view (`src/data/portfolio.js`, `renderCap`)                                             |

## Functional requirements

| ID              | Implementation                                                                                                                                                           | Test                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| FR-001 – FR-005 | Plot search and datalist, map click-to-select, highlighted polygon and 3D envelope, plot bound to its dataset, core-facts review before starting                         | `engine: AC-01`                                                      |
| FR-006 – FR-008 | Asset panel: identity, planning and zoning, development controls, constraints, affection plan                                                                            |                                                                      |
| FR-009 – FR-013 | Multi-source retrieval table, source attribution on every fact, evidence drawer; retrieval is simulated (no live integration)                                            | `engine: evidence corpus`                                            |
| FR-014 – FR-018 | Real communities, roads, Dubai Metro, land use, buildings and named facilities on the map (open data, `src/data/geo/`); demographics; accessibility score and components |                                                                      |
| FR-019          | Location outputs feed HBU demand, location and gap criteria                                                                                                              | `engine: HBU`                                                        |
| FR-020 – FR-024 | Comparable scoring factors, explanations and exclusions, map layer, structured list                                                                                      | `engine: comparables`                                                |
| FR-025 – FR-029 | Demand vs supply per category, gap index, evidence list per conclusion, feeds HBU gap criterion                                                                          | `engine: supply-demand`                                              |
| FR-030 – FR-032 | Candidate uses per plot; legal-permissibility screening; constraint sensitivity in planning and risk scores                                                              | `engine: HBU`                                                        |
| FR-033 – FR-040 | Seven predefined criteria, visible and editable weights, scores, totals, ranking, AI rationale, evidence per criterion                                                   | `engine: HBU`, `engine: weights`                                     |
| FR-041 – FR-045 | Six structures, rule screening (R-xx), weighted comparison, rationale; AI interpretation in a separate block                                                             | `engine: structuring`                                                |
| FR-046 – FR-051 | NPV, IRR, ROI (total and annualised), payback; assumption register; instant recalculation                                                                                | `engine: NPV/IRR`, `engine: financial model`                         |
| FR-052 – FR-055 | Editable sliders and inputs, tornado, breakevens, base / downside / upside / specialist / saved scenarios                                                                | `engine: user-modified`                                              |
| FR-056 – FR-062 | Verdict, rationale, metrics, material assumptions, sources, separated fact / calculation / AI blocks, on-screen summary                                                  | `engine: recommendation`                                             |
| FR-063 – FR-069 | Review bar per stage, chat explanation and challenge, modify-and-rerun, explicit accept or reject, “awaiting specialist decision” wording                                | `engine: rerun`, `assistant: parses actions`, `assistant: challenge` |
| FR-070 – FR-074 | Provenance chips (Sourced / Assumption / User-modified / Calculated / AI analysis), legend, formulas on hover                                                            | `engine: cited sources exist`                                        |
| FR-075 – FR-080 | BM25 retrieval, retrieved records shown per answer, inline citations, LLM grounded by digest and evidence, `search_evidence` tool                                        | `engine: retrieval`, `assistant: grounded`, `assistant: Claude path` |
| FR-081 – FR-085 | Ten named agents, stage stepper, activity log with sources and hand-offs, business-level wording only                                                                    | `engine: orchestrator`                                               |
| FR-086 – FR-090 | Capture from the recommendation; CAP record carries use, structure, status, priority, stage, indicative value, metrics, conditions; editable monitoring fields           |                                                                      |

## Data requirements (§24) and principles (§25)

| Section                                                                                             | Where                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24.2 Plot & asset, 24.3 Planning & affection map                                                    | `src/data/plots.js` (affection map as structured fields, AC-13)                                                                                                        |
| 24.4 GIS, 24.5 Demographics, 24.6 Commercial activity, 24.7 Infrastructure                          | `src/data/context.js`                                                                                                                                                  |
| 24.8 Market, 24.9 DLD, 24.10 Comparables                                                            | `src/data/context.js` (`MARKET`, `TRANSACTIONS`, `COMPARABLES`)                                                                                                        |
| 24.11 Supply-demand, 24.12 HBU methodology, 24.13 Structures, 24.14 – 24.15 Financial & sensitivity | `src/data/methodology.js`                                                                                                                                              |
| 24.16 CAP                                                                                           | `src/data/portfolio.js`                                                                                                                                                |
| 24.17 Source & evidence metadata                                                                    | `src/data/sources.js` (each record has name, type, record id, content, date, citation, category, description, relation to analysis)                                    |
| DP-01 – DP-08                                                                                       | Map geometry is real open data (cited as a real source); all other data is simulated and marked as such; dummy financial assumptions and AI text are tagged separately |

## Out of scope (§27), respected

There is no authentication, role-based access, live integrations, persistent audit trail, document upload or OCR, PDF committee pack, or autonomous approval. CAP records live in the browser's local storage as a convenience only (AC-10).
