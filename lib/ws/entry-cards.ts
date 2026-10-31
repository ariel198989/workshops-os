// Pure data for the printed "כרטיסי כניסה" sheet: one card per group, six cards per A4 page. Unit tested.
import { isJoinToken, isPin, joinUrl } from './group-access';
import type { OverviewGroup, WsGroup } from './types';

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
}

/** Board order is kept; a group without a ws_groups row (viewer without the grant) still gets a card, without QR or PIN. */
export function entryCards(
  groups: readonly OverviewGroup[], rows: readonly WsGroup[], code: string, studentUrl: string,
): EntryCard[] {
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
    };
  });
}

/** Splits cards into pages of `perPage`; the last page may be short. No empty pages. */
export function paginate<T>(items: readonly T[], perPage: number = CARDS_PER_PAGE): T[][] {
  if (perPage < 1) throw new Error('perPage must be at least 1');
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}
