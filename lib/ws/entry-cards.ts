// Pure data for the printed "כרטיסי כניסה" sheet: one card per group, six cards per A4 page. Unit tested.
import { fallbackLine, isJoinToken, isPin, joinUrl } from './group-access';
import type { OverviewGroup, WsGroup } from './types';
import { isWorkshopNumber, numberedFallbackLine } from './workshop-number';

export const CARDS_PER_PAGE = 6;

export interface EntryCard {
  groupId: string;
  number: number;
  /** display name or "קבוצה N" */
  label: string;
  /** the one-scan join url, null when the row has no valid token */
  joinUrl: string | null;
  pin: string | null;
  code: string;
  /** the 4-digit workshop number (0015), null until the workshop is confirmed or live */
  shortCode: string | null;
}

/** Board order is kept; a group without a ws_groups row (viewer without the grant) still gets a card, without QR or PIN. */
export function entryCards(
  groups: readonly OverviewGroup[], rows: readonly WsGroup[], code: string, studentUrl: string,
  shortCode: string | null = null,
): EntryCard[] {
  const number = isWorkshopNumber(shortCode) ? shortCode : null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return groups.map((g) => {
    const row = byId.get(g.group_id);
    return {
      groupId: g.group_id,
      number: g.number,
      label: g.display_name ?? `קבוצה ${g.number}`,
      joinUrl: isJoinToken(row?.join_token) ? joinUrl(studentUrl, row.join_token) : null,
      pin: isPin(row?.pin) ? row.pin : null,
      code,
      shortCode: number,
    };
  });
}

/** The no-camera line under the QR: starts with the workshop number when there is one. The PIN is rendered separately. */
export function cardFallbackLine(card: Pick<EntryCard, 'code' | 'number' | 'shortCode'>): string {
  return card.shortCode ? numberedFallbackLine(card.shortCode, card.number) : fallbackLine(card.code, card.number);
}

/** Splits cards into pages of `perPage`; the last page may be short. No empty pages. */
export function paginate<T>(items: readonly T[], perPage: number = CARDS_PER_PAGE): T[][] {
  if (perPage < 1) throw new Error('perPage must be at least 1');
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}
