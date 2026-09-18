'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import toast from 'react-hot-toast';
import { Upload, CheckCircle, Briefcase } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * `?job=<id>&jobTitle=<title>` comes from the careers "Apply Now" button. The public registration
 * API has no job field, so the job is only shown here for the applicant's reference.
 */
function useApplyingFor() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('job');
  const titleParam = searchParams.get('jobTitle');
  const { data: jobs } = useQuery({
    queryKey: ['public-jobs'],
    queryFn: () => axios.get(`${API_URL}/api/jobs/public`).then(r => r.data),
    enabled: !!jobId && !titleParam,
  });
  if (!jobId) return null;
  return titleParam || (Array.isArray(jobs) ? jobs.find((j: any) => j.id === jobId)?.title : null) || null;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const applyingFor = useApplyingFor();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    if (cvFile) form.set('cv', cvFile);
    try {
      await axios.post(`${API_URL}/api/registrations/public`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
      toast.success('Registration submitted successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <Navbar />
        <main className="pt-[84px] min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center py-16 px-4">
            <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
            <p className="text-gray-600 mb-6">Thank you for registering. Our team will reach out to you soon.</p>
            <button onClick={() => setSubmitted(false)} className="btn-primary">Submit Another</button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="pt-[84px] bg-gray-50 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <p className="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-2">CANDIDATE REGISTRATION</p>
            <h1 className="font-heading text-4xl font-bold text-gray-900">Apply for a Job</h1>
            <p className="text-gray-600 mt-2">Register your profile and we'll match you with the right opportunity</p>
          </div>

          <form onSubmit={handleSubmit} className="card space-y-5">
            {applyingFor && (
              <div className="flex items-center gap-2 rounded-lg bg-primary-50 border border-primary-100 px-4 py-3 text-sm text-gray-700">
                <Briefcase size={16} className="text-primary-400 shrink-0" />
                <span>Applying for: <span className="font-semibold text-gray-900">{applyingFor}</span></span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input name="firstName" required className="input" placeholder="John" />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input name="lastName" required className="input" placeholder="Doe" />
              </div>
            </div>
            <div>
              <label className="label">Email Address *</label>
              <input name="email" type="email" required className="input" placeholder="john@example.com" />
            </div>
            <div>
              <label className="label">Phone Number *</label>
              <input name="phone" required className="input" placeholder="+971 50 XXX XXXX" />
            </div>
            <div>
              <label className="label">Nationality</label>
              <input name="nationality" className="input" placeholder="e.g. Indian, Filipino" />
            </div>
            <div>
              <label className="label">Years of Experience</label>
              <select name="experience" className="input">
                <option value="">Select experience</option>
                <option value="0-1">0-1 years</option>
                <option value="1-3">1-3 years</option>
                <option value="3-5">3-5 years</option>
                <option value="5-10">5-10 years</option>
                <option value="10+">10+ years</option>
              </select>
            </div>
            <div>
              <label className="label">Key Skills</label>
              <input name="skills" className="input" placeholder="e.g. Project Management, Excel, Sales" />
            </div>
            <div>
              <label className="label">Upload CV (PDF, DOC)</label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 transition-colors"
                onClick={() => document.getElementById('cv-upload')?.click()}
              >
                <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {cvFile ? cvFile.name : 'Click to upload or drag & drop'}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOC up to 10MB</p>
                <input
                  id="cv-upload"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3.5 text-base"
            >
              {loading ? 'Submitting...' : 'Submit Application →'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
