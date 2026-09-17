export const EXPENSE_CATEGORIES = [
  'RENT', 'UTILITIES', 'OFFICE_SUPPLIES', 'MARKETING', 'TRAVEL',
  'PROFESSIONAL_FEES', 'MAINTENANCE', 'INSURANCE', 'IT_SOFTWARE',
  'BANK_CHARGES', 'TAXES', 'OTHER',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  OFFICE_SUPPLIES: 'Office Supplies',
  MARKETING: 'Marketing',
  TRAVEL: 'Travel',
  PROFESSIONAL_FEES: 'Professional Fees',
  MAINTENANCE: 'Maintenance',
  INSURANCE: 'Insurance',
  IT_SOFTWARE: 'IT / Software',
  BANK_CHARGES: 'Bank Charges',
  TAXES: 'Taxes',
  OTHER: 'Other',
};

export const EXPENSE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED'] as const;

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  PAID: 'Paid',
  REJECTED: 'Rejected',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export const RECURRENCE_INTERVALS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];
