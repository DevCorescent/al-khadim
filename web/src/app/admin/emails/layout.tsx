'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import RequirePermission from '@/components/admin/RequirePermission';

const TABS = [
  { label: 'Compose',   href: '/admin/emails' },
  { label: 'Campaigns', href: '/admin/emails/campaigns' },
  { label: 'Templates', href: '/admin/emails/templates' },
  { label: 'Groups',    href: '/admin/emails/groups' },
  { label: 'History',   href: '/admin/emails/history' },
];

export default function EmailsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RequirePermission module="emails">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between border-b border-gray-200 mb-5">
          <nav className="flex gap-1 -mb-px">
            {TABS.map(tab => {
              const active = tab.href === '/admin/emails'
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(tab.href + '/');
              return (
                <Link key={tab.href} href={tab.href}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                    active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/admin/settings/email"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 pb-2.5 transition-colors">
            <ExternalLink size={12} /> SMTP Settings
          </Link>
        </div>
        {children}
      </div>
    </RequirePermission>
  );
}
