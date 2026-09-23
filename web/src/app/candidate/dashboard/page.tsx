'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useCandidateAuth, candidateApi } from '@/lib/candidateAuth';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase, Clock, CheckCircle, XCircle, Star, ArrowRight,
  FileText, User, TrendingUp, Calendar, AlertCircle, Eye, PlayCircle
} from 'lucide-react';
import YouTubeEmbed from '@/components/YouTubeEmbed';
import CandidateDocumentRequests from '@/components/CandidateDocumentRequests';

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  NEW:                  { label: 'Applied',            color: 'bg-blue-100 text-blue-700',   icon: Clock },
  SCREENING:            { label: 'In Review',          color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  SHORTLISTED:          { label: 'Shortlisted',        color: 'bg-purple-100 text-purple-700', icon: Star },
  INTERVIEW_SCHEDULED:  { label: 'Interview Scheduled',color: 'bg-indigo-100 text-indigo-700', icon: Calendar },
  INTERVIEWED:          { label: 'Interviewed',        color: 'bg-orange-100 text-orange-700', icon: CheckCircle },
  OFFERED:              { label: 'Offer Received!',    color: 'bg-emerald-100 text-emerald-700', icon: Star },
  JOINED:               { label: 'Placed',             color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED:             { label: 'Not Selected',       color: 'bg-red-100 text-red-700',    icon: XCircle },
  ON_HOLD:              { label: 'On Hold',            color: 'bg-gray-100 text-gray-500',  icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: Clock };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${s.color}`}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

export default function CandidateDashboard() {
  const { candidate, accessToken, refreshProfile } = useCandidateAuth();

  const { data: profile } = useQuery({
    queryKey: ['candidate-me'],
    queryFn: () => candidateApi(accessToken!).get('/api/candidate-auth/me').then(r => r.data),
    enabled: !!accessToken,
  });

  useEffect(() => { refreshProfile(); }, []);

  const apps = profile?.applications || [];
  const interviews = profile?.interviews || [];

  const stats = [
    { label: 'Applications', value: apps.length, icon: Briefcase, color: 'text-blue-500 bg-blue-50' },
    { label: 'Interviews',   value: interviews.length, icon: Calendar, color: 'text-purple-500 bg-purple-50' },
    { label: 'Shortlisted',  value: apps.filter((a: any) => a.status === 'SHORTLISTED').length, icon: Star, color: 'text-amber-500 bg-amber-50' },
    { label: 'Offers',       value: apps.filter((a: any) => a.status === 'OFFERED').length, icon: TrendingUp, color: 'text-emerald-500 bg-emerald-50' },
  ];

  const profileComplete = [
    !!candidate?.headline,
    !!candidate?.summary,
    (candidate?.skills?.length || 0) > 0,
    !!candidate?.education,
    !!candidate?.currentLocation,
    !!candidate?.linkedIn,
    !!candidate?.introVideoUrl,
  ];
  const completeness = Math.round((profileComplete.filter(Boolean).length / profileComplete.length) * 100);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Welcome back, {candidate?.firstName} 👋
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-gray-500 text-sm">Here's your candidature overview</p>
          {(profile?.cvId || candidate?.cvId) && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono bg-gray-900 text-white px-2 py-0.5 rounded-md tracking-wide">
              <FileText size={10} /> {profile?.cvId || candidate?.cvId}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Applications list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Intro video */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <PlayCircle size={14} className="text-primary-400" /> Intro Video
              </h2>
              <Link href="/candidate/profile" className="text-xs text-primary-500 font-semibold hover:underline">
                {candidate?.introVideoUrl ? 'Update' : 'Add video'}
              </Link>
            </div>
            {candidate?.introVideoUrl ? (
              <YouTubeEmbed url={candidate.introVideoUrl} title="My intro video" />
            ) : (
              <Link href="/candidate/profile" className="flex flex-col items-center justify-center gap-2 aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary-300 hover:text-primary-400 transition-colors">
                <PlayCircle size={24} />
                <span className="text-xs font-semibold">Add a ~1 minute intro video</span>
              </Link>
            )}
          </div>

          <CandidateDocumentRequests />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Recent Applications</h2>
            <Link href="/candidate/jobs" className="text-xs text-primary-500 font-semibold flex items-center gap-1 hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {apps.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <Briefcase size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700 mb-1">No applications yet</p>
              <p className="text-xs text-gray-400 mb-4">Browse open positions and apply</p>
              <Link href="/candidate/find-jobs" className="btn-primary text-xs py-2 px-4">Browse Jobs →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {apps.slice(0, 5).map((app: any) => (
                <div key={app.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{app.job?.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{app.job?.client?.companyName || 'Al Khadim Client'}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(app.appliedAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              ))}
            </div>
          )}

          {/* Upcoming interviews */}
          {interviews.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-gray-900 mt-2">Upcoming Interviews</h2>
              <div className="space-y-2">
                {interviews.filter((i: any) => i.status === 'SCHEDULED').slice(0, 3).map((iv: any) => (
                  <div key={iv.id} className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-indigo-900">{iv.job?.title}</p>
                        <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1.5">
                          <Calendar size={11} />
                          {new Date(iv.scheduledAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                        {iv.mode === 'ONLINE' && iv.meetLink ? (
                          <a href={iv.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 font-semibold hover:underline mt-1 inline-block">
                            Join meeting link →
                          </a>
                        ) : (
                          <p className="text-xs text-indigo-500 mt-0.5">{iv.location || iv.type}</p>
                        )}
                        {iv.notes && <p className="text-xs text-indigo-400 mt-1">{iv.notes}</p>}
                      </div>
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">Scheduled</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Profile completeness */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Profile Strength</h3>
              <span className={`text-sm font-bold ${completeness >= 80 ? 'text-emerald-500' : completeness >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                {completeness}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all ${completeness >= 80 ? 'bg-emerald-400' : completeness >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
            <div className="space-y-2">
              {[
                { label: 'Headline',    done: !!candidate?.headline },
                { label: 'Summary',     done: !!candidate?.summary },
                { label: 'Skills',      done: (candidate?.skills?.length || 0) > 0 },
                { label: 'Education',   done: !!candidate?.education },
                { label: 'Location',    done: !!candidate?.currentLocation },
                { label: 'LinkedIn',    done: !!candidate?.linkedIn },
                { label: 'Intro Video', done: !!candidate?.introVideoUrl },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  {done
                    ? <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                  }
                  <span className={done ? 'text-gray-500 line-through' : 'text-gray-700'}>{label}</span>
                </div>
              ))}
            </div>
            <Link href="/candidate/profile" className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:underline">
              <User size={12} /> Complete your profile
            </Link>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/candidate/profile" className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-500 py-2 border-b border-gray-50 transition-colors">
                <User size={14} className="text-gray-400" /> Edit Profile
              </Link>
              <Link href="/candidate/find-jobs" className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-500 py-2 border-b border-gray-50 transition-colors">
                <Briefcase size={14} className="text-gray-400" /> Browse Jobs
              </Link>
              <Link href="/candidates" className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-500 py-2 transition-colors">
                <Eye size={14} className="text-gray-400" /> View Public Profiles
              </Link>
            </div>
          </div>

          {/* Profile visibility */}
          <div className={`rounded-2xl p-4 ${candidate?.isPublic ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-start gap-2.5">
              <Eye size={16} className={candidate?.isPublic ? 'text-emerald-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
              <div>
                <p className="text-xs font-bold text-gray-800">
                  {candidate?.isPublic ? 'Profile is Public' : 'Profile is Private'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {candidate?.isPublic
                    ? 'Employers can discover your profile on the candidates page.'
                    : 'Your profile is not yet visible to employers. Contact us to make it public.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
