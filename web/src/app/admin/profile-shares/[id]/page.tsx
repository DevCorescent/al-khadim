'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Send, Eye, Download, Star, XCircle, Calendar, Ban,
  Mail, RotateCcw, FileText, User, Building2, Briefcase, CalendarCheck,
  Video, MapPin, CalendarPlus,
} from 'lucide-react';
import { FIELD_LABELS } from '@/lib/shareableFields';
import ScheduleInterviewModal from '@/components/admin/ScheduleInterviewModal';

const STATUS_COLORS: Record<string, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  VIEWED: 'bg-indigo-100 text-indigo-700',
  DOWNLOADED: 'bg-purple-100 text-purple-700',
  SHORTLISTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  INTERVIEW_REQUESTED: 'bg-amber-100 text-amber-700',
  INTERVIEW_SCHEDULED: 'bg-indigo-100 text-indigo-700',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
};

const EVENT_ICON: Record<string, any> = {
  CREATED: Send, EMAIL_SENT: Mail, RESENT: RotateCcw, VIEWED: Eye, DOWNLOADED: Download,
  SHORTLISTED: Star, REJECTED: XCircle, INTERVIEW_REQUESTED: Calendar, INTERVIEW_SCHEDULED: CalendarCheck, WITHDRAWN: Ban,
};

const ACTOR_LABEL: Record<string, string> = {
  STAFF: 'Staff', CLIENT_USER: 'Company', ANONYMOUS_TOKEN: 'Anonymous link', SYSTEM: 'System',
};

function eventText(e: any) {
  const who = e.actorName || ACTOR_LABEL[e.actorType] || e.actorType;
  switch (e.eventType) {
    case 'CREATED': return `${who} created this share`;
    case 'EMAIL_SENT': return 'Notification email sent';
    case 'RESENT': return `${who} resent the share`;
    case 'VIEWED': return `${who} viewed the profile`;
    case 'DOWNLOADED': return `${who} downloaded a document`;
    case 'SHORTLISTED': return `${who} shortlisted the candidate`;
    case 'REJECTED': return `${who} rejected the candidate`;
    case 'INTERVIEW_REQUESTED': return `${who} requested an interview`;
    case 'INTERVIEW_SCHEDULED': return `${who} scheduled the interview`;
    case 'WITHDRAWN': return `${who} withdrew this share`;
    default: return `${who} — ${e.eventType}`;
  }
}

