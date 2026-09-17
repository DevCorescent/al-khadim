'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Users, Search, UserPlus, ArrowRight } from 'lucide-react';
import DynamicFilterFields from './DynamicFilterFields';
import RecipientDirectory, { DirectorySelection } from './RecipientDirectory';
import { RECIPIENT_TYPES } from './recipientTypes';

// Re-exported for backward compatibility — several read-only screens
// (campaign list/detail, templates, groups) already import RECIPIENT_TYPES
// from this module to label a RecipientType value.
export { RECIPIENT_TYPES };

export interface AudienceValue {
  targetMode: 'FILTER' | 'GROUP' | 'CUSTOM';
  recipientType?: string;       // FILTER mode
  filters?: Record<string, any>; // FILTER mode
  groupId?: string;              // GROUP mode
  customRecipients?: DirectorySelection[]; // CUSTOM mode
}

interface AudiencePickerProps {
  value: AudienceValue;
  onChange: (value: AudienceValue) => void;
  onCountChange?: (total: number) => void;
}

const MODES: { value: AudienceValue['targetMode']; label: string }[] = [
  { value: 'FILTER', label: 'Filter by criteria' },
  { value: 'GROUP', label: 'Saved group' },
  { value: 'CUSTOM', label: 'Pick people' },
];

