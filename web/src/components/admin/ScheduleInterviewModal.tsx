'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { Video, MapPin, X, UserPlus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shareId: string;
  candidateName: string;
  jobTitle?: string;
  suggestedAt?: string | null;
  /** Interviewer emails the company already submitted when requesting this interview — pre-filled, editable, and extendable by staff. */
  suggestedInterviewerEmails?: string[] | null;
  existing?: { mode?: 'ONLINE' | 'OFFLINE'; meetLink?: string | null; location?: string | null; interviewers?: string[]; notes?: string | null } | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toLocalInputValue(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduleInterviewModal({ isOpen, onClose, shareId, candidateName, jobTitle, suggestedAt, suggestedInterviewerEmails, existing }: Props) {
  const qc = useQueryClient();
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(suggestedAt));
  const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>(existing?.mode || 'ONLINE');
  const [meetLink, setMeetLink] = useState(existing?.meetLink || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [interviewers, setInterviewers] = useState<string[]>(
    (existing?.interviewers?.length ? existing.interviewers : suggestedInterviewerEmails) || []
  );
  const [emailInput, setEmailInput] = useState('');
  const [notes, setNotes] = useState(existing?.notes || '');

  function addEmails(raw: string) {
    const candidates = raw.split(/[,\n\s]/).map(s => s.trim()).filter(Boolean);
    const valid = candidates.filter(e => EMAIL_RE.test(e));
    const invalid = candidates.filter(e => !EMAIL_RE.test(e));
    if (valid.length) setInterviewers(prev => [...new Set([...prev, ...valid.map(e => e.toLowerCase())])]);
    if (invalid.length) toast.error(`Not a valid email: ${invalid.join(', ')}`);
    setEmailInput('');
  }
  function removeEmail(email: string) {
    setInterviewers(prev => prev.filter(e => e !== email));
  }

  const scheduleMutation = useMutation({
    mutationFn: () => api.post(`/profile-shares/${shareId}/schedule-interview`, {
      scheduledAt: new Date(scheduledAt).toISOString(),
      mode,
      meetLink: mode === 'ONLINE' ? meetLink : undefined,
      location: mode === 'OFFLINE' ? location : undefined,
      interviewers,
      notes: notes || undefined,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['profile-share-detail', shareId] });
      const n = res.data.interviewersNotified || 0;
      toast.success([
        res.data.accountCreated
          ? 'Interview scheduled. Candidate portal account created — login details emailed to the candidate.'
          : 'Interview scheduled and emailed to the candidate and company.',
        n > 0 ? `${n} interviewer${n !== 1 ? 's' : ''} notified.` : '',
      ].filter(Boolean).join(' '));
      if (res.data.interviewerFailures?.length) {
        toast.error(`Could not email: ${res.data.interviewerFailures.join(', ')}`);
      }
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to schedule interview'),
  });

  const canSubmit = scheduledAt && (mode === 'ONLINE' ? meetLink : location);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Schedule Interview — ${candidateName}`} size="md">
      <div className="space-y-4">
        {jobTitle && <p className="text-xs text-gray-400">For: {jobTitle}</p>}

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date &amp; Time *</label>
          <input type="datetime-local" className="input text-sm" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">Mode *</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('ONLINE')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                mode === 'ONLINE' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <Video size={14} /> Online
            </button>
            <button type="button" onClick={() => setMode('OFFLINE')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                mode === 'OFFLINE' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <MapPin size={14} /> In Person
            </button>
          </div>
        </div>

        {mode === 'ONLINE' ? (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Meeting Link *</label>
            <input className="input text-sm" placeholder="https://meet.google.com/..." value={meetLink} onChange={e => setMeetLink(e.target.value)} />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Location / Address *</label>
            <input className="input text-sm" placeholder="Al Khadim HQ, Sharjah Media City" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <UserPlus size={13} className="text-gray-400" /> Interviewer emails (optional)
          </label>
          {suggestedInterviewerEmails && suggestedInterviewerEmails.length > 0 && (
            <p className="text-[11px] text-gray-400 mb-1.5">Pre-filled from the company's interview request — add more attendees as needed.</p>
          )}
          {interviewers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {interviewers.map(email => (
                <span key={email} className="flex items-center gap-1 text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100 pl-2.5 pr-1.5 py-1 rounded-full">
                  {email}
                  <button type="button" onClick={() => removeEmail(email)} className="hover:text-red-500 transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input className="input text-sm" placeholder="Type an email and press Enter…" value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (emailInput.trim()) addEmails(emailInput); } }}
            onBlur={() => { if (emailInput.trim()) addEmails(emailInput); }} />
          <p className="text-[11px] text-gray-400 mt-1">Each person added here will get an email invitation with the date, time, and how to join.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
          <textarea className="input w-full h-20 resize-none text-sm" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Please bring a printed copy of your portfolio" />
        </div>

        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          This will email the candidate, the company{interviewers.length > 0 ? `, and ${interviewers.length} interviewer${interviewers.length !== 1 ? 's' : ''}` : ''} with
          the interview details. If the candidate doesn't yet have a portal login, one will be created and
          the login credentials will be emailed to the candidate only — never to the company or interviewers.
        </p>

        <button onClick={() => scheduleMutation.mutate()} disabled={!canSubmit || scheduleMutation.isPending}
          className="w-full btn-primary justify-center py-3 rounded-xl text-sm disabled:opacity-50">
          {scheduleMutation.isPending ? 'Scheduling…' : 'Schedule Interview'}
        </button>
      </div>
    </Modal>
  );
}
