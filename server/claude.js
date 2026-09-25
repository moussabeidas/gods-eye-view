// Conversational investment assistant backed by Claude. Retrieval runs
// server-side over the evidence corpus (visible RAG, FR-075 – FR-080); tools
// let the model search further and queue modify-and-rerun actions that the
// browser applies (FR-066, FR-067). The model never approves (FR-069).

import Anthropic from '@anthropic-ai/sdk';
import { getDoc } from '../src/data/sources.js';
import { HBU_CRITERIA } from '../src/data/methodology.js';
import { search } from '../src/engine/retrieval.js';
import { plotIndex } from '../src/engine/analyst.js';
import { buildDigest } from '../src/engine/digest.js';
import { STAGES } from '../src/engine/orchestrator.js';

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const MAX_TURNS = 6;

export function llmConfigured() {
  return Boolean(client || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

/** Test hook: substitute the SDK client. */
export function setClient(c) {
  client = c;
}

const SYSTEM = `You are the conversational investment assistant inside an Investment Agentic AI prototype used by Dubai Municipality investment specialists to assess municipal plots.

Your job: help the specialist review, question and challenge the analysis of the selected plot across six stages: Asset Intelligence, Location & Market Intelligence, Highest & Best Use (HBU), Investment Structuring, Financial Feasibility and Investment Recommendation.

Ground every factual statement in the session digest or in retrieved evidence records. Cite evidence inline as [[record-id]] using the record ids exactly as given (for example [[DM-PLAN:ZONE-426-0318]]). Never invent record ids, figures or sources. If the evidence does not cover a question, say so, and use search_evidence before concluding that nothing exists.

Keep the information types visibly distinct. Label a figure as sourced, predefined assumption, user-modified assumption or calculated output, as the digest marks it. Put your own interpretation in a separate sentence or paragraph starting "AI interpretation:". All data is representative or simulated for a prototype; say so when it matters.

The specialist has final authority. Never state or imply that an investment is approved; recommendations are decision support. When the specialist challenges a conclusion, engage with it seriously: set out the weakest evidence, the sensitivities, and what would change the conclusion.

When the specialist asks to change an assumption, an HBU weight or the selected use, or to rerun a stage, call the matching action tool. The interface applies the change after your reply and reruns the affected agents. Say what will change and that the change will show as user-modified. Only call an action tool when the specialist asks for a change or clearly agrees to one.

Write concisely for a business reader. Use short paragraphs, bullets, and a markdown table when comparing options. Do not expose internal reasoning or implementation details.`;

const ASSUMPTION_KEYS = [
  'price',
  'utilisation',
  'rampYears',
  'escalation',
  'ancillaryFactor',
  'opexRatio',
  'capexPerM2',
  'softCostPct',
  'farUtilisation',
  'efficiency',
  'constructionYears',
  'horizonYears',
  'discountRate',
  'exitCapRate',
];

function tools(useIds) {
  return [
    {
      name: 'search_evidence',
      description: 'Search the evidence corpus for the selected plot (DM, DLD, RERA, public, third-party and methodology records). Returns records with ids to cite.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Keywords describing the evidence needed.' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      name: 'set_assumption',
      description:
        'Queue a change to one financial assumption for the selected use, then rerun Financial Analysis and Recommendation. Percentages are decimals (0.085 = 8.5%). Price is in the unit shown in the digest; capexPerM2 is AED per m² GFA; years are integers.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { key: { type: 'string', enum: ASSUMPTION_KEYS }, value: { type: 'number' } },
        required: ['key', 'value'],
        additionalProperties: false,
      },
    },
    {
      name: 'set_hbu_weight',
      description: 'Queue a change to one HBU criterion weight (points; weights are re-normalised to 100), then rerun HBU onwards.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { criterion: { type: 'string', enum: HBU_CRITERIA.map((c) => c.id) }, weight: { type: 'number' } },
        required: ['criterion', 'weight'],
        additionalProperties: false,
      },
    },
    {
      name: 'select_use',
      description: 'Queue the specialist’s choice of HBU alternative to carry into structuring, financials and recommendation.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { use_id: { type: 'string', enum: useIds } },
        required: ['use_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'rerun_stage',
      description: 'Queue a rerun of the analysis from the given stage.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { stage: { type: 'string', enum: STAGES.map((s) => s.id) } },
        required: ['stage'],
        additionalProperties: false,
      },
    },
  ];
}

