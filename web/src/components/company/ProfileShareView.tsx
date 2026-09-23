'use client';
import { useState } from 'react';
import { FileText, Download, Eye, Star, XCircle, Calendar, Lock, ExternalLink, Video, MapPin, CheckCircle2, PlayCircle } from 'lucide-react';
import { SHAREABLE_FIELD_GROUPS } from '@/lib/shareableFields';
import YouTubeEmbed from '@/components/YouTubeEmbed';
import { isValidYouTubeUrl } from '@/lib/youtube';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SENT: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  VIEWED: { label: 'Viewed', color: 'bg-indigo-100 text-indigo-700' },
  DOWNLOADED: { label: 'Downloaded', color: 'bg-purple-100 text-purple-700' },
  SHORTLISTED: { label: 'Shortlisted', color: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  INTERVIEW_REQUESTED: { label: 'Interview Requested', color: 'bg-amber-100 text-amber-700' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', color: 'bg-indigo-100 text-indigo-700' },
  WITHDRAWN: { label: 'No Longer Available', color: 'bg-gray-100 text-gray-500' },
};

function renderValue(key: string, value: any) {
  if (value === null || value === undefined || value === '') return null;
  if (key === 'introVideoUrl') return null; // rendered as an embedded player, not in the text grid
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((v: string) => (
          <span key={v} className="text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100 px-2.5 py-1 rounded-full">{v}</span>
        ))}
      </div>
    );
  }
  if (key === 'linkedIn' || key === 'portfolio') {
    return <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline flex items-center gap-1">{value} <ExternalLink size={11} /></a>;
  }
  if (key === 'currentSalary' || key === 'expectedSalary') {
    return <span>{value.toLocaleString()}</span>;
  }
  return <span>{String(value)}</span>;
}

interface InterviewInfo {
  id: string;
  scheduledAt: string;
  mode: 'ONLINE' | 'OFFLINE';
  meetLink?: string | null;
  location?: string | null;
  interviewers?: string[];
  notes?: string | null;
  status: string;
}