export default function AudiencePicker({ value, onChange, onCountChange }: AudiencePickerProps) {
  const mode = value.targetMode || 'FILTER';

  return (
    <div className="space-y-4">
      {/* Mode switcher — same pill-toggle styling as ScheduleControl's Send now / Schedule toggle. */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {MODES.map(m => (
          <button key={m.value} type="button" onClick={() => onChange({ ...value, targetMode: m.value })}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${mode === m.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'FILTER' && <FilterMode value={value} onChange={onChange} onCountChange={onCountChange} />}
      {mode === 'GROUP' && <GroupMode value={value} onChange={onChange} onCountChange={onCountChange} />}
      {mode === 'CUSTOM' && <CustomMode value={value} onChange={onChange} onCountChange={onCountChange} />}
    </div>
  );
}

/* ── Filter by criteria — unchanged behavior, now reading/writing through `value` ── */
function FilterMode({ value, onChange, onCountChange }: {
  value: AudienceValue; onChange: (v: AudienceValue) => void; onCountChange?: (n: number) => void;
}) {
  const recipientType = value.recipientType || 'CANDIDATES';
  const filters = value.filters || {};

  function setRecipientType(rt: string) {
    onChange({ ...value, targetMode: 'FILTER', recipientType: rt, filters: {} });
  }
  function setFilters(f: Record<string, any>) {
    onChange({ ...value, targetMode: 'FILTER', recipientType, filters: f });
  }

  // Debounce filter changes into the audience-preview call.
  const [debounced, setDebounced] = useState(filters);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 400);
    return () => clearTimeout(t);
  }, [filters]);

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['audience-preview', 'FILTER', recipientType, JSON.stringify(debounced)],
    queryFn: () => api.post('/emails/campaigns/audience-preview', {
      targetMode: 'FILTER', recipientType, filters: debounced,
    }).then(r => r.data),
    enabled: !!recipientType,
  });

  useEffect(() => {
    if (preview && typeof preview.total === 'number') onCountChange?.(preview.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.total]);

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Recipient Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {RECIPIENT_TYPES.map(rt => (
            <button key={rt.value} type="button" onClick={() => setRecipientType(rt.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                recipientType === rt.value ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <Users size={13} /> {rt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Filters</h3>
        <DynamicFilterFields recipientType={recipientType} filters={filters} onFiltersChange={setFilters} />
      </div>

      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search size={14} className="text-primary-500" />
          <span className="text-sm font-bold text-gray-900">
            {previewLoading ? 'Counting…' : `${preview?.total ?? 0} recipient${preview?.total === 1 ? '' : 's'} match`}
          </span>
        </div>
        {!previewLoading && (preview?.sample?.length ?? 0) > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {preview.sample.map((s: any) => (
              <p key={s.id} className="text-[11px] text-gray-500 truncate">
                {s.name} <span className="text-gray-400">— {s.email}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Saved group — select from GET /emails/groups, live count via audience-preview ── */
function GroupMode({ value, onChange, onCountChange }: {
  value: AudienceValue; onChange: (v: AudienceValue) => void; onCountChange?: (n: number) => void;
}) {
  const groupId = value.groupId || '';

  const { data: groups = [], isLoading: groupsLoading } = useQuery<any[]>({
    queryKey: ['email-groups'],
    queryFn: () => api.get('/emails/groups').then(r => r.data),
  });

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['audience-preview', 'GROUP', groupId],
    queryFn: () => api.post('/emails/campaigns/audience-preview', { targetMode: 'GROUP', groupId }).then(r => r.data),
    enabled: !!groupId,
  });

  useEffect(() => {
    if (!groupId) { onCountChange?.(0); return; }
    if (preview && typeof preview.total === 'number') onCountChange?.(preview.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.total, groupId]);

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Saved Group</label>
        <select className="input" value={groupId}
          onChange={e => onChange({ ...value, targetMode: 'GROUP', groupId: e.target.value || undefined })}>
          <option value="">{groupsLoading ? 'Loading groups…' : 'Select a group…'}</option>
          {groups.map((g: any) => (
            <option key={g.id} value={g.id}>{g.name} ({g.memberCount} members)</option>
          ))}
        </select>
        <Link href="/admin/emails/groups" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold mt-1.5">
          Manage groups <ArrowRight size={11} />
        </Link>
      </div>

      {groupId && (
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Search size={14} className="text-primary-500" />
            <span className="text-sm font-bold text-gray-900">
              {previewLoading ? 'Counting…' : `${preview?.total ?? 0} recipient${preview?.total === 1 ? '' : 's'} in this group`}
            </span>
          </div>
          {!previewLoading && (preview?.sample?.length ?? 0) > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {preview.sample.map((s: any) => (
                <p key={s.id} className="text-[11px] text-gray-500 truncate">
                  {s.name} <span className="text-gray-400">— {s.email}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Pick people — hand-pick via RecipientDirectory, optionally save as a reusable group ── */
function CustomMode({ value, onChange, onCountChange }: {
  value: AudienceValue; onChange: (v: AudienceValue) => void; onCountChange?: (n: number) => void;
}) {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [pendingSelection, setPendingSelection] = useState<DirectorySelection[] | null>(null);

  const recipients = value.customRecipients || [];

  useEffect(() => {
    onCountChange?.(recipients.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients.length]);

  function applySelection(selection: DirectorySelection[]) {
    onChange({ ...value, targetMode: 'CUSTOM', customRecipients: selection });
    setDirectoryOpen(false);
  }

  const createGroup = useMutation({
    mutationFn: async ({ name, selection }: { name: string; selection: DirectorySelection[] }) => {
      const { data: group } = await api.post('/emails/groups', { name });
      await api.post(`/emails/groups/${group.id}/members`, {
        members: selection.map(s => ({ recipientType: s.recipientType, recipientId: s.recipientId, name: s.name, email: s.email })),
      });
      return group;
    },
    onSuccess: (group: any) => toast.success(`Saved "${group.name}" as a new group`),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save group'),
  });

  function handleSaveAsGroupClick(selection: DirectorySelection[]) {
    setPendingSelection(selection);
    setSavingGroupName(true);
  }

  function confirmSaveAsGroup() {
    if (!pendingSelection || !groupNameInput.trim()) return;
    createGroup.mutate({ name: groupNameInput.trim(), selection: pendingSelection });
    applySelection(pendingSelection);
    setSavingGroupName(false);
    setGroupNameInput('');
    setPendingSelection(null);
  }

  function cancelSaveAsGroup() {
    setSavingGroupName(false);
    setGroupNameInput('');
    setPendingSelection(null);
  }

  const typesInvolved = new Set(recipients.map(r => r.recipientType)).size;

  return (
    <div className="space-y-3">
      {savingGroupName ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-2">
          <input autoFocus className="input text-sm flex-1" placeholder="Group name…" value={groupNameInput}
            onChange={e => setGroupNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmSaveAsGroup(); if (e.key === 'Escape') cancelSaveAsGroup(); }} />
          <button type="button" onClick={confirmSaveAsGroup} disabled={!groupNameInput.trim() || createGroup.isPending}
            className="btn-primary text-sm py-2 px-3 disabled:opacity-50">
            {createGroup.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={cancelSaveAsGroup} className="text-xs text-gray-400 hover:text-gray-600 px-2">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setDirectoryOpen(true)}
          className="btn-primary text-sm py-2.5 px-4 inline-flex items-center gap-2">
          <UserPlus size={14} /> Browse all users
        </button>
      )}

      {recipients.length > 0 && (
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-gray-900">
            {recipients.length} people selected across {typesInvolved} type{typesInvolved === 1 ? '' : 's'}
          </span>
          <button type="button" onClick={() => setDirectoryOpen(true)}
            className="text-xs font-semibold text-primary-700 hover:text-primary-800">
            Change selection
          </button>
        </div>
      )}

      <RecipientDirectory
        open={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        onConfirm={applySelection}
        secondaryAction={{ label: 'Save as New Group', onClick: handleSaveAsGroupClick }}
      />
    </div>
  );
}
