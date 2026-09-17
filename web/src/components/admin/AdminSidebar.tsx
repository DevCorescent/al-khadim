'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Briefcase, UserCheck, Calendar,
  Building2, FileText, BarChart3, Settings, LogOut,
  ChevronDown, ChevronsLeft, ChevronsRight, Clock, DollarSign, Globe,
  ClipboardList, Bell, UserPlus, Palette, X, Shield, Mail, Share2, TrendingUp,
  Receipt, Landmark, PieChart, Bot,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  {
    label: 'CRM', icon: Building2, children: [
      { label: 'Deals',      href: '/admin/crm/deals',      icon: TrendingUp },
      { label: 'Clients',    href: '/admin/crm',            icon: Building2 },
      { label: 'Follow-Ups', href: '/admin/crm/follow-ups', icon: Bell },
      { label: 'Enquiries',  href: '/admin/crm/enquiries',  icon: ClipboardList },
    ],
  },
  {
    label: 'Finance', icon: DollarSign, children: [
      { label: 'Overview',  href: '/admin/finance',          icon: DollarSign },
      { label: 'Invoices',  href: '/admin/crm/invoices',     icon: FileText },
      { label: 'Expenses',  href: '/admin/finance/expenses', icon: Receipt },
      { label: 'Payroll',   href: '/admin/payroll',          icon: DollarSign },
      { label: 'Accounts',  href: '/admin/finance/accounts', icon: Landmark },
      { label: 'Budgets',   href: '/admin/finance/budgets',  icon: PieChart },
    ],
  },
  {
    label: 'Recruitment', icon: UserPlus, children: [
      { label: 'Candidates',       href: '/admin/candidates',               icon: Users },
      { label: 'Job Orders',       href: '/admin/jobs',                     icon: Briefcase },
      { label: 'Interviews',       href: '/admin/interviews',               icon: Calendar },
      { label: 'CV Registrations', href: '/admin/candidates/registrations', icon: UserCheck },
      { label: 'Profile Requests', href: '/admin/profile-requests',         icon: Bell },
      { label: 'Profile Shares',   href: '/admin/profile-shares',           icon: Share2 },
      { label: 'Candidate Tracking', href: '/admin/candidate-tracking',     icon: ClipboardList },
    ],
  },
  {
    label: 'HRMS', icon: UserCheck, children: [
      { label: 'Employees',  href: '/admin/employees',  icon: Users },
      { label: 'Attendance', href: '/admin/attendance', icon: Clock },
      { label: 'Leave',      href: '/admin/leave',      icon: Calendar },
    ],
  },
  { label: 'Outsourcing', href: '/admin/outsourcing', icon: Globe },
  { label: 'Documents',   href: '/admin/documents',   icon: FileText },
  { label: 'Emails',      href: '/admin/emails',      icon: Mail },
  { label: 'Reports',     href: '/admin/reports',     icon: BarChart3 },
  {
    label: 'Team', icon: Users, children: [
      { label: 'Users',         href: '/admin/users',       icon: Users },
      { label: 'Roles & Perms', href: '/admin/users/roles', icon: Shield },
    ],
  },
  { label: 'Site Editor', href: '/admin/site-editor', icon: Palette },
  {
    label: 'Settings', icon: Settings, children: [
      { label: 'General',    href: '/admin/settings',              icon: Settings },
      { label: 'Categories', href: '/admin/settings/categories',   icon: ClipboardList },
      { label: 'Industries', href: '/admin/settings/industries',   icon: Globe },
      { label: 'Email',      href: '/admin/settings/email',        icon: Mail },
      { label: 'AI Assistant', href: '/admin/settings/ai',         icon: Bot },
    ],
  },
];