interface Props {
  data: {
    id: string;
    status: string;
    method: string;
    message?: string;
    sentAt: string;
    respondedAt?: string;
    job?: { id: string; title: string } | null;
    client?: { id: string; companyName: string };
    snapshotData: { fields: Record<string, any>; documents: any[] };
    interview?: InterviewInfo | null;
  };
  mode: 'portal' | 'public';
  onDownload?: (docId: string, title: string) => void;
  /** Opens the document in a preview instead of downloading it. */
  onView?: (docId: string, title: string, mimeType?: string | null) => void;
  onRespond?: (action: 'SHORTLIST' | 'REJECT' | 'REQUEST_INTERVIEW', reason?: string, preferredAt?: string, interviewerEmails?: string) => Promise<void> | void;
  responding?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfileShareView({ data, mode, onDownload, onView, onRespond, responding }: Props) {
  const [reasonOpen, setReasonOpen] = useState<null | 'REJECT' | 'REQUEST_INTERVIEW'>(null);
  const [reason, setReason] = useState('');
  const [preferredAt, setPreferredAt] = useState('');
  const [interviewerEmails, setInterviewerEmails] = useState('');

  const parsedInterviewerEmails = interviewerEmails.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const interviewerEmailsValid = parsedInterviewerEmails.length > 0 && parsedInterviewerEmails.every(e => EMAIL_RE.test(e));

  const fields = data.snapshotData?.fields || {};
  const documents = data.snapshotData?.documents || [];
  const status = STATUS_LABELS[data.status] || { label: data.status, color: 'bg-gray-100 text-gray-600' };
  const name = [fields.firstName, fields.lastName].filter(Boolean).join(' ') || 'Candidate Profile';
  const withdrawn = data.status === 'WITHDRAWN';
  const interviewScheduled = data.status === 'INTERVIEW_SCHEDULED' && data.interview;
  const interviewRequested = data.status === 'INTERVIEW_REQUESTED';

  function submitRespond(action: 'SHORTLIST' | 'REJECT' | 'REQUEST_INTERVIEW') {
    if (action === 'REQUEST_INTERVIEW' && reasonOpen !== action) {
      setReasonOpen(action);
      return;
    }
    if (action === 'REJECT' && reasonOpen !== action) {
      setReasonOpen(action);
      return;
    }
    if (action === 'REQUEST_INTERVIEW') {
      if (!preferredAt || !interviewerEmailsValid) return;
      onRespond?.(action, reason || undefined, new Date(preferredAt).toISOString(), parsedInterviewerEmails.join(','));
    } else {
      onRespond?.(action, reason || undefined);
    }
    setReasonOpen(null);
    setReason('');
    setPreferredAt('');
    setInterviewerEmails('');
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 border-2 border-primary-100 flex items-center justify-center text-xl font-bold text-primary-600 shrink-0">
              {fields.photo
                ? <img src={`${API_URL}/${fields.photo}`} alt="" className="w-full h-full object-cover rounded-2xl" />
                : (name[0] || '?')}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{name}</h1>
              {fields.headline && <p className="text-sm text-gray-500">{fields.headline}</p>}
              {data.job && <p className="text-xs text-gray-400 mt-1">For: {data.job.title}</p>}
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${status.color}`}>{status.label}</span>
        </div>
        {data.message && (
          <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700">{data.message}</div>
        )}
      </div>

      {withdrawn ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <Lock size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">This profile is no longer available</p>
        </div>
      ) : (
        <>
          {/* Intro video */}
          {isValidYouTubeUrl(fields.introVideoUrl) && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PlayCircle size={13} /> Intro Video
              </h3>
              <YouTubeEmbed url={fields.introVideoUrl} title={`${name} — intro video`} />
            </div>
          )}

          {/* Fields */}
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            {SHAREABLE_FIELD_GROUPS.map(g => {
              const visible = g.fields.filter(f => renderValue(f.key, fields[f.key]) !== null);
              if (visible.length === 0) return null;
              return (
                <div key={g.group} className="bg-white rounded-2xl border border-gray-200 p-5 sm:col-span-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{g.group}</h3>
                  <div className="space-y-2.5">
                    {visible.map(f => (
                      <div key={f.key} className="grid grid-cols-3 gap-3 text-sm">
                        <span className="text-gray-400">{f.label}</span>
                        <span className="col-span-2 text-gray-800 font-medium">{renderValue(f.key, fields[f.key])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Documents */}
          {documents.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Documents</h3>
              <div className="space-y-2">
                {documents.map((d: any) => {
                  // `viewable` comes from the share snapshot: PDFs and images can
                  // be previewed, a .docx can only be downloaded.
                  const canView = !!onView && d.viewable !== false;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3"
                    >
                      <FileText size={14} className="text-primary-400 shrink-0" />
                      <span className="flex-1 min-w-0 text-sm font-semibold text-gray-700 truncate">
                        {d.title}
                      </span>
                      {canView && (
                        <button
                          onClick={() => onView?.(d.id, d.title, d.mimeType)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-white hover:bg-primary-400 border border-primary-200 hover:border-primary-400 rounded-full px-3 py-1.5 transition-colors shrink-0"
                        >
                          <Eye size={13} /> View
                        </button>
                      )}
                      <button
                        onClick={() => onDownload?.(d.id, d.title)}
                        title={`Download ${d.filename || d.title}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-full px-3 py-1.5 transition-colors shrink-0"
                      >
                        <Download size={13} /> <span className="hidden sm:inline">Download</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interview details (once scheduled by Al Khadim) */}
          {interviewScheduled && data.interview && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-indigo-900">Interview Scheduled</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-indigo-800">
                  <Calendar size={14} className="shrink-0" />
                  {new Date(data.interview.scheduledAt).toLocaleString('en-AE', { dateStyle: 'full', timeStyle: 'short' })}
                </div>
                {data.interview.mode === 'ONLINE' ? (
                  <a href={data.interview.meetLink || '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-600 font-semibold hover:underline w-fit">
                    <Video size={14} className="shrink-0" /> Join meeting link
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-indigo-800">
                    <MapPin size={14} className="shrink-0" /> {data.interview.location}
                  </div>
                )}
                {data.interview.notes && <p className="text-indigo-700 text-xs mt-1">{data.interview.notes}</p>}
              </div>
            </div>
          )}

          {interviewRequested && !interviewScheduled && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-sm text-amber-700">
              Interview requested — Al Khadim will confirm the schedule shortly.
            </div>
          )}

