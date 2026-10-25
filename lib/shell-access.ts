import type { StaffRole, Whoami } from './ws/types';

// The canonical types live in lib/ws/types; re-exported so nav.ts and tests keep one import site.
export type { StaffRole, Whoami };

const ROLE_LABELS: Readonly<Record<StaffRole, string>> = {
  owner: 'בעלים',
  admin: 'מנהל',
  instructor: 'מדריך',
  guest: 'אורח',
};

export function roleLabel(role: StaffRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : '';
}

/** Paths rendered without AuthGate and Shell. */
export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/verify' || pathname.startsWith('/verify/');
}

/**
 * What the frame renders for a signed-in user:
 * public = bare page, staff = console Shell, not-staff = "this area is for Corewise staff" card
 * (students use the separate student app), denied = whoami could not be loaded.
 */
export type RouteDecision =
  | { kind: 'public' }
  | { kind: 'staff' }
  | { kind: 'not-staff' }
  | { kind: 'denied' };

export function decideRoute(whoami: Whoami | null, pathname: string | null): RouteDecision {
  if (isPublicPath(pathname)) return { kind: 'public' };
  if (!whoami) return { kind: 'denied' };
  return whoami.staff !== null ? { kind: 'staff' } : { kind: 'not-staff' };
}
