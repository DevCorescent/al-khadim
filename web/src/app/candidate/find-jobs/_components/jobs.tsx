'use client';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Send } from 'lucide-react';
import { useCandidateAuth, candidateApi } from '@/lib/candidateAuth';

/**
 * Shared data for Find Jobs and the job detail page: the public job list (GET /api/jobs/public,
 * same query as /careers), the jobs I've already applied to (from GET /api/candidate-auth/me,
 * shared with the dashboard and My Applications) and the apply mutation.
 */
export function useFindJobs() {
  const { accessToken } = useCandidateAuth();
  const api = candidateApi(accessToken);
  const qc = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-jobs'],
    queryFn: () => api.get('/api/jobs/public').then(r => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: ['candidate-me'],
    queryFn: () => api.get('/api/candidate-auth/me').then(r => r.data),
    enabled: !!accessToken,
  });
  const appliedJobIds = new Set<string>((profile?.applications || []).map((a: any) => a.jobId));

  const apply = useMutation({
    mutationFn: (jobId: string) => api.post('/api/candidate-auth/me/applications', { jobId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate-me'] });
      toast.success('Application submitted');
    },
    onError: (e: any) => {
      // 409 = already applied (e.g. from another tab): refresh so the button shows "Applied".
      if (e.response?.status === 409) qc.invalidateQueries({ queryKey: ['candidate-me'] });
      // Show the server's message for client errors; 5xx may carry internals.
      toast.error((e.response?.status < 500 && e.response?.data?.error) || 'Could not submit your application. Please try again.');
    },
  });

  return { jobs: jobs as any[], isLoading, profileLoaded: !!profile, appliedJobIds, apply };
}

export function formatSalary(job: any): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;
  return job.salaryMin && job.salaryMax
    ? `${job.currency} ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}`
    : `${job.currency} ${(job.salaryMin || job.salaryMax).toLocaleString()}`;
}

export function postedDate(job: any): string {
  return new Date(job.publishedAt || job.createdAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ApplyButton({ jobId, className = '' }: { jobId: string; className?: string }) {
  const { profileLoaded, appliedJobIds, apply } = useFindJobs();

  if (appliedJobIds.has(jobId)) {
    return (
      <Link href="/candidate/jobs"
        className={`inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200 ${className}`}>
        <CheckCircle size={14} /> Applied
      </Link>
    );
  }

  // Each button has its own mutation, so isPending is this job only. Wait for the profile so an
  // already-applied job never flashes an Apply button.
  return (
    <button onClick={() => apply.mutate(jobId)} disabled={!profileLoaded || apply.isPending}
      className={`btn-primary text-sm py-2 px-4 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${className}`}>
      <Send size={14} /> {apply.isPending ? 'Applying…' : 'Apply'}
    </button>
  );
}
