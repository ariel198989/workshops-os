'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isPublicPath } from '@/lib/shell-access';
import { AuthGate } from './AuthGate';
import { Shell } from './Shell';

/** Wraps the console in AuthGate + Shell; public routes (/verify/*) render bare. */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicPath(pathname)) return <>{children}</>;
  return (
    <AuthGate>
      <Shell>{children}</Shell>
    </AuthGate>
  );
}
