import { Target, Eye, Rocket } from 'lucide-react';

const items = [
  {
    Icon: Target,
    title: 'Our Mission',
    text: 'To become the leading global HR consultancy — empowering organisations through strategic workforce management that drives efficiency, innovation, and growth.',
  },
  {
    Icon: Eye,
    title: 'Our Vision',
    text: 'To be the premier provider of innovative, customised HR solutions — empowering organisations to achieve their full potential through exceptional talent.',
  },
  {
    Icon: Rocket,
    title: 'Our Motto',
    text: '"Empowering Careers, Elevating Business: Building Future Together."',
    italic: true,
  },
];

export default function HomeMission() {
  return (
    <section className="py-16 md:py-20 bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-xl mb-12">
          <p className="text-xs font-bold text-primary-400 tracking-widest uppercase mb-3">OUR FOUNDATION</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Purpose-driven excellence</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map(({ Icon, title, text, italic }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-2xl p-7 hover:border-primary-400/40 hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-5">
                <Icon size={22} className="text-primary-400" strokeWidth={1.8} />
              </div>
              <h3 className="font-bold text-gray-900 mb-3">{title}</h3>
              <p className={`text-gray-500 text-sm leading-relaxed ${italic ? 'italic font-medium text-gray-600' : ''}`}>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
