# God’s Eye View — Investment Agentic AI

A map-centric decision-support platform for Dubai Municipality investment specialists. It is built to the **Business Requirements Document: Investment Agentic AI Prototype**.

You start from a DM plot number. Specialised AI agents take the plot through a six-stage journey:

**Asset Intelligence → Location & Market Intelligence → Highest & Best Use → Investment Structuring → Financial Feasibility → Investment Recommendation**

You then review, challenge and decide, and capture the opportunity in a simulated **Commercial Assets Portfolio (CAP)**.

> Prototype. All data is representative or simulated, and source retrieval from DM, DLD, RERA, public and approved third-party systems is simulated. Outputs are illustrative and are **not** investment approvals: the investment specialist keeps final authority.

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

To enable the Claude-powered assistant, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Without a key, the **offline analyst** answers instead. It is deterministic and retrieval-grounded, and it still cites evidence and can apply modify-and-rerun commands. The header pill shows which mode is active.

## What you can do

| Journey step           | What the platform shows                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Plot selection      | Enter `426-0318` (Al Warqa’a Third, community facilities) or `332-0914` (Al Jaddaf, mixed use), or click a plot on the map. Review core plot facts before starting.        |
| 2. Plot identification | The plot is highlighted on the interactive map, with a 3D extrusion of its maximum permitted height and affection-plan constraints drawn on the plot.                      |
| 3. Asset Intelligence  | Plot, planning, zoning, development controls, constraints and structured affection-map fields, retrieved from several represented sources, each with inspectable evidence. |
| 4. Location & Market   | Demographics, accessibility, commercial and community activity (drawn on the map), RERA benchmarks, DLD transactions and market trend.                                     |
| 5. Comparables         | Comparable plots scored on six predefined factors, with “why comparable” and “why excluded” explanations, shown on the map.                                                |
| 6. Supply-demand       | Demand from population, worker or visitor indicators against recorded supply and pipeline, expressed as a gap index with its evidence.                                     |
| 7–8. HBU               | Alternative uses screened for legal permissibility, scored 0–10 on seven weighted criteria, ranked, and explained. Weights can be edited.                                  |
| 9. Structuring         | Lease, Musataha, BOT, DBOT, Concession and PPP screened by predefined rules and compared. The AI interpretation is shown separately from the methodology.                  |
| 10–11. Financials      | NPV, IRR, ROI and payback from an annual cash-flow model. There is an editable assumption register, a sensitivity tornado, breakevens and scenario comparison.             |
| 12. Recommendation     | A decision-ready summary that separates sourced facts, calculations, assumptions and AI analysis, with risks, conditions and alternatives.                                 |
| 13. Human review       | Accept, challenge, reject or rerun any stage. The recommendation needs your explicit decision.                                                                             |
| 14. Portfolio capture  | Capture the opportunity into the simulated CAP with its classification, monitoring fields and financial summary.                                                           |

Throughout the journey:

- **Visible agentic orchestration.** The agent activity panel shows ten specialised agents working in sequence. Each shows the sources it retrieved and the earlier outputs it used.
- **Visible RAG.** Every assistant answer lists the evidence records it retrieved and cites them inline. Any citation chip opens the source record, with its metadata and how it relates to the analysis. The **Evidence library** lists all records.
- **Explainability.** Every material value carries a provenance tag: _Sourced_, _Assumption_, _User-modified_, _Calculated_ or _AI analysis_ (see **Legend**).
- **Conversational challenge.** Ask “why does X rank above Y?”, “I challenge this recommendation”, “set discount rate to 10%”, “reduce rent by 10%”, “set the weight of supply gap to 30” or “proceed with the private school”. The assistant explains, or queues the change and reruns the affected agents.

## Architecture

```
index.html, src/main.js     Application controller (state, events, rendering)
src/ui/                     Map (MapLibre GL), panels, charts, chat, evidence, CAP
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
src/data/                   Representative dataset and predefined methodology
  plots.js, context.js      Plots, communities, roads, facilities, market, comparables
  sources.js                Source systems and the evidence corpus (§24.17 metadata)
  methodology.js            HBU criteria and weights, benchmarks, structures, templates
  portfolio.js              Simulated CAP records and capture
server/                     API: /api/health, /api/chat (Claude or offline analyst)
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

MIT for the source code (see `LICENSE`). Bundled data is simulated and is for demonstration only.
