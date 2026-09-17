'use client';
import Link from 'next/link';
import { MapPin, Phone, Mail, Linkedin, Facebook, Instagram, Twitter, MessageCircle } from 'lucide-react';
import { useSiteConfig } from '@/lib/siteConfig';

const DEFAULT_COLUMNS = [
  {
    title: 'Company',
    links: [
      { label: 'Home', href: '/' }, { label: 'About Us', href: '/about' },
      { label: 'Careers', href: '/careers' }, { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'Placement Services', href: '/services#placement' },
      { label: 'Recruitment', href: '/services#recruitment' },
      { label: 'Contractual Outsourcing', href: '/services#outsourcing' },
      { label: 'Management Consultancy', href: '/services#consultancy' },
    ],
  },
];

const SOCIAL_ICONS: Record<string, any> = {
  linkedin: Linkedin, facebook: Facebook, instagram: Instagram,
  twitter: Twitter, whatsapp: MessageCircle,
};

export default function Footer() {
  const footer = useSiteConfig(s => s.footer);

  const logoText   = footer?.logoText   || 'Al Khadim';
  const tagline    = footer?.tagline    || 'LLC';
  const description = footer?.description || "Building UAE's workforce with premium HR solutions since 2017.";
  const phone      = footer?.phone      || '+971 56 984 2508';
  const email      = footer?.email      || 'sales@alkhadim.ae';
  const address    = footer?.address    || 'Sharjah Media City, Sharjah, UAE';
  const copyright  = footer?.copyright  || `© ${new Date().getFullYear()} Al Khadim LLC. All rights reserved.`;
  const columns    = footer?.columns    || DEFAULT_COLUMNS;
  const socials    = footer?.socials    || {};
  const showSocials = footer?.showSocials !== false;

  const activeSocials = showSocials
    ? Object.entries(socials).filter(([, url]) => url)
    : [];

  return (
    <footer className="bg-gray-900 text-gray-400" style={{ background: 'var(--color-footer-bg, #0f172a)', color: 'var(--color-footer-text, #94a3b8)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3 mb-4 group">
              <div className="w-10 h-10 bg-primary-400 rounded-xl flex items-center justify-center shadow-md shadow-primary-400/25 group-hover:shadow-primary-400/40 transition-shadow">
                <span className="text-white font-bold text-lg">{logoText.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="font-bold text-white text-sm tracking-wide">{logoText.toUpperCase()}</p>
                <p className="text-[10px] text-primary-400 tracking-widest uppercase font-semibold">{tagline}</p>
              </div>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">{description}</p>

            {activeSocials.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {activeSocials.map(([key, url]) => {
                  const Icon = SOCIAL_ICONS[key];
                  if (!Icon) return null;
                  return (
                    <a key={key} href={url as string} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-400 transition-colors">
                      <Icon size={14} />
                    </a>
                  );
                })}
              </div>
            )}
            {activeSocials.length === 0 && (
              <div className="flex gap-2">
                {[Linkedin, Facebook, Instagram].map((Icon, i) => (
                  <a key={i} href="#" className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-400 transition-colors">
                    <Icon size={14} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Link columns from config */}
          {columns.map((col: any, i: number) => (
            <div key={i}>
              <h4 className="text-white font-bold text-sm mb-4 tracking-tight">{col.title}</h4>
              <ul className="space-y-2.5">
                {(col.links || []).map((l: any) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-gray-500 hover:text-primary-400 transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4 tracking-tight">Contact</h4>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2.5 items-start">
                <MapPin size={13} className="text-primary-400 mt-0.5 shrink-0" />
                <span className="text-gray-500 leading-relaxed text-xs">{address}</span>
              </div>
              <div className="flex gap-2.5 items-center">
                <Phone size={13} className="text-primary-400 shrink-0" />
                <a href={`tel:${phone.replace(/\s/g,'')}`} className="text-gray-500 hover:text-primary-400 transition-colors text-xs">{phone}</a>
              </div>
              <div className="flex gap-2.5 items-center">
                <Mail size={13} className="text-primary-400 shrink-0" />
                <a href={`mailto:${email}`} className="text-gray-500 hover:text-primary-400 transition-colors text-xs">{email}</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800 mx-4 sm:mx-6 lg:mx-8 py-5">
        <p className="text-center text-xs text-gray-600">{copyright}</p>
      </div>
    </footer>
  );
}
