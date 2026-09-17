// Standalone HTML print engine — generates a complete print-ready payslip
// document from a payroll record + employee data. No DOM capture. Mirrors
// crm/invoices/_components/printEngine.ts's pattern (buildPrintHTML/window.print).

export interface PayslipEmployee {
  firstName: string;
  lastName: string;
  employeeId?: string;
  designation?: string;
}

export interface PayslipPayroll {
  id?: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  overtime: number;
  deductions: number;
  grossSalary: number;
  netSalary: number;
  currency?: string;
  status?: string;
  paymentDate?: string;
  paymentMethod?: string;
  employee: PayslipEmployee;
  // Company header — pass in from useSettings() at the call site.
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
}

const FONT_STACK = "'Helvetica Neue', Arial, sans-serif";
const PRIMARY = '#6366f1';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtN(n: number): string {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function buildPayslipHTML(p: PayslipPayroll): string {
  const currency = p.currency || 'AED';
  const companyName = p.companyName || 'Al Khadim LLC';
  const emp = p.employee;
  const period = `${MONTH_NAMES[(p.month || 1) - 1]} ${p.year}`;
  const reference = `PS-${p.year}${String(p.month).padStart(2, '0')}-${emp.employeeId || (p.id || '').slice(0, 6).toUpperCase() || '000'}`;
  const isPaid = p.status === 'PAID';

  const earningsRows = [
    { label: 'Basic Salary', amount: p.basicSalary || 0 },
    { label: 'Allowances', amount: p.allowances || 0 },
    { label: 'Overtime', amount: p.overtime || 0 },
  ].map(r => `
    <tr>
      <td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333">${r.label}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:12px;color:#333">${currency} ${fmtN(r.amount)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Payslip — ${emp.firstName} ${emp.lastName} — ${period}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#fff;font-family:${FONT_STACK};font-size:13px;color:#333;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:0;size:A4}
    @media print{html,body{width:210mm;min-height:297mm}}
    table{border-collapse:collapse}
  </style>
</head>
<body style="position:relative;min-height:100vh;display:flex;flex-direction:column">
  <div style="flex:1">
    <div style="border-bottom:4px solid ${PRIMARY};padding:36px 48px 24px">
      <table width="100%" style="border-collapse:collapse">
        <tr>
          <td>
            <div style="width:52px;height:52px;background:${PRIMARY};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;text-align:center;line-height:52px">
              ${(companyName[0] || '?').toUpperCase()}
            </div>
            <div style="margin-top:10px">
              <div style="font-size:18px;font-weight:800;color:#111">${companyName}</div>
              ${p.companyAddress ? `<div style="color:#666;font-size:11px;margin-top:3px;white-space:pre-line">${p.companyAddress}</div>` : ''}
              ${p.companyEmail ? `<div style="color:#666;font-size:11px">${p.companyEmail}</div>` : ''}
              ${p.companyPhone ? `<div style="color:#666;font-size:11px">${p.companyPhone}</div>` : ''}
            </div>
          </td>
          <td style="text-align:right;vertical-align:top">
            <div style="font-size:28px;font-weight:900;color:${PRIMARY};letter-spacing:3px">PAYSLIP</div>
            <div style="font-size:14px;color:#555;margin-top:4px;font-family:monospace">${reference}</div>
            <div style="display:inline-block;margin-top:8px;background:${PRIMARY}18;color:${PRIMARY};padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px">${period.toUpperCase()}</div>
          </td>
        </tr>
      </table>
    </div>

    <div style="background:#f8f8fc;padding:20px 48px;border-bottom:1px solid #eee">
      <table width="100%" style="border-collapse:collapse">
        <tr>
          <td style="width:50%;vertical-align:top">
            <div style="font-size:10px;font-weight:800;color:${PRIMARY};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Employee</div>
            <div style="font-size:14px;font-weight:700;color:#111">${emp.firstName} ${emp.lastName}</div>
            ${emp.designation ? `<div style="color:#555;font-size:12px;margin-top:2px">${emp.designation}</div>` : ''}
            ${emp.employeeId ? `<div style="color:#888;font-size:11px;margin-top:2px">ID: ${emp.employeeId}</div>` : ''}
          </td>
          <td style="vertical-align:top;text-align:right">
            <div style="font-size:10px;font-weight:800;color:${PRIMARY};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Pay Period</div>
            <div style="font-size:13px;font-weight:700;color:#222">${period}</div>
            <div style="margin-top:8px">
              <span style="background:${isPaid ? '#10b98118' : '#f59e0b18'};color:${isPaid ? '#10b981' : '#f59e0b'};padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">${p.status || 'DRAFT'}</span>
            </div>
            ${p.paymentDate ? `<div style="color:#888;font-size:11px;margin-top:6px">Paid on ${fmtDate(p.paymentDate)}${p.paymentMethod ? ` · ${p.paymentMethod}` : ''}</div>` : ''}
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:24px 48px">
      <table width="100%" style="border-collapse:collapse">
        <thead>
          <tr style="background:${PRIMARY}">
            <th style="color:#fff;text-align:left;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Earnings</th>
            <th style="color:#fff;text-align:right;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;width:140px">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${earningsRows}
          <tr>
            <td style="padding:10px 14px;font-weight:800;font-size:12px;color:#111;border-top:2px solid #111">Gross Salary</td>
            <td style="padding:10px 14px;text-align:right;font-weight:800;font-size:12px;color:#111;border-top:2px solid #111">${currency} ${fmtN(p.grossSalary)}</td>
          </tr>
        </tbody>
      </table>

      <table width="100%" style="border-collapse:collapse;margin-top:20px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="color:#555;text-align:left;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Deductions</th>
            <th style="color:#555;text-align:right;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;width:140px">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333">Deductions</td>
            <td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:12px;color:#e53e3e">- ${currency} ${fmtN(p.deductions)}</td>
          </tr>
        </tbody>
      </table>

      <table width="100%" style="border-collapse:collapse;margin-top:24px">
        <tr><td></td><td style="width:320px">
          <table width="100%" style="border-collapse:collapse;background:#f8f8fc;border-radius:10px">
            <tr>
              <td style="padding:16px 20px;font-size:15px;font-weight:900;color:#111">NET SALARY</td>
              <td style="padding:16px 20px;text-align:right;font-size:20px;font-weight:900;color:${PRIMARY}">${currency} ${fmtN(p.netSalary)}</td>
            </tr>
          </table>
        </td></tr>
      </table>
    </div>
  </div>

  <div style="background:${PRIMARY};padding:14px 40px;text-align:center;margin-top:auto">
    <div style="font-size:11px;color:rgba(255,255,255,0.7)">This is a computer-generated payslip and does not require a signature · ${companyName}</div>
  </div>
</body>
</html>`;
}
