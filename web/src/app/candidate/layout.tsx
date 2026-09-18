'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useCandidateAuth } from '@/lib/candidateAuth';
import {
  LayoutDashboard, User, Briefcase, FileText, LogOut, ChevronRight, Share2, ClipboardList
} from 'lucide-react';

const nav = [
  { href: '/candidate/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/candidate/profile',     icon: User,             label: 'My Profile' },
  { href: '/candidate/jobs',        icon: Briefcase,        label: 'My Applications' },
  { href: '/candidate/shared-with', icon: Share2,           label: 'Shared With' },
  { href: '/candidate/tracking',    icon: ClipboardList,    label: 'My Tracking' },
];

const PUBLIC_PATHS = ['/candidate/login', '/candidate/register'];

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, candidate, logout } = useCandidateAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isPublic && !isAuthenticated) router.replace('/candidate/login');
    if (isPublic && isAuthenticated) router.replace('/candidate/dashboard');
  }, [_hasHydrated, isAuthenticated, isPublic, router]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isPublic) return <>{children}</>;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar (mobile + desktop) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-14 flex items-center px-4 lg:px-6 gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-primary-400 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <span className="font-bold text-gray-900 text-sm hidden sm:block">Al Khadim</span>
        </Link>
        <ChevronRight size={14} className="text-gray-400 hidden sm:block" />
        <span className="text-sm text-gray-500 hidden sm:block">Candidate Portal</span>

        <div className="flex-1" />

        {/* Avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center shrink-0">
            {candidate?.photo
              ? <img src={`${process.env.NEXT_PUBLIC_API_URL}/${candidate.photo}`} className="w-full h-full object-cover" alt="" />
              : <span className="text-primary-600 font-bold text-xs">{candidate?.firstName?.[0]}{candidate?.lastName?.[0]}</span>
            }
          </div>
          <span className="text-sm font-semibold text-gray-900 hidden sm:block">{candidate?.firstName}</span>
        </div>
      </header>

      <div className="flex flex-1 pt-14">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-56 fixed left-0 top-14 bottom-0 bg-white border-r border-gray-200 py-6 px-3">
          <nav className="flex-1 space-y-0.5">
            {nav.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    active
                      ? 'bg-primary-50 text-primary-600 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
              onClick={() => logout().then(() => router.replace('/candidate/login'))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition-all w-full"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:ml-56 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-primary-500' : 'text-gray-500'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => logout().then(() => router.replace('/candidate/login'))}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-red-400"
        >
          <LogOut size={20} strokeWidth={1.8} />
          Logout
        </button>
      </nav>
    </div>
  );
}
