'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { decideRoute, isPublicPath } from '@/lib/shell-access';
import { useStore } from '@/lib/store';
import { wsAuthStore } from '@/lib/ws/staff';
import { NotStaffCard } from '@/components/auth/NotStaffCard';
import { AuthGate } from './AuthGate';
import { Shell } from './Shell';

/** Runs inside AuthGate (whoami is loaded): console for staff, a "staff only" card for everyone else. */
function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { whoami } = useStore(wsAuthStore);
  // 'denied' (whoami failed to load) is handled by AuthGate, which never renders children in that case
  const decision = decideRoute(whoami, pathname);
  if (decision.kind === 'staff') return <Shell>{children}</Shell>;
  if (decision.kind === 'public') return <>{children}</>;
  return <NotStaffCard />;
}

/** Wraps the app in AuthGate + RouteGuard; public routes (/verify/*) render bare. */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicPath(pathname)) return <>{children}</>;
  return (
    <AuthGate>
      <RouteGuard>{children}</RouteGuard>
    </AuthGate>
  );
}