export default function ProfileShareDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { data: share, isLoading } = useQuery({
    queryKey: ['profile-share-detail', id],
    queryFn: () => api.get(`/profile-shares/${id}`).then(r => r.data),
    enabled: !!id,
    staleTime: 0,
  });

  const withdrawMutation = useMutation({
    mutationFn: () => api.patch(`/profile-shares/${id}/withdraw`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile-share-detail', id] }); toast.success('Share withdrawn'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to withdraw'),
  });

  const resendMutation = useMutation({
    mutationFn: () => api.post(`/profile-shares/${id}/resend`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile-share-detail', id] }); toast.success('Share resent'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to resend'),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!share) return <div className="p-8 text-center text-red-500">Share not found</div>;

  const s = share as any;
  const fields = Object.keys(s.snapshotData?.fields || {});
  const documents = s.snapshotData?.documents || [];
  const latestInterview = (s.interviews || [])[0] || null;
  const latestRequest = [...(s.events || [])].reverse().find((e: any) => e.eventType === 'INTERVIEW_REQUESTED');
  const candidateName = `${s.candidate?.firstName || ''} ${s.candidate?.lastName || ''}`.trim();

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {s.candidate?.firstName} {s.candidate?.lastName} → {s.client?.companyName}
          </h1>
          <p className="text-sm text-gray-500">{s.job?.title || 'General profile'} · sent by {s.sentByUser?.name}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>{s.status?.replace(/_/g, ' ')}</span>
      </div>

      <div className="flex gap-2 mb-6">
        <Link href={`/admin/candidates/${s.candidate?.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50">
          <User size={12} /> View Candidate
        </Link>
        {s.status !== 'WITHDRAWN' && (
          <>
            {s.job && (
              <button onClick={() => setScheduleOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-500 rounded-xl px-3 py-1.5 hover:bg-indigo-600">
                <CalendarPlus size={12} /> {latestInterview ? 'Reschedule Interview' : 'Schedule Interview'}
              </button>
            )}
            <button onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50">
              <RotateCcw size={12} /> Resend
            </button>
            <button onClick={() => { if (confirm('Withdraw this share?')) withdrawMutation.mutate(); }} disabled={withdrawMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-xl px-3 py-1.5 hover:bg-red-50">
              <Ban size={12} /> Withdraw
            </button>
          </>
        )}
      </div>

      {latestRequest?.metadata?.preferredAt && !latestInterview && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-800">Company requested an interview</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Preferred: {new Date(latestRequest.metadata.preferredAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}
              {latestRequest.metadata.reason && ` — "${latestRequest.metadata.reason}"`}
            </p>
            {latestRequest.metadata.interviewerEmails?.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                Interviewer(s): {latestRequest.metadata.interviewerEmails.join(', ')}
              </p>
            )}
          </div>
          {s.job && (
            <button onClick={() => setScheduleOpen(true)} className="btn-primary text-xs px-3 py-1.5 shrink-0">Schedule Now</button>
          )}
        </div>
      )}

      {latestInterview && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-6">
          <p className="text-sm font-bold text-indigo-900 mb-2">Interview Scheduled</p>
          <div className="flex flex-wrap gap-4 text-sm text-indigo-800">
            <span className="flex items-center gap-1.5"><Calendar size={13} /> {new Date(latestInterview.scheduledAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            {latestInterview.mode === 'ONLINE' ? (
              <a href={latestInterview.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary-600 font-semibold hover:underline">
                <Video size={13} /> {latestInterview.meetLink}
              </a>
            ) : (
              <span className="flex items-center gap-1.5"><MapPin size={13} /> {latestInterview.location}</span>
            )}
          </div>
          {latestInterview.notes && <p className="text-xs text-indigo-700 mt-2">{latestInterview.notes}</p>}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: what was shared */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Fields Shared</h3>
            <div className="flex flex-wrap gap-1.5">
              {fields.length === 0 && <span className="text-xs text-gray-400">None</span>}
              {fields.map(f => (
                <span key={f} className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{FIELD_LABELS[f] || f}</span>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Documents</h3>
            {documents.length === 0 ? <span className="text-xs text-gray-400">None</span> : (
              <div className="space-y-2">
                {documents.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <FileText size={13} className="text-gray-400" /> {d.title}
                  </div>
                ))}
              </div>
            )}
          </div>
          {s.message && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Message</h3>
              <p className="text-sm text-gray-700">{s.message}</p>
            </div>
          )}
          {s.notes && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Internal Note</h3>
              <p className="text-sm text-amber-800">{s.notes}</p>
            </div>
          )}
        </div>

        {/* Right: timeline */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Tracking Timeline</h3>
            <div className="space-y-0">
              {(s.events || []).map((e: any, i: number) => {
                const Icon = EVENT_ICON[e.eventType] || Send;
                return (
                  <div key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                        <Icon size={12} className="text-primary-500" />
                      </div>
                      {i < s.events.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm font-semibold text-gray-800">{eventText(e)}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(e.createdAt).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {e.metadata?.preferredAt && (
                        <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1">
                          Preferred: {new Date(e.metadata.preferredAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      )}
                      {e.metadata?.interviewerEmails?.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1">
                          Interviewer(s): {e.metadata.interviewerEmails.join(', ')}
                        </p>
                      )}
                      {e.metadata?.reason && <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1">"{e.metadata.reason}"</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {s.job && (
        <ScheduleInterviewModal
          isOpen={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          shareId={s.id}
          candidateName={candidateName}
          jobTitle={s.job.title}
          suggestedAt={latestRequest?.metadata?.preferredAt || latestInterview?.scheduledAt}
          suggestedInterviewerEmails={latestRequest?.metadata?.interviewerEmails}
          existing={latestInterview}
        />
      )}
    </div>
  );
}
