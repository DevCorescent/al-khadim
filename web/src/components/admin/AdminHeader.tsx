'use client';
import { usePathname } from 'next/navigation';
import { Bell, Search, Menu, ChevronRight, Bot } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useState } from 'react';
import AssistantPanel from './ai/AssistantPanel';

const breadcrumbs: Record<string, { label: string; parent?: string; parentHref?: string }> = {
  '/admin':                           { label: 'Dashboard' },
  '/admin/crm':                       { label: 'Clients',          parent: 'CRM' },
  '/admin/crm/follow-ups':            { label: 'Follow-Ups',       parent: 'CRM' },
  '/admin/crm/enquiries':             { label: 'Enquiries',        parent: 'CRM' },
  '/admin/crm/invoices':              { label: 'Invoices',         parent: 'CRM' },
  '/admin/candidates':                { label: 'Candidates',       parent: 'Recruitment' },
  '/admin/candidates/registrations':  { label: 'CV Registrations', parent: 'Recruitment' },
  '/admin/profile-requests':          { label: 'Profile Requests', parent: 'Recruitment' },
  '/admin/jobs':                      { label: 'Job Orders',       parent: 'Recruitment' },
  '/admin/interviews':                { label: 'Interviews',       parent: 'Recruitment' },
  '/admin/employees':                 { label: 'Employees',        parent: 'HRMS' },
  '/admin/attendance':                { label: 'Attendance',       parent: 'HRMS' },
  '/admin/leave':                     { label: 'Leave',            parent: 'HRMS' },
  '/admin/payroll':                   { label: 'Payroll' },
  '/admin/outsourcing':               { label: 'Outsourcing' },
  '/admin/documents':                 { label: 'Documents' },
  '/admin/reports':                   { label: 'Reports' },
  '/admin/users':                     { label: 'Users',            parent: 'Team' },
  '/admin/users/roles':               { label: 'Roles & Perms',   parent: 'Team' },
  '/admin/site-editor':               { label: 'Site Editor' },
  '/admin/settings':                  { label: 'Settings' },
};

interface AdminHeaderProps { onMenuOpen?: () => void; }

export default function AdminHeader({ onMenuOpen }: AdminHeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Match longest known path
  const matched = Object.keys(breadcrumbs)
    .filter(k => pathname === k || pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0];

  const crumb = breadcrumbs[matched] || { label: 'Admin Panel' };

  return (
    <div className="px-4 sm:px-5 pt-4 pb-2 shrink-0">
      {/* Pill header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(0,0,0,0.06)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        }}>

        {/* Left: hamburger + breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={onMenuOpen}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors shrink-0">
            <Menu size={18}/>
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            {crumb.parent && (
              <>
                <span className="text-xs font-semibold" style={{color:'rgba(0,0,0,0.3)'}}>{crumb.parent}</span>
                <ChevronRight size={11} style={{color:'rgba(0,0,0,0.2)'}} className="shrink-0"/>
              </>
            )}
            <span className="text-sm font-bold text-gray-900 truncate">{crumb.label}</span>
          </div>
        </div>

        {/* Right: search + bell + avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              placeholder="Search…"
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 w-40 transition-all placeholder-gray-400"
            />
          </div>

          {/* Bell */}
          <button className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <Bell size={15} className="text-gray-500"/>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"/>
          </button>

          {/* AI Assistant */}
          <button onClick={() => setAssistantOpen(true)}
            className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <Bot size={15} className="text-gray-500"/>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 mx-0.5"/>

          {/* Avatar + name */}
          <Link href="/admin/settings" className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-[11px] shrink-0"
              style={{background:'#18181b'}}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-gray-800 leading-tight">{user?.name?.split(' ')[0]}</p>
              <p className="text-[9px] font-medium leading-tight" style={{color:'rgba(0,0,0,0.35)'}}>{user?.role}</p>
            </div>
          </Link>
        </div>
      </div>

      <AssistantPanel isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