function evidenceBlock(results) {
  return results.map((x) => `<record id="${x.doc.id}" source="${x.doc.sourceName}" type="${x.doc.sourceType}" date="${x.doc.date}">\n${x.doc.title}\n${x.doc.content}\n</record>`).join('\n');
}

const retrievedView = (x) => ({ id: x.doc.id, title: x.doc.title, sourceName: x.doc.sourceName, score: Math.round(x.score * 100) / 100, snippet: x.snippet });

/** Answer a chat turn with Claude. Returns {text, citations, retrieved, actions, mode, model}. */
export async function chatWithClaude(session, { question, stage, history = [] }) {
  const index = plotIndex(session.plot.plotNumber);
  const initial = search(index, `${question} ${stage ?? ''}`, { k: 6 });
  const retrieved = new Map(initial.map((x) => [x.doc.id, retrievedView(x)]));
  const actions = [];
  const useIds = session.results.hbu.alternatives.map((a) => a.use.id);

  const system = [
    { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: buildDigest(session, stage) },
  ];
  const messages = [
    ...history.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text).slice(0, 4000) })),
    {
      role: 'user',
      content: `Retrieved evidence for this question:\n${evidenceBlock(initial) || '(no records matched)'}\n\nSpecialist question (current stage: ${stage ?? 'unknown'}):\n${question}`,
    },
  ];
  // The API requires the first message to be from the user.
  while (messages.length && messages[0].role !== 'user') messages.shift();

  let useFallbacks = process.env.CLAUDE_FALLBACKS !== 'off';
  let response;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const params = {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system,
      tools: tools(useIds),
      messages,
      ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    };
    try {
      response = await getClient().beta.messages.create(params);
    } catch (error) {
      if (useFallbacks && error instanceof Anthropic.BadRequestError) {
        useFallbacks = false;
        turn--;
        continue;
      }
      throw error;
    }
    if (response.stop_reason === 'refusal') {
      return {
        text: 'The assistant declined to answer this request. Please rephrase the question about the plot analysis.',
        citations: [],
        retrieved: [...retrieved.values()],
        actions,
        mode: 'claude',
        model: response.model,
      };
    }
    if (response.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: response.content });
    const results = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const input = block.input ?? {};
      let content;
      if (block.name === 'search_evidence') {
        const found = search(index, String(input.query ?? ''), { k: 5 });
        for (const x of found) retrieved.set(x.doc.id, retrievedView(x));
        content = evidenceBlock(found) || 'No matching records.';
      } else if (block.name === 'set_assumption' && ASSUMPTION_KEYS.includes(input.key) && Number.isFinite(input.value)) {
        actions.push({ type: 'setAssumption', key: input.key, value: input.value });
        content = 'Queued. The interface applies it after your reply, marks it user-modified, and reruns Financial Analysis → Recommendation.';
      } else if (block.name === 'set_hbu_weight' && HBU_CRITERIA.some((c) => c.id === input.criterion) && Number.isFinite(input.weight)) {
        actions.push({ type: 'setWeight', criterion: input.criterion, value: Math.max(0, input.weight) });
        content = 'Queued. Weights will be re-normalised and HBU → Recommendation rerun after your reply.';
      } else if (block.name === 'select_use' && useIds.includes(input.use_id)) {
        actions.push({ type: 'selectUse', useId: input.use_id });
        content = 'Queued. Structuring → Recommendation will rerun for this use after your reply.';
      } else if (block.name === 'rerun_stage' && STAGES.some((s) => s.id === input.stage)) {
        actions.push({ type: 'rerun', stage: input.stage });
        content = 'Queued rerun.';
      } else {
        results.push({ type: 'tool_result', tool_use_id: block.id, content: 'Invalid tool input.', is_error: true });
        continue;
      }
      results.push({ type: 'tool_result', tool_use_id: block.id, content });
    }
    messages.push({ role: 'user', content: results });
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  const citations = [...new Set([...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]))].filter((id) => getDoc(id));
  return { text: text || 'No answer was produced.', citations, retrieved: [...retrieved.values()], actions, mode: 'claude', model: response.model };
}
