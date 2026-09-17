'use client';
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, Save, Eye, ArrowLeft, Info, RefreshCw, Palette, CheckSquare } from 'lucide-react';

/* ─── Currency data ──────────────────────────────────────────── */
const CURRENCIES = [
  { code:'USD', symbol:'$',  name:'US Dollar' },
  { code:'EUR', symbol:'€',  name:'Euro' },
  { code:'GBP', symbol:'£',  name:'British Pound' },
  { code:'AED', symbol:'د.إ', name:'UAE Dirham' },
  { code:'SAR', symbol:'ر.س', name:'Saudi Riyal' },
  { code:'QAR', symbol:'ر.ق', name:'Qatari Riyal' },
  { code:'KWD', symbol:'د.ك', name:'Kuwaiti Dinar' },
  { code:'BHD', symbol:'.د.ب', name:'Bahraini Dinar' },
  { code:'OMR', symbol:'ر.ع.', name:'Omani Rial' },
  { code:'INR', symbol:'₹',  name:'Indian Rupee' },
  { code:'PKR', symbol:'₨',  name:'Pakistani Rupee' },
  { code:'BDT', symbol:'৳',  name:'Bangladeshi Taka' },
  { code:'LKR', symbol:'Rs', name:'Sri Lankan Rupee' },
  { code:'NPR', symbol:'Rs', name:'Nepalese Rupee' },
  { code:'PHP', symbol:'₱',  name:'Philippine Peso' },
  { code:'MYR', symbol:'RM', name:'Malaysian Ringgit' },
  { code:'SGD', symbol:'S$', name:'Singapore Dollar' },
  { code:'IDR', symbol:'Rp', name:'Indonesian Rupiah' },
  { code:'THB', symbol:'฿',  name:'Thai Baht' },
  { code:'CNY', symbol:'¥',  name:'Chinese Yuan' },
  { code:'JPY', symbol:'¥',  name:'Japanese Yen' },
  { code:'KRW', symbol:'₩',  name:'South Korean Won' },
  { code:'AUD', symbol:'A$', name:'Australian Dollar' },
  { code:'CAD', symbol:'C$', name:'Canadian Dollar' },
  { code:'NZD', symbol:'NZ$', name:'New Zealand Dollar' },
  { code:'CHF', symbol:'Fr', name:'Swiss Franc' },
  { code:'ZAR', symbol:'R',  name:'South African Rand' },
  { code:'NGN', symbol:'₦',  name:'Nigerian Naira' },
  { code:'KES', symbol:'KSh', name:'Kenyan Shilling' },
  { code:'EGP', symbol:'E£', name:'Egyptian Pound' },
  { code:'TRY', symbol:'₺',  name:'Turkish Lira' },
  { code:'BRL', symbol:'R$', name:'Brazilian Real' },
  { code:'MXN', symbol:'$',  name:'Mexican Peso' },
  { code:'ARS', symbol:'$',  name:'Argentine Peso' },
  { code:'CLP', symbol:'$',  name:'Chilean Peso' },
  { code:'COP', symbol:'$',  name:'Colombian Peso' },
];

const TAX_LABELS = ['VAT','GST','HST','PST','Sales Tax','Service Tax','Withholding Tax','No Tax'];

const PAYMENT_METHODS = [
  { value:'BANK_TRANSFER', label:'Bank Transfer' },
  { value:'CHEQUE',        label:'Cheque' },
  { value:'CASH',          label:'Cash' },
  { value:'ONLINE',        label:'Online Payment' },
  { value:'CARD',          label:'Credit / Debit Card' },
  { value:'CRYPTO',        label:'Cryptocurrency' },
  { value:'OTHER',         label:'Other' },
];

const DATE_FORMATS = ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD','DD MMM YYYY'];

const TEMPLATES = [
  { key:'classic',    label:'Classic',    desc:'Traditional header with ruled lines' },
  { key:'modern',     label:'Modern',     desc:'Bold gradient header with card sections' },
  { key:'minimal',    label:'Minimal',    desc:'Clean typography, no background fills' },
  { key:'corporate',  label:'Corporate',  desc:'Color bar header with structured layout' },
];

const FONT_FAMILIES = [
  { value:'helvetica', label:'Helvetica / Arial' },
  { value:'georgia',   label:'Georgia (Serif)' },
  { value:'courier',   label:'Courier (Mono)' },
  { value:'trebuchet', label:'Trebuchet MS' },
  { value:'inter',     label:'Inter' },
];

const TABLE_STYLES = [
  { value:'striped',  label:'Striped rows' },
  { value:'bordered', label:'Bordered cells' },
  { value:'minimal',  label:'Minimal lines' },
  { value:'clean',    label:'Clean (no lines)' },
];

const LOGO_SHAPES = [
  { value:'rounded', label:'Rounded' },
  { value:'circle',  label:'Circle' },
  { value:'square',  label:'Square' },
];

const WATERMARK_PRESETS = ['','PAID','DRAFT','CONFIDENTIAL','VOID','APPROVED','SAMPLE'];

const PRESET_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308',
  '#22c55e','#14b8a6','#0ea5e9','#3b82f6','#1e293b','#374151',
];

/* ─── types ──────────────────────────────────────────────────── */
interface Item { id?: string; description: string; qty: number; unit: string; unitPrice: number; total: number; }
interface FormState {
  docType: string; clientId: string; subject: string; status: string;
  currency: string; dateFormat: string;
  issueDate: string; dueDate: string; validUntil: string;
  fromName: string; fromAddress: string; fromEmail: string; fromPhone: string;
  fromTaxNo: string; fromRegNo: string;
  billingName: string; billingAddress: string; billingEmail: string; billingPhone: string;
  discount: number; discountType: string; taxRate: number; taxLabel: string;
  paymentMethod: string; paymentRef: string;
  bankName: string; bankAccount: string; bankIBAN: string; bankSwift: string;
  bankRoutingNo: string; bankSortCode: string;
  terms: string; notes: string; description: string;
  items: Item[];
  // Design
  template: string; primaryColor: string; accentColor: string; fontFamily: string;
  logoText: string; logoShape: string; tableStyle: string;
  watermark: string; watermarkOpacity: number;
  showHeader: boolean; showFooter: boolean; showSignature: boolean; footerText: string;
}

