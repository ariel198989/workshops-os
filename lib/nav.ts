export type NavId =
  | 'dashboard' | 'workshops' | 'orgs' | 'curriculum' | 'models' | 'certificates' | 'settings';

export interface NavItem {
  readonly id: NavId;
  readonly href: string;
  readonly label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', href: '/', label: 'לוח בקרה' },
  { id: 'workshops', href: '/workshops', label: 'סדנאות' },
  { id: 'orgs', href: '/orgs', label: 'ארגונים' },
  { id: 'curriculum', href: '/curriculum', label: 'תבניות וקוריקולום' },
  { id: 'models', href: '/models', label: 'מודלים ודאטה' },
  { id: 'certificates', href: '/certificates', label: 'תעודות' },
  { id: 'settings', href: '/settings', label: 'הגדרות' },
];

export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
