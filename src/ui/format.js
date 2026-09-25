// Formatting, escaping and provenance chips shared by every panel.

import { KIND_LABEL } from '../engine/provenance.js';
import { getDoc } from '../data/sources.js';

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const num = (x, d = 0) => (x == null || Number.isNaN(x) ? '—' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(d)}%`);
export const aedM = (x, d = 1) => (x == null ? '—' : `AED ${(x / 1e6).toFixed(d)}M`);
export const aed = (x) => (x == null ? '—' : `AED ${num(x)}`);
export const yrs = (x) => (x == null ? 'Beyond horizon' : `${x.toFixed(1)} yrs`);

const KIND_SHORT = { sourced: 'Sourced', assumption: 'Assumption', user: 'User-modified', calculated: 'Calculated', ai: 'AI analysis' };

/** Provenance chip; clicking a sourced chip opens its evidence (FR-013, FR-071). */
export function chip(kind, { sources = [], formula, note } = {}) {
  const title = [KIND_LABEL[kind], formula && `Formula: ${formula}`, note, sources.length && `Sources: ${sources.map((id) => getDoc(id)?.sourceName ?? id).join('; ')}`].filter(Boolean).join('\n');
  const attr = sources.length ? ` data-action="evidence" data-ids="${esc(sources.join('|'))}"` : '';
  return `<button type="button" class="chip chip-${kind}" title="${esc(title)}"${attr}>${KIND_SHORT[kind]}</button>`;
}

export function tagChip(t) {
  return t ? chip(t.kind, { sources: t.sources, formula: t.formula, note: t.note }) : '';
}

/** Inline citation marker for one evidence record. */
export function citeChip(id, i) {
  const d = getDoc(id);
  return `<button type="button" class="cite" data-action="evidence" data-ids="${esc(id)}" title="${esc(d ? `${d.sourceName}\n${d.title}` : id)}">${i != null ? i : '↗'}</button>`;
}

export function sourcesLine(ids = []) {
  const uniq = [...new Set(ids)].filter((id) => getDoc(id));
  if (!uniq.length) return '';
  return `<div class="sources-line"><span>Evidence</span>${uniq.map((id) => `<button type="button" class="src-pill" data-action="evidence" data-ids="${esc(id)}">${esc(getDoc(id).sourceName.split(' — ')[0])} · ${esc(getDoc(id).recordId)}</button>`).join('')}</div>`;
}

/** A block of AI-generated analysis, visibly distinct from sourced facts (FR-072). */
export function aiBlock(t, heading = 'AI-generated analysis') {
  if (!t) return '';
  return `<div class="ai-block"><div class="ai-head"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8L2.5 17.5l1.8-.7z"/></svg>${esc(heading)}</div><p>${esc(t.value)}</p>${sourcesLine(t.sources)}</div>`;
}

export function fmtValue(v, unit) {
  if (Array.isArray(v)) return v.map(esc).join(', ');
  if (typeof v === 'number') {
    if (unit === '%') return pct(v, 0);
    return `${num(v, v < 10 && v % 1 ? 1 : 0)}${unit ? ` ${esc(unit)}` : ''}`;
  }
  return esc(v);
}

/** Definition rows [label, tagged value]. */
export function factRows(rows) {
  return `<dl class="facts">${rows.map(([label, t]) => `<div class="fact"><dt>${esc(label)}</dt><dd><span>${fmtValue(t.value, t.unit)}</span>${tagChip(t)}</dd></div>`).join('')}</dl>`;
}

/** Tiny markdown renderer for assistant replies: bold, italics, lists, tables, citations. */
export function renderMarkdown(md, citeIndex = new Map()) {
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/\[\[([^\]]+)\]\]/g, (_, id) => {
        const clean = id.replace(/&amp;/g, '&');
        if (!getDoc(clean)) return '';
        if (!citeIndex.has(clean)) citeIndex.set(clean, citeIndex.size + 1);
        return citeChip(clean, citeIndex.get(clean));
      });
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\|.*\|$/.test(line.trim()) && /^\|[\s:|-]+\|$/.test(lines[i + 1]?.trim() ?? '')) {
      const head = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim()))
        rows.push(
          lines[i++]
            .trim()
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim()),
        );
      out.push(
        `<div class="table-wrap"><table class="md-table"><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (/^\s*[-•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-•]\s+/, ''));
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`);
      continue;
    }
    if (/^#{1,4}\s+/.test(line)) {
      out.push(`<p class="md-h">${inline(line.replace(/^#{1,4}\s+/, ''))}</p>`);
    } else if (line.trim()) {
      out.push(`<p>${inline(line)}</p>`);
    }
    i++;
  }
  return out.join('');
}