const DOC_LABELS: Record<string,string> = { INVOICE:'Invoice', PROFORMA_INVOICE:'Proforma Invoice', QUOTATION:'Quotation' };

const BLANK: FormState = {
  docType:'INVOICE', clientId:'', subject:'', status:'DRAFT',
  currency:'USD', dateFormat:'DD/MM/YYYY',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate:'', validUntil:'',
  fromName:'', fromAddress:'', fromEmail:'', fromPhone:'', fromTaxNo:'', fromRegNo:'',
  billingName:'', billingAddress:'', billingEmail:'', billingPhone:'',
  discount:0, discountType:'FIXED', taxRate:0, taxLabel:'VAT',
  paymentMethod:'BANK_TRANSFER', paymentRef:'',
  bankName:'', bankAccount:'', bankIBAN:'', bankSwift:'', bankRoutingNo:'', bankSortCode:'',
  terms:'Payment is due within 30 days of invoice date.\nPlease make payment via bank transfer to the details provided.',
  notes:'', description:'',
  items:[{ description:'', qty:1, unit:'', unitPrice:0, total:0 }],
  // Design defaults
  template:'classic', primaryColor:'#6366f1', accentColor:'#ffffff', fontFamily:'helvetica',
  logoText:'', logoShape:'rounded', tableStyle:'striped',
  watermark:'', watermarkOpacity:12,
  showHeader:true, showFooter:true, showSignature:false, footerText:'',
};

function calcTotals(items: Item[], discount: number, discountType: string, taxRate: number) {
  const subtotal = items.reduce((s,i) => s + (Number(i.qty)||0) * (Number(i.unitPrice)||0), 0);
  const discAmt  = discountType === 'PERCENT' ? subtotal * (discount/100) : Number(discount)||0;
  const taxable  = Math.max(0, subtotal - discAmt);
  const taxAmt   = taxable * ((Number(taxRate)||0)/100);
  return { subtotal, discAmt, taxAmt, total: taxable + taxAmt };
}

function fmtDate(iso: string, fmt: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = String(d.getFullYear());
  const mon = d.toLocaleString('default',{month:'short'});
  return fmt.replace('DD',dd).replace('MMM',mon).replace('MM',mm).replace('YYYY',yyyy);
}

function isDark(hex: string) {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return (r*299+g*587+b*114)/1000 < 128;
}

