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
    <nav aria-label="Quick links" className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pointer-events-none"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      {/* Same frosted teal-night glass as the top navbar, tinted enough to stay legible over light sections. */}
      <div className="pointer-events-auto relative flex items-center h-16 px-1.5 gap-1 rounded-[22px] overflow-hidden
        bg-gradient-to-b from-hp-ink/70 to-hp-ink/85 backdrop-blur-xl backdrop-saturate-150
        border border-white/10 shadow-[0_12px_36px_-8px_rgba(6,30,38,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}
              className={`relative flex-1 h-[52px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 active:scale-95 ${active ? 'bg-white/[0.12] ring-1 ring-white/10' : 'hover:bg-white/[0.06]'}`}>
              {active && <span aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-b-full bg-hp-gold shadow-[0_0_10px_rgba(198,161,91,0.8)]" />}
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-hp-gold' : 'text-white/85'} />
              <span className={`text-[10px] font-semibold tracking-wide leading-none ${active ? 'text-hp-gold' : 'text-white/70'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
