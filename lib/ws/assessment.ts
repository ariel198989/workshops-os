// Concept-check summary (ws_concept_summary RPC) plus the pure rendering rules the page needs.
import { sb } from '../db';

export type ConceptPhase = 'pre' | 'post';
export interface ConceptItem {
  id: string; q: string | null; options: string[] | null; answer: number | null; core: string | null;
  counts: number[]; correct: number | null; correct_pct: number | null;
}
export interface ConceptSummaryRow {
  session_module_id: string; module_title: string; phase: ConceptPhase; n: number; items: ConceptItem[];
}

export async function fetchConceptSummary(workshopId: string): Promise<ConceptSummaryRow[]> {
  const { data, error } = await sb.rpc('ws_concept_summary', { p_workshop: workshopId });
  if (error) throw error;
  return (data ?? []) as ConceptSummaryRow[];
}

/** Below this many respondents the RPC withholds percentages and we show "X מתוך Y". */
export const MIN_RESPONDENTS = 15;
export const SMALL_SAMPLE_NOTE = 'פחות מ-15 משיבים: אין אחוזים';
export const PHASE_LABELS: Record<ConceptPhase, string> = { pre: 'לפני', post: 'אחרי' };

const PHASE_ORDER: Record<ConceptPhase, number> = { pre: 0, post: 1 };

/** By module title, then pre before post. Immutable. */
export function sortConceptRows(rows: readonly ConceptSummaryRow[]): ConceptSummaryRow[] {
  return [...rows].sort((a, b) =>
    a.module_title.localeCompare(b.module_title, 'he') || PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);
}

export const isSmallSample = (n: number): boolean => n < MIN_RESPONDENTS;

export const correctLabel = (pct: number | null): string => (pct === null ? '-' : `${Math.round(pct)}%`);

/** One label per answer option: "X מתוך Y" for small samples, the raw count otherwise. */
export function countLabels(n: number, counts: readonly number[]): string[] {
  return counts.map((c) => (isSmallSample(n) ? `${c} מתוך ${n}` : String(c)));
}

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

/** "א. 3 מתוך 12 · ב. 9 מתוך 12", the correct option marked with ✓. */
export function optionLabels(item: ConceptItem, n: number): string[] {
  return countLabels(n, item.counts).map((label, i) =>
    `${LETTERS[i] ?? i + 1}. ${label}${item.answer === i ? ' ✓' : ''}`);
}

/** The question text, or its id when the module stored none. */
export const questionLabel = (item: ConceptItem): string => item.q?.trim() || item.id;
