/**
 * Static option lists for the candidate/company registration forms.
 *
 * Countries carry their dial code and demonym so one list drives the phone
 * country-code picker, the nationality picker and the location picker.
 * Gulf + main recruitment source markets are listed first (`priority`), since
 * they cover the overwhelming majority of Al Khadim's candidates.
 */

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** E.164 dial prefix, including the leading '+'. */
  dial: string;
  /** Nationality demonym, e.g. "Emirati". */
  demonym: string;
  flag: string;
  /** Shown above the divider in pickers. */
  priority?: boolean;
}

export const COUNTRIES: Country[] = [
  // ── Gulf ──
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', demonym: 'Emirati', flag: '🇦🇪', priority: true },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', demonym: 'Saudi', flag: '🇸🇦', priority: true },
  { code: 'QA', name: 'Qatar', dial: '+974', demonym: 'Qatari', flag: '🇶🇦', priority: true },
  { code: 'KW', name: 'Kuwait', dial: '+965', demonym: 'Kuwaiti', flag: '🇰🇼', priority: true },
  { code: 'OM', name: 'Oman', dial: '+968', demonym: 'Omani', flag: '🇴🇲', priority: true },
  { code: 'BH', name: 'Bahrain', dial: '+973', demonym: 'Bahraini', flag: '🇧🇭', priority: true },
  // ── Main source markets ──
  { code: 'IN', name: 'India', dial: '+91', demonym: 'Indian', flag: '🇮🇳', priority: true },
  { code: 'PK', name: 'Pakistan', dial: '+92', demonym: 'Pakistani', flag: '🇵🇰', priority: true },
  { code: 'PH', name: 'Philippines', dial: '+63', demonym: 'Filipino', flag: '🇵🇭', priority: true },
  { code: 'BD', name: 'Bangladesh', dial: '+880', demonym: 'Bangladeshi', flag: '🇧🇩', priority: true },
  { code: 'EG', name: 'Egypt', dial: '+20', demonym: 'Egyptian', flag: '🇪🇬', priority: true },
  { code: 'NP', name: 'Nepal', dial: '+977', demonym: 'Nepali', flag: '🇳🇵', priority: true },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', demonym: 'Sri Lankan', flag: '🇱🇰', priority: true },
  { code: 'GB', name: 'United Kingdom', dial: '+44', demonym: 'British', flag: '🇬🇧', priority: true },
  { code: 'US', name: 'United States', dial: '+1', demonym: 'American', flag: '🇺🇸', priority: true },

  // ── Rest of the world ──
  { code: 'AF', name: 'Afghanistan', dial: '+93', demonym: 'Afghan', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', dial: '+355', demonym: 'Albanian', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', dial: '+213', demonym: 'Algerian', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina', dial: '+54', demonym: 'Argentine', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', dial: '+374', demonym: 'Armenian', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', dial: '+61', demonym: 'Australian', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', dial: '+43', demonym: 'Austrian', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', dial: '+994', demonym: 'Azerbaijani', flag: '🇦🇿' },
  { code: 'BY', name: 'Belarus', dial: '+375', demonym: 'Belarusian', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium', dial: '+32', demonym: 'Belgian', flag: '🇧🇪' },
  { code: 'BT', name: 'Bhutan', dial: '+975', demonym: 'Bhutanese', flag: '🇧🇹' },
  { code: 'BO', name: 'Bolivia', dial: '+591', demonym: 'Bolivian', flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia and Herzegovina', dial: '+387', demonym: 'Bosnian', flag: '🇧🇦' },
  { code: 'BR', name: 'Brazil', dial: '+55', demonym: 'Brazilian', flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgaria', dial: '+359', demonym: 'Bulgarian', flag: '🇧🇬' },
  { code: 'KH', name: 'Cambodia', dial: '+855', demonym: 'Cambodian', flag: '🇰🇭' },
  { code: 'CM', name: 'Cameroon', dial: '+237', demonym: 'Cameroonian', flag: '🇨🇲' },
  { code: 'CA', name: 'Canada', dial: '+1', demonym: 'Canadian', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', dial: '+56', demonym: 'Chilean', flag: '🇨🇱' },
  { code: 'CN', name: 'China', dial: '+86', demonym: 'Chinese', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', dial: '+57', demonym: 'Colombian', flag: '🇨🇴' },
  { code: 'HR', name: 'Croatia', dial: '+385', demonym: 'Croatian', flag: '🇭🇷' },
  { code: 'CY', name: 'Cyprus', dial: '+357', demonym: 'Cypriot', flag: '🇨🇾' },
  { code: 'CZ', name: 'Czechia', dial: '+420', demonym: 'Czech', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', dial: '+45', demonym: 'Danish', flag: '🇩🇰' },
  { code: 'EC', name: 'Ecuador', dial: '+593', demonym: 'Ecuadorian', flag: '🇪🇨' },
  { code: 'ET', name: 'Ethiopia', dial: '+251', demonym: 'Ethiopian', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', dial: '+358', demonym: 'Finnish', flag: '🇫🇮' },
  { code: 'FR', name: 'France', dial: '+33', demonym: 'French', flag: '🇫🇷' },
  { code: 'GE', name: 'Georgia', dial: '+995', demonym: 'Georgian', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', dial: '+49', demonym: 'German', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', dial: '+233', demonym: 'Ghanaian', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', dial: '+30', demonym: 'Greek', flag: '🇬🇷' },
  { code: 'HK', name: 'Hong Kong', dial: '+852', demonym: 'Hong Konger', flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary', dial: '+36', demonym: 'Hungarian', flag: '🇭🇺' },
  { code: 'ID', name: 'Indonesia', dial: '+62', demonym: 'Indonesian', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', dial: '+98', demonym: 'Iranian', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', dial: '+964', demonym: 'Iraqi', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', dial: '+353', demonym: 'Irish', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', dial: '+972', demonym: 'Israeli', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', dial: '+39', demonym: 'Italian', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', dial: '+81', demonym: 'Japanese', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', dial: '+962', demonym: 'Jordanian', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', dial: '+7', demonym: 'Kazakh', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', dial: '+254', demonym: 'Kenyan', flag: '🇰🇪' },
  { code: 'KR', name: 'South Korea', dial: '+82', demonym: 'South Korean', flag: '🇰🇷' },
  { code: 'KG', name: 'Kyrgyzstan', dial: '+996', demonym: 'Kyrgyz', flag: '🇰🇬' },
  { code: 'LB', name: 'Lebanon', dial: '+961', demonym: 'Lebanese', flag: '🇱🇧' },
  { code: 'LY', name: 'Libya', dial: '+218', demonym: 'Libyan', flag: '🇱🇾' },
  { code: 'MY', name: 'Malaysia', dial: '+60', demonym: 'Malaysian', flag: '🇲🇾' },
  { code: 'MV', name: 'Maldives', dial: '+960', demonym: 'Maldivian', flag: '🇲🇻' },
  { code: 'MT', name: 'Malta', dial: '+356', demonym: 'Maltese', flag: '🇲🇹' },
  { code: 'MU', name: 'Mauritius', dial: '+230', demonym: 'Mauritian', flag: '🇲🇺' },
  { code: 'MX', name: 'Mexico', dial: '+52', demonym: 'Mexican', flag: '🇲🇽' },
  { code: 'MD', name: 'Moldova', dial: '+373', demonym: 'Moldovan', flag: '🇲🇩' },
  { code: 'MN', name: 'Mongolia', dial: '+976', demonym: 'Mongolian', flag: '🇲🇳' },
  { code: 'ME', name: 'Montenegro', dial: '+382', demonym: 'Montenegrin', flag: '🇲🇪' },
  { code: 'MA', name: 'Morocco', dial: '+212', demonym: 'Moroccan', flag: '🇲🇦' },
  { code: 'MM', name: 'Myanmar', dial: '+95', demonym: 'Burmese', flag: '🇲🇲' },
  { code: 'NL', name: 'Netherlands', dial: '+31', demonym: 'Dutch', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', demonym: 'New Zealander', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', dial: '+234', demonym: 'Nigerian', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', dial: '+47', demonym: 'Norwegian', flag: '🇳🇴' },
  { code: 'PS', name: 'Palestine', dial: '+970', demonym: 'Palestinian', flag: '🇵🇸' },
  { code: 'PE', name: 'Peru', dial: '+51', demonym: 'Peruvian', flag: '🇵🇪' },
  { code: 'PL', name: 'Poland', dial: '+48', demonym: 'Polish', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', dial: '+351', demonym: 'Portuguese', flag: '🇵🇹' },
  { code: 'RO', name: 'Romania', dial: '+40', demonym: 'Romanian', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', dial: '+7', demonym: 'Russian', flag: '🇷🇺' },
  { code: 'RW', name: 'Rwanda', dial: '+250', demonym: 'Rwandan', flag: '🇷🇼' },
  { code: 'SN', name: 'Senegal', dial: '+221', demonym: 'Senegalese', flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia', dial: '+381', demonym: 'Serbian', flag: '🇷🇸' },
  { code: 'SG', name: 'Singapore', dial: '+65', demonym: 'Singaporean', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia', dial: '+421', demonym: 'Slovak', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', dial: '+386', demonym: 'Slovenian', flag: '🇸🇮' },
  { code: 'SO', name: 'Somalia', dial: '+252', demonym: 'Somali', flag: '🇸🇴' },
  { code: 'ZA', name: 'South Africa', dial: '+27', demonym: 'South African', flag: '🇿🇦' },
  { code: 'SS', name: 'South Sudan', dial: '+211', demonym: 'South Sudanese', flag: '🇸🇸' },
  { code: 'ES', name: 'Spain', dial: '+34', demonym: 'Spanish', flag: '🇪🇸' },
  { code: 'SD', name: 'Sudan', dial: '+249', demonym: 'Sudanese', flag: '🇸🇩' },
  { code: 'SE', name: 'Sweden', dial: '+46', demonym: 'Swedish', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', dial: '+41', demonym: 'Swiss', flag: '🇨🇭' },
  { code: 'SY', name: 'Syria', dial: '+963', demonym: 'Syrian', flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan', dial: '+886', demonym: 'Taiwanese', flag: '🇹🇼' },
  { code: 'TJ', name: 'Tajikistan', dial: '+992', demonym: 'Tajik', flag: '🇹🇯' },
  { code: 'TZ', name: 'Tanzania', dial: '+255', demonym: 'Tanzanian', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', dial: '+66', demonym: 'Thai', flag: '🇹🇭' },
  { code: 'TN', name: 'Tunisia', dial: '+216', demonym: 'Tunisian', flag: '🇹🇳' },
  { code: 'TR', name: 'Türkiye', dial: '+90', demonym: 'Turkish', flag: '🇹🇷' },
  { code: 'TM', name: 'Turkmenistan', dial: '+993', demonym: 'Turkmen', flag: '🇹🇲' },
  { code: 'UG', name: 'Uganda', dial: '+256', demonym: 'Ugandan', flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine', dial: '+380', demonym: 'Ukrainian', flag: '🇺🇦' },
  { code: 'UY', name: 'Uruguay', dial: '+598', demonym: 'Uruguayan', flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan', dial: '+998', demonym: 'Uzbek', flag: '🇺🇿' },
  { code: 'VE', name: 'Venezuela', dial: '+58', demonym: 'Venezuelan', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', dial: '+84', demonym: 'Vietnamese', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', dial: '+967', demonym: 'Yemeni', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', dial: '+260', demonym: 'Zambian', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', dial: '+263', demonym: 'Zimbabwean', flag: '🇿🇼' },
];

export const DEFAULT_COUNTRY = 'AE';

export const countryByCode = (code: string) => COUNTRIES.find((c) => c.code === code);

/** Short forms people write instead of the official country name. */
const COUNTRY_ALIASES: Record<string, string> = {
  'uae': 'AE', 'u.a.e': 'AE', 'emirates': 'AE',
  'usa': 'US', 'u.s.a': 'US', 'u.s': 'US', 'us': 'US', 'america': 'US',
  'uk': 'GB', 'u.k': 'GB', 'britain': 'GB', 'great britain': 'GB',
  'england': 'GB', 'scotland': 'GB', 'wales': 'GB',
  'korea': 'KR', 'south korea': 'KR',
  'ksa': 'SA', 'saudi': 'SA',
};

/**
 * Best-effort country → demonym for a free-text location such as
 * "Pune, India" or "Dubai, UAE".
 *
 * Deliberately NOT used to set `nationality`: where someone lives is not their
 * citizenship, and for a UAE agency a wrong nationality affects visa
 * eligibility, so it may only pre-select a value a person then confirms.
 * Returns null unless the country is recognised, and any value returned comes
 * from COUNTRIES, so it is always a valid NATIONALITIES option.
 */
export function demonymForLocation(location?: string | null): string | null {
  const raw = (location ?? '').trim();
  if (!raw) return null;
  // Reversed, because the country is the last part of "Pune, Maharashtra, India".
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean).reverse();
  for (const part of [...parts, raw]) {
    const key = part.toLowerCase().replace(/\.+$/, '');
    const code = COUNTRY_ALIASES[key];
    const hit = code
      ? COUNTRIES.find((c) => c.code === code)
      : COUNTRIES.find((c) => c.name.toLowerCase() === key);
    if (hit) return hit.demonym;
  }
  return null;
}

/** Longest dial code wins, since '+97' prefixes both '+971' and '+974'. */
function matchDial(compact: string, prefix: string): Country | undefined {
  const matches = COUNTRIES
    .filter((c) => compact.startsWith(prefix + c.dial.slice(1)))
    .sort((a, b) => b.dial.length - a.dial.length);
  // Prefer a priority country when several share a dial code (+1 → US, not CA).
  return matches.find((c) => c.priority) ?? matches[0];
}

/**
 * Splits a stored phone string into a country and a local number, so a value
 * parsed from a CV round-trips into the picker. Handles the formats CVs
 * actually use: '+971501234567', '00971501234567', '971501234567' and the
 * national form '0501234567'. Anything unrecognised keeps its digits under the
 * default country rather than being mangled.
 */
export function splitPhone(raw?: string | null): { country: string; number: string } {
  const value = String(raw || '').trim();
  if (!value) return { country: DEFAULT_COUNTRY, number: '' };

  const compact = value.replace(/[\s()./-]/g, '');

  // '+971…'
  if (compact.startsWith('+')) {
    const hit = matchDial(compact, '+');
    if (hit) return { country: hit.code, number: compact.slice(hit.dial.length) };
    return { country: DEFAULT_COUNTRY, number: compact.replace(/^\+/, '') };
  }

  const digits = compact.replace(/\D/g, '');
  if (!digits) return { country: DEFAULT_COUNTRY, number: '' };

  // '00971…' — international prefix instead of '+'.
  if (digits.startsWith('00')) {
    const rest = digits.slice(2);
    const hit = matchDial(rest, '');
    if (hit) return { country: hit.code, number: rest.slice(hit.dial.length - 1) };
    return { country: DEFAULT_COUNTRY, number: rest };
  }

  // National form: a leading trunk '0' is not part of the number we store.
  if (digits.startsWith('0')) {
    return { country: DEFAULT_COUNTRY, number: digits.replace(/^0+/, '') };
  }

  // Bare '971501234567' — only treat the head as a dial code if enough digits
  // remain to be a real subscriber number, so a local 8-digit line is left alone.
  const hit = matchDial(digits, '');
  if (hit && digits.length - (hit.dial.length - 1) >= 6) {
    return { country: hit.code, number: digits.slice(hit.dial.length - 1) };
  }

  return { country: DEFAULT_COUNTRY, number: digits };
}

/** Recombines a picker selection into the single string the API stores. */
export function joinPhone(countryCode: string, number: string): string {
  const digits = String(number || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return `${countryByCode(countryCode)?.dial ?? ''}${digits}`;
}

/** Nationality options, derived from the country list. */
export const NATIONALITIES = COUNTRIES.map((c) => ({
  value: c.demonym,
  label: c.demonym,
  hint: c.name,
  icon: c.flag,
  priority: c.priority,
}));

/** Cities candidates commonly live in, Gulf first. Free text is still allowed. */
export const LOCATIONS: { value: string; icon: string; priority?: boolean }[] = [
  { value: 'Dubai, UAE', icon: '🇦🇪', priority: true },
  { value: 'Abu Dhabi, UAE', icon: '🇦🇪', priority: true },
  { value: 'Sharjah, UAE', icon: '🇦🇪', priority: true },
  { value: 'Ajman, UAE', icon: '🇦🇪', priority: true },
  { value: 'Ras Al Khaimah, UAE', icon: '🇦🇪', priority: true },
  { value: 'Fujairah, UAE', icon: '🇦🇪', priority: true },
  { value: 'Umm Al Quwain, UAE', icon: '🇦🇪', priority: true },
  { value: 'Al Ain, UAE', icon: '🇦🇪', priority: true },
  { value: 'Doha, Qatar', icon: '🇶🇦', priority: true },
  { value: 'Riyadh, Saudi Arabia', icon: '🇸🇦', priority: true },
  { value: 'Jeddah, Saudi Arabia', icon: '🇸🇦', priority: true },
  { value: 'Dammam, Saudi Arabia', icon: '🇸🇦', priority: true },
  { value: 'Kuwait City, Kuwait', icon: '🇰🇼', priority: true },
  { value: 'Manama, Bahrain', icon: '🇧🇭', priority: true },
  { value: 'Muscat, Oman', icon: '🇴🇲', priority: true },
  { value: 'Mumbai, India', icon: '🇮🇳' },
  { value: 'Delhi, India', icon: '🇮🇳' },
  { value: 'Bengaluru, India', icon: '🇮🇳' },
  { value: 'Hyderabad, India', icon: '🇮🇳' },
  { value: 'Chennai, India', icon: '🇮🇳' },
  { value: 'Pune, India', icon: '🇮🇳' },
  { value: 'Kochi, India', icon: '🇮🇳' },
  { value: 'Ahmedabad, India', icon: '🇮🇳' },
  { value: 'Karachi, Pakistan', icon: '🇵🇰' },
  { value: 'Lahore, Pakistan', icon: '🇵🇰' },
  { value: 'Islamabad, Pakistan', icon: '🇵🇰' },
  { value: 'Manila, Philippines', icon: '🇵🇭' },
  { value: 'Cebu, Philippines', icon: '🇵🇭' },
  { value: 'Dhaka, Bangladesh', icon: '🇧🇩' },
  { value: 'Kathmandu, Nepal', icon: '🇳🇵' },
  { value: 'Colombo, Sri Lanka', icon: '🇱🇰' },
  { value: 'Cairo, Egypt', icon: '🇪🇬' },
  { value: 'Amman, Jordan', icon: '🇯🇴' },
  { value: 'Beirut, Lebanon', icon: '🇱🇧' },
  { value: 'Casablanca, Morocco', icon: '🇲🇦' },
  { value: 'Tunis, Tunisia', icon: '🇹🇳' },
  { value: 'Istanbul, Türkiye', icon: '🇹🇷' },
  { value: 'London, United Kingdom', icon: '🇬🇧' },
  { value: 'Singapore', icon: '🇸🇬' },
  { value: 'Kuala Lumpur, Malaysia', icon: '🇲🇾' },
  { value: 'Nairobi, Kenya', icon: '🇰🇪' },
  { value: 'Lagos, Nigeria', icon: '🇳🇬' },
  { value: 'Johannesburg, South Africa', icon: '🇿🇦' },
];

/** Experience buckets. `value` is the number of years stored on the profile. */
export const EXPERIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'Fresher — no experience' },
  { value: '1', label: '1 year' },
  ...Array.from({ length: 19 }, (_, i) => ({ value: String(i + 2), label: `${i + 2} years` })),
  { value: '25', label: '25+ years' },
];

export const VISA_STATUS_OPTIONS = [
  'Employment Visa',
  'Visit Visa',
  'Tourist Visa',
  'Cancelled Visa',
  'Golden Visa',
  'Freelance Visa',
  'Student Visa',
  'Family / Dependent Visa',
  'Own Visa',
  'No Visa — outside UAE',
];

/** Language suggestions, most common in the region first. */
export const LANGUAGE_OPTIONS: string[] = [
  'English', 'Arabic', 'Hindi', 'Urdu', 'Malayalam', 'Tamil', 'Telugu', 'Bengali',
  'Punjabi', 'Gujarati', 'Marathi', 'Kannada', 'Tagalog / Filipino', 'Nepali',
  'Sinhala', 'Farsi / Persian', 'Pashto', 'French', 'Spanish', 'German', 'Italian',
  'Portuguese', 'Russian', 'Ukrainian', 'Turkish', 'Mandarin Chinese', 'Cantonese',
  'Japanese', 'Korean', 'Indonesian', 'Malay', 'Thai', 'Vietnamese', 'Swahili',
  'Amharic', 'Somali', 'Dutch', 'Polish', 'Romanian', 'Greek', 'Hebrew',
];

/** Skill suggestions grouped by discipline; the picker searches across all of them. */
export const SKILL_OPTIONS: string[] = [
  // Software / IT
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Angular', 'Vue.js', 'Node.js',
  'Python', 'Java', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby on Rails', 'Go', 'Rust',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Oracle', 'Redis',
  'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
  'Git', 'REST APIs', 'GraphQL', 'Microservices', 'Linux', 'DevOps',
  'Cybersecurity', 'Network Administration', 'Data Analysis', 'Power BI', 'Tableau',
  'Machine Learning', 'Flutter', 'React Native', 'iOS / Swift', 'Android / Kotlin',
  // ERP / business systems
  'SAP', 'SAP FICO', 'SAP MM', 'Oracle ERP', 'Microsoft Dynamics', 'Salesforce',
  'Tally', 'QuickBooks', 'Zoho', 'Odoo',
  // Engineering / construction
  'AutoCAD', 'Revit', 'SolidWorks', 'CATIA', 'ETABS', 'STAAD Pro', 'Primavera P6',
  'MS Project', 'BIM', 'Civil Engineering', 'Structural Design', 'MEP', 'HVAC',
  'Quantity Surveying', 'Site Supervision', 'Project Management', 'PMP',
  'Health & Safety (NEBOSH)', 'IOSH', 'Quality Control', 'Welding Inspection',
  // Oil & gas
  'Piping Design', 'Process Engineering', 'Pipeline Integrity', 'HSE', 'Offshore Operations',
  // Finance / accounting
  'Financial Reporting', 'IFRS', 'Accounts Payable', 'Accounts Receivable',
  'Budgeting & Forecasting', 'Auditing', 'Taxation', 'VAT', 'Payroll', 'ACCA', 'CPA', 'CMA',
  'Financial Modelling', 'Advanced Excel',
  // HR / admin
  'Recruitment', 'Talent Acquisition', 'HR Operations', 'HRMS', 'Employee Relations',
  'Performance Management', 'Learning & Development', 'Compensation & Benefits',
  'UAE Labour Law', 'CIPD', 'Onboarding', 'Office Administration', 'Data Entry',
  // Sales / marketing
  'B2B Sales', 'Business Development', 'Key Account Management', 'CRM',
  'Digital Marketing', 'SEO', 'Google Ads', 'Social Media Marketing',
  'Content Writing', 'Brand Management', 'Market Research', 'Retail Sales',
  // Healthcare
  'Nursing', 'Patient Care', 'Phlebotomy', 'Radiology', 'Pharmacy', 'Medical Coding',
  'DHA Licensed', 'HAAD / DOH Licensed', 'MOH Licensed', 'BLS / ACLS',
  // Logistics / operations
  'Supply Chain Management', 'Logistics', 'Warehouse Management', 'Procurement',
  'Inventory Control', 'Import & Export', 'Customs Clearance', 'Fleet Management',
  // Hospitality
  'Guest Relations', 'Food & Beverage', 'Housekeeping', 'Front Office', 'Opera PMS',
  'Culinary Arts', 'Barista', 'Event Management',
  // Design
  'Adobe Photoshop', 'Adobe Illustrator', 'Adobe InDesign', 'Figma', 'UI/UX Design',
  'Graphic Design', 'Video Editing', '3D Modelling', 'Interior Design',
  // Soft skills
  'Team Leadership', 'Communication', 'Problem Solving', 'Time Management',
  'Negotiation', 'Customer Service', 'Stakeholder Management', 'Training & Mentoring',
];