          {/* Actions */}
          {mode === 'portal' && onRespond ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Your Decision</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => submitRespond('SHORTLIST')} disabled={responding}
                  className="flex items-center gap-1.5 bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50">
                  <Star size={14} /> Shortlist
                </button>
                {!interviewRequested && !interviewScheduled && (
                  <button onClick={() => submitRespond('REQUEST_INTERVIEW')} disabled={responding}
                    className="flex items-center gap-1.5 bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50">
                    <Calendar size={14} /> Request Interview
                  </button>
                )}
                <button onClick={() => submitRespond('REJECT')} disabled={responding}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                  <XCircle size={14} /> Reject
                </button>
              </div>
              {!data.job && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Shortlist/Reject require this profile to be linked to a job order — ask Al Khadim to re-share for a specific role.
                </p>
              )}
              {reasonOpen === 'REQUEST_INTERVIEW' && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">Preferred date &amp; time *</label>
                  <input type="datetime-local" className="input text-sm" value={preferredAt} onChange={e => setPreferredAt(e.target.value)} />

                  <label className="block text-xs font-semibold text-gray-600 pt-1">Interviewer email(s) *</label>
                  <input className="input w-full text-sm" placeholder="e.g. sarah@company.com, omar@company.com"
                    value={interviewerEmails} onChange={e => setInterviewerEmails(e.target.value)} />
                  <p className="text-[11px] text-gray-400">
                    Everyone who will take this interview — Al Khadim will email each of them the interview invitation once it's confirmed.
                  </p>
                  {interviewerEmails.trim() && !interviewerEmailsValid && (
                    <p className="text-[11px] text-red-500">Enter one or more valid email addresses, separated by commas.</p>
                  )}

                  <input className="input w-full text-sm" placeholder="Note for the recruiter (optional)"
                    value={reason} onChange={e => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => submitRespond('REQUEST_INTERVIEW')} disabled={responding || !preferredAt || !interviewerEmailsValid}
                      className="btn-primary text-sm px-4 disabled:opacity-50">{responding ? 'Sending…' : 'Confirm Request'}</button>
                    <button onClick={() => { setReasonOpen(null); setPreferredAt(''); setReason(''); setInterviewerEmails(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                  </div>
                </div>
              )}
              {reasonOpen === 'REJECT' && (
                <div className="mt-3 flex gap-2">
                  <input className="input flex-1 text-sm" placeholder="Reason for rejecting (optional)"
                    value={reason} onChange={e => setReason(e.target.value)} />
                  <button onClick={() => submitRespond('REJECT')} disabled={responding}
                    className="btn-primary text-sm px-4">{responding ? 'Sending…' : 'Confirm'}</button>
                </div>
              )}
            </div>
          ) : mode === 'public' ? (
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-5 text-center">
              <p className="text-sm text-primary-700 font-semibold mb-1">Want to shortlist, reject, or request an interview?</p>
              <p className="text-xs text-primary-600 mb-3">Log in to your company portal to take action on this candidate.</p>
              <a href="/company/login" className="btn-primary text-sm px-5 py-2 inline-flex">Log in to Company Portal</a>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
