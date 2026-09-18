'use client';
import { useState, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { MapPin, Briefcase, DollarSign, Search, X } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function CareersContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(initialQ);
  // `?job=<id>` (from the home page job strip) highlights and scrolls to that job.
  const highlightJobId = searchParams.get('job');

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-jobs'],
    queryFn: () => axios.get(`${API_URL}/api/jobs/public`).then(r => r.data),
  });

  useEffect(() => {
    if (!highlightJobId || isLoading) return;
    document.getElementById(`job-${highlightJobId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightJobId, isLoading]);

  const filtered = jobs.filter((j: any) =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.client?.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <main className="pt-[84px]">
        {/* Hero */}
        <section className="bg-gray-900 text-white py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-4">CAREERS</p>
            <h1 className="font-heading text-5xl font-bold mb-6">Find Your Dream Job</h1>
            <p className="text-gray-400 text-lg mb-10">Explore opportunities across UAE and beyond</p>
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search jobs, companies..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-10 py-4 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                autoFocus={!!initialQ}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            {search && (
              <p className="text-gray-500 text-sm mt-4">
                Showing results for <span className="text-white font-semibold">"{search}"</span>
                {' · '}
                <button className="text-primary-400 hover:underline" onClick={() => setSearch('')}>Clear</button>
              </p>
            )}
          </div>
        </section>

        {/* Jobs List */}
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-4">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading jobs...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-700 font-semibold text-lg mb-2">
                  {search ? `No results for "${search}"` : 'No jobs posted yet'}
                </p>
                <p className="text-gray-400 text-sm mb-6">
                  {search ? 'Try a different keyword or browse all positions.' : 'Check back soon for new opportunities.'}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="inline-flex items-center gap-2 bg-primary-400 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-primary-500 transition-colors"
                  >
                    Browse all jobs
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {search && (
                  <p className="text-sm text-gray-500 mb-6">
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
                  </p>
                )}
                {filtered.map((job: any) => (
                  <div key={job.id} id={`job-${job.id}`}
                    className={`card hover:shadow-md transition-shadow scroll-mt-28 ${job.id === highlightJobId ? 'ring-2 ring-primary-400' : ''}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                        <p className="text-primary-400 font-medium text-sm">{job.client?.companyName}</p>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} /> {job.location}{job.country ? `, ${job.country}` : ''}
                            </span>
                          )}
                          {job.jobType && (
                            <span className="flex items-center gap-1">
                              <Briefcase size={14} /> {job.jobType}
                            </span>
                          )}
                          {(job.salaryMin || job.salaryMax) && (
                            <span className="flex items-center gap-1">
                              <DollarSign size={14} />
                              {job.salaryMin && job.salaryMax
                                ? `${job.currency} ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}`
                                : `${job.currency} ${(job.salaryMin || job.salaryMax).toLocaleString()}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/register?job=${encodeURIComponent(job.id)}&jobTitle=${encodeURIComponent(job.title)}`} className="btn-primary text-sm py-2.5 px-5 shrink-0">
                        Apply Now →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default function CareersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <CareersContent />
    </Suspense>
  );
}
