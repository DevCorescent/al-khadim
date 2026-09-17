'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface TrackingTemplate {
  label: string;
  sections: any[];
}

export type TrackingTemplateMap = Record<string, TrackingTemplate>;

/**
 * Fetches the dynamic, admin-managed industry tracking templates
 * (Industry rows with hasTracking=true), keyed by industry key —
 * same shape the old hardcoded INDUSTRY_TRACKING_TEMPLATES constant used to
 * export, so consumers only need to swap a static import for this hook.
 */
export function useTrackingTemplates() {
  return useQuery<TrackingTemplateMap>({
    queryKey: ['tracking-templates'],
    queryFn: () => api.get('/candidate-tracking/templates').then((r) => r.data),
    staleTime: 60_000,
  });
}
