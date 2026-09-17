'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Briefcase, Building2, Menu } from 'lucide-react';
import { clsx } from 'clsx';

const QUICK_ACTIONS = [
  { href: '/admin',            icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/candidates', icon: Users,            label: 'Candidates' },
  { href: '/admin/jobs',       icon: Briefcase,        label: 'Jobs' },
  { href: '/admin/crm',        icon: Building2,        label: 'Clients' },
];

interface AdminBottomNavProps { onMore?: () => void; }

export default function AdminBottomNav({ onMore }: AdminBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {QUICK_ACTIONS.map(({ href, icon: Icon, label }) => {
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link key={href} href={href}
            className={clsx('flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
              active ? 'text-black' : 'text-gray-400')}
          >
            <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
            {label}
          </Link>
        );
      })}
      <button onClick={onMore}
        className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-gray-400"
      >
        <Menu size={19} strokeWidth={1.8} />
        More
      </button>
    </nav>
  );
}
