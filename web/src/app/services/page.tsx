import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

const services = [
  {
    id: 'placement',
    title: 'Placement Services',
    icon: '🤝',
    description: 'We specialize in connecting top talent with leading companies across the UAE and GCC region. Our extensive network and deep industry knowledge enable us to provide precise candidate-to-role matching.',
    features: ['Executive search', 'Mid-level placements', 'Bulk hiring', 'Industry-specific recruitment', 'Background verification'],
  },
  {
    id: 'recruitment',
    title: 'Recruitment Services',
    icon: '🔍',
    description: 'End-to-end recruitment solutions tailored to your business needs. From job analysis to onboarding, we manage the entire hiring process.',
    features: ['Job analysis & description', 'Multi-channel sourcing', 'Screening & assessment', 'Interview coordination', 'Offer management'],
  },
  {
    id: 'outsourcing',
    title: 'Short term / Contractual Outsourcing',
    icon: '🏗️',
    description: 'Flexible workforce solutions for project-based needs. We provide skilled professionals on short-term contracts, helping you scale quickly without long-term commitments.',
    features: ['Contract staffing', 'Project-based teams', 'Payroll management', 'Visa & compliance', 'On-site supervision'],
  },
  {
    id: 'consultancy',
    title: 'Management Consultancy Services',
    icon: '📊',
    description: 'Strategic HR consulting to optimize your workforce and business operations. Our experienced consultants help you build high-performance organizations.',
    features: ['HR strategy development', 'Organizational restructuring', 'Performance management', 'Training & development', 'Compliance advisory'],
  },
  {
    id: 'residency',
    title: 'Permanent Residency',
    icon: '🌍',
    description: 'Comprehensive assistance for permanent residency applications in UAE. We guide professionals and families through the entire visa and residency process.',
    features: ['Golden Visa assistance', 'Skilled worker residency', 'Family sponsorship', 'Document processing', 'Government liaison'],
  },
  {
    id: 'transport-accommodation-insurance',
    title: 'Transport, Accommodation & Insurance',
    icon: '🚌',
    description: 'End-to-end welfare and mobility support for your deployed workforce. We arrange staff transport, managed accommodation and full insurance cover so your teams are looked after from day one.',
    features: ['Staff transport & fleet arrangement', 'Managed labour accommodation', 'Medical & health insurance', 'Group life & workmen cover', 'Travel & visa insurance'],
  },
];

// Section image (index-aligned with `services` above)
const SERVICE_IMAGES = [
  '1521737852567-6949f3f9f2b5',
  '1600880292203-757bb62b4baf',
  '1504307651254-35680f356dfd',
  '1553877522-43269d4ea984',
  '1557804506-669a67965ba0',
  '1586528116311-ad8dd3c8310d',
];

export default function ServicesPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[84px]">
        <section className="bg-gray-900 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-3">OUR SERVICES</p>
            <h1 className="font-heading text-5xl font-bold mb-4">End-to-end HR Solutions</h1>
            <p className="text-gray-400 text-lg">Tailored for your success</p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 space-y-16">
            {services.map((s, i) => (
              <div key={s.id} id={s.id} className={`grid lg:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="text-5xl mb-4">{s.icon}</div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">{s.title}</h2>
                  <p className="text-gray-600 leading-relaxed mb-6">{s.description}</p>
                  <ul className="space-y-2 mb-8">
                    {s.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-gray-700">
                        <span className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center text-primary-400 text-xs">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/enquiry" className="btn-primary">Get Started →</Link>
                </div>
                <div className={`aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden ${i % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <img
                    src={`https://images.unsplash.com/photo-${SERVICE_IMAGES[i % SERVICE_IMAGES.length]}?w=600&q=80`}
                    alt={s.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
