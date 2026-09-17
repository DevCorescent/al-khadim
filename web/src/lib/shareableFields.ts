export interface ShareableField {
  key: string;
  label: string;
}

export const SHAREABLE_FIELD_GROUPS: { group: string; fields: ShareableField[] }[] = [
  {
    group: 'Personal',
    fields: [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'altPhone', label: 'Alternate Phone' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'currentLocation', label: 'Current Location' },
      { key: 'photo', label: 'Photo' },
    ],
  },
  {
    group: 'Identity Documents',
    fields: [
      { key: 'passportNo', label: 'Passport Number' },
      { key: 'passportExpiry', label: 'Passport Expiry' },
      { key: 'visaStatus', label: 'Visa Status' },
    ],
  },
  {
    group: 'Professional',
    fields: [
      { key: 'headline', label: 'Headline' },
      { key: 'summary', label: 'Summary' },
      { key: 'skills', label: 'Skills' },
      { key: 'languages', label: 'Languages' },
      { key: 'education', label: 'Education' },
      { key: 'experience', label: 'Experience (Years)' },
      { key: 'linkedIn', label: 'LinkedIn' },
      { key: 'portfolio', label: 'Portfolio' },
    ],
  },
  {
    group: 'Compensation',
    fields: [
      { key: 'currentSalary', label: 'Current Salary' },
      { key: 'expectedSalary', label: 'Expected Salary' },
      { key: 'currency', label: 'Currency' },
    ],
  },
  {
    group: 'Media',
    fields: [
      { key: 'introVideoUrl', label: 'Intro Video' },
    ],
  },
];

export const ALL_SHAREABLE_FIELDS = SHAREABLE_FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key));

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  SHAREABLE_FIELD_GROUPS.flatMap(g => g.fields.map(f => [f.key, f.label]))
);
