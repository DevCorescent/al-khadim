import Link from 'next/link';
import { Upload, CheckCircle, ArrowRight, Star, Zap, Shield, User } from 'lucide-react';

const steps = [
  { icon: Upload,       title: 'Upload Your CV',       desc: 'PDF or DOCX — we parse it instantly.' },
  { icon: CheckCircle,  title: 'Profile Auto-Created',  desc: 'We extract name, skills & experience.' },
  { icon: Star,         title: 'Get Discovered',        desc: 'Employers browse your verified profile.' },
  { icon: Zap,          title: 'Land Your Role',        desc: 'Get placed in as little as 48 hours.' },
];

export default function HomeCVUpload() {
  return (
    <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-10 items-center">

          {/* Left – copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-5">
              <Upload size={12} className="text-blue-500" />
              <span className="text-xs font-bold text-blue-600 tracking-widest uppercase">For Job Seekers</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-snug mb-4">
              Upload your CV.<br />
              <span className="text-primary-400">Get placed in the UAE.</span>
            </h2>
            <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-lg">
              Our AI-powered CV parser extracts your profile automatically. Once approved by our team, you'll get a public profile, access to your personal dashboard, and direct exposure to hiring employers.
            </p>

            {/* Steps */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {steps.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} className="text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/candidate/register" className="btn-primary text-sm py-3 px-6 rounded-xl">
                Upload CV Now <ArrowRight size={15} />
              </Link>
              <Link href="/candidate/login" className="btn-outline text-sm py-3 px-6 rounded-xl">
                Already registered? Sign In
              </Link>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <Shield size={13} className="text-gray-400" />
              <p className="text-xs text-gray-400">Your data is confidential and only shared with your consent.</p>
            </div>
          </div>

          {/* Right – visual card */}
          <div className="relative">
            {/* Ambient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-blue-50 rounded-3xl" />

            <div className="relative p-6 sm:p-8">
              {/* Mock profile card */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 mb-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-400 to-blue-600 flex items-center justify-center shrink-0">
                    <User size={22} className="text-white" />
                  </div>
                  <div>
                    <div className="h-3 w-28 rounded bg-gray-200 mb-2" />
                    <div className="h-2.5 w-36 rounded bg-gray-100 mb-2" />
                    <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" /> Available for hire
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[56, 44, 38, 60, 46].map((w, i) => (
                    <span key={i} className="h-4 rounded-full bg-primary-50 border border-primary-100" style={{ width: w }} />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-2.5 w-32 rounded bg-gray-100" />
                  <div className="h-2.5 w-14 rounded bg-primary-100" />
                </div>
              </div>

              {/* CV parsed badge */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3">
                <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">CV parsed successfully</p>
                  <p className="text-xs text-emerald-600">Skills, experience and languages filled in for you</p>
                </div>
              </div>

              {/* Stats */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
