'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Briefcase, MapPin, DollarSign, Clock, Calendar, Users, Award } from 'lucide-react';
import { useFindJobs, ApplyButton, formatSalary, postedDate } from '../_components/jobs';

export default function CandidateJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  // There is no public job-detail endpoint; the job comes from the public list (GET /api/jobs/public).
  const { jobs, isLoading } = useFindJobs();
  const job = jobs.find(j => j.id === id);

  const back = (
    <Link href="/candidate/find-jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-500 mb-5">
      <ArrowLeft size={14} /> Back to Find Jobs
    </Link>
  );

  if (isLoading) {
    return <div className="p-4 sm:p-6 max-w-4xl mx-auto">{back}<div className="text-center py-12 text-gray-400 text-sm">Loading job…</div></div>;
  }

  if (!job) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {back}
        <div className="text-center py-16">
          <Briefcase size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">This job is no longer available</p>
          <p className="text-xs text-gray-400">It may have been filled or closed.</p>
        </div>
      </div>
    );
  }

  const salary = formatSalary(job);
  const details = [
    { label: 'Location',   value: [job.location, job.country].filter(Boolean).join(', '), icon: MapPin },
    { label: 'Job Type',   value: job.jobType, icon: Briefcase },
    { label: 'Experience', value: job.experience, icon: Award },
    { label: 'Salary',     value: salary, icon: DollarSign },
    { label: 'Positions',  value: job.positionsCount ? String(job.positionsCount) : null, icon: Users },
    { label: 'Deadline',   value: job.deadline ? new Date(job.deadline).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : null, icon: Calendar },
    { label: 'Posted',     value: postedDate(job), icon: Clock },
  ].filter(d => d.value);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {back}

      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{job.title}</h1>
            <p className="text-sm font-semibold text-primary-500 mt-0.5">{job.client?.companyName || 'Al Khadim Client'}</p>
          </div>
          <ApplyButton jobId={job.id} className="shrink-0" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100">
          {details.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <Icon size={13} className="text-gray-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(job.description || job.requirements) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-5">
          {job.description && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-2">Description</h2>
              <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
          )}
          {job.requirements && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-2">Requirements</h2>
              <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{job.requirements}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
