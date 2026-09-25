// Export the recommendation as a PowerPoint deck or PDF report, in English or
// Arabic. Renderers and fonts load on demand so the main bundle stays small.

import { buildReport, reportFilename } from './report.js';

async function loadFonts() {
  const { regular, bold } = await import('./fonts.js');
  const b64 = (dataUrl) => dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { regular: b64(regular), bold: b64(bold) };
}

/** Offer a file to the viewer: artifact download capability when hosted, else a normal download. */
async function saveFile(filename, data) {
  const blob = new Blob([data]);
  const claude = typeof window !== 'undefined' ? window.claude : undefined;
  if (claude?.use) {
    const downloads = await claude.use('downloads');
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
        return 'saved';
      } catch (error) {
        if (error?.code === 'declined') return 'declined';
        if (error?.code === 'rate_limited') return 'busy';
        if (!['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(error?.code)) throw error;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'saved';
}

/**
 * Build and offer the recommendation pack.
 * @param {object} session  analysis session with a computed recommendation
 * @param {{format: 'pptx'|'pdf', lang: 'en'|'ar'}} opts
 * @returns {Promise<{status: string, filename: string}>}
 */
export async function exportRecommendation(session, { format, lang }) {
  const report = buildReport(session, lang);
  const filename = reportFilename(report, format);
  let data;
  if (format === 'pptx') {
    const { buildPptx } = await import('./pptx.js');
    data = await buildPptx(report);
  } else {
    const [{ buildPdf }, fonts] = await Promise.all([import('./pdf.js'), loadFonts()]);
    data = buildPdf(report, fonts);
  }
  return { status: await saveFile(filename, data), filename };
}
