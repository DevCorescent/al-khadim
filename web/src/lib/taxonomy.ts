import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  order: number;
}

export interface Industry {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  color: string;
  order: number;
  hasTracking: boolean;
  trackingSections?: any[] | null;
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useIndustries(hasTracking?: boolean) {
  return useQuery<Industry[]>({
    queryKey: ['industries', hasTracking],
    queryFn: () => api.get('/industries', { params: hasTracking !== undefined ? { hasTracking } : {} }).then((r) => r.data),
    staleTime: 60_000,
  });
}
