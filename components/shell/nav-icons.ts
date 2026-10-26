import type { IconSvgElement } from '@hugeicons/react';
import {
  DashboardSquare01Icon, Calendar01Icon, Building02Icon, Layers01Icon,
  Brain02Icon, Certificate01Icon, Settings02Icon, UserMultiple02Icon,
} from '@hugeicons/core-free-icons';
import type { NavId } from '@/lib/nav';

/** One icon per nav section, shared by the desktop sidebar and the phone tab bar. */
export const NAV_ICONS: Record<NavId, IconSvgElement> = {
  dashboard: DashboardSquare01Icon,
  workshops: Calendar01Icon,
  orgs: Building02Icon,
  curriculum: Layers01Icon,
  models: Brain02Icon,
  certificates: Certificate01Icon,
  staff: UserMultiple02Icon,
  settings: Settings02Icon,
};
