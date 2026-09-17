'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Shield, Users, TrendingUp } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]       = useState('admin@alkhadim.ae');
  const [password, setPassword] = useState('Admin@123');
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const router    = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success('Welcome back!');
      router.push('/admin');
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        err.message ||
        'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left branding panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900 flex-col justify-between p-14">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-400/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary-400/5 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(201,168,76,1) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-400 rounded-xl flex items-center justify-center shadow-lg shadow-primary-400/30">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <div>
              <p className="font-bold text-white text-lg tracking-wide">AL KHADIM LLC</p>
              <p className="text-primary-400 text-xs tracking-widest uppercase font-semibold">Premium HR Solutions</p>
            </div>
          </Link>
        </div>

        {/* Copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-primary-400 text-xs font-bold tracking-widest uppercase mb-4">HRMS & CRM PORTAL</p>
            <h2 className="text-5xl font-bold text-white leading-tight mb-6">
              Empowering<br />
              <span className="text-primary-400">People.</span><br />
              Elevating<br />
              <span className="text-gray-400 font-medium">Business.</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Access your complete HR management suite — recruitment, payroll, and beyond, all in one intelligent platform.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { Icon: Users,       value: '1800+', label: 'Candidates' },
              { Icon: TrendingUp,  value: '531+',  label: 'Active Jobs' },
              { Icon: Shield,      value: '36+',   label: 'Clients'    },
            ].map(({ Icon, value, label }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <Icon size={18} className="text-primary-400 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">{value}</p>
                <p className="text-gray-500 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-gray-700 text-xs">© {new Date().getFullYear()} Al Khadim LLC · Sharjah Media City, UAE</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-400 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">AL KHADIM LLC</p>
                <p className="text-[10px] text-gray-400 tracking-widest uppercase font-semibold">HRMS & CRM Portal</p>
              </div>
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <p className="text-primary-400 text-xs font-bold tracking-widest uppercase mb-2">WELCOME BACK</p>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Sign In</h1>
            <p className="text-gray-400 text-sm">Enter your credentials to access the management portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 transition-all"
                  placeholder="admin@alkhadim.ae"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-11 py-3 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Hint */}
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
              Default credentials: <span className="font-semibold text-gray-600">admin@alkhadim.ae</span> / <span className="font-semibold text-gray-600">Admin@123</span>
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-400 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-primary-500 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary-400/25 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>Sign In <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* Security badge */}
          <div className="mt-6 flex items-center gap-3 bg-gray-50 rounded-xl p-3.5 border border-gray-100">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <Shield size={15} className="text-green-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-700">Secured Connection</p>
              <p className="text-xs text-gray-400">256-bit SSL · JWT protected</p>
            </div>
          </div>

          <div className="text-center mt-6">
            <Link href="/" className="text-sm text-gray-400 hover:text-primary-400 transition-colors">
              ← Back to Website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
