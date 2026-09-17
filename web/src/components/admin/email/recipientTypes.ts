/**
 * Shared recipient-type metadata used across the campaign builder's audience
 * picker, the recipient directory, and various read-only screens (campaign
 * list/detail, templates, groups) that label a `RecipientType` value. Lives
 * in its own module (rather than only inside AudiencePicker.tsx) so
 * RecipientDirectory.tsx can import it without creating a circular import
 * with AudiencePicker.tsx, which itself imports RecipientDirectory.
 */
export type RecipientTypeValue = 'CANDIDATES' | 'EMPLOYEES' | 'CLIENTS' | 'CLIENT_USERS' | 'USERS';

export const RECIPIENT_TYPES: { value: RecipientTypeValue; label: string }[] = [
  { value: 'CANDIDATES',   label: 'Candidates' },
  { value: 'EMPLOYEES',    label: 'Employees' },
  { value: 'CLIENTS',      label: 'Clients' },
  { value: 'CLIENT_USERS', label: 'Client Users' },
  { value: 'USERS',        label: 'Internal Staff' },
];