const INK = '#18181b'; // matte black — the single brand accent used across nav chrome

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AdminSidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string[]>(['CRM', 'Finance', 'Recruitment', 'HRMS', 'Team', 'Settings']);

  const toggle = (label: string) =>
    setExpanded(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);

  const handleLogout = () => { logout(); router.push('/login'); };
  const handleNavClick = () => { onClose?.(); };

  const c = !!collapsed;

  const sidebar = (
    <div className={clsx('flex flex-col h-full bg-white transition-[width] duration-200 ease-out', c ? 'w-[68px]' : 'w-[220px]')}
      style={{ borderRight: '1px solid #e5e7eb' }}>
      {/* Logo */}
      <div className={clsx('pt-5 pb-4 flex items-center shrink-0', c ? 'px-3 justify-center' : 'px-4 justify-between')}>
        <Link href="/admin" onClick={handleNavClick} className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: INK }}>
            <span className="text-white font-black text-sm tracking-tight">AK</span>
          </div>
          {!c && (
            <div className="min-w-0">
              <p className="font-bold text-[13px] leading-tight tracking-wide text-gray-900 truncate">AL KHADIM</p>
              <p className="text-[10px] font-medium leading-tight text-gray-400 truncate">Admin Portal</p>
            </div>
          )}
        </Link>
        {!c && onClose && (
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors lg:hidden shrink-0">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className={clsx('mb-3 border-t border-gray-100', c ? 'mx-3' : 'mx-4')} />

      {/* Nav */}
      <nav className={clsx('flex-1 space-y-0.5 overflow-y-auto pb-4 scrollbar-none', c ? 'px-2' : 'px-3')}>
        {navItems.map(item => {
          if (item.children) {
            const isOpen   = expanded.includes(item.label);
            const isActive = item.children.some(ch => pathname === ch.href || pathname.startsWith(ch.href + '/'));

            if (c) {
              // Collapsed: icon-only trigger with a hover flyout listing children.
              return (
                <div key={item.label} className="relative group">
                  <div
                    className="w-full flex items-center justify-center py-2.5 rounded-xl text-gray-500 transition-colors cursor-default"
                    style={isActive ? { background: '#f4f4f5', color: INK } : undefined}
                  >
                    <item.icon size={16} />
                  </div>
                  <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-40 min-w-[180px] bg-white rounded-xl border border-gray-100 shadow-lg py-1.5">
                    <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
                    {item.children.map(child => {
                      const active = pathname === child.href || pathname.startsWith(child.href + '/');
                      return (
                        <Link key={child.href} href={child.href} onClick={handleNavClick}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors"
                          style={active ? { background: INK, color: '#fff' } : { color: '#4b5563' }}
                        >
                          <child.icon size={13} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggle(item.label)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-gray-50"
                  style={{ color: isActive ? INK : '#6b7280', background: isActive ? '#f4f4f5' : 'transparent' }}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon size={14} />
                    <span className="tracking-wide">{item.label}</span>
                  </span>
                  <ChevronDown size={12}
                    className={clsx('transition-transform duration-200 text-gray-300', isOpen ? 'rotate-0' : '-rotate-90')} />
                </button>

                {isOpen && (
                  <div className="mt-0.5 mb-1 ml-3 pl-3 space-y-0.5 border-l-[1.5px] border-gray-100">
                    {item.children.map(child => {
                      const active = pathname === child.href || pathname.startsWith(child.href + '/');
                      return (
                        <Link key={child.href} href={child.href} onClick={handleNavClick}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors hover:bg-gray-100"
                          style={active ? { color: '#fff', background: INK } : { color: '#6b7280' }}
                        >
                          <child.icon size={12} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = pathname === item.href;
          const link = (
            <Link key={item.href!} href={item.href!} onClick={handleNavClick}
              className={clsx('flex items-center rounded-xl text-xs font-semibold transition-colors',
                c ? 'justify-center py-2.5' : 'gap-2.5 px-3 py-2 hover:bg-gray-50')}
              style={active ? { color: '#fff', background: INK } : { color: '#6b7280' }}
            >
              <item.icon size={c ? 16 : 14} />
              {!c && <span className="tracking-wide">{item.label}</span>}
            </Link>
          );
          if (!c) return link;
          return (
            <div key={item.href} className="relative group">
              {link}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block z-40 whitespace-nowrap bg-white rounded-lg border border-gray-100 shadow-lg px-3 py-1.5 text-xs font-semibold text-gray-700">
                {item.label}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Divider */}
      <div className={clsx('border-t border-gray-100', c ? 'mx-3' : 'mx-4')} />

      {/* Collapse toggle (desktop only) */}
      {onToggleCollapse && (
        <button onClick={onToggleCollapse}
          className={clsx('hidden lg:flex items-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors mx-3 mt-2 py-2 text-xs font-semibold',
            c ? 'justify-center' : 'justify-start gap-2 px-3')}
          title={c ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {c ? <ChevronsRight size={15} /> : <><ChevronsLeft size={15} /> Collapse</>}
        </button>
      )}

      {/* User footer */}
      <div className={clsx('py-3 shrink-0', c ? 'px-2' : 'px-3')}>
        <div className={clsx('flex items-center rounded-xl mb-1 bg-gray-50', c ? 'justify-center py-2' : 'gap-2.5 px-3 py-2.5')}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[11px] shrink-0" style={{ background: INK }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          {!c && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-800 leading-tight truncate">{user?.name}</p>
              <p className="text-[9px] font-medium leading-tight truncate text-gray-400">{user?.role}</p>
            </div>
          )}
        </div>
        <button onClick={handleLogout}
          className={clsx('w-full flex items-center rounded-xl text-xs font-semibold text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors',
            c ? 'justify-center py-2' : 'gap-2 px-3 py-1.5')}
          title="Sign Out"
        >
          <LogOut size={13} />
          {!c && 'Sign Out'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex h-full">
        {sidebar}
      </div>

      {/* Mobile drawer (never collapsed) */}
      <div className={clsx('lg:hidden fixed inset-0 z-50 flex transition-all duration-300', open ? 'visible' : 'invisible')}>
        <div
          className={clsx('absolute inset-0 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
        <div className={clsx('relative flex h-full transition-transform duration-300 ease-out', open ? 'translate-x-0' : '-translate-x-full')}>
          <div className="w-[220px] flex flex-col h-full bg-white" style={{ borderRight: '1px solid #e5e7eb' }}>
            {/* Re-render the uncollapsed variant for mobile regardless of desktop collapse state */}
            <MobileSidebarBody pathname={pathname} onClose={onClose} />
          </div>
        </div>
      </div>
    </>
  );
}

/** Always-expanded nav body used inside the mobile drawer, independent of desktop collapse state. */
function MobileSidebarBody({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string[]>(['CRM', 'Finance', 'Recruitment', 'HRMS', 'Team', 'Settings']);
  const toggle = (label: string) =>
    setExpanded(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  const handleLogout = () => { logout(); router.push('/login'); };
  const handleNavClick = () => { onClose?.(); };

  return (
    <>
      <div className="px-4 pt-5 pb-4 flex items-center justify-between shrink-0">
        <Link href="/admin" onClick={handleNavClick} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: INK }}>
            <span className="text-white font-black text-sm tracking-tight">AK</span>
          </div>
          <div>
            <p className="font-bold text-[13px] leading-tight tracking-wide text-gray-900">AL KHADIM</p>
            <p className="text-[10px] font-medium leading-tight text-gray-400">Admin Portal</p>
          </div>
        </Link>
        <button onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X size={15} />
        </button>
      </div>
      <div className="mx-4 mb-3 border-t border-gray-100" />
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4 scrollbar-none">
        {navItems.map(item => {
          if (item.children) {
            const isOpen   = expanded.includes(item.label);
            const isActive = item.children.some(ch => pathname === ch.href || pathname.startsWith(ch.href + '/'));
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggle(item.label)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-gray-50"
                  style={{ color: isActive ? INK : '#6b7280', background: isActive ? '#f4f4f5' : 'transparent' }}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon size={14} />
                    <span className="tracking-wide">{item.label}</span>
                  </span>
                  <ChevronDown size={12} className={clsx('transition-transform duration-200 text-gray-300', isOpen ? 'rotate-0' : '-rotate-90')} />
                </button>
                {isOpen && (
                  <div className="mt-0.5 mb-1 ml-3 pl-3 space-y-0.5 border-l-[1.5px] border-gray-100">
                    {item.children.map(child => {
                      const active = pathname === child.href || pathname.startsWith(child.href + '/');
                      return (
                        <Link key={child.href} href={child.href} onClick={handleNavClick}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors hover:bg-gray-100"
                          style={active ? { color: '#fff', background: INK } : { color: '#6b7280' }}
                        >
                          <child.icon size={12} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const active = pathname === item.href;
          return (
            <Link key={item.href!} href={item.href!} onClick={handleNavClick}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-gray-50"
              style={active ? { color: '#fff', background: INK } : { color: '#6b7280' }}
            >
              <item.icon size={14} />
              <span className="tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mx-4 border-t border-gray-100" />
      <div className="px-3 py-3 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 bg-gray-50">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[11px] shrink-0" style={{ background: INK }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-800 leading-tight truncate">{user?.name}</p>
            <p className="text-[9px] font-medium leading-tight truncate text-gray-400">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </>
  );
}
