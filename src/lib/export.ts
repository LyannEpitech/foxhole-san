import type { PlanSummary } from '../engine/resolver';
import { formatDuration } from '../components/PlanExtras';

type Labeler = (refId: string) => string;
type Translator = (key: string) => string;

/** A1.5 — plan totals as a Discord-friendly markdown snippet. */
export function planToDiscordMarkdown(
  result: PlanSummary,
  title: string,
  L: Labeler,
  t: Translator,
): string {
  const lines: string[] = [`**${title}**`];
  const section = (label: string, totals: Record<string, number>) => {
    const entries = Object.entries(totals);
    if (entries.length === 0) return;
    lines.push(`__${label}__`);
    for (const [refId, qty] of entries) lines.push(`- ${L(refId)}: **${qty}**`);
  };
  section(t('totals.raw'), result.totals.raw);
  section(t('totals.refined'), result.totals.refined);
  if (result.buildings.length > 0) {
    lines.push(`__${t('panels.buildings')}__`);
    lines.push(result.buildings.map((b) => L(b.id)).join(', '));
  }
  const makespan = result.buildingTimes.reduce((m, bt) => Math.max(m, bt.seconds), 0);
  if (makespan > 0) lines.push(`__${t('panels.timeline')}__ ${formatDuration(makespan)}`);
  return lines.join('\n');
}

/** A1.5 — plan totals as CSV (section,name,quantity). */
export function planToCsv(result: PlanSummary, L: Labeler, t: Translator): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows: string[] = ['section,name,quantity'];
  for (const [refId, qty] of Object.entries(result.totals.raw)) {
    rows.push(`${esc(t('totals.raw'))},${esc(L(refId))},${qty}`);
  }
  for (const [refId, qty] of Object.entries(result.totals.refined)) {
    rows.push(`${esc(t('totals.refined'))},${esc(L(refId))},${qty}`);
  }
  return rows.join('\n');
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
