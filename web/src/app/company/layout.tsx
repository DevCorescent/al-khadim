'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useClientAuth } from '@/lib/clientAuth';
import { LayoutDashboard, Users2, LogOut, ChevronRight, Bell, Clock, XCircle, Briefcase } from 'lucide-react';

const PUBLIC_PATHS = ['/company/login', '/company/register', '/company/accept-invite', '/company/view'];

function PendingApprovalScreen({ companyName, onLogout }: { companyName?: string; onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Clock size={28} className="text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Your business profile is under review</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          {companyName ? <>Thanks for registering <strong>{companyName}</strong>.</> : 'Thanks for registering.'}{' '}
          Al Khadim's team is reviewing your account. You'll receive an email once it's approved and your full
          dashboard — including candidate profiles shared with your company — is unlocked.
        </p>
        <button onClick={onLogout} className="btn-outline text-sm">Log out</button>
      </div>
    </div>
  );
}

function RejectedScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <XCircle size={28} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">We couldn't approve your business profile</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Please contact Al Khadim for more information about your account status.
        </p>
        <button onClick={onLogout} className="btn-outline text-sm">Log out</button>
      </div>
    </div>
  );
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, clientUser, logout, refreshProfile } = useClientAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  const nav = [
    { href: '/company/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/company/candidates', icon: Users2, label: 'Candidates' },
    { href: '/company/jobs', icon: Briefcase, label: 'Jobs' },
    ...(clientUser?.role === 'COMPANY_ADMIN' ? [{ href: '/company/team', icon: Users2, label: 'Team' }] : []),
  ];

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isPublic && !isAuthenticated) router.replace('/company/login');
    if (pathname === '/company/login' && isAuthenticated) router.replace('/company/dashboard');
  }, [_hasHydrated, isAuthenticated, isPublic, pathname, router]);

  useEffect(() => {
    if (_hasHydrated && isAuthenticated) refreshProfile().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isAuthenticated, pathname]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isPublic) return <>{children}</>;
  if (!isAuthenticated) return null;

  const handleLogout = () => logout().then(() => router.replace('/company/login'));

  if (clientUser?.client?.status === 'PENDING') {
    return <PendingApprovalScreen companyName={clientUser.client.companyName} onLogout={handleLogout} />;
  }
  if (clientUser?.client?.status === 'REJECTED') {
    return <RejectedScreen onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-14 flex items-center px-4 lg:px-6 gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-primary-400 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <span className="font-bold text-gray-900 text-sm hidden sm:block">Al Khadim</span>
        </Link>
        <ChevronRight size={14} className="text-gray-400 hidden sm:block" />
        <span className="text-sm text-gray-500 hidden sm:block">Company Portal</span>

        <div className="flex-1" />

        <button className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={16} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-600 font-bold text-xs">{clientUser?.name?.[0]}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{clientUser?.name}</p>
            <p className="text-[10px] text-gray-400 leading-tight">{clientUser?.client?.companyName}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-14">
        <aside className="hidden lg:flex flex-col w-56 fixed left-0 top-14 bottom-0 bg-white border-r border-gray-200 py-6 px-3">
          <nav className="flex-1 space-y-0.5">
            {nav.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    active ? 'bg-primary-50 text-primary-600 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-primary-500' : 'text-gray-400'} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-100 pt-3 mt-3">
            <button
              onClick={() => logout().then(() => router.replace('/company/login'))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition-all w-full"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-56 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-primary-500' : 'text-gray-500'
              }`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => logout().then(() => router.replace('/company/login'))}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-red-400"
        >
          <LogOut size={20} strokeWidth={1.8} />
          Logout
        </button>
      </nav>
    </div>
  );
}
