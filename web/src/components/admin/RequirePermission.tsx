'use client';
import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { firstAccessiblePath, hasPermission } from '@/lib/permissions';

/** Friendly "no access" state, used by the admin layout's page guard and RequirePermission. */
export function NoAccess({ message }: { message?: string }) {
  const user = useAuth(s => s.user);
  const home = firstAccessiblePath(user);
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto mb-5">
          <ShieldOff size={24} className="text-gray-400" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-1.5">You don&apos;t have access to this page</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          {message || 'Your role doesn’t include permission to view this section. Ask an administrator if you need access.'}
        </p>
        {home && (
          <Link href={home}
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors">
            {home === '/admin' ? 'Back to dashboard' : 'Go to an accessible page'}
          </Link>
        )}
      </div>
    </div>
  );
}

interface RequirePermissionProps {
  module: string;
  action?: string;
  children: React.ReactNode;
  /** Rendered instead of the default NoAccess state when permission is missing. */
  fallback?: React.ReactNode;
}

/**
 * Client-side permission gate. The backend enforces the same check
 * (src/server/permissions.ts); this only avoids rendering UI the user can't use.
 */
export default function RequirePermission({ module, action = 'view', children, fallback }: RequirePermissionProps) {
  const user = useAuth(s => s.user);
  if (!hasPermission(user, module, action)) return <>{fallback ?? <NoAccess />}</>;
  return <>{children}</>;
}
