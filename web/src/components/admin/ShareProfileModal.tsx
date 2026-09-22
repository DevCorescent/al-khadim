'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { SHAREABLE_FIELD_GROUPS } from '@/lib/shareableFields';
import { FileText, Mail, Globe, Send, AlertTriangle, Eye, EyeOff } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  candidate: any;
}

export default function ShareProfileModal({ isOpen, onClose, candidate }: Props) {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [jobId, setJobId] = useState('');
  const [method, setMethod] = useState<'PORTAL' | 'EMAIL' | 'BOTH'>('BOTH');
  const [message, setMessage] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [docIds, setDocIds] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['clients-picker'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then(r => r.data.data),
    enabled: isOpen,
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs-picker', clientId],
    queryFn: () => api.get('/jobs', { params: { clientId, limit: 100 } }).then(r => r.data.data),
    enabled: isOpen && !!clientId,
  });

  const documents: any[] = candidate?.documents || [];

  const shareMutation = useMutation({
    mutationFn: () => api.post('/profile-shares', {
      candidateId: candidate.id,
      clientId,
      jobId: jobId || undefined,
      sharedFields: fields,
      sharedDocumentIds: docIds,
      method,
      message: message || undefined,
    }),
    onSuccess: () => {
      toast.success('Profile shared');
      qc.invalidateQueries({ queryKey: ['profile-shares', candidate.id] });
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to share profile'),
  });

  function reset() {
    setClientId(''); setJobId(''); setMethod('BOTH'); setMessage(''); setFields([]); setDocIds([]); setShowPreview(false);
  }

  const selectedJob = (jobs || []).find((j: any) => j.id === jobId);
  const selectedClient = (clients || []).find((c: any) => c.id === clientId);
  const candidateName = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ') || 'Candidate';

  function toggleField(key: string) {
    setFields(f => f.includes(key) ? f.filter(x => x !== key) : [...f, key]);
  }
  function toggleDoc(id: string) {
    setDocIds(d => d.includes(id) ? d.filter(x => x !== id) : [...d, id]);
  }

  const canSubmit = clientId && (fields.length > 0 || docIds.length > 0);

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title={`Share ${candidate?.firstName}'s Profile`} size="lg">
      <div className="space-y-5">
        {/* Client + Job */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Company *</label>
            <select className="input text-sm" value={clientId} onChange={e => { setClientId(e.target.value); setJobId(''); }}>
              <option value="">Select company…</option>
              {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Job (optional)</label>
            <select className="input text-sm" value={jobId} onChange={e => setJobId(e.target.value)} disabled={!clientId}>
              <option value="">General profile</option>
              {(jobs || []).map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
        </div>

        {/* Field selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Fields to share <span className="text-gray-400 font-normal">— only checked fields are visible to the company</span>
          </label>
          <div className="border border-gray-200 rounded-xl p-3 space-y-3 max-h-64 overflow-y-auto">
            {SHAREABLE_FIELD_GROUPS.map(g => (
              <div key={g.group}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{g.group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.fields.map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleField(f.key)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        fields.includes(f.key)
                          ? 'bg-primary-400 border-primary-400 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">Documents to share</label>
          <div className="space-y-1.5">
            {candidate?.cvPath && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={docIds.includes('cv')} onChange={() => toggleDoc('cv')} />
                <FileText size={13} className="text-gray-400" /> CV / Resume
              </label>
            )}
            {documents.map(doc => (
              <label key={doc.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={docIds.includes(doc.id)} onChange={() => toggleDoc(doc.id)} />
                <FileText size={13} className="text-gray-400" /> {doc.title} <span className="text-xs text-gray-400">({doc.type})</span>
              </label>
            ))}
            {!candidate?.cvPath && documents.length === 0 && (
              <p className="text-xs text-gray-400">No documents available for this candidate</p>
            )}
          </div>
        </div>

        {/* Delivery method */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">Delivery</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: 'PORTAL', label: 'Portal only', icon: Globe },
              { v: 'EMAIL', label: 'Email only', icon: Mail },
              { v: 'BOTH', label: 'Both', icon: Send },
            ].map(({ v, label, icon: Icon }) => (
              <button key={v} type="button" onClick={() => setMethod(v as any)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                  method === v ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-700">Message (optional)</label>
            {message.trim() && (
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-primary-500 hover:text-primary-600">
                {showPreview ? <><EyeOff size={12} /> Hide preview</> : <><Eye size={12} /> Preview</>}
              </button>
            )}
          </div>
          <textarea className="input w-full h-20 resize-none text-sm" value={message} onChange={e => setMessage(e.target.value)}
            placeholder="e.g. Please review for the HR Manager role." />
          <p className="flex items-start gap-1.5 text-[11px] text-amber-600 mt-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            This message is sent as-is to <strong className="font-semibold">{selectedClient?.companyName || 'the company'}</strong> alongside
            the shared profile — write it the way you'd want the client to read it, not as an internal note.
          </p>

          {showPreview && message.trim() && (
            <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center gap-1.5">
                <Eye size={11} className="text-gray-400" />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">What {selectedClient?.companyName || 'the company'} will see</p>
              </div>
              <div className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 border-2 border-primary-100 flex items-center justify-center text-sm font-bold text-primary-600 shrink-0 overflow-hidden">
                    {candidate?.photo
                      ? <img src={`${API_URL}/${candidate.photo}`} alt="" className="w-full h-full object-cover" />
                      : (candidateName[0] || '?')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{fields.includes('firstName') || fields.includes('lastName') ? candidateName : 'Candidate Profile'}</p>
                    {fields.includes('headline') && candidate?.headline && <p className="text-xs text-gray-500">{candidate.headline}</p>}
                    {selectedJob && <p className="text-[11px] text-gray-400 mt-0.5">For: {selectedJob.title}</p>}
                  </div>
                </div>
                <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-700 whitespace-pre-wrap">{message}</div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => shareMutation.mutate()}
          disabled={!canSubmit || shareMutation.isPending}
          className="w-full btn-primary justify-center py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {shareMutation.isPending ? 'Sharing…' : 'Share Profile'}
        </button>
        {!canSubmit && <p className="text-xs text-gray-400 text-center">Select a company and at least one field or document</p>}
      </div>
    </Modal>
  );
}
