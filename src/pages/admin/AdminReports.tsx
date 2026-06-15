import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Download,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Eye,
  X,
  Loader2,
  CalendarDays,
  CheckCircle,
  XCircle,
  Banknote,
  RotateCcw,
  Calendar,
  Hash,
  IndianRupee,
  User,
  Building,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface TxRecord {
  id: string;
  payment_reference: string;
  amount: string;
  charges: string;
  gst: string;
  total_amount: string;
  status: string;
  display_status?: string;
  card_type: string | null;
  gateway_transaction_id: string | null;
  failure_reason: string | null;
  gateway_environment: string | null;
  ip_address: string | null;
  created_at: string;
  completed_at: string | null;
  beneficiary_details: any;
  selected_payment_option: any;
  category_details: any;
  sender: { full_name: string; email: string; mobile: string } | null;
  gateway_name: string | null;
  payout_mode?: string | null;
  payout: {
    status: string;
    payout_reference: string | null;
    utr_number: string | null;
    completed_at: string | null;
    payout_date: string | null;
    payout_reference_number: string | null;
    payout_confirmed_amount: number | null;
    gateway_transaction_id: string | null;
  } | null;
  // KYC / PAN enrichment
  sender_pan: string | null;
  sender_address: string | null;
  business_kyc_verified: boolean;
  company_name: string | null;
  company_pan: string | null;
  company_gst: string | null;
  company_address: string | null;
  receiver_pan: string | null;
  gateway_settlement_status?: string | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'settlement_pending', label: 'Settlement In Progress' },
  { value: 'settlement_in_progress', label: 'Settlement In Progress (Gateway)' },
  { value: 'kyc_pending', label: 'Merchant Onboarding Required' },
  { value: 'merchant_kyc_review', label: 'Merchant KYC Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'refund_pending', label: 'Refund Pending' },
  { value: 'cancelled', label: 'Transaction Failed' },
  { value: 'processing', label: 'Processing' },
];

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-blue-100 text-blue-700',
  kyc_pending: 'bg-amber-100 text-amber-700',
  merchant_kyc_review: 'bg-amber-100 text-amber-700',
  settlement_pending: 'bg-blue-100 text-blue-700',
  settlement_in_progress: 'bg-blue-100 text-blue-700',
  refunded: 'bg-orange-100 text-orange-700',
  refund_pending: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Transaction Failed',
  processing: 'Processing',
  pending: 'Processing',
  kyc_pending: 'Merchant Onboarding Required',
  merchant_kyc_review: 'Merchant KYC Pending',
  settlement_pending: 'Settlement In Progress',
  settlement_in_progress: 'Settlement In Progress',
  refunded: 'Refunded',
  refund_pending: 'Refund Pending',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function fmt(v: string | number) {
  return parseFloat(String(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
  const label = STATUS_LABELS[status] || status;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

const GATEWAY_SETTLEMENT_MAP: Record<string, { label: string; cls: string }> = {
  settled:        { label: 'Settled',      cls: 'bg-green-100 text-green-700' },
  captured:       { label: 'Captured',     cls: 'bg-blue-100 text-blue-700' },
  paid:           { label: 'Paid',         cls: 'bg-blue-100 text-blue-700' },
  not_captured:   { label: 'Not Captured', cls: 'bg-amber-100 text-amber-700' },
  not_paid:       { label: 'Not Paid',     cls: 'bg-amber-100 text-amber-700' },
  check_failed:   { label: 'Check Failed', cls: 'bg-red-100 text-red-700' },
  no_tx_id:       { label: 'No Tx ID',     cls: 'bg-gray-100 text-gray-500' },
  not_applicable: { label: 'N/A',          cls: 'bg-gray-100 text-gray-500' },
};

function GatewaySettlementBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const entry = GATEWAY_SETTLEMENT_MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${entry.cls}`}>{entry.label}</span>;
}


function escapeCSV(v: any): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const GATEWAY_STTLMT_CSV_LABELS: Record<string, string> = {
  settled: 'Settled', captured: 'Captured', paid: 'Paid',
  not_captured: 'Not Captured', not_paid: 'Not Paid',
  refunded: 'Refunded', check_failed: 'Check Failed',
  no_tx_id: 'No Tx ID', not_applicable: 'N/A',
};

function downloadCSV(rows: TxRecord[]) {
  const headers = [
    // Invoice header
    'Reference', 'Invoice Date', 'Completed Date', 'Status',
    // Bill To (Payer)
    'Sender Name', 'Sender Email', 'Sender Mobile', 'Sender PAN',
    'Company Name', 'Company PAN', 'Company GST Number', 'Company Address',
    // Beneficiary Details
    'Beneficiary Name', 'Beneficiary PAN', 'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary IFSC',
    // Payment Details
    'Category', 'Payment Option', 'Gateway', 'Environment',
    'Base Amount (INR)', 'Platform Charges (INR)', 'CGST 9% (INR)', 'SGST 9% (INR)', 'Total Charged (INR)',
    // Gateway
    'Gateway Transaction Ref', 'Gateway Settlement Status',
    // Payout / Settlement Details
    'Payout Mode', 'Settlement Time',
    'Payout Status', 'Payout Reference', 'Payout UTR / Ref No', 'Payout Date', 'Payout Confirmed Amount (INR)',
    // Refund
    'Refund Date',
  ];

  const csvRows = rows.map(r => {
    const ds = r.display_status || r.status;
    const bene = r.beneficiary_details || {};
    const payout = r.payout;
    const gstTotal = parseFloat(r.gst || '0');
    const cgst = (gstTotal / 2).toFixed(2);
    const sgst = (gstTotal / 2).toFixed(2);
    const isRefund = ds === 'refunded';

    const refundDate = isRefund && payout?.completed_at ? fmtDate(payout.completed_at) : '';
    const payoutDate = !isRefund
      ? (payout?.payout_date || (payout?.completed_at ? fmtDate(payout.completed_at) : ''))
      : '';

    return [
      r.payment_reference,
      fmtDate(r.created_at),
      r.completed_at ? fmtDate(r.completed_at) : '',
      STATUS_LABELS[ds] || ds,
      // Bill To
      r.sender?.full_name || '',
      r.sender?.email || '',
      r.sender?.mobile || '',
      r.business_kyc_verified ? '' : (r.sender_pan || ''),
      r.business_kyc_verified ? (r.company_name || '') : '',
      r.business_kyc_verified ? (r.company_pan || '') : '',
      r.business_kyc_verified ? (r.company_gst || '') : '',
      r.business_kyc_verified ? (r.company_address || '') : '',
      // Beneficiary
      bene.full_name || '',
      r.receiver_pan || '',
      bene.bank_name || '',
      bene.bank_account || '',
      bene.ifsc || '',
      // Payment
      r.category_details?.category_name || '',
      r.selected_payment_option?.card_type || r.card_type || '',
      r.gateway_name || '',
      r.gateway_environment || '',
      r.amount,
      r.charges,
      cgst,
      sgst,
      r.total_amount,
      r.gateway_transaction_id || '',
      // Gateway settlement
      r.gateway_settlement_status ? (GATEWAY_STTLMT_CSV_LABELS[r.gateway_settlement_status] || r.gateway_settlement_status) : '',
      // Payout / Settlement
      r.payout ? formatPayoutMode(r.payout.payout_type ?? r.payout_mode) : (r.payout_mode ? formatPayoutMode(r.payout_mode) : ''),
      r.category_details?.settlement_time || '',
      payout?.status || '',
      payout?.payout_reference || '',
      payout?.utr_number || payout?.payout_reference_number || '',
      payoutDate,
      payout?.payout_confirmed_amount ?? '',
      refundDate,
    ].map(escapeCSV).join(',');
  });

  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface CompanyInfo {
  company_name: string;
  address: string;
  gst_number: string;
  pan: string;
  cin: string;
  support_email: string;
  phone_number: string;
  website_url: string;
  company_logo_url: string | null;
}

function buildInvoiceHTML(r: TxRecord, co: CompanyInfo, invoiceNo: number): string {
  const bene = r.beneficiary_details || {};
  const ds = r.display_status || r.status;
  const isRefund = ds === 'refunded';
  const statusLabel = STATUS_LABELS[ds] || ds;
  const statusColor = ds === 'completed' ? '#16a34a' : ds === 'failed' || ds === 'cancelled' ? '#dc2626' : ds === 'refunded' ? '#ea580c' : '#d97706';
  const statusBg = ds === 'completed' ? '#dcfce7' : ds === 'failed' || ds === 'cancelled' ? '#fee2e2' : ds === 'refunded' ? '#ffedd5' : '#fef3c7';
  const option = r.selected_payment_option?.card_type || r.card_type || '—';
  const payout = r.payout;
  const baseAmt = parseFloat(r.amount || '0');
  const charges = parseFloat(r.charges || '0');
  const gst = parseFloat(r.gst || '0');
  const cgst = gst / 2;
  const sgst = gst / 2;
  const total = parseFloat(r.total_amount || '0');
  const logoHtml = co.company_logo_url
    ? `<img src="${co.company_logo_url}" alt="${co.company_name}" style="height:44px;object-fit:contain;margin-bottom:4px;" />`
    : `<span style="font-size:20px;font-weight:800;color:#1e293b;letter-spacing:-0.5px;">${co.company_name}</span>`;

  const row = (label: string, value: string, mono = false, bold = false) =>
    `<tr>
      <td style="padding:5px 8px;color:#64748b;font-size:11.5px;width:42%;border-bottom:1px solid #f1f5f9;">${label}</td>
      <td style="padding:5px 8px;font-size:11.5px;border-bottom:1px solid #f1f5f9;${mono ? 'font-family:Courier New,monospace;' : ''}${bold ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`;

  const amtRow = (label: string, value: string, highlight = false, large = false) =>
    `<tr>
      <td style="padding:${large ? '8' : '5'}px 8px;${highlight ? 'font-weight:700;' : 'color:#64748b;'}font-size:${large ? '13' : '11.5'}px;border-top:${large ? '2px solid #e2e8f0' : '1px solid #f1f5f9'};">${label}</td>
      <td style="padding:${large ? '8' : '5'}px 8px;text-align:right;${highlight ? 'font-weight:800;font-size:14px;color:#0f172a;' : `font-size:11.5px;`}border-top:${large ? '2px solid #e2e8f0' : '1px solid #f1f5f9'};">${value}</td>
    </tr>`;

  return `
<div style="page-break-after:always;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#0f172a;max-width:780px;margin:0 auto;padding:32px 36px;">

  <!-- Header -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
    <tr>
      <td style="vertical-align:top;width:55%;">
        ${logoHtml}
        <div style="margin-top:6px;font-size:11px;color:#64748b;line-height:1.6;">
          ${co.address}<br/>
          ${co.website_url} &nbsp;|&nbsp; ${co.support_email}<br/>
          ${co.phone_number}
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-1px;margin-bottom:8px;">INVOICE</div>
        <table style="border-collapse:collapse;margin-left:auto;font-size:11.5px;">
          <tr>
            <td style="padding:3px 0;color:#64748b;padding-right:12px;">Invoice No.</td>
            <td style="padding:3px 0;font-weight:700;font-family:Courier New,monospace;">${r.payment_reference}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;color:#64748b;padding-right:12px;">Invoice Date</td>
            <td style="padding:3px 0;">${fmtDate(r.created_at)}</td>
          </tr>
          ${r.completed_at ? `<tr><td style="padding:3px 0;color:#64748b;padding-right:12px;">Completed</td><td style="padding:3px 0;">${fmtDate(r.completed_at)}</td></tr>` : ''}
          <tr>
            <td style="padding:3px 0;color:#64748b;padding-right:12px;">Status</td>
            <td style="padding:3px 0;"><span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:10.5px;font-weight:700;background:${statusBg};color:${statusColor};">${statusLabel}</span></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Divider -->
  <div style="border-top:2px solid #0f172a;margin-bottom:24px;"></div>

  <!-- Bill From / Bill To -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="vertical-align:top;width:50%;padding-right:16px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px;">Bill From</div>
        <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${co.company_name}</div>
        <div style="font-size:11.5px;color:#475569;line-height:1.7;">
          GST: ${co.gst_number}<br/>
          PAN: ${co.pan}<br/>
          CIN: ${co.cin}
        </div>
      </td>
      <td style="vertical-align:top;padding-left:16px;border-left:1px solid #e2e8f0;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px;">Bill To (Payer)</div>
        ${r.business_kyc_verified && r.company_name
          ? `<div style="font-weight:700;font-size:13px;margin-bottom:2px;">${r.company_name}</div>`
          : ''}
        <div style="font-weight:${r.business_kyc_verified ? '600' : '700'};font-size:${r.business_kyc_verified ? '12' : '13'}px;margin-bottom:4px;">${r.sender?.full_name || '—'}</div>
        <div style="font-size:11.5px;color:#475569;line-height:1.7;">
          ${r.business_kyc_verified && r.company_address ? `${r.company_address}<br/>` : ''}
          ${!r.business_kyc_verified && r.sender_address ? `${r.sender_address}<br/>` : ''}
          ${r.business_kyc_verified && r.company_pan ? `Company PAN: ${r.company_pan}<br/>` : ''}
          ${r.business_kyc_verified && r.company_gst ? `GST: ${r.company_gst}<br/>` : ''}
          ${!r.business_kyc_verified && r.sender_pan ? `PAN: ${r.sender_pan}<br/>` : ''}
          ${r.sender?.email ? `Email: ${r.sender.email}<br/>` : ''}
          ${r.sender?.mobile ? `Mobile: ${r.sender.mobile}` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- Transaction Details + Amount side by side -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <!-- Left: Transaction Details -->
      <td style="vertical-align:top;width:58%;padding-right:16px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px;">Transaction Details</div>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:6px;overflow:hidden;">
          ${row('Category', r.category_details?.category_name || '—')}
          ${r.category_details?.settlement_time ? row('Transaction Settlement Time',
            r.category_details.settlement_time === 'instant' ? 'Instant Settlement'
            : r.category_details.settlement_time === 'T+0' ? 'Transaction + 0 Day'
            : r.category_details.settlement_time === 'T+1' ? 'Transaction + 1 Day'
            : r.category_details.settlement_time === 'T+2' ? 'Transaction + 2 Days'
            : r.category_details.settlement_time) : ''}
          ${row('Payment Option', option)}
          ${row('Gateway', r.gateway_name || '—')}
          ${r.gateway_transaction_id ? row('Gateway Tx ID', r.gateway_transaction_id, true) : ''}
          ${r.gateway_environment ? row('Environment', r.gateway_environment.charAt(0).toUpperCase() + r.gateway_environment.slice(1)) : ''}
        </table>
      </td>
      <!-- Right: Beneficiary -->
      <td style="vertical-align:top;padding-left:16px;border-left:1px solid #e2e8f0;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px;">Beneficiary Details</div>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:6px;overflow:hidden;">
          ${row('Name', bene.full_name || '—', false, true)}
          ${r.receiver_pan ? row('PAN Number', r.receiver_pan, true) : ''}
          ${row('Bank', bene.bank_name || '—')}
          ${row('Account No.', bene.bank_account || '—', true)}
          ${row('IFSC Code', bene.ifsc || '—', true)}
          ${bene.city ? row('City', bene.city) : ''}
        </table>
      </td>
    </tr>
  </table>

  <!-- Amount Breakdown -->
  <div style="margin-bottom:24px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px;">Amount Breakdown</div>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;">
      <thead>
        <tr style="background:#e2e8f0;">
          <th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#475569;">Description</th>
          <th style="padding:7px 8px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#475569;">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #e2e8f0;">
            Payment Transfer — ${r.category_details?.category_name || 'Service'} &nbsp;<span style="font-size:10px;color:#64748b;font-weight:normal;">HSN/SAC: 998399</span><br/>
            <span style="font-size:10.5px;color:#64748b;">To: ${bene.full_name || '—'} · ${bene.bank_account || ''} · ${bene.ifsc || ''}</span>
          </td>
          <td style="padding:7px 8px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0;">₹${fmt(baseAmt)}</td>
        </tr>
        <tr>
          <td style="padding:7px 8px;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;">Service Charges</td>
          <td style="padding:7px 8px;text-align:right;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;">₹${fmt(charges)}</td>
        </tr>
        <tr>
          <td style="padding:7px 8px;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;">CGST (9%)</td>
          <td style="padding:7px 8px;text-align:right;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;">₹${fmt(cgst)}</td>
        </tr>
        <tr>
          <td style="padding:7px 8px;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;">SGST (9%)</td>
          <td style="padding:7px 8px;text-align:right;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;">₹${fmt(sgst)}</td>
        </tr>
        <tr style="background:#0f172a;">
          <td style="padding:10px 8px;font-size:13px;font-weight:700;color:#fff;">TOTAL CHARGED</td>
          <td style="padding:10px 8px;text-align:right;font-size:16px;font-weight:800;color:#fff;">₹${fmt(total)}</td>
        </tr>
      </tbody>
    </table>
  </div>


  <!-- Footer -->
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10.5px;color:#94a3b8;line-height:1.6;">
      This is a computer-generated invoice. No signature required.<br/>
      For queries: ${co.support_email} &nbsp;|&nbsp; ${co.phone_number}
    </div>
    <div style="font-size:10px;color:#cbd5e1;text-align:right;">
      Generated: ${new Date().toLocaleString('en-IN')}<br/>
      ${invoiceNo} of __TOTAL__
    </div>
  </div>

</div>`;
}

function formatPayoutMode(mode: string | null | undefined): string {
  if (!mode) return '—';
  if (mode === 'auto' || mode === 'payout') return 'Auto Payout';
  if (mode === 'manual') return 'Manual Payout';
  if (mode === 'admin') return 'Admin Payout';
  if (mode === 'payment_split') return 'Payment Split';
  return mode;
}

function formatSettlementTime(t: string | null | undefined): string {
  if (!t) return '—';
  const s = t.trim().toUpperCase();
  if (s === 'INSTANT' || s === 'T+0') return 'Instant';
  if (s === 'T+1') return 'T+1 Day';
  if (s === 'T+2') return 'T+2 Days';
  return t;
}

const ACTION_BLOCKED_STATUSES = new Set(['failed', 'completed', 'refunded', 'cancelled']);

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra',
  '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh (New)',
};

function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function below100(x: number): string {
    return x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  }
  function below1000(x: number): string {
    return x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + below100(x % 100) : '') : below100(x);
  }
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); if (crore) parts.push(below1000(crore) + ' Crore');
  const lakh = Math.floor((n % 10000000) / 100000); if (lakh) parts.push(below1000(lakh) + ' Lakh');
  const thousand = Math.floor((n % 100000) / 1000); if (thousand) parts.push(below1000(thousand) + ' Thousand');
  const rest = n % 1000; if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = numToWords(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
}

