// Every material value carries its provenance so the interface can keep sourced
// facts, predefined assumptions, user-modified assumptions, calculated outputs
// and AI-generated analysis visibly distinct (BRD §20, FR-070 – FR-074).

export const KIND = Object.freeze({
  SOURCED: 'sourced',
  ASSUMPTION: 'assumption',
  USER: 'user',
  CALCULATED: 'calculated',
  AI: 'ai',
});

export const KIND_LABEL = {
  sourced: 'Sourced fact',
  assumption: 'Predefined assumption',
  user: 'User-modified assumption',
  calculated: 'Calculated output',
  ai: 'AI-generated analysis',
};

/** A value tagged with its provenance, supporting sources and optional formula. */
export function tag(value, kind, { sources = [], note, formula, label, unit } = {}) {
  return { value, kind, sources, note, formula, label, unit };
}

export const sourced = (value, sources, extra = {}) => tag(value, KIND.SOURCED, { ...extra, sources });
export const assumed = (value, extra = {}) => tag(value, KIND.ASSUMPTION, extra);
export const calculated = (value, formula, extra = {}) => tag(value, KIND.CALCULATED, { ...extra, formula });
export const aiText = (value, sources = [], extra = {}) => tag(value, KIND.AI, { ...extra, sources });
