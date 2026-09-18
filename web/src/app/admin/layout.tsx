'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import { NoAccess } from '@/components/admin/RequirePermission';
import { canViewPath, firstAccessiblePath } from '@/lib/permissions';

const COLLAPSE_KEY = 'admin-sidebar-collapsed';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, user, refreshMe } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace('/login');
  }, [_hasHydrated, isAuthenticated, router]);

  // Refresh role/permissions from the server on mount so changes an admin made to
  // this user's role apply without signing out and back in.
  useEffect(() => {
    if (_hasHydrated && isAuthenticated) refreshMe().catch(() => { /* 401s are handled by the api client */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isAuthenticated]);

  // Users without dashboard access land on /admin after login — send them to the
  // first page they can open instead of an access-denied screen.
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || pathname !== '/admin' || canViewPath(user, '/admin')) return;
    const home = firstAccessiblePath(user);
    if (home) router.replace(home);
  }, [_hasHydrated, isAuthenticated, pathname, user, router]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true');
    } catch { /* ignore */ }
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{background:'#f4f5f7'}}>
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminHeader onMenuOpen={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto px-3 sm:px-5 pb-24 lg:pb-5 pt-3">
          {canViewPath(user, pathname) ? children : <NoAccess />}
        </main>
      </div>
      <AdminBottomNav onMore={() => setSidebarOpen(true)} />
    </div>
  );
}
