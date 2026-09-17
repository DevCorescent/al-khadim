import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[84px]">
        <section className="bg-gray-900 text-white py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-3">ABOUT US</p>
            <h1 className="font-heading text-5xl font-bold mb-4">Our Story</h1>
            <p className="text-gray-400 text-lg">Building careers and businesses since 2017</p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4">
            <div className="prose max-w-none text-gray-600">
              <p className="text-xl leading-relaxed mb-8">
                Since our inception in 2017, Al Khadim's journey has been dedicated to unlocking the vast potential of human capital, empowering businesses to achieve their strategic goals through superior workforce solutions.
              </p>
              <p className="leading-relaxed mb-8">
                Today, Al Khadim stands as a premier provider of human resource solutions, delivering a comprehensive suite of services that meets the diverse and rapidly evolving needs of dynamic businesses. Our registered office is in Sharjah Media City, UAE, with branches across Delhi-NCR, Bangalore, and Cochin.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mt-12">
              {[
                { year: '2017', label: 'Founded', desc: 'Started operations in UAE' },
                { year: '36+', label: 'Happy Clients', desc: 'Businesses trust us' },
                { year: '1800+', label: 'Job Seekers', desc: 'Served across GCC' },
              ].map(s => (
                <div key={s.year} className="text-center">
                  <p className="text-4xl font-bold text-primary-400 font-heading">{s.year}</p>
                  <p className="font-semibold text-gray-900 mt-1">{s.label}</p>
                  <p className="text-gray-500 text-sm mt-1">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link href="/contact" className="btn-primary">Get In Touch →</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
