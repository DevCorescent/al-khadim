'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Briefcase, MapPin, DollarSign, Clock, Search, ArrowRight } from 'lucide-react';
import { useFindJobs, ApplyButton, formatSalary, postedDate } from './_components/jobs';

export default function FindJobsPage() {
  const { jobs, isLoading } = useFindJobs();
  const [search, setSearch] = useState('');

  // GET /api/jobs/public has no search parameter; filter client-side like /careers does.
  const q = search.trim().toLowerCase();
  const filtered = jobs.filter(j => !q ||
    j.title?.toLowerCase().includes(q) ||
    j.client?.companyName?.toLowerCase().includes(q) ||
    j.location?.toLowerCase().includes(q));

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Find Jobs</h1>
        <p className="text-gray-500 text-sm mt-1">Browse open positions and apply with your profile</p>
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by job title, company or location…" className="input pl-9 text-sm" />
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading jobs…</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Briefcase size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">{search ? 'No results found' : 'No open positions right now'}</p>
          <p className="text-xs text-gray-400">{search ? 'Try a different keyword' : 'Please check back soon'}</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(job => {
          const salary = formatSalary(job);
          return (
            <div key={job.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/candidate/find-jobs/${job.id}`} className="font-bold text-gray-900 text-base leading-snug hover:text-primary-500">
                    {job.title}
                  </Link>
                  <p className="text-sm font-semibold text-primary-500 mt-0.5">{job.client?.companyName || 'Al Khadim Client'}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    {job.location && (
                      <span className="flex items-center gap-1"><MapPin size={11} /> {job.location}{job.country ? `, ${job.country}` : ''}</span>
                    )}
                    {job.jobType && (
                      <span className="flex items-center gap-1"><Briefcase size={11} /> {job.jobType}</span>
                    )}
                    {salary && (
                      <span className="flex items-center gap-1"><DollarSign size={11} /> {salary}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock size={11} /> Posted {postedDate(job)}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/candidate/find-jobs/${job.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-primary-300">
                    View Details <ArrowRight size={14} />
                  </Link>
                  <ApplyButton jobId={job.id} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
