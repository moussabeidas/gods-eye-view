import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSession, computeFrom } from '../src/engine/orchestrator.js';
import { buildReport, reportFilename } from '../src/export/report.js';
import { buildPptx } from '../src/export/pptx.js';
import { buildPdf } from '../src/export/pdf.js';

const fontDir = 'node_modules/@expo-google-fonts/ibm-plex-sans-arabic/';
const fonts = {
  regular: fs.readFileSync(`${fontDir}400Regular/IBMPlexSansArabic_400Regular.ttf`).toString('base64'),
  bold: fs.readFileSync(`${fontDir}700Bold/IBMPlexSansArabic_700Bold.ttf`).toString('base64'),
};
const ARABIC = /[؀-ۿ]/;

const session = computeFrom(createSession('326-0914'));
session.overrides.assumptions['midscale-hotel'] = { discountRate: 0.1 };
computeFrom(session, 'structuring');
session.reviews.recommendation = { status: 'accepted', note: 'Proceed', at: '2026-09-25' };

test('report model carries the same figures in English and Arabic', () => {
  const en = buildReport(session, 'en');
  const ar = buildReport(session, 'ar');
  assert.equal(en.dir, 'ltr');
  assert.equal(ar.dir, 'rtl');
  assert.equal(en.kpis.length, 4);
  assert.deepEqual(
    en.hbu.alternatives.map((a) => a.total),
    ar.hbu.alternatives.map((a) => a.total),
  );
  assert.deepEqual(en.financial.cashflow, ar.financial.cashflow);
  assert.equal(ar.financial.assumptions.find((a) => a.user)?.value, '10.00%', 'user-modified assumption is carried and flagged');
  assert.equal(en.decision.status, 'accepted');
});

test('Arabic pack is written in Arabic, not translated English sentences', () => {
  const ar = buildReport(session, 'ar');
  for (const text of [ar.narrative, ar.verdict.label, ar.headline.use, ar.headline.structure, ...ar.risks, ...ar.conditions, ...ar.reasons]) {
    assert.match(text, ARABIC, text);
  }
  assert.doesNotMatch(ar.narrative, /\b(the|and|with|under)\b/i);
  assert.equal(reportFilename(ar, 'pdf'), 'Investment-Recommendation_326-0914_AR.pdf');
});

test('English pack never presents the AI output as an approval (FR-069)', () => {
  const en = buildReport(session, 'en');
  assert.doesNotMatch(`${en.verdict.label} ${en.narrative}`, /\bapproved\b/i);
  assert.match(en.t.disclaimer, /Not an investment approval/);
});

test('PowerPoint and PDF files are produced for both languages', async () => {
  for (const lang of ['en', 'ar']) {
    const report = buildReport(session, lang);
    const pptx = Buffer.from(await buildPptx(report));
    assert.equal(pptx.subarray(0, 2).toString(), 'PK', 'pptx is a zip package');
    assert.ok(pptx.length > 50_000);
    const pdf = Buffer.from(buildPdf(report, fonts));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 30_000);
  }
});
