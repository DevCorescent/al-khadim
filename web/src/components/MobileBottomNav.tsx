'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Briefcase, Search, Users, User } from 'lucide-react';

const tabs = [
  { label: 'Home',      href: '/',                    icon: Home },
  { label: 'Jobs',      href: '/careers',             icon: Search },
  { label: 'Talent',    href: '/candidates',          icon: Users },
  { label: 'Services',  href: '/services',            icon: Briefcase },
  { label: 'My Portal', href: '/candidate/dashboard', icon: User },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin') || pathname.startsWith('/candidate/')) return null;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pointer-events-none"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto rounded-2xl overflow-hidden flex items-center h-16 px-2 gap-1"
        style={{
          background: 'rgba(10,10,16,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05) inset',
        }}>
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all duration-200 active:scale-90"
              style={{
                background: active ? '#2563EB' : 'transparent',
                boxShadow:  active ? '0 2px 12px rgba(37,99,235,0.4)' : 'none',
              }}>
              <Icon
                size={18}
                strokeWidth={active ? 2.5 : 1.8}
                style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.4)' }}
              />
              <span className="text-[9px] font-bold tracking-wide leading-none"
                style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.35)' }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