function buildEInvoiceJSON(r: TxRecord, co: CompanyInfo): object {
  const isRefund = (r.display_status || r.status) === 'refunded';
  const docType = isRefund ? 'CRN' : 'INV';

  const charges = parseFloat(r.charges || '0');
  const gstTotal = parseFloat(r.gst || '0');
  const halfGst = parseFloat((gstTotal / 2).toFixed(2));
  const total = parseFloat(r.total_amount || '0');

  const supplierGstin = (co.gst_number || '').toUpperCase().trim();
  // Use buyer's company GSTIN for B2B when business KYC verified
  const buyerGstin = (r.business_kyc_verified && r.company_gst ? r.company_gst : '').toUpperCase().trim();
  const supplierStateCode = supplierGstin.slice(0, 2);
  const buyerStateCode = buyerGstin ? buyerGstin.slice(0, 2) : supplierStateCode;
  const isInterState = buyerGstin ? supplierStateCode !== buyerStateCode : false;
  const posCode = buyerGstin ? buyerStateCode : supplierStateCode;

  const txDate = r.created_at ? new Date(r.created_at) : new Date();
  const docDate = `${String(txDate.getDate()).padStart(2, '0')}/${String(txDate.getMonth() + 1).padStart(2, '0')}/${txDate.getFullYear()}`;

  const bene = r.beneficiary_details || {};
  const senderName = r.sender?.full_name || 'Consumer';

  const igst = isInterState ? parseFloat((halfGst * 2).toFixed(2)) : 0;
  const cgstAmt = isInterState ? 0 : halfGst;
  const sgstAmt = isInterState ? 0 : halfGst;

  const itemAmt = charges;
  const itemTotal = parseFloat((itemAmt + cgstAmt + sgstAmt + igst).toFixed(2));

  // Extract pincode from address string (6-digit number)
  const extractPin = (addr: string): number => {
    const m = addr.match(/\b(\d{6})\b/);
    return m ? parseInt(m[1]) : 999999;
  };

  const sellerAddr = co.address || '';
  const sellerPin = extractPin(sellerAddr);
  const sellerLoc = STATE_CODES[supplierStateCode] || 'Maharashtra';

  const buyerAddrRaw = r.business_kyc_verified
    ? (r.company_address || r.sender_address || '')
    : (r.sender_address || '');
  const buyerPin = extractPin(buyerAddrRaw);
  const buyerLoc = STATE_CODES[posCode] || STATE_CODES[supplierStateCode] || 'Maharashtra';

  // Strip phone to 10 digits
  const cleanPhone = (ph: string | null | undefined) =>
    (ph || '').replace(/\D/g, '').slice(-10);

  // Build aggregated doc reference string
  const docRefs = [r.gateway_transaction_id, r.payout?.utr_number, r.payout?.payout_reference_number]
    .filter(Boolean).join(' | ') || r.payment_reference;

  const attribs: { Nm: string; Val: string }[] = [
    { Nm: 'SAC', Val: '998399' },
    { Nm: 'BeneficiaryName', Val: bene.full_name || '' },
    { Nm: 'BeneficiaryBank', Val: bene.bank_name || '' },
    { Nm: 'BeneficiaryAccount', Val: bene.bank_account || '' },
    { Nm: 'IFSC', Val: bene.ifsc || '' },
    { Nm: 'BaseTransferAmount', Val: parseFloat(r.amount || '0').toFixed(2) },
    { Nm: 'ServiceCharges', Val: charges.toFixed(2) },
    { Nm: 'Gateway', Val: r.gateway_name || '' },
    { Nm: 'PaymentOption', Val: r.selected_payment_option?.card_type || r.card_type || '' },
    { Nm: 'Category', Val: r.category_details?.category_name || '' },
  ];
  if (r.sender_pan) attribs.push({ Nm: 'PayerPAN', Val: r.sender_pan });
  if (r.receiver_pan) attribs.push({ Nm: 'BeneficiaryPAN', Val: r.receiver_pan });
  if (r.gateway_transaction_id) attribs.push({ Nm: 'GatewayTxID', Val: r.gateway_transaction_id });
  if (r.payout?.utr_number) attribs.push({ Nm: 'UTRNumber', Val: r.payout.utr_number });
  if (r.payout?.payout_reference_number) attribs.push({ Nm: 'PayoutRef', Val: r.payout.payout_reference_number });
  if (r.payout?.id) attribs.push({ Nm: 'PayoutID', Val: r.payout.id });
  if (r.payout?.payout_confirmed_amount != null)
    attribs.push({ Nm: 'PayoutConfirmedAmt', Val: String(r.payout.payout_confirmed_amount) });

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: buyerGstin ? 'B2B' : 'B2C',
      RegRev: 'N',
      EcmGstin: null,
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: docType,
      No: r.payment_reference,
      Dt: docDate,
    },
    SellerDtls: {
      Gstin: supplierGstin || 'URP',
      LglNm: co.company_name || 'PayByCard Technologies Private Limited',
      TrdNm: co.company_name || 'PayByCard Technologies Private Limited',
      Addr1: sellerAddr.slice(0, 100),
      Addr2: [co.pan ? `PAN: ${co.pan}` : '', co.cin ? `CIN: ${co.cin}` : ''].filter(Boolean).join(' | ').slice(0, 100),
      Loc: sellerLoc,
      Pin: sellerPin,
      Stcd: supplierStateCode || '27',
      Ph: cleanPhone(co.phone_number),
      Em: co.support_email || '',
    },
    BuyerDtls: {
      Gstin: buyerGstin || 'URP',
      LglNm: r.business_kyc_verified && r.company_name ? r.company_name : senderName,
      TrdNm: r.business_kyc_verified && r.company_name ? r.company_name : senderName,
      Pos: posCode || '27',
      Addr1: buyerAddrRaw.slice(0, 100),
      Addr2: r.business_kyc_verified
        ? (r.company_gst ? `GST: ${r.company_gst}` : (r.company_pan ? `PAN: ${r.company_pan}` : ''))
        : (r.sender_pan ? `PAN: ${r.sender_pan}` : ''),
      Loc: buyerLoc,
      Pin: buyerPin,
      Stcd: posCode || supplierStateCode || '27',
      Ph: cleanPhone(r.sender?.mobile),
      Em: r.sender?.email || '',
    },
    DispDtls: null,
    ShipDtls: null,
    ItemList: [
      {
        SlNo: '1',
        PrdDesc: `Payment Transfer Service - ${r.category_details?.category_name || 'Fund Transfer'}`,
        IsServc: 'Y',
        HsnCd: '998399',
        Barcde: null,
        Qty: 1,
        FreeQty: 0,
        Unit: 'OTH',
        UnitPrice: parseFloat(itemAmt.toFixed(2)),
        TotAmt: parseFloat(itemAmt.toFixed(2)),
        Discount: 0,
        PreTaxVal: 0,
        AssAmt: parseFloat(itemAmt.toFixed(2)),
        GstRt: 18,
        IgstAmt: igst,
        CgstAmt: cgstAmt,
        SgstAmt: sgstAmt,
        CesRt: 0,
        CesAmt: 0,
        CesNonAdvlAmt: 0,
        StateCesRt: 0,
        StateCesAmt: 0,
        StateCesNonAdvlAmt: 0,
        OthChrg: 0,
        TotItemVal: itemTotal,
        OrdLineRef: r.payment_reference,
        OrgCntry: null,
        PrdSlNo: null,
        BchDtls: null,
        AttribDtls: attribs,
      },
    ],
    ValDtls: {
      AssVal: parseFloat(itemAmt.toFixed(2)),
      CgstVal: cgstAmt,
      SgstVal: sgstAmt,
      IgstVal: igst,
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: parseFloat(total.toFixed(2)),
      TotInvValFc: 0,
    },
    PayDtls: {
      Nm: senderName,
      AccDet: bene.bank_account || '',
      Mode: r.selected_payment_option?.card_type || r.card_type || 'Online',
      FinInsBr: bene.ifsc || '',
      PayTerm: 'Immediate',
      PayInstr: '',
      CrTrn: '',
      DirDr: '',
      CrDay: 0,
      PaidAmt: isRefund ? 0 : parseFloat(total.toFixed(2)),
      PaymtDue: 0,
    },
    RefDtls: isRefund
      ? {
          InvRm: `Refund for transaction ${r.payment_reference}`,
          DocPerdDtls: null,
          PrecDocDtls: [{ InvNo: r.payment_reference, InvDt: docDate, OthRefNo: r.gateway_transaction_id || '' }],
          ContrDtls: null,
        }
      : null,
    AddlDocDtls: [
      {
        Url: co.website_url || 'https://paybycard.in',
        Docs: docRefs,
        Info: amountInWords(parseFloat(total.toFixed(2))),
      },
    ],
    EwbDtls: null,
  };
}

