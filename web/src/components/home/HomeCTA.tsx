import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomeCTA() {
  return (
    <section className="py-16 md:py-20 bg-gray-900">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-5">

          {/* Hire card */}
          <div className="bg-white rounded-2xl p-8 md:p-10">
            <p className="text-xs font-bold text-primary-400 tracking-widest uppercase mb-4">FOR EMPLOYERS</p>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-3">
              Find the right talent, fast.
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-7">
              Access 1,800+ verified candidates across the UAE. Our expert consultants match you with the right professionals within 48 hours.
            </p>
            <Link href="/enquiry"
              className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-primary-400 transition-all duration-200">
              Start Hiring <ArrowRight size={15} />
            </Link>
          </div>

          {/* Work card */}
          <div className="bg-primary-400 rounded-2xl p-8 md:p-10">
            <p className="text-xs font-bold text-white/70 tracking-widest uppercase mb-4">FOR JOB SEEKERS</p>
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-3">
              Land your dream job in the UAE.
            </h3>
            <p className="text-white/80 text-sm leading-relaxed mb-7">
              Browse 531+ active positions across top UAE companies. Let our placement experts guide your career journey every step of the way.
            </p>
            <Link href="/careers"
              className="inline-flex items-center gap-2 bg-white text-gray-900 text-sm font-bold px-6 py-3 rounded-full hover:bg-gray-100 transition-all duration-200">
              Find Work <ArrowRight size={15} />
            </Link>
          </div>

        </div>

        {/* Bottom strip */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-gray-800 pt-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <p className="font-bold text-white text-sm">Al Khadim LLC</p>
              <p className="text-gray-500 text-xs">UAE's Premier HR Consultancy · Est. 2017</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {['Free Consultation', '48-Hour Response', '100% Confidential', 'UAE Licensed'].map((item) => (
              <span key={item} className="text-gray-500 text-xs font-medium">✓ {item}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
