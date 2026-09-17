'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useTrackingTemplates } from '@/lib/industryTracking';
import IndustryTrackingTabs from '@/components/IndustryTrackingTabs';
import DocumentRequestsPanel from '@/components/admin/DocumentRequestsPanel';
import { Briefcase, Eye, EyeOff, Users2, User, Trash2, Download, Upload, FileSpreadsheet } from 'lucide-react';

export default function CandidateTrackingPanel({ candidateId }: { candidateId: string }) {
  const qc = useQueryClient();
  const [activeIndustry, setActiveIndustry] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const { data: templates } = useTrackingTemplates();

  const { data: records, isLoading } = useQuery({
    queryKey: ['candidate-tracking', candidateId],
    queryFn: () => api.get('/candidate-tracking', { params: { candidateId } }).then((r) => r.data),
    enabled: !!candidateId,
    staleTime: 0,
  });

  const active = (records || []).find((r: any) => r.industry.key === activeIndustry);

  useEffect(() => {
    if (records && records.length > 0 && !activeIndustry) {
      setActiveIndustry(records[0].industry.key);
    }
  }, [records, activeIndustry]);

  useEffect(() => {
    if (active) { setDraft(active.data || {}); setDirty(false); }
  }, [active?.id]);

  const startMutation = useMutation({
    mutationFn: (industry: string) => api.post('/candidate-tracking', { candidateId, industry }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['candidate-tracking', candidateId] });
      setActiveIndustry(res.data.industry.key);
      toast.success('Tracking started');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to start tracking'),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/candidate-tracking/${active.id}`, { data: draft }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate-tracking', candidateId] });
      toast.success('Tracking saved');
      setDirty(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  const visibilityMutation = useMutation({
    mutationFn: (patch: any) => api.put(`/candidate-tracking/${active.id}`, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['candidate-tracking', candidateId] }); toast.success('Visibility updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update visibility'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/candidate-tracking/${active.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate-tracking', candidateId] });
      setActiveIndustry(null);
      toast.success('Tracking removed');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to remove'),
  });

  const importInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/candidate-tracking/${active.id}/import-csv`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate-tracking', candidateId] });
      toast.success('Tracking imported from CSV');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to import CSV'),
  });

  function updateField(sectionKey: string, fieldKey: string, value: any) {
    setDraft((d) => ({ ...d, [sectionKey]: { ...(d[sectionKey] || {}), [fieldKey]: value } }));
    setDirty(true);
  }

  async function downloadBlob(url: string, filename: string) {
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Download failed');
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>;

  const existingIndustries = (records || []).map((r: any) => r.industry.key);
  const availableToAdd = Object.entries(templates || {}).filter(([k]) => !existingIndustries.includes(k));

  return (
    <div className="space-y-4">
      {/* Industry tabs + add */}
      <div className="flex flex-wrap items-center gap-2">
        {(records || []).map((r: any) => {
          const active_ = r.industry.key === activeIndustry;
          return (
            <button key={r.id} onClick={() => setActiveIndustry(r.industry.key)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors ${
                active_ ? 'bg-primary-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              <Briefcase size={13} /> {templates?.[r.industry.key]?.label || r.industry.name}
              {r.visibility === 'PUBLIC' && <Eye size={11} className="opacity-80" />}
            </button>
          );
        })}
        {availableToAdd.length > 0 && (
          <div className="relative group">
            <select
              onChange={(e) => { if (e.target.value) startMutation.mutate(e.target.value); e.target.value = ''; }}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-white border border-dashed border-gray-300 text-gray-500 cursor-pointer"
              defaultValue=""
            >
              <option value="" disabled>+ Start tracking…</option>
              {availableToAdd.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {!active && (records || []).length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <Briefcase size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">No industry tracking yet</p>
          <p className="text-xs text-gray-400 mt-1">Pick an industry above to start tracking this candidate's requisition/SOP checklist</p>
        </div>
      )}

      {active && (
        <>
          {/* Visibility controls */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Visibility:</span>
                <button onClick={() => visibilityMutation.mutate({ visibility: 'PRIVATE' })}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${active.visibility === 'PRIVATE' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <EyeOff size={11} className="inline mr-1" /> Private
                </button>
                <button onClick={() => visibilityMutation.mutate({ visibility: 'PUBLIC' })}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${active.visibility === 'PUBLIC' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Eye size={11} className="inline mr-1" /> Public
                </button>
              </div>
              {active.visibility === 'PUBLIC' && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={active.visibleToCandidate}
                      onChange={(e) => visibilityMutation.mutate({ visibleToCandidate: e.target.checked })} />
                    <User size={12} /> Candidate
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={active.visibleToCompany}
                      onChange={(e) => visibilityMutation.mutate({ visibleToCompany: e.target.checked })} />
                    <Users2 size={12} /> Company
                  </label>
                </div>
              )}
              <button onClick={() => { if (confirm('Remove this industry tracking record?')) deleteMutation.mutate(); }}
                className="text-red-400 hover:text-red-600 p-1.5"><Trash2 size={14} /></button>
            </div>
            {active.visibility === 'PRIVATE' && (
              <p className="text-xs text-gray-400 mt-2">Only Al Khadim staff can see this tracking record.</p>
            )}
            {active.visibility === 'PUBLIC' && !active.visibleToCandidate && !active.visibleToCompany && (
              <p className="text-xs text-amber-500 mt-2">Public but not shown to anyone yet — check Candidate and/or Company above.</p>
            )}
          </div>

          {/* Save + CSV toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadBlob(`/candidate-tracking/sample-csv?industry=${active.industry.key}`, `${active.industry.key}_tracking_template.csv`)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50">
                <FileSpreadsheet size={13} /> Sample CSV
              </button>
              <button
                onClick={() => downloadBlob(`/candidate-tracking/${active.id}/export-csv`, `${active.industry.key}_tracking_export.csv`)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50">
                <Download size={13} /> Export CSV
              </button>
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
                <Upload size={13} /> {importMutation.isPending ? 'Importing…' : 'Import CSV'}
              </button>
              <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importMutation.mutate(f); e.target.value = ''; }} />
            </div>
            <button onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}
              className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
              {saveMutation.isPending ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>

          {/* Sections (tabbed) */}
          <IndustryTrackingTabs
            industry={active.industry.key}
            data={draft}
            mode="edit"
            onChange={updateField}
          />

          <div className="flex justify-end">
            <button onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}
              className="btn-primary text-sm py-2.5 px-5 disabled:opacity-50">
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          <DocumentRequestsPanel candidateId={candidateId} trackingId={active.id} />
        </>
      )}
    </div>
  );
}
