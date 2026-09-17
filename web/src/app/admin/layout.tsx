'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminBottomNav from '@/components/admin/AdminBottomNav';

const COLLAPSE_KEY = 'admin-sidebar-collapsed';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace('/login');
  }, [_hasHydrated, isAuthenticated, router]);

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
          {children}
        </main>
      </div>
      <AdminBottomNav onMore={() => setSidebarOpen(true)} />
    </div>
  );
}
