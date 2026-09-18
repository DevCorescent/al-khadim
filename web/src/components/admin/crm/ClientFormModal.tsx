'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/admin/Modal';
import { useIndustries } from '@/lib/taxonomy';

export const CLIENT_FORM_FIELDS = [
  { name: 'companyName',   label: 'Company Name *', type: 'text',     required: true },
  { name: 'contactPerson', label: 'Contact Person *', type: 'text',   required: true },
  { name: 'email',         label: 'Email *',         type: 'email',   required: true },
  { name: 'phone',         label: 'Phone *',         type: 'tel',     required: true },
  { name: 'altPhone',      label: 'Alt Phone',       type: 'tel' },
  { name: 'country',       label: 'Country',         type: 'text' },
  { name: 'city',          label: 'City',            type: 'text' },
  { name: 'address',       label: 'Address',         type: 'text' },
  { name: 'website',       label: 'Website',         type: 'url' },
  { name: 'notes',         label: 'Notes',           type: 'textarea' },
];

export const CLIENT_SOURCE_OPTIONS = ['Website', 'Referral', 'Cold Call', 'LinkedIn', 'Event', 'Enquiry Form', 'Other'];
export const CLIENT_STANDARD_SOURCES = CLIENT_SOURCE_OPTIONS.filter(o => o !== 'Other');

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The client being edited, or null to add a new one. */
  editing: any | null;
  saving: boolean;
  /** Receives the normalised payload for POST /clients or PUT /clients/:id. */
  onSubmit: (body: any) => void;
}

/** Add / edit client form, shared by the CRM clients list and the client detail page. */
export default function ClientFormModal({ isOpen, onClose, editing, saving, onSubmit }: Props) {
  const { data: industries } = useIndustries();
  const [showOtherSource, setShowOtherSource] = useState(false);

  useEffect(() => {
    if (isOpen) setShowOtherSource(!!editing?.source && !CLIENT_STANDARD_SOURCES.includes(editing.source));
  }, [isOpen, editing]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(fd.entries());
    body.isActive = body.isActive !== 'false';
    if (body.source === 'Other' && body.sourceOther) body.source = body.sourceOther;
    delete body.sourceOther;
    onSubmit(body);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Client' : 'Add Client'}>
      <form onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CLIENT_FORM_FIELDS.map(f => (
            <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-bold text-gray-500 mb-1">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea name={f.name} defaultValue={editing?.[f.name] || ''} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" />
              ) : (
                <input type={f.type} name={f.name} required={f.required} defaultValue={editing?.[f.name] || ''}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
              )}
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Industry</label>
            <select name="industryId" defaultValue={editing?.industryId || ''}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
              <option value="">Select…</option>
              {(industries || []).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Source</label>
            <select name="source" defaultValue={
                editing?.source && CLIENT_STANDARD_SOURCES.includes(editing.source) ? editing.source
                : editing?.source ? 'Other' : ''
              }
              onChange={e => setShowOtherSource(e.target.value === 'Other')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
              <option value="">Select…</option>
              {CLIENT_SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {showOtherSource && (
              <input name="sourceOther" placeholder="Specify source"
                defaultValue={editing?.source && !CLIENT_STANDARD_SOURCES.includes(editing.source) ? editing.source : ''}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Status</label>
            <select name="isActive" defaultValue={String(editing?.isActive ?? true)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-1">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60">
            {saving ? 'Saving…' : editing ? 'Update' : 'Add Client'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
