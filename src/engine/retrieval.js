// Lexical retrieval (BM25) over the evidence corpus. It runs identically in the
// browser and in the API so the conversational assistant and the analytical
// agents cite the same records (BRD FR-075 – FR-080).

const STOP = new Set(
  'a an and are as at be by for from has have in is it its of on or that the this to was were will with what which why how does do can i we our you your me about than then there their they them into per vs versus should would could more most less'.split(
    ' ',
  ),
);

const SYNONYMS = {
  hbu: ['highest', 'best', 'use'],
  population: ['demographic', 'residents'],
  demographics: ['population', 'age', 'households'],
  shops: ['retail'],
  grocery: ['supermarket'],
  schools: ['school', 'khda'],
  gym: ['sports', 'fitness'],
  hospital: ['clinic', 'healthcare'],
  zoning: ['planning', 'permitted'],
  far: ['floor', 'area', 'ratio', 'gfa'],
  rent: ['rental', 'rera'],
  transactions: ['dld', 'sale'],
  comparable: ['comparables', 'comp'],
  structure: ['structuring', 'musataha', 'lease', 'bot', 'concession', 'ppp'],
  npv: ['financial', 'model', 'discount'],
  irr: ['financial', 'model'],
  metro: ['transit', 'station'],
  access: ['accessibility', 'road'],
  constraints: ['easement', 'affection', 'constraint'],
};

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

/** Build a BM25 index over documents with {id, title, content, category}. */
export function buildIndex(docs) {
  const entries = docs.map((d) => {
    const terms = tokenize(`${d.title} ${d.title} ${d.category} ${d.sourceName} ${d.content}`);
    const tf = new Map();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { doc: d, tf, len: terms.length };
  });
  const df = new Map();
  for (const e of entries) for (const t of e.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLen = entries.reduce((s, e) => s + e.len, 0) / Math.max(1, entries.length);
  return { entries, df, avgLen, n: entries.length };
}

/** Top-k documents for a free-text query, each with a relevance score and snippet. */
export function search(index, query, { k = 5, boostCategories = [] } = {}) {
  const base = tokenize(query);
  const q = [...new Set([...base, ...base.flatMap((t) => SYNONYMS[t] ?? [])])];
  if (!q.length) return [];
  const k1 = 1.4;
  const b = 0.72;
  const scored = index.entries.map((e) => {
    let score = 0;
    for (const t of q) {
      const f = e.tf.get(t);
      if (!f) continue;
      const df = index.df.get(t);
      const idf = Math.log(1 + (index.n - df + 0.5) / (df + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * e.len) / index.avgLen));
    }
    if (score > 0 && boostCategories.includes(e.doc.category)) score *= 1.25;
    return { doc: e.doc, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, z) => z.score - a.score)
    .slice(0, k)
    .map((s) => ({ ...s, snippet: snippet(s.doc.content, base) }));
}

function snippet(content, terms, max = 240) {
  const sentences = content.split(/(?<=[.;])\s+/);
  let best = sentences[0];
  let bestHits = -1;
  for (const s of sentences) {
    const st = new Set(tokenize(s));
    const hits = terms.filter((t) => st.has(t)).length;
    if (hits > bestHits) {
      best = s;
      bestHits = hits;
    }
  }
  return best.length > max ? `${best.slice(0, max - 1)}…` : best;
}