async function downloadEInvoiceJSON(rows: TxRecord[]) {
  let co: CompanyInfo = {
    company_name: 'PayByCard Technologies Private Limited',
    address: '3701, IRIS, Runwal Bliss, Crompton Greaves Compound, Kanjur Marg East, Mumbai, Maharashtra, India 400 042.',
    gst_number: '27AAQCP4546F1Z2',
    pan: 'AAQCP4546F',
    cin: 'U62099MH2025PTC462923',
    support_email: 'support@paybycard.in',
    phone_number: '+918850144143',
    website_url: 'https://paybycard.in',
    company_logo_url: null,
  };
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-company-settings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.settings) co = { ...co, ...data.settings };
    }
  } catch (_) { /* use defaults */ }

  const invoices = rows.map(r => buildEInvoiceJSON(r, co));
  const json = JSON.stringify(invoices, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `e-invoices-gst-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadBulkPDF(rows: TxRecord[]) {
  // Fetch company details from master settings
  let co: CompanyInfo = {
    company_name: 'PayByCard Technologies Private Limited',
    address: '3701, IRIS, Runwal Bliss, Crompton Greaves Compound, Kanjur Marg East, Mumbai, Maharashtra, India 400 042.',
    gst_number: '27AAQCP4546F1Z2',
    pan: 'AAQCP4546F',
    cin: 'U62099MH2025PTC462923',
    support_email: 'support@paybycard.in',
    phone_number: '+918850144143',
    website_url: 'https://paybycard.in',
    company_logo_url: null,
  };
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-company-settings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.settings) co = { ...co, ...data.settings };
    }
  } catch (_) { /* use defaults */ }

  const total = rows.length;
  const invoicesHtml = rows
    .map((r, i) => buildInvoiceHTML(r, co, i + 1).replace('__TOTAL__', String(total)))
    .join('');

  const logoPreload = co.company_logo_url
    ? `<link rel="preload" as="image" href="${co.company_logo_url}">`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Transaction Invoices — ${co.company_name}</title>
  ${logoPreload}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #0f172a; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  ${invoicesHtml}
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=800');
  if (!win) { alert('Please allow pop-ups to download the PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Wait for images to load before printing
  const printWhenReady = () => {
    if (win.document.readyState === 'complete') {
      setTimeout(() => win.print(), 400);
    } else {
      win.addEventListener('load', () => setTimeout(() => win.print(), 400));
    }
  };
  printWhenReady();
}

function DetailModal({ record, onClose }: { record: TxRecord; onClose: () => void }) {
  const bene = record.beneficiary_details || {};
  const ds = record.display_status || record.status;
  const payout = record.payout;
  const option = record.selected_payment_option?.card_type || record.card_type || '—';
  const [branchName, setBranchName] = useState<string>('');

  useEffect(() => {
    const ifsc = bene.ifsc;
    if (!ifsc) return;
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-ifsc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ifsc }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.branch) setBranchName(d.branch); })
      .catch(() => {});
  }, [bene.ifsc]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="bg-gradient-to-r from-[#8c76f0] to-[#7c63e0] px-6 py-5 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Transaction Details</h2>
              <p className="text-white/70 text-xs font-mono">{record.payment_reference}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={ds} />
            <span className="text-sm text-gray-500">{fmtDate(record.created_at)}</span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Information</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><p className="text-gray-500 text-xs mb-0.5">Sender</p><p className="font-medium text-gray-900">{record.sender?.full_name || '—'}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">Email</p><p className="font-medium text-gray-900">{record.sender?.email || '—'}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">Mobile</p><p className="font-medium text-gray-900">{record.sender?.mobile || '—'}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">Environment</p><p className="font-medium text-gray-900">{record.gateway_environment || '—'}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">Initiated At</p><p className="font-medium text-gray-900">{fmtDate(record.created_at)}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">IP Address</p><p className="font-mono text-xs text-gray-900">{record.ip_address || '—'}</p></div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Beneficiary Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><p className="text-gray-500 text-xs mb-0.5">Name</p><p className="font-medium text-gray-900">{bene.full_name || '—'}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">Bank</p><p className="font-medium text-gray-900">{bene.bank_name || '—'}</p></div>
              <div className="col-span-2"><p className="text-gray-500 text-xs mb-0.5">Account Number</p><p className="font-mono text-gray-900">{bene.bank_account || '—'}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">IFSC Code</p><p className="font-mono text-gray-900">{bene.ifsc || '—'}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">Branch Name</p><p className="font-medium text-gray-900">{branchName || bene.city || '—'}</p></div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Amount Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Base Amount</span><span className="font-medium">₹{fmt(record.amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Service Charges</span><span className="font-medium">₹{fmt(record.charges)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">GST</span><span className="font-medium">₹{fmt(record.gst)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">Total Charged</span>
                <span className="font-bold text-[#8c76f0] text-base">₹{fmt(record.total_amount)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Gateway & Category</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><p className="text-gray-500 text-xs mb-0.5">Gateway</p><p className="font-medium text-gray-900">{record.gateway_name || '—'}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">Payment Option</p><p className="font-medium text-gray-900">{option}</p></div>
              <div><p className="text-gray-500 text-xs mb-0.5">Category</p><p className="font-medium text-gray-900">{record.category_details?.category_name || '—'}</p></div>
              {record.gateway_transaction_id && (
                <div className="col-span-2"><p className="text-gray-500 text-xs mb-0.5">Gateway Transaction ID</p><p className="font-mono text-xs text-gray-900">{record.gateway_transaction_id}</p></div>
              )}
              {record.failure_reason && (
                <div className="col-span-2"><p className="text-gray-500 text-xs mb-0.5">Failure Reason</p><p className="text-red-600 font-medium">{record.failure_reason}</p></div>
              )}
            </div>
          </div>

          {payout && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payout / Settlement Details</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Payout Status</p>
                  <div className="mt-0.5"><StatusBadge status={payout.status} /></div>
                </div>
                {payout.payout_reference && (
                  <div><p className="text-gray-500 text-xs mb-0.5">Payout Reference</p><p className="font-mono text-xs text-gray-900">{payout.payout_reference}</p></div>
                )}
                {payout.gateway_transaction_id && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs mb-0.5">{payout.status === 'refunded' ? 'Refund Transaction ID' : 'Gateway Transaction ID'}</p>
                    <p className="font-mono text-xs text-gray-900 break-all">{payout.gateway_transaction_id}</p>
                  </div>
                )}
                {payout.utr_number && (
                  <div><p className="text-gray-500 text-xs mb-0.5">UTR Number</p><p className="font-mono text-xs text-gray-900">{payout.utr_number}</p></div>
                )}
                {payout.payout_reference_number && !payout.utr_number && (
                  <div><p className="text-gray-500 text-xs mb-0.5">Reference Number</p><p className="font-mono text-xs text-gray-900">{payout.payout_reference_number}</p></div>
                )}
                {(payout.payout_date || payout.completed_at) && (
                  <div><p className="text-gray-500 text-xs mb-0.5">Payout Date</p><p className="font-medium text-gray-900">{payout.payout_date || fmtDate(payout.completed_at)}</p></div>
                )}
                {payout.payout_confirmed_amount != null && (
                  <div><p className="text-gray-500 text-xs mb-0.5">Confirmed Amount</p><p className="font-bold text-gray-900">₹{fmt(payout.payout_confirmed_amount)}</p></div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:border-gray-400 hover:bg-gray-50 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const toggle = (v: string) => {
    const next = value.includes(v) ? value.filter(x => x !== v) : [...value, v];
    onChange(next);
  };

  const label = value.length === 0
    ? 'All Status'
    : value.length === 1
      ? STATUS_OPTIONS.find(o => o.value === value[0])?.label ?? value[0]
      : `${value.length} statuses selected`;

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between border-2 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none transition-all text-left ${open ? 'border-[#8c76f0] ring-2 ring-purple-100' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <span className={value.length === 0 ? 'text-gray-500' : 'text-gray-900 font-medium'}>{label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          <label className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} className="rounded accent-[#8c76f0] w-3.5 h-3.5" />
            <span className="text-sm text-gray-700 font-medium">All Status</span>
          </label>
          {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
            <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-purple-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="rounded accent-[#8c76f0] w-3.5 h-3.5" />
              <span className="text-sm text-gray-700">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminReports() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? localStorage.getItem('adminId');
  const { loading: permLoading } = useAdminPermission('reports');

  const [records, setRecords] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [detailRecord, setDetailRecord] = useState<TxRecord | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Payout modal state (manual payout confirmation — admin enters date/ref/amount)
  const [payoutModal, setPayoutModal] = useState<TxRecord | null>(null);
  const [payoutProcessing, setPayoutProcessing] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');

  const openPayoutModal = (record: TxRecord) => {
    setPayoutModal(record);
    setPayoutDate(new Date().toISOString().split('T')[0]);
    setPayoutRef('');
    setPayoutAmount(record.amount);
    setPayoutError('');
    setPayoutSuccess('');
  };

  const closePayoutModal = () => {
    setPayoutModal(null);
    setPayoutError('');
    setPayoutSuccess('');
  };

  const handlePayout = async () => {
    if (!payoutModal) return;
    if (!payoutDate || !payoutRef || !payoutAmount) {
      setPayoutError('All fields are required');
      return;
    }
    setPayoutProcessing(true);
    setPayoutError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-process-manual-payout`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId,
            paymentId: payoutModal.id,
            is_payment_record: true,
            action: 'confirm',
            payout_date: payoutDate,
            payout_reference_number: payoutRef,
            payout_confirmed_amount: payoutAmount,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setPayoutSuccess('Payout confirmed successfully');
      setTimeout(() => { closePayoutModal(); fetchRecords(page, pageSize); }, 1500);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPayoutProcessing(false);
    }
  };

  // Refund modal state (gateway refund — no parameters from admin)
  const [refundModal, setRefundModal] = useState<TxRecord | null>(null);
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');

  const openRefundModal = (record: TxRecord) => {
    setRefundModal(record);
    setRefundError('');
    setRefundSuccess('');
  };

  const closeRefundModal = () => {
    setRefundModal(null);
    setRefundError('');
    setRefundSuccess('');
  };

  const handleGatewayRefund = async () => {
    if (!refundModal) return;
    setRefundProcessing(true);
    setRefundError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-gateway-refund`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId, paymentId: refundModal.id }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund failed');
      setRefundSuccess(data.message || 'Refund initiated successfully');
      setTimeout(() => { closeRefundModal(); fetchRecords(page, pageSize); }, 2000);
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setRefundProcessing(false);
    }
  };

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  const buildFetchBody = useCallback((pg: number, ps: number) => ({
    adminId,
    page: pg,
    limit: ps,
    statuses: statusFilters.length > 0 ? statusFilters : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
  }), [adminId, statusFilters, dateFrom, dateTo, search]);

  const fetchRecords = useCallback(async (pg = 1, ps = pageSize) => {
    if (!adminId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-all-transactions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildFetchBody(pg, ps)),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setRecords(data.payments || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } finally {
      setLoading(false);
    }
  }, [adminId, buildFetchBody, pageSize]);

  // Fetches ALL records matching the current filters (ignores pagination)
  const fetchAllForExport = useCallback(async (): Promise<TxRecord[]> => {
    if (!adminId) return [];
    const exportLimit = total > 0 ? total : 100000;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-all-transactions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...buildFetchBody(1, exportLimit), include_kyc: true }),
      }
    );
    const data = await res.json();
    return data.payments || [];
  }, [adminId, buildFetchBody, total]);

  useEffect(() => {
    setPage(1);
    fetchRecords(1, pageSize);
  }, [statusFilters, dateFrom, dateTo, search]);

  useEffect(() => {
    fetchRecords(page, pageSize);
  }, [page, pageSize]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  if (permLoading) return null;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#8c76f0] to-[#7c63e0] rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
              <BarChart2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transaction Reports</h1>
              <p className="text-gray-500 text-sm mt-0.5">View, filter and export all payment transactions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchRecords(page, pageSize)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 border-2 border-gray-300 rounded-xl text-sm text-gray-600 hover:border-[#8c76f0] hover:bg-purple-50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={async () => {
                setExportLoading(true);
                try { downloadCSV(await fetchAllForExport()); } finally { setExportLoading(false); }
              }}
              disabled={total === 0 || exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40"
            >
              {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              CSV {total > 0 && !exportLoading && <span className="opacity-70 text-xs">({total})</span>}
            </button>
            <button
              onClick={async () => {
                setExportLoading(true);
                try { await downloadBulkPDF(await fetchAllForExport()); } finally { setExportLoading(false); }
              }}
              disabled={total === 0 || exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#8c76f0] text-white rounded-xl text-sm font-medium hover:bg-[#7c63e0] transition-colors disabled:opacity-40"
            >
              {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Bulk PDF {total > 0 && !exportLoading && <span className="opacity-70 text-xs">({total})</span>}
            </button>
            <button
              onClick={async () => {
                setExportLoading(true);
                try { await downloadEInvoiceJSON(await fetchAllForExport()); } finally { setExportLoading(false); }
              }}
              disabled={total === 0 || exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-40"
            >
              {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              E-Invoice JSON {total > 0 && !exportLoading && <span className="opacity-70 text-xs">({total})</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Reference, name..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <StatusMultiSelect value={statusFilters} onChange={v => { setStatusFilters(v); setPage(1); }} />
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="flex-1 border-2 border-gray-300 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="flex-1 border-2 border-gray-300 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            {total > 0 ? <><span className="font-semibold text-gray-800">{total}</span> transaction{total !== 1 ? 's' : ''}</> : 'No transactions'}
            {totalPages > 1 && <span className="ml-2 text-gray-400">· Page {page} of {totalPages}</span>}
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="whitespace-nowrap text-xs text-gray-500">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border-2 border-gray-300 rounded-xl px-2 py-1.5 focus:border-[#8c76f0] focus:outline-none bg-white text-sm"
            >
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-[#8c76f0] animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-[#8c76f0]" />
            </div>
            <p className="text-gray-600 font-semibold">No transactions found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Reference', 'Date', 'Sender', 'Beneficiary', 'Bank / IFSC', 'Option / Gateway', 'Amount', 'Total', 'Status', 'Gateway Sttlmt', 'Payout Mode', 'Settlement', 'Payout', ''].map((h, i) => (
                      <th key={i} className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map(r => {
                    const ds = r.display_status || r.status;
                    const bene = r.beneficiary_details || {};
                    return (
                      <tr key={r.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-[#8c76f0]">{r.payment_reference}</span>
                          {r.gateway_transaction_id && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5 max-w-[100px] truncate">{r.gateway_transaction_id}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 truncate max-w-[100px]">{r.sender?.full_name || '—'}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[100px]">{r.sender?.email || ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 truncate max-w-[100px]">{bene.full_name || '—'}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[100px]">{bene.bank_name || ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-gray-700">{bene.bank_account || '—'}</p>
                          <p className="font-mono text-xs text-gray-400 mt-0.5">{bene.ifsc || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700 text-xs truncate max-w-[100px]">{r.selected_payment_option?.card_type || r.card_type || '—'}</p>
                          <p className="text-xs text-gray-400">{r.gateway_name || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <p className="font-medium text-gray-900">₹{fmt(r.amount)}</p>
                          <p className="text-xs text-gray-400">+₹{fmt(parseFloat(r.charges || '0') + parseFloat(r.gst || '0'))}</p>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="font-bold text-gray-900">₹{fmt(r.total_amount)}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={ds} /></td>
                        <td className="px-4 py-3"><GatewaySettlementBadge status={r.gateway_settlement_status} /></td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 whitespace-nowrap">{formatPayoutMode(r.payout?.payout_type ?? r.payout_mode)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 whitespace-nowrap">{formatSettlementTime(r.category_details?.settlement_time)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {r.payout ? (
                            <div>
                              <StatusBadge status={r.payout.status} />
                              {(r.payout.utr_number || r.payout.payout_reference_number) && (
                                <p className="text-xs text-gray-400 font-mono mt-0.5 max-w-[100px] truncate">
                                  {r.payout.utr_number || r.payout.payout_reference_number}
                                </p>
                              )}
                              {r.payout.status === 'refunded' && r.payout.gateway_transaction_id && (
                                <p className="text-xs text-orange-600 font-mono mt-0.5 max-w-[120px] truncate" title={r.payout.gateway_transaction_id}>
                                  {r.payout.gateway_transaction_id}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => setDetailRecord(r)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[#8c76f0] border border-[#8c76f0]/30 rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                            {ds === 'settlement_pending' && (
                              <>
                                <button
                                  onClick={() => openPayoutModal(r)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
                                >
                                  <Banknote className="w-3.5 h-3.5" />
                                  Payout
                                </button>
                                <button
                                  onClick={() => openRefundModal(r)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors whitespace-nowrap"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Refund
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-xl border-2 border-gray-300 text-gray-600 hover:border-[#8c76f0] hover:bg-purple-50 disabled:opacity-40 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${pg === page ? 'bg-[#8c76f0] text-white border-2 border-[#8c76f0]' : 'border-2 border-gray-300 text-gray-600 hover:border-[#8c76f0] hover:bg-purple-50'}`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl border-2 border-gray-300 text-gray-600 hover:border-[#8c76f0] hover:bg-purple-50 disabled:opacity-40 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {detailRecord && (
        <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
      )}

      {/* Manual Payout Modal */}
      {payoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-green-500 to-green-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Manual Payout</h2>
              </div>
              <button onClick={closePayoutModal} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {payoutSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700 font-medium">{payoutSuccess}</p>
                </div>
              )}
              {payoutError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{payoutError}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><User className="w-3.5 h-3.5" />Sender</span>
                  <span className="font-medium text-gray-900">{payoutModal.sender?.full_name || '—'}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Building className="w-3.5 h-3.5" />Beneficiary</span>
                  <span className="font-medium text-gray-900">{payoutModal.beneficiary_details?.full_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 pl-5">Bank</span>
                  <span className="text-gray-700">{payoutModal.beneficiary_details?.bank_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 pl-5">Account</span>
                  <span className="font-mono text-xs text-gray-900">{payoutModal.beneficiary_details?.bank_account || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 pl-5">IFSC</span>
                  <span className="font-mono text-xs text-gray-900">{payoutModal.beneficiary_details?.ifsc || '—'}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                  <span className="text-gray-600">Base Amount</span>
                  <span className="text-gray-900">₹{fmt(payoutModal.amount)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />Payout Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={payoutDate}
                    onChange={e => setPayoutDate(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />UTR / Reference Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payoutRef}
                    onChange={e => setPayoutRef(e.target.value)}
                    placeholder="Bank UTR or transaction reference"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5" />Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(e.target.value)}
                    step="0.01"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={closePayoutModal}
                disabled={payoutProcessing}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePayout}
                disabled={payoutProcessing || !!payoutSuccess}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-green-500 to-green-600 disabled:opacity-50 transition-opacity"
              >
                {payoutProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Banknote className="w-4 h-4" />Confirm Payout</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gateway Refund Confirmation Modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-red-500 to-red-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Initiate Refund</h2>
                  <p className="text-white/70 text-xs mt-0.5">Via {refundModal.gateway_name || 'payment gateway'}</p>
                </div>
              </div>
              <button onClick={closeRefundModal} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {refundSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700 font-medium">{refundSuccess}</p>
                </div>
              )}
              {refundError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{refundError}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="font-mono text-xs font-semibold text-[#8c76f0]">{refundModal.payment_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sender</span>
                  <span className="font-medium text-gray-900">{refundModal.sender?.full_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Beneficiary</span>
                  <span className="font-medium text-gray-900">{refundModal.beneficiary_details?.full_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Gateway</span>
                  <span className="font-medium text-gray-900">{refundModal.gateway_name || '—'} ({refundModal.gateway_environment || 'production'})</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-700">Refund Amount</span>
                  <span className="font-bold text-red-600 text-base">₹{fmt(refundModal.amount)}</span>
                </div>
                <p className="text-xs text-gray-400 pt-1">Only the base amount is refunded. Platform charges and GST are non-refundable.</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700 font-medium">This will immediately call the {refundModal.gateway_name || 'gateway'} API to process the refund. This action cannot be undone.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={closeRefundModal}
                disabled={refundProcessing}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGatewayRefund}
                disabled={refundProcessing || !!refundSuccess}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-500 to-red-600 disabled:opacity-50 transition-opacity"
              >
                {refundProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4" />Confirm Refund</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
