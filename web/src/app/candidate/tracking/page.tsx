'use client';
import { useState } from 'react';
import { useCandidateAuth, candidateApi } from '@/lib/candidateAuth';
import { useQuery } from '@tanstack/react-query';
import { useTrackingTemplates } from '@/lib/industryTracking';
import IndustryTrackingTabs from '@/components/IndustryTrackingTabs';
import { Briefcase, ClipboardList } from 'lucide-react';

export default function CandidateTrackingPage() {
  const { accessToken } = useCandidateAuth();
  const [activeIndustry, setActiveIndustry] = useState<string | null>(null);
  const { data: templates } = useTrackingTemplates();

  const { data: records, isLoading } = useQuery({
    queryKey: ['candidate-tracking-me'],
    queryFn: () => candidateApi(accessToken!).get('/api/candidate-auth/me/tracking').then((r) => r.data),
    enabled: !!accessToken,
    staleTime: 0,
  });

  const list = records || [];
  const active = list.find((r: any) => r.industry.key === activeIndustry) || list[0];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Tracking</h1>
        <p className="text-gray-500 text-sm mt-1">Progress Al Khadim has shared with you for your placement</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <ClipboardList size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No tracking shared with you yet</p>
          <p className="text-xs text-gray-400 mt-1">Once Al Khadim makes your placement tracking visible, it will appear here</p>
        </div>
      ) : (
        <>
          {list.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {list.map((r: any) => {
                const isActive = r.industry.key === active?.industry.key;
                return (
                  <button key={r.id} onClick={() => setActiveIndustry(r.industry.key)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors ${
                      isActive ? 'bg-primary-400 text-white' : 'bg-white border border-gray-200 text-gray-600'
                    }`}>
                    <Briefcase size={13} /> {templates?.[r.industry.key]?.label || r.industry.name}
                  </button>
                );
              })}
            </div>
          )}
          {active && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Last updated {new Date(active.updatedAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <IndustryTrackingTabs industry={active.industry.key} data={active.data} mode="view" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
