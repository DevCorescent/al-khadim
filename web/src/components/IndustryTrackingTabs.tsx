'use client';
import { useEffect, useState } from 'react';
import IndustryTrackingSection from './IndustryTrackingSection';
import { useTrackingTemplates } from '@/lib/industryTracking';

interface Props {
  industry: string;
  data: Record<string, any>;
  mode: 'edit' | 'view';
  onChange?: (sectionKey: string, fieldKey: string, value: any) => void;
}

export default function IndustryTrackingTabs({ industry, data, mode, onChange }: Props) {
  const { data: templates } = useTrackingTemplates();
  const template = templates?.[industry];
  const sections = template?.sections || [];
  const [activeKey, setActiveKey] = useState(sections[0]?.key);

  useEffect(() => { setActiveKey(sections[0]?.key); }, [industry, sections.length]);

  const active = sections.find((s: any) => s.key === activeKey) || sections[0];
  if (!active) return null;

  return (
    <div>
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {sections.map((s: any) => (
          <button key={s.key} type="button" onClick={() => setActiveKey(s.key)}
            className={`shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors ${
              activeKey === s.key ? 'bg-primary-400 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {s.label}
          </button>
        ))}
      </div>
      <IndustryTrackingSection
        section={active}
        data={data?.[active.key] || {}}
        mode={mode}
        onChange={mode === 'edit' ? (fieldKey, value) => onChange?.(active.key, fieldKey, value) : undefined}
      />
    </div>
  );
}
