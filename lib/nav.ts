import type { StaffRole } from './shell-access';

export type NavId =
  | 'dashboard' | 'workshops' | 'orgs' | 'curriculum' | 'models' | 'certificates' | 'staff' | 'settings';

export interface NavItem {
  readonly id: NavId;
  readonly href: string;
  readonly label: string;
  /** when set, the item is shown only to these platform roles */
  readonly roles?: readonly StaffRole[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', href: '/', label: 'לוח בקרה' },
  { id: 'workshops', href: '/workshops', label: 'סדנאות' },
  { id: 'orgs', href: '/orgs', label: 'ארגונים' },
  { id: 'curriculum', href: '/curriculum', label: 'תבניות וקוריקולום' },
  { id: 'models', href: '/models', label: 'מודלים ודאטה' },
  { id: 'certificates', href: '/certificates', label: 'תעודות' },
  { id: 'staff', href: '/staff', label: 'צוות', roles: ['owner', 'admin'] },
  { id: 'settings', href: '/settings', label: 'הגדרות' },
];

export function visibleNavItems(role: StaffRole | null | undefined): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role != null && item.roles.includes(role)));
}

export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Short labels for the phone tab bar (11px under an icon); items not listed keep their label. */
const MOBILE_LABELS: Partial<Record<NavId, string>> = {
  dashboard: 'לוח',
  curriculum: 'מערך',
  models: 'מודלים',
};

export function mobileLabel(item: NavItem): string {
  return MOBILE_LABELS[item.id] ?? item.label;
}

/** Which sections earn a slot in the bottom bar, most important first; the rest go under "עוד". */
const MOBILE_PRIORITY: readonly NavId[] = [
  'workshops', 'orgs', 'curriculum', 'staff', 'certificates', 'models', 'dashboard', 'settings',
];

export interface MobileNav {
  readonly primary: readonly NavItem[];
  readonly more: readonly NavItem[];
}

/** Bottom bar = up to `slots` visible items by priority; everything else (in menu order) under "עוד". */
export function splitMobileNav(items: readonly NavItem[], slots = 4): MobileNav {
  const primary = MOBILE_PRIORITY
    .flatMap((id) => items.filter((item) => item.id === id))
    .slice(0, slots);
  const more = items.filter((item) => !primary.includes(item));
  return { primary, more };
}
