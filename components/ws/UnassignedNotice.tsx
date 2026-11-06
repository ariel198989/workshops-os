'use client';
import { useStore } from '@/lib/store';
import { isUnassigned, wsAuthStore } from '@/lib/ws/staff';

export const UNASSIGNED_TEXT = 'אינך משובץ/ת לסדנה הזו, ולכן הנתונים שלה מוסתרים. מנהל יכול לשבץ אותך בהגדרות הסדנה.';

/** True for staff who are not assigned to the workshop (RLS returns empty data to them). */
export function useUnassigned(workshopId: string): boolean {
  const { whoami } = useStore(wsAuthStore);
  return isUnassigned(whoami, workshopId);
}

/** Shown instead of the workshop's tabs, which would otherwise render empty without explanation. */
export function UnassignedNotice() {
  return (
    <p className="hud muted" role="status" style={{ padding: 24, textAlign: 'center' }}>{UNASSIGNED_TEXT}</p>
  );
}
