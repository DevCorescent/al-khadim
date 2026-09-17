import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomeCEO() {
  return (
    <section className="py-16 md:py-20 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Image */}
          <div className="relative order-2 lg:order-1">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden max-w-sm mx-auto lg:max-w-none bg-gray-100">
              <img
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=700&q=80"
                alt="Mr. Santosh Bhagat — CEO"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Name card below image */}
            <div className="mt-4 flex items-center gap-3 max-w-sm mx-auto lg:max-w-none">
              <div className="w-10 h-10 bg-primary-400 rounded-full flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Mr. Santosh Bhagat</p>
                <p className="text-gray-400 text-xs">CEO & Co-Founder · Al Khadim LLC</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="order-1 lg:order-2">
            <p className="text-xs font-bold text-primary-400 tracking-widest uppercase mb-4">MEET OUR CEO</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-6">
              Leadership built on<br />trust and expertise.
            </h2>

            {/* Pull quote */}
            <blockquote className="border-l-4 border-primary-400 pl-5 mb-6">
              <p className="text-gray-600 text-base leading-relaxed italic">
                "Our mission is to bridge exceptional talent with visionary organisations — building a stronger UAE workforce, one placement at a time."
              </p>
            </blockquote>

            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              With a rich background spanning transport, people management, and strategic consulting, Mr. Santosh Bhagat co-founded Al Khadim LLC to address the UAE's growing demand for comprehensive manpower solutions.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Under his leadership, Al Khadim has grown to serve 36+ enterprise clients, placing over 1,800 candidates across the UAE and beyond.
            </p>

            <Link href="/about"
              className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 border-2 border-gray-900 px-6 py-3 rounded-full hover:bg-gray-900 hover:text-white transition-all duration-200">
              Read Our Story <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
