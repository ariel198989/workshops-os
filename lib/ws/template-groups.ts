// Pure grouping of curriculum templates by band (curriculum list + new-workshop picker).
import { BANDS, type Band, type ReleaseStatus } from './types';

export interface GateSource { release_status: ReleaseStatus; ai_gate_note: string | null; requires_product: readonly string[] }

/** Text shown under a draft / blocked template: the gate note, or the product dependency, or nothing for live. */
export function templateGateNote(t: GateSource): string | null {
  if (t.release_status === 'live') return null;
  if (t.ai_gate_note) return t.ai_gate_note;
  if (t.release_status === 'blocked') return `תלוי מוצר: ${t.requires_product.length > 0 ? t.requires_product.join(', ') : 'לא צוין'}`;
  return null;
}

export interface BandGroup<T> { band: Band | null; label: string; items: T[] }

/** Groups in BANDS order; templates without a band go last under `noBandLabel`. Empty groups are dropped. */
export function groupTemplatesByBand<T extends { band: Band | null }>(
  templates: readonly T[], labelOf: (band: Band) => string = (b) => b, noBandLabel = 'ללא שכבה',
): BandGroup<T>[] {
  const buckets: (Band | null)[] = [...BANDS, null];
  return buckets
    .map((band) => ({ band, label: band ? labelOf(band) : noBandLabel, items: templates.filter((t) => t.band === band) }))
    .filter((g) => g.items.length > 0);
}
