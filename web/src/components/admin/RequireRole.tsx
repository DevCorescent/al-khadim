'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

interface RequireRoleProps {
  allow: string[];
  children: React.ReactNode;
}

/**
 * Client-side role gate. Mirrors the hydration-gated redirect pattern in
 * `web/src/app/admin/layout.tsx`: wait for the auth store to hydrate, then
 * redirect away if the user is authenticated but not in the allowed role list.
 * The real enforcement is the backend's `authorize()` middleware — this only
 * prevents the UI from flashing content the user can't act on.
 */
export default function RequireRole({ allow, children }: RequireRoleProps) {
  const { user, isAuthenticated, _hasHydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (_hasHydrated && isAuthenticated && user && !allow.includes(user.role)) {
      router.replace('/admin');
    }
  }, [_hasHydrated, isAuthenticated, user, allow, router]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated && user && !allow.includes(user.role)) return null;

  return <>{children}</>;
}
