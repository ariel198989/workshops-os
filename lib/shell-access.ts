export type StaffRole = 'owner' | 'admin' | 'instructor' | 'guest';

export interface Whoami {
  readonly user_id: string;
  readonly staff: { readonly role: StaffRole; readonly full_name: string } | null;
  readonly workshops: readonly { readonly workshop_id: string; readonly role: string }[];
  readonly participations: readonly unknown[];
}

const ROLE_LABELS: Readonly<Record<StaffRole, string>> = {
  owner: 'בעלים',
  admin: 'מנהל',
  instructor: 'מדריך',
  guest: 'אורח',
};

export function roleLabel(role: StaffRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : '';
}

/** Console access = platform staff row, or at least one participation. */
export function hasConsoleAccess(whoami: Whoami | null): boolean {
  if (!whoami) return false;
  return whoami.staff !== null || whoami.participations.length > 0;
}

/** Paths rendered without AuthGate and Shell. */
export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/verify' || pathname.startsWith('/verify/');
}
