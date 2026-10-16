import { DEFAULT_DESIGN } from '../../src/lib/invoiceDesign';

/**
 * The company's own tax-invoice layout (letterhead, bordered table, amount in
 * words, bank block and stamp), recreated from its existing invoices.
 */
export const INVOICE_TEMPLATES = [
  {
    name: 'Al Khadim — Tax Invoice',
    description: 'Letterhead tax invoice with customer TRN, service dates, VAT per line, amount in words and bank details.',
    isDefault: true,
    data: {
      docType: 'INVOICE', currency: 'AED', dateFormat: 'DD-MM-YYYY',
      taxRate: 5, taxLabel: 'VAT', discount: 0, discountType: 'FIXED',
      fromName: 'AL KHADIM LLC',
      fromAddress: 'Sharjah Media City,\nSharjah, UAE',
      fromPhone: '+971 56 984 2508',
      fromWebsite: 'www.alkhadim.ae',
      fromEmail: 'info@alkhadim.ae',
      fromEmailAlt: 'santosh@alkhadim.ae',
      fromTaxNo: '100567061500003',
      paymentMethod: 'BANK_TRANSFER',
      paymentTerms: 'Immediately',
      bankAccountName: 'SANTOSH BHAGAT',
      bankName: 'EMIRATES NBD',
      bankAccount: '1015384990801',
      bankIBAN: 'AE16 0260 0010 1538 4990 801',
      bankSwift: 'EBILAEAD',
      bankBranch: 'Burjman, Dubai, UAE',
      notes: 'If you have any inquiry, please contact us within 10 days, after which the company will not be responsible.',
      terms: '',
      template: 'letterhead', primaryColor: '#0D4E60', accentColor: '#ffffff', fontFamily: 'calibri',
      logoUrl: 'brand/al-khadim-logo.png', logoShape: 'circle', tableStyle: 'bordered',
      watermark: '', watermarkOpacity: 12,
      showHeader: true, showFooter: true, showSignature: false,
      footerText: 'Placement Agency | Temporary Employee Agency | Outsourcing/Staffing',
      designOptions: {
        ...DEFAULT_DESIGN,
        paymentNote: 'Payment to be made by online transfer at below',
        numberFormat: '{SEQ:4}/{MM}/{FY}',
        numberStart: 20,
        dateFormat: 'DD-MM-YYYY',
      },
    },
  },
];