/* ─── component ──────────────────────────────────────────────── */
export default function InvoiceBuilder({ existing, defaultType = 'INVOICE' }: { existing?: any; defaultType?: string }) {
  const router  = useRouter();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details'|'from'|'billing'|'payment'|'design'>('details');

  const init = useCallback((): FormState => {
    if (!existing) return { ...BLANK, docType: defaultType };
    return {
      docType:       existing.docType       || defaultType,
      clientId:      existing.clientId      || '',
      subject:       existing.subject       || '',
      status:        existing.status        || 'DRAFT',
      currency:      existing.currency      || 'USD',
      dateFormat:    existing.dateFormat    || 'DD/MM/YYYY',
      issueDate:     existing.issueDate     ? existing.issueDate.split('T')[0]   : BLANK.issueDate,
      dueDate:       existing.dueDate       ? existing.dueDate.split('T')[0]     : '',
      validUntil:    existing.validUntil    ? existing.validUntil.split('T')[0]  : '',
      fromName:      existing.fromName      || '',
      fromAddress:   existing.fromAddress   || '',
      fromEmail:     existing.fromEmail     || '',
      fromPhone:     existing.fromPhone     || '',
      fromTaxNo:     existing.fromTaxNo     || '',
      fromRegNo:     existing.fromRegNo     || '',
      billingName:   existing.billingName   || existing.client?.companyName || '',
      billingAddress:existing.billingAddress|| [existing.client?.address, existing.client?.city, existing.client?.country].filter(Boolean).join(', ') || '',
      billingEmail:  existing.billingEmail  || existing.client?.email || '',
      billingPhone:  existing.billingPhone  || existing.client?.phone || '',
      discount:      existing.discount      || 0,
      discountType:  existing.discountType  || 'FIXED',
      taxRate:       existing.taxRate       ?? 0,
      taxLabel:      existing.taxLabel      || 'VAT',
      paymentMethod: existing.paymentMethod || 'BANK_TRANSFER',
      paymentRef:    existing.paymentRef    || '',
      bankName:      existing.bankName      || '',
      bankAccount:   existing.bankAccount   || '',
      bankIBAN:      existing.bankIBAN      || '',
      bankSwift:     existing.bankSwift     || '',
      bankRoutingNo: existing.bankRoutingNo || '',
      bankSortCode:  existing.bankSortCode  || '',
      terms:         existing.terms         || BLANK.terms,
      notes:         existing.notes         || '',
      description:   existing.description   || '',
      items: (existing.items?.length > 0)
        ? existing.items.map((i: any) => ({ ...i, qty:i.qty||1, unitPrice:i.unitPrice||0, total:(i.qty||1)*(i.unitPrice||0) }))
        : BLANK.items,
      // Design
      template:        existing.template        || 'classic',
      primaryColor:    existing.primaryColor    || '#6366f1',
      accentColor:     existing.accentColor     || '#ffffff',
      fontFamily:      existing.fontFamily      || 'helvetica',
      logoText:        existing.logoText        || '',
      logoShape:       existing.logoShape       || 'rounded',
      tableStyle:      existing.tableStyle      || 'striped',
      watermark:       existing.watermark       || '',
      watermarkOpacity:existing.watermarkOpacity ?? 12,
      showHeader:      existing.showHeader      ?? true,
      showFooter:      existing.showFooter      ?? true,
      showSignature:   existing.showSignature   ?? false,
      footerText:      existing.footerText      || '',
    };
  }, [existing, defaultType]);

  const [form, setForm] = useState<FormState>(init);
  useEffect(() => { setForm(init()); }, [init]);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const setVal = (field: keyof FormState, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients?limit=200').then(r => r.data.data || []),
  });

  useEffect(() => {
    if (!form.clientId) return;
    const c = (clients as any[]).find((cl:any) => cl.id === form.clientId);
    if (!c) return;
    setForm(f => ({
      ...f,
      billingName:    f.billingName    || c.companyName || '',
      billingEmail:   f.billingEmail   || c.email || '',
      billingPhone:   f.billingPhone   || c.phone || '',
      billingAddress: f.billingAddress || [c.address, c.city, c.country].filter(Boolean).join(', ') || '',
    }));
  }, [form.clientId, clients]);

  /* ─── items ─── */
  const updateItem = (idx: number, field: keyof Item, val: string|number) => {
    setForm(f => {
      const items = [...f.items];
      const it    = { ...items[idx], [field]: val };
      it.total    = (Number(it.qty)||0) * (Number(it.unitPrice)||0);
      items[idx]  = it;
      return { ...f, items };
    });
  };
  const addItem    = () => setForm(f => ({ ...f, items:[...f.items, { description:'', qty:1, unit:'', unitPrice:0, total:0 }] }));
  const removeItem = (idx:number) => setForm(f => ({ ...f, items:f.items.filter((_,i)=>i!==idx) }));

  /* ─── totals ─── */
  const { subtotal, discAmt, taxAmt, total } = calcTotals(form.items, Number(form.discount), form.discountType, Number(form.taxRate));
  const fmtN = (n:number) => n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtC = (n:number) => `${form.currency} ${fmtN(n)}`;

  /* ─── save ─── */
  async function save(andPreview=false) {
    if (!form.clientId) { toast.error('Please select a client'); return; }
    if (form.items.some(i => !i.description.trim())) { toast.error('All line items need a description'); return; }
    setSaving(true);
    try {
      const res = existing
        ? await api.put(`/invoices/${existing.id}`, form)
        : await api.post('/invoices', form);
      toast.success(existing ? 'Saved' : 'Created');
      if (andPreview) router.push(`/admin/crm/invoices/${res.data.id}`);
      else if (!existing) router.push(`/admin/crm/invoices/${res.data.id}/edit`);
    } catch (e:any) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const TABS = [
    { key:'details' as const,  label:'Document' },
    { key:'from'    as const,  label:'From / Sender' },
    { key:'billing' as const,  label:'Bill To' },
    { key:'payment' as const,  label:'Payment' },
    { key:'design'  as const,  label:'🎨 Design', icon:<Palette size={11}/> },
  ];

  const pc = form.primaryColor || '#6366f1';
  const onPc = isDark(pc) ? '#ffffff' : '#111111';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/crm/invoices')}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft size={15} className="text-gray-500"/>
          </button>
          <div>
            <div className="flex items-center gap-1">
              <select value={form.docType} onChange={set('docType')}
                className="text-base font-bold text-gray-900 bg-transparent border-none outline-none cursor-pointer pr-4 appearance-none">
                <option value="INVOICE">Invoice</option>
                <option value="PROFORMA_INVOICE">Proforma Invoice</option>
                <option value="QUOTATION">Quotation</option>
              </select>
              <ChevronDown size={13} className="text-gray-400 -ml-3 pointer-events-none"/>
            </div>
            <p className="text-xs text-gray-400">{existing ? `Editing ${existing.invoiceNo}` : `New ${DOC_LABELS[form.docType]||'Document'}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={form.status} onChange={set('status')}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white">
            {(form.docType==='QUOTATION'
              ? ['DRAFT','SENT','ACCEPTED','REJECTED','CANCELLED']
              : ['DRAFT','SENT','PAID','OVERDUE','CANCELLED']
            ).map(s=><option key={s}>{s}</option>)}
          </select>
          <button onClick={()=>save(false)} disabled={saving}
            className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-60 transition-colors">
            <Save size={14}/> Save
          </button>
          <button onClick={()=>save(true)} disabled={saving}
            className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2 rounded-xl disabled:opacity-60 transition-colors shadow-sm">
            <Eye size={14}/> {saving?'Saving…':'Save & Preview'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── Left: form ── */}
        <div className="xl:col-span-3 space-y-5">
          {/* Section tabs */}
          <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm overflow-x-auto">
            {TABS.map(t => (
              <button key={t.key} onClick={()=>setActiveTab(t.key)}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${activeTab===t.key?'bg-primary-400 text-white shadow-sm':'text-gray-400 hover:text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── DOCUMENT TAB ── */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Document Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Client *</label>
                    <select value={form.clientId} onChange={set('clientId')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                      <option value="">Select client…</option>
                      {(clients as any[]).map((c:any)=><option key={c.id} value={c.id}>{c.companyName}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Subject / Title</label>
                    <input value={form.subject} onChange={set('subject')} placeholder="e.g. Recruitment Services — Q2 2026"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Issue Date</label>
                    <input type="date" value={form.issueDate} onChange={set('issueDate')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      {form.docType==='QUOTATION'?'Valid Until':'Due Date'}
                    </label>
                    <input type="date"
                      value={form.docType==='QUOTATION'?form.validUntil:form.dueDate}
                      onChange={form.docType==='QUOTATION'?set('validUntil'):set('dueDate')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Currency</label>
                    <select value={form.currency} onChange={set('currency')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                      {CURRENCIES.map(c=>(
                        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Date Format</label>
                    <select value={form.dateFormat} onChange={set('dateFormat')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                      {DATE_FORMATS.map(f=><option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Description / Reference</label>
                    <input value={form.description} onChange={set('description')} placeholder="Internal reference or brief description"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-700">Line Items</h3>
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 text-xs font-bold text-primary-500 bg-primary-50 border border-primary-200 px-3 py-1.5 rounded-xl hover:bg-primary-100 transition-colors">
                    <Plus size={12}/> Add Line
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                  {[['Description','col-span-4'],['Qty','col-span-2'],['Unit','col-span-1'],['Unit Price','col-span-2'],['Total','col-span-2'],['','col-span-1']].map(([h,c])=>(
                    <div key={h} className={`${c} text-[10px] font-bold text-gray-400 uppercase tracking-wide`}>{h}</div>
                  ))}
                </div>

                <div className="space-y-2">
                  {form.items.map((item,idx)=>(
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl px-2 py-2 group">
                      <div className="col-span-4">
                        <input value={item.description} onChange={e=>updateItem(idx,'description',e.target.value)}
                          placeholder="Item or service description…"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400/40 bg-white"/>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="0.01" value={item.qty===0?'':item.qty}
                          onChange={e=>updateItem(idx,'qty',parseFloat(e.target.value)||0)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400/40 bg-white text-right"/>
                      </div>
                      <div className="col-span-1">
                        <input value={item.unit} onChange={e=>updateItem(idx,'unit',e.target.value)} placeholder="pcs"
                          className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400/40 bg-white"/>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="0.01" value={item.unitPrice===0?'':item.unitPrice}
                          onChange={e=>updateItem(idx,'unitPrice',parseFloat(e.target.value)||0)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400/40 bg-white text-right"/>
                      </div>
                      <div className="col-span-2 text-xs font-bold text-gray-700 text-right pr-1">
                        {fmtN((item.qty||0)*(item.unitPrice||0))}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={()=>removeItem(idx)} disabled={form.items.length===1}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-300 hover:text-red-500 disabled:opacity-20 transition-colors">
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-medium">Subtotal</span>
                    <span className="font-semibold text-gray-700">{fmtC(subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 font-medium flex-1">Discount</span>
                    <div className="flex items-center gap-1 border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={()=>setVal('discountType','FIXED')}
                        className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${form.discountType==='FIXED'?'bg-primary-400 text-white':'text-gray-400 hover:bg-gray-50'}`}>
                        {form.currency}
                      </button>
                      <button onClick={()=>setVal('discountType','PERCENT')}
                        className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${form.discountType==='PERCENT'?'bg-primary-400 text-white':'text-gray-400 hover:bg-gray-50'}`}>
                        %
                      </button>
                    </div>
                    <input type="number" min="0" step="0.01" value={form.discount||''}
                      onChange={e=>setVal('discount',parseFloat(e.target.value)||0)}
                      className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none text-right"/>
                    <span className="text-sm font-semibold text-red-500 w-32 text-right tabular-nums">
                      {discAmt > 0 ? `- ${fmtC(discAmt)}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 font-medium flex-1">Tax</span>
                    <select value={form.taxLabel} onChange={set('taxLabel')}
                      className="text-xs border border-gray-200 rounded-xl px-2 py-1.5 focus:outline-none w-28">
                      {TAX_LABELS.map(t=><option key={t}>{t}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" step="0.01" value={form.taxRate||''}
                        onChange={e=>setVal('taxRate',parseFloat(e.target.value)||0)}
                        className="w-16 text-xs border border-gray-200 rounded-xl px-2 py-1.5 focus:outline-none text-right"/>
                      <span className="text-xs text-gray-400 font-bold">%</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-32 text-right tabular-nums">
                      {taxAmt > 0 ? fmtC(taxAmt) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t-2 border-gray-900 pt-3">
                    <span className="font-black text-gray-900 text-base">TOTAL</span>
                    <span className="text-2xl font-black text-primary-600 tabular-nums">{fmtC(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── FROM / SENDER TAB ── */}
          {activeTab === 'from' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">Sender / Your Company Details</h3>
              <p className="text-xs text-gray-400 flex items-center gap-1.5 -mt-2">
                <Info size={12}/> This appears as the "From" section on the document.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Company / Your Name</label>
                  <input value={form.fromName} onChange={set('fromName')} placeholder="Your company or personal name"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.fromEmail} onChange={set('fromEmail')} placeholder="your@company.com"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Phone</label>
                  <input value={form.fromPhone} onChange={set('fromPhone')} placeholder="+1 555 000 0000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Address</label>
                  <textarea value={form.fromAddress} onChange={set('fromAddress')} rows={3}
                    placeholder="Street address, City, State/Province, Postal Code, Country"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Tax / VAT / GST Number</label>
                  <input value={form.fromTaxNo} onChange={set('fromTaxNo')} placeholder="e.g. TRN 100234567890003"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Company Reg. Number</label>
                  <input value={form.fromRegNo} onChange={set('fromRegNo')} placeholder="e.g. 12345678"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
              </div>
            </div>
          )}

          {/* ── BILLING / TO TAB ── */}
          {activeTab === 'billing' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">Bill To</h3>
                {form.clientId && (
                  <button onClick={() => {
                    const c = (clients as any[]).find((cl:any)=>cl.id===form.clientId);
                    if (c) setForm(f => ({
                      ...f,
                      billingName:    c.companyName||'',
                      billingEmail:   c.email||'',
                      billingPhone:   c.phone||'',
                      billingAddress: [c.address,c.city,c.country].filter(Boolean).join(', ')||'',
                    }));
                    toast.success('Re-filled from client');
                  }} className="flex items-center gap-1 text-xs font-bold text-primary-500 hover:underline">
                    <RefreshCw size={11}/> Re-fill from client
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5 -mt-2">
                <Info size={12}/> Pre-filled from the selected client. Edit freely.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Company / Recipient Name</label>
                  <input value={form.billingName} onChange={set('billingName')} placeholder="Company or person name"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.billingEmail} onChange={set('billingEmail')} placeholder="billing@client.com"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Phone</label>
                  <input value={form.billingPhone} onChange={set('billingPhone')} placeholder="+44 20 0000 0000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Billing Address</label>
                  <textarea value={form.billingAddress} onChange={set('billingAddress')} rows={4}
                    placeholder="Street, City, State/Province, Postal Code, Country"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Notes to Client</label>
                <textarea value={form.notes} onChange={set('notes')} rows={3}
                  placeholder="Any message or note to include on the document…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none"/>
              </div>
            </div>
          )}

          {/* ── PAYMENT & TERMS TAB ── */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Payment Method</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(m=>(
                    <button key={m.value} onClick={()=>setVal('paymentMethod',m.value)}
                      className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-colors text-left ${
                        form.paymentMethod===m.value
                          ? 'bg-primary-400 text-white border-primary-400'
                          : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-500'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Payment Reference / Instructions</label>
                  <input value={form.paymentRef} onChange={set('paymentRef')} placeholder="e.g. Include invoice number as reference"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
              </div>

              {(form.paymentMethod === 'BANK_TRANSFER' || form.bankName) && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <h3 className="text-sm font-bold text-gray-700">Bank Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { f:'bankName'      as const, label:'Bank Name',                 placeholder:'e.g. HSBC, Chase, Barclays' },
                      { f:'bankAccount'   as const, label:'Account Number',            placeholder:'0000 0000 0000' },
                      { f:'bankIBAN'      as const, label:'IBAN (International)',       placeholder:'GB29 NWBK 6016 1331 9268 19' },
                      { f:'bankSwift'     as const, label:'SWIFT / BIC',               placeholder:'NWBKGB2L' },
                      { f:'bankRoutingNo' as const, label:'Routing / ABA Number (US)', placeholder:'021000021' },
                      { f:'bankSortCode'  as const, label:'Sort Code (UK)',            placeholder:'60-16-13' },
                    ].map(({f,label,placeholder})=>(
                      <div key={f}>
                        <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
                        <input value={form[f] as string} onChange={set(f)} placeholder={placeholder}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 font-mono"/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Terms & Conditions</h3>
                <textarea value={form.terms} onChange={set('terms')} rows={7}
                  placeholder="Payment terms, late fees, dispute resolution, jurisdiction…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none"/>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    ['Net 30','Payment is due within 30 days of invoice date.'],
                    ['Net 15','Payment is due within 15 days of invoice date.'],
                    ['Net 7', 'Payment is due within 7 days of invoice date.'],
                    ['Due on receipt','Payment is due upon receipt of this invoice.'],
                  ].map(([label,text])=>(
                    <button key={label} onClick={()=>setVal('terms', text + '\n\nPlease make payment via bank transfer to the details provided.\nLate payments may incur a 1.5% monthly interest charge.')}
                      className="text-[10px] font-bold text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1 hover:border-primary-300 hover:text-primary-500 transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DESIGN TAB ── */}
          {activeTab === 'design' && (
            <div className="space-y-4">
              {/* Template selector */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Template Layout</h3>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map(t => (
                    <button key={t.key} onClick={()=>setVal('template',t.key)}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                        form.template===t.key
                          ? 'border-primary-400 bg-primary-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      {/* Mini template thumbnail */}
                      <TemplateThumbnail template={t.key} color={pc}/>
                      <div className="mt-2">
                        <p className="text-xs font-bold text-gray-800">{t.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
                      </div>
                      {form.template===t.key && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{background:pc}}>
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                <h3 className="text-sm font-bold text-gray-700">Colors</h3>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Primary / Brand Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.primaryColor} onChange={set('primaryColor')}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"/>
                    <div className="flex gap-1.5 flex-wrap">
                      {PRESET_COLORS.map(c=>(
                        <button key={c} onClick={()=>setVal('primaryColor',c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${form.primaryColor===c?'border-gray-900 scale-110':'border-white shadow-sm'}`}
                          style={{background:c}}/>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 font-mono ml-1">{form.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Accent / Background Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.accentColor} onChange={set('accentColor')}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"/>
                    <div className="flex gap-1.5 flex-wrap">
                      {['#ffffff','#f8f9fa','#f0f4ff','#fff9f0','#f0fff4','#fdf2f8','#f5f3ff','#1e1e2e'].map(c=>(
                        <button key={c} onClick={()=>setVal('accentColor',c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${form.accentColor===c?'border-gray-900 scale-110':'border-gray-200 shadow-sm'}`}
                          style={{background:c}}/>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 font-mono ml-1">{form.accentColor}</span>
                  </div>
                </div>
              </div>

              {/* Typography + Logo */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Typography & Logo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Font Family</label>
                    <select value={form.fontFamily} onChange={set('fontFamily')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                      {FONT_FAMILIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Table Style</label>
                    <select value={form.tableStyle} onChange={set('tableStyle')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                      {TABLE_STYLES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Logo Initials / Text</label>
                    <input value={form.logoText} onChange={set('logoText')} placeholder="e.g. AK (defaults to first letter)"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Logo Shape</label>
                    <div className="flex gap-2 mt-1">
                      {LOGO_SHAPES.map(s=>(
                        <button key={s.value} onClick={()=>setVal('logoShape',s.value)}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors ${
                            form.logoShape===s.value
                              ? 'border-primary-400 bg-primary-50 text-primary-600'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Watermark */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Watermark</h3>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Watermark Text</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {WATERMARK_PRESETS.map(w=>(
                      <button key={w||'none'} onClick={()=>setVal('watermark',w)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
                          form.watermark===w
                            ? 'border-primary-400 bg-primary-50 text-primary-600'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {w||'None'}
                      </button>
                    ))}
                  </div>
                  <input value={form.watermark} onChange={set('watermark')} placeholder="Or type custom watermark text…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
                {form.watermark && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Opacity: {form.watermarkOpacity}%
                    </label>
                    <input type="range" min={3} max={40} value={form.watermarkOpacity}
                      onChange={e=>setVal('watermarkOpacity',parseInt(e.target.value))}
                      className="w-full accent-primary-400"/>
                    <div className="flex justify-between text-[10px] text-gray-300 mt-1">
                      <span>Subtle (3%)</span><span>Visible (40%)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Show/Hide sections */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Show / Hide Sections</h3>
                <div className="space-y-3">
                  {[
                    { f:'showHeader'    as const, label:'Header (company info + doc number)' },
                    { f:'showFooter'    as const, label:'Footer bar at bottom of document' },
                    { f:'showSignature' as const, label:'Signature blocks (authorised + client)' },
                  ].map(({f,label})=>(
                    <label key={f} className="flex items-center gap-3 cursor-pointer group">
                      <button type="button" onClick={()=>setVal(f,!form[f])}
                        className={`w-11 h-6 rounded-full border-2 transition-colors flex-shrink-0 relative ${
                          form[f] ? 'bg-primary-400 border-primary-400' : 'bg-gray-100 border-gray-200'
                        }`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          form[f] ? 'translate-x-5' : 'translate-x-0'
                        }`}/>
                      </button>
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Custom Footer Text</label>
                  <input value={form.footerText} onChange={set('footerText')}
                    placeholder="e.g. Thank you for your business · www.company.com"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"/>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: live preview ── */}
        <div className="xl:col-span-2">
          <div className="sticky top-[73px]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Live Preview</p>
            <LivePreview form={form} subtotal={subtotal} discAmt={discAmt} taxAmt={taxAmt} total={total}/>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Template Thumbnail ─────────────────────────────────────── */
function TemplateThumbnail({ template, color }: { template: string; color: string }) {
  const rgb = parseInt(color.replace('#','').slice(0,2),16) + ',' + parseInt(color.replace('#','').slice(2,4),16) + ',' + parseInt(color.replace('#','').slice(4,6),16);
  if (template === 'classic') return (
    <div className="h-16 bg-white rounded-lg border border-gray-100 overflow-hidden">
      <div className="h-3" style={{borderBottom:`3px solid ${color}`}}/>
      <div className="px-2 pt-1.5 space-y-1">
        <div className="h-1.5 rounded" style={{background:color,width:'40%'}}/>
        <div className="h-1 bg-gray-100 rounded w-1/2"/>
        <div className="h-1 bg-gray-100 rounded w-1/3 mt-1"/>
        <div className="h-2 rounded mt-1" style={{background:`${color}20`,width:'100%'}}/>
      </div>
    </div>
  );
  if (template === 'modern') return (
    <div className="h-16 rounded-lg overflow-hidden">
      <div className="h-8" style={{background:`linear-gradient(135deg,${color},rgba(${rgb},0.7))`}}/>
      <div className="bg-white px-2 pt-1 space-y-1">
        <div className="h-1 bg-gray-100 rounded w-3/4"/>
        <div className="h-1 bg-gray-100 rounded w-1/2"/>
      </div>
    </div>
  );
  if (template === 'minimal') return (
    <div className="h-16 bg-white rounded-lg border border-gray-100 overflow-hidden px-2 pt-2 space-y-1.5">
      <div className="flex justify-between items-center">
        <div className="h-1.5 bg-gray-700 rounded w-1/3"/>
        <div className="h-1.5 rounded w-1/4" style={{background:color}}/>
      </div>
      <div className="h-0.5 w-full" style={{background:color}}/>
      <div className="h-1 bg-gray-100 rounded w-full"/>
      <div className="h-1 bg-gray-100 rounded w-2/3"/>
    </div>
  );
  // corporate
  return (
    <div className="h-16 rounded-lg overflow-hidden">
      <div className="h-5 px-2 flex items-center" style={{background:color}}>
        <div className="h-2 w-1/3 bg-white rounded opacity-80"/>
      </div>
      <div className="bg-gray-50 px-2 pt-1 space-y-1">
        <div className="h-1 bg-gray-200 rounded w-2/3"/>
        <div className="h-1 bg-gray-200 rounded w-1/2"/>
      </div>
      <div className="bg-white px-2 pt-1 space-y-0.5">
        <div className="h-1 rounded w-full" style={{background:`${color}15`}}/>
        <div className="h-1 bg-gray-100 rounded w-full"/>
      </div>
    </div>
  );
}

/* ─── Live Preview (template-aware) ──────────────────────────── */
function LivePreview({ form, subtotal, discAmt, taxAmt, total }: any) {
  const fmtN = (n:number) => n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtC = (n:number) => `${form.currency} ${fmtN(n)}`;
  const DOC_LBL: Record<string,string> = { INVOICE:'INVOICE', PROFORMA_INVOICE:'PROFORMA INVOICE', QUOTATION:'QUOTATION' };
  const senderName = form.fromName || 'Your Company';
  const pc = form.primaryColor || '#6366f1';
  const onPc = isDark(pc) ? '#fff' : '#111';
  const dt = fmtDate(form.issueDate, form.dateFormat) || '—';
  const dateLabel = form.docType==='QUOTATION' ? 'Valid Until' : 'Due Date';
  const exDate    = fmtDate(form.dueDate||form.validUntil, form.dateFormat);
  const tmpl = form.template || 'classic';

  const logoRadius = form.logoShape==='circle'?'9999px':form.logoShape==='square'?'4px':'10px';
  const logoChar   = (form.logoText || senderName[0] || '?').toUpperCase().slice(0,2);

  const tableItems = form.items.filter((i:any)=>i.description);

  function TableRows() {
    return <>
      {tableItems.map((item:any,idx:number)=>{
        const stripe = form.tableStyle==='striped' && idx%2===0;
        return (
          <tr key={idx} style={stripe?{background:`${pc}08`}:{}}>
            <td className="py-1.5 text-gray-700 leading-snug">{item.description}</td>
            <td className="py-1.5 text-center text-gray-500">{item.qty}{item.unit?` ${item.unit}`:''}</td>
            <td className="py-1.5 text-right text-gray-500">{fmtC(item.unitPrice)}</td>
            <td className="py-1.5 text-right font-semibold" style={{color:pc}}>{fmtC((item.qty||0)*(item.unitPrice||0))}</td>
          </tr>
        );
      })}
    </>;
  }

  function Totals() {
    return (
      <div className="mt-3 pt-2 space-y-1">
        <div className="flex justify-between text-gray-500 text-[9px]"><span>Subtotal</span><span>{fmtC(subtotal)}</span></div>
        {discAmt>0 && <div className="flex justify-between text-[9px]"><span className="text-gray-500">Discount</span><span className="text-red-500">- {fmtC(discAmt)}</span></div>}
        {taxAmt>0  && <div className="flex justify-between text-[9px]"><span className="text-gray-500">{form.taxLabel||'Tax'} {form.taxRate>0?`${form.taxRate}%`:''}</span><span className="text-gray-600">{fmtC(taxAmt)}</span></div>}
        <div className="flex justify-between font-black border-t pt-1.5 mt-1" style={{borderColor:pc}}>
          <span className="text-gray-900 text-[11px]">TOTAL</span>
          <span className="text-[13px]" style={{color:pc}}>{fmtC(total)}</span>
        </div>
      </div>
    );
  }

  function BillToSection() {
    return <>
      <p className="text-[8px] font-bold uppercase mb-0.5" style={{color:pc}}>Bill To</p>
      <p className="font-bold text-gray-800">{form.billingName||'—'}</p>
      {form.billingEmail   && <p className="text-gray-400 text-[9px]">{form.billingEmail}</p>}
      {form.billingAddress && <p className="text-gray-400 text-[8px] leading-relaxed">{form.billingAddress}</p>}
    </>;
  }

  function DatesMeta() {
    return (
      <div className="space-y-1">
        <div>
          <p className="text-[8px] font-bold uppercase text-gray-400">Issue Date</p>
          <p className="font-semibold text-gray-700 text-[9px]">{dt}</p>
        </div>
        {exDate && <div>
          <p className="text-[8px] font-bold uppercase text-gray-400">{dateLabel}</p>
          <p className="font-semibold text-orange-500 text-[9px]">{exDate}</p>
        </div>}
      </div>
    );
  }

  // ─── Classic preview
  if (tmpl === 'classic') return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden text-[10px]" style={{transform:'scale(0.82)',transformOrigin:'top center',marginBottom:'-18%'}}>
      {form.showHeader && (
        <div style={{borderBottom:`3px solid ${pc}`,padding:'16px 20px 12px'}}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div style={{width:36,height:36,background:pc,borderRadius:logoRadius,display:'flex',alignItems:'center',justifyContent:'center',color:onPc,fontWeight:900,fontSize:14,marginBottom:6}}>
                {logoChar}
              </div>
              <p className="font-bold text-gray-800">{senderName}</p>
              {form.fromAddress && <p className="text-gray-400 text-[9px]">{form.fromAddress}</p>}
              {form.fromEmail   && <p className="text-gray-400 text-[9px]">{form.fromEmail}</p>}
              {form.fromTaxNo   && <p className="text-gray-400 text-[9px]">Tax: {form.fromTaxNo}</p>}
            </div>
            <div className="text-right">
              <p className="font-black text-[15px] tracking-widest" style={{color:pc}}>{DOC_LBL[form.docType]||'INVOICE'}</p>
              <DatesMeta/>
            </div>
          </div>
        </div>
      )}
      <div style={{background:'#f9f9fc',padding:'8px 20px',borderBottom:'1px solid #eee'}}>
        <div className="grid grid-cols-2 gap-4">
          <BillToSection/>
          {form.subject && <div><p className="text-[9px] font-bold text-gray-700">{form.subject}</p></div>}
        </div>
      </div>
      <div style={{padding:'10px 20px'}}>
        <table className="w-full">
          <thead><tr style={{background:pc}}>
            {['Description','Qty','Rate','Amount'].map(h=>(
              <th key={h} className="pb-1.5 pt-1.5 px-1 text-[8px] font-bold uppercase" style={{color:onPc,textAlign:h==='Description'?'left':'right'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody><TableRows/></tbody>
        </table>
        <Totals/>
      </div>
      {form.showWatermark && form.watermark && <WatermarkOverlay form={form}/>}
      {form.showFooter && (
        <div style={{background:pc,padding:'8px 20px',textAlign:'center'}}>
          <p style={{color:onPc,fontSize:8,opacity:0.7}}>{form.footerText||`Thank you for your business · ${senderName}`}</p>
        </div>
      )}
    </div>
  );

  // ─── Modern preview
  if (tmpl === 'modern') return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden text-[10px]" style={{transform:'scale(0.82)',transformOrigin:'top center',marginBottom:'-18%'}}>
      {form.showHeader && (
        <div style={{background:`linear-gradient(135deg,${pc} 0%,${pc}99 100%)`,padding:'16px 20px'}}>
          <div className="flex items-start justify-between">
            <div>
              <div style={{width:36,height:36,background:'rgba(255,255,255,0.2)',borderRadius:logoRadius,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:14,border:'1.5px solid rgba(255,255,255,0.3)',marginBottom:6}}>
                {logoChar}
              </div>
              <p className="font-bold text-white">{senderName}</p>
              {form.fromAddress && <p style={{color:'rgba(255,255,255,0.7)',fontSize:9}}>{form.fromAddress}</p>}
            </div>
            <div className="text-right">
              <p style={{fontSize:22,fontWeight:900,color:'rgba(255,255,255,0.2)',letterSpacing:3}}>{DOC_LBL[form.docType]||'INVOICE'}</p>
              <div style={{color:'#fff',fontSize:9,marginTop:4}}>{dt}</div>
              <div style={{fontSize:18,fontWeight:900,color:'#fff',marginTop:4}}>{fmtC(total)}</div>
            </div>
          </div>
        </div>
      )}
      <div style={{background:'#f9f9fc',padding:'8px 20px',borderBottom:'1px solid #eee'}}>
        <div className="grid grid-cols-2 gap-4">
          <BillToSection/>
          <DatesMeta/>
        </div>
      </div>
      <div style={{padding:'10px 20px'}}>
        <table className="w-full">
          <thead><tr style={{background:pc}}>
            {['Description','Qty','Rate','Amount'].map(h=>(
              <th key={h} className="pb-1.5 pt-1.5 px-1 text-[8px] font-bold uppercase" style={{color:onPc,textAlign:h==='Description'?'left':'right'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody><TableRows/></tbody>
        </table>
        <Totals/>
      </div>
      {form.showFooter && (
        <div style={{background:pc,padding:'6px 20px',textAlign:'center'}}>
          <p style={{color:onPc,fontSize:8,opacity:0.7}}>{form.footerText||`Thank you for your business · ${senderName}`}</p>
        </div>
      )}
    </div>
  );

  // ─── Minimal preview
  if (tmpl === 'minimal') return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden text-[10px]" style={{transform:'scale(0.82)',transformOrigin:'top center',marginBottom:'-18%'}}>
      <div style={{padding:'20px 24px 12px'}}>
        {form.showHeader && (
          <>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p style={{fontSize:14,fontWeight:900,color:'#111'}}>{senderName}</p>
                {form.fromAddress && <p style={{color:'#888',fontSize:9}}>{form.fromAddress}</p>}
              </div>
              <div className="text-right">
                <p style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:pc}}>{DOC_LBL[form.docType]||'INVOICE'}</p>
                <p style={{fontSize:13,fontWeight:900,color:'#111'}}>{dt}</p>
              </div>
            </div>
            <div style={{height:2,background:pc,marginBottom:10}}/>
          </>
        )}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <BillToSection/>
          {exDate && <div><p className="text-[8px] text-gray-400 font-bold uppercase">{dateLabel}</p><p className="text-orange-500 font-bold text-[9px]">{exDate}</p></div>}
        </div>
        <table className="w-full">
          <thead><tr style={{borderBottom:'2px solid #111'}}>
            {['Description','Qty','Rate','Amount'].map(h=>(
              <th key={h} className="pb-1 text-[8px] font-bold uppercase text-gray-500" style={{textAlign:h==='Description'?'left':'right'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody><TableRows/></tbody>
        </table>
        <Totals/>
      </div>
      {form.showFooter && (
        <div style={{borderTop:`1px solid ${pc}30`,padding:'6px 24px',textAlign:'center'}}>
          <p style={{color:pc,fontSize:8,opacity:0.7}}>{form.footerText||`Thank you for your business`}</p>
        </div>
      )}
    </div>
  );

  // ─── Corporate preview
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden text-[10px]" style={{transform:'scale(0.82)',transformOrigin:'top center',marginBottom:'-18%'}}>
      {form.showHeader && (
        <div style={{background:pc,padding:'12px 20px'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div style={{width:32,height:32,background:'rgba(255,255,255,0.18)',borderRadius:logoRadius,display:'flex',alignItems:'center',justifyContent:'center',color:onPc,fontWeight:900,fontSize:13,border:'1.5px solid rgba(255,255,255,0.3)'}}>
                {logoChar}
              </div>
              <div>
                <p style={{fontWeight:800,color:onPc,fontSize:11}}>{senderName}</p>
                {form.fromAddress && <p style={{color:isDark(pc)?'rgba(255,255,255,0.65)':'rgba(0,0,0,0.5)',fontSize:8}}>{form.fromAddress}</p>}
              </div>
            </div>
            <div className="text-right">
              <p style={{fontSize:14,fontWeight:900,color:onPc,letterSpacing:2}}>{DOC_LBL[form.docType]||'INVOICE'}</p>
              <p style={{color:isDark(pc)?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.6)',fontSize:9}}>{dt}</p>
            </div>
          </div>
        </div>
      )}
      <div style={{background:'#f4f6fa',padding:'8px 20px',borderBottom:'1px solid #e8eaed'}}>
        <div className="grid grid-cols-2 gap-4">
          <BillToSection/>
          <div className="text-right">
            <p className="text-[8px] font-bold text-gray-400 uppercase">Total Amount</p>
            <p className="font-black text-[16px]" style={{color:pc}}>{fmtC(total)}</p>
          </div>
        </div>
      </div>
      <div style={{padding:'10px 20px'}}>
        <table className="w-full">
          <thead><tr style={{borderTop:`2px solid ${pc}`,borderBottom:`2px solid ${pc}`,background:`${pc}10`}}>
            {['Description','Qty','Rate','Amount'].map(h=>(
              <th key={h} className="pb-1.5 pt-1.5 px-1 text-[8px] font-bold uppercase" style={{color:pc,textAlign:h==='Description'?'left':'right'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody><TableRows/></tbody>
        </table>
        <Totals/>
      </div>
      {form.showFooter && (
        <div style={{background:pc,padding:'6px 20px',textAlign:'center'}}>
          <p style={{color:onPc,fontSize:8,opacity:0.7}}>{form.footerText||`Thank you for your business · ${senderName}`}</p>
        </div>
      )}
    </div>
  );
}

function WatermarkOverlay({ form }: { form: any }) {
  const op = (form.watermarkOpacity || 12) / 100;
  return (
    <div style={{
      position:'absolute',top:'50%',left:'50%',
      transform:'translate(-50%,-50%) rotate(-35deg)',
      fontSize:60,fontWeight:900,color:`rgba(0,0,0,${op})`,
      letterSpacing:4,textTransform:'uppercase',
      pointerEvents:'none',whiteSpace:'nowrap',zIndex:0,userSelect:'none',
    }}>
      {form.watermark}
    </div>
  );
}
