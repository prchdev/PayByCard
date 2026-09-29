import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReceiptText, Plus, Save, X, AlertCircle, CheckCircle, Loader2, Pencil,
  Search, Download, Eye, Ban, RotateCcw, CreditCard, FileText, IndianRupee,
  Upload, FileImage, Paperclip, ExternalLink,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';
import * as XLSX from 'xlsx';

interface Vendor {
  id: string; vendor_code: string; legal_name: string; trade_name: string | null;
  contact_person: string | null; address: string | null; country: string | null;
  email: string | null; phone: string | null; domestic_or_international: string | null;
  registration_status: string | null; registration_type: string | null;
  cin_number: string | null; pan_number: string | null; gst_number: string | null;
  gst_registration_state: string | null; bank_account_holder: string | null;
  bank_name: string | null; bank_account_number: string | null; bank_ifsc: string | null;
  bank_account_type: string | null; payment_terms: string | null; expense_category: string | null;
  additional_remark: string | null; status: string | null;
}

interface LineItem {
  id?: string; description: string; hsn_sac: string; quantity: number; amount_per_unit: number;
  sgst_amount: number; cgst_amount: number; igst_amount: number; other_tax_amount: number;
}

interface Payment {
  id?: string; payment_id_code: string; payment_date: string; payment_mode: string;
  paid_from: string; payment_source: string | null; transaction_id: string | null;
  amount_paid: number; receipt_number: string | null; payment_status: string; payment_remark: string | null;
}

interface FinanceDocument {
  id: string;
  document_type: string;
  file_url: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

interface Invoice {
  id: string; invoice_id_code: string; vendor_id: string; invoice_number: string;
  invoice_date: string; due_date: string | null; po_number: string | null;
  currency: string; place_of_supply: string | null; expense_category: string | null;
  additional_remark: string | null; subtotal: number; total_sgst: number; total_cgst: number;
  total_igst: number; total_tax: number; grand_total: number; total_paid: number;
  invoice_status: string; payment_status: string; cancellation_reason: string | null;
  created_at: string; vendor?: Vendor; line_items?: LineItem[]; payments?: Payment[];
  documents?: FinanceDocument[];
}

interface InvoiceForm {
  id?: string; vendor_id: string; invoice_number: string; invoice_date: string;
  due_date: string; po_number: string; currency: string; place_of_supply: string;
  expense_category: string; additional_remark: string; invoice_status: string;
  line_items: LineItem[];
}

const EMPTY_FORM: InvoiceForm = {
  vendor_id: '', invoice_number: '', invoice_date: new Date().toISOString().split('T')[0],
  due_date: '', po_number: '', currency: 'INR', place_of_supply: '', expense_category: '',
  additional_remark: '', invoice_status: 'draft', line_items: [{ description: '', hsn_sac: '', quantity: 1, amount_per_unit: 0, sgst_amount: 0, cgst_amount: 0, igst_amount: 0, other_tax_amount: 0 }],
};

const EMPTY_PAYMENT = {
  payment_date: new Date().toISOString().split('T')[0], payment_mode: 'bank_transfer',
  paid_from: 'company_account', payment_source: '', transaction_id: '', amount_paid: 0,
  receipt_number: '', payment_status: 'successful', payment_remark: '',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function Invoicing() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('invoicing');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<InvoiceForm>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [dateType, setDateType] = useState<'invoice' | 'payment'>('invoice');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [cancelModal, setCancelModal] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [paymentModal, setPaymentModal] = useState<{ invoice: Invoice; payment: Payment | null } | null>(null);
  const [paymentForm, setPaymentForm] = useState<typeof EMPTY_PAYMENT>(EMPTY_PAYMENT);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [paymentDocs, setPaymentDocs] = useState<Record<string, FinanceDocument[]>>({});
  const [pendingInvoiceFile, setPendingInvoiceFile] = useState<File | null>(null);
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [pendingSnapshotFile, setPendingSnapshotFile] = useState<File | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const adminSessionToken = sessionStorage.getItem('pbc_admin_session') || '';

  const handleGenerateInvoicePdf = async (invoiceId: string, action: 'view' | 'download') => {
    setGeneratingPdf(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-generate-finance-invoice-pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'x-pbc-admin-session': adminSessionToken },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate PDF');
      const binary = atob(data.pdf_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (action === 'view') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to generate PDF' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const getSignedUrl = async (documentId: string, entityType: 'invoice' | 'payment'): Promise<string | null> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-download-finance-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'x-pbc-admin-session': adminSessionToken },
        body: JSON.stringify({ adminId, documentId, entityType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get download URL');
      return data.signedUrl || null;
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate document link' });
      return null;
    }
  };

  const handleViewDoc = async (documentId: string, entityType: 'invoice' | 'payment') => {
    setDownloadingDoc(documentId);
    const url = await getSignedUrl(documentId, entityType);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    setDownloadingDoc(null);
  };

  const handleDownloadDoc = async (documentId: string, entityType: 'invoice' | 'payment') => {
    setDownloadingDoc(`${documentId}_dl`);
    const url = await getSignedUrl(documentId, entityType);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setDownloadingDoc(null);
  };

  const uploadFile = async (file: File, docType: string, entityType: 'invoice' | 'payment', entityId: string) => {
    const key = `${entityType}_${entityId}_${docType}`;
    setUploadingDoc(key);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-upload-finance-document`, {
        method: 'POST',
        headers: { 'x-pbc-admin-session': adminSessionToken },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload file');
      setMessage({ type: 'success', text: 'File uploaded successfully' });
      await fetchInvoices();
      if (entityType === 'payment') await fetchPaymentDocs(entityId);
      if (viewInvoice) {
        const updated = invoices.find(i => i.id === viewInvoice.id);
        if (updated) setViewInvoice(updated);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload file' });
    } finally {
      setUploadingDoc(null);
    }
  };

  const fetchPaymentDocs = async (paymentId: string) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-get-invoices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId }),
      });
      const data = await response.json();
      if (response.ok && data.invoices) {
        for (const inv of data.invoices) {
          if (inv.payments) {
            for (const pay of inv.payments) {
              if (pay.id === paymentId) {
                setPaymentDocs(prev => ({ ...prev, [paymentId]: (pay as any).documents || [] }));
                return;
              }
            }
          }
        }
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { if (!adminId) navigate('/admin/login'); }, [adminId, navigate]);
  useEffect(() => { fetchInvoices(); fetchVendors(); }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-get-invoices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, search: searchTerm, invoiceStatus: statusFilter, paymentStatus: payStatusFilter, dateType, dateFrom, dateTo }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch invoices');
      setInvoices(data.invoices || []);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load invoices' });
    } finally { setLoading(false); }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-get-vendors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId }),
      });
      const data = await response.json();
      if (response.ok) setVendors(data.vendors || []);
    } catch { /* ignore */ }
  };

  const calcTotals = (items: LineItem[]) => {
    let subtotal = 0, totalSgst = 0, totalCgst = 0, totalIgst = 0, totalTax = 0, grandTotal = 0;
    for (const item of items) {
      const taxable = (Number(item.quantity) || 0) * (Number(item.amount_per_unit) || 0);
      const lineTax = (Number(item.sgst_amount) || 0) + (Number(item.cgst_amount) || 0) + (Number(item.igst_amount) || 0) + (Number(item.other_tax_amount) || 0);
      subtotal += taxable; totalSgst += Number(item.sgst_amount) || 0; totalCgst += Number(item.cgst_amount) || 0;
      totalIgst += Number(item.igst_amount) || 0; totalTax += lineTax; grandTotal += taxable + lineTax;
    }
    return { subtotal, totalSgst, totalCgst, totalIgst, totalTax, grandTotal };
  };

  const totals = useMemo(() => calcTotals(formData.line_items), [formData.line_items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_id || !formData.invoice_number || !formData.invoice_date) {
      setMessage({ type: 'error', text: 'Vendor, invoice number, and invoice date are required' });
      return;
    }
    if (formData.line_items.length === 0 || !formData.line_items[0].description) {
      setMessage({ type: 'error', text: 'At least one line item is required' });
      return;
    }
    setSaving(true); setMessage(null); setDupWarning(null);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-save-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, ...formData, forceSave: !!dupWarning }),
      });
      const data = await response.json();
      if (response.status === 409 && data.error === 'duplicate_warning') {
        setDupWarning(data.message);
        setSaving(false);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Failed to save invoice');
      const savedInvoiceId = data.invoice?.id;
      if (savedInvoiceId && pendingInvoiceFile) {
        await uploadFile(pendingInvoiceFile, 'invoice_pdf', 'invoice', savedInvoiceId);
      }
      setMessage({ type: 'success', text: formData.id ? 'Invoice updated successfully' : 'Invoice created successfully' });
      setShowForm(false); setFormData(EMPTY_FORM); setPendingInvoiceFile(null); fetchInvoices();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save invoice' });
    } finally { setSaving(false); }
  };

  const handleEdit = (inv: Invoice) => {
    setFormData({
      id: inv.id, vendor_id: inv.vendor_id, invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date, due_date: inv.due_date || '', po_number: inv.po_number || '',
      currency: inv.currency, place_of_supply: inv.place_of_supply || '', expense_category: inv.expense_category || '',
      additional_remark: inv.additional_remark || '', invoice_status: inv.invoice_status,
      line_items: (inv.line_items && inv.line_items.length > 0) ? inv.line_items.map(li => ({
        id: li.id, description: li.description, hsn_sac: li.hsn_sac || '', quantity: li.quantity,
        amount_per_unit: li.amount_per_unit, sgst_amount: li.sgst_amount, cgst_amount: li.cgst_amount,
        igst_amount: li.igst_amount, other_tax_amount: li.other_tax_amount,
      })) : [{ description: '', hsn_sac: '', quantity: 1, amount_per_unit: 0, sgst_amount: 0, cgst_amount: 0, igst_amount: 0, other_tax_amount: 0 }],
    });
    setShowForm(true); setMessage(null); setDupWarning(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelInvoice = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-save-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, id: cancelModal.id, action: 'cancel', reason: cancelReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to cancel invoice');
      setMessage({ type: 'success', text: 'Invoice cancelled successfully' });
      setCancelModal(null); setCancelReason(''); fetchInvoices();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to cancel invoice' });
    } finally { setSaving(false); }
  };

  const handleSavePayment = async () => {
    if (!paymentModal || !paymentForm.amount_paid) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        adminId, id: paymentModal.invoice.id, action: 'save_payment',
        payment_date: paymentForm.payment_date, payment_mode: paymentForm.payment_mode,
        paid_from: paymentForm.paid_from, payment_source: paymentForm.payment_source,
        transaction_id: paymentForm.transaction_id, amount_paid: paymentForm.amount_paid,
        receipt_number: paymentForm.receipt_number, payment_status: paymentForm.payment_status,
        payment_remark: paymentForm.payment_remark,
      };
      if (paymentModal.payment?.id) body.paymentId = paymentModal.payment.id;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-save-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save payment');
      const savedPaymentId = data.payment?.id;
      if (savedPaymentId) {
        if (pendingReceiptFile) await uploadFile(pendingReceiptFile, 'receipt', 'payment', savedPaymentId);
        if (pendingSnapshotFile) await uploadFile(pendingSnapshotFile, 'snapshot', 'payment', savedPaymentId);
      }
      setMessage({ type: 'success', text: paymentModal.payment ? 'Payment updated' : 'Payment added successfully' });
      setPaymentModal(null); setPaymentForm(EMPTY_PAYMENT); setPendingReceiptFile(null); setPendingSnapshotFile(null); fetchInvoices();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save payment' });
    } finally { setSaving(false); }
  };

  const handleCancelPayment = async (inv: Invoice, pay: Payment) => {
    setSaving(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-save-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, id: inv.id, action: 'cancel_payment', paymentId: pay.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to cancel payment');
      setMessage({ type: 'success', text: 'Payment cancelled' });
      fetchInvoices();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to cancel payment' });
    } finally { setSaving(false); }
  };

  const resetFilters = () => {
    setSearchTerm(''); setStatusFilter(''); setPayStatusFilter(''); setDateType('invoice'); setDateFrom(''); setDateTo(''); fetchInvoices();
  };

  const exportInvoices = async (all: boolean) => {
    const data = all ? invoices : invoices.filter(inv =>
      (!searchTerm || inv.invoice_id_code.toLowerCase().includes(searchTerm.toLowerCase()) || inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!statusFilter || inv.invoice_status === statusFilter) &&
      (!payStatusFilter || inv.payment_status === payStatusFilter) &&
      (!dateFrom || inv.invoice_date >= dateFrom) &&
      (!dateTo || inv.invoice_date <= dateTo)
    );

    if (data.length === 0) {
      setMessage({ type: 'error', text: 'No invoices to export' });
      return;
    }

    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Invoices
      const invoiceRows = data.map(inv => ({
        'Invoice ID': inv.invoice_id_code,
        'Invoice Number': inv.invoice_number,
        'Invoice Date': inv.invoice_date,
        'Due Date': inv.due_date || '',
        'PO Number': inv.po_number || '',
        'Currency': inv.currency,
        'Place of Supply': inv.place_of_supply || '',
        'Expense Category': inv.expense_category || '',
        'Additional Remark': inv.additional_remark || '',
        'Subtotal': Number(inv.subtotal),
        'Total SGST': Number(inv.total_sgst),
        'Total CGST': Number(inv.total_cgst),
        'Total IGST': Number(inv.total_igst),
        'Total Tax': Number(inv.total_tax),
        'Grand Total': Number(inv.grand_total),
        'Total Paid': Number(inv.total_paid),
        'Pending': Number(inv.grand_total) - Number(inv.total_paid),
        'Invoice Status': inv.invoice_status,
        'Payment Status': inv.payment_status,
        'Cancellation Reason': inv.cancellation_reason || '',
        'Created At': new Date(inv.created_at).toLocaleString('en-IN'),
      }));
      const wsInvoices = XLSX.utils.json_to_sheet(invoiceRows);
      wsInvoices['!cols'] = Object.keys(invoiceRows[0]).map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

      // Sheet 2: Vendors
      const vendorRows = data.map(inv => {
        const v = inv.vendor;
        return {
          'Invoice ID': inv.invoice_id_code,
          'Vendor Code': v?.vendor_code || '',
          'Legal Name': v?.legal_name || '',
          'Trade Name': v?.trade_name || '',
          'Contact Person': v?.contact_person || '',
          'Address': v?.address || '',
          'Country': v?.country || '',
          'Email': v?.email || '',
          'Phone': v?.phone || '',
          'Domestic/International': v?.domestic_or_international || '',
          'Registration Status': v?.registration_status || '',
          'Registration Type': v?.registration_type || '',
          'CIN Number': v?.cin_number || '',
          'PAN Number': v?.pan_number || '',
          'GST Number': v?.gst_number || '',
          'GST Registration State': v?.gst_registration_state || '',
          'Bank Account Holder': v?.bank_account_holder || '',
          'Bank Name': v?.bank_name || '',
          'Bank Account Number': v?.bank_account_number || '',
          'Bank IFSC': v?.bank_ifsc || '',
          'Bank Account Type': v?.bank_account_type || '',
          'Payment Terms': v?.payment_terms || '',
          'Expense Category': v?.expense_category || '',
          'Vendor Status': v?.status || '',
        };
      });
      const wsVendors = XLSX.utils.json_to_sheet(vendorRows);
      wsVendors['!cols'] = Object.keys(vendorRows[0]).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, wsVendors, 'Vendors');

      // Sheet 3: Line Items
      const lineItemRows: Record<string, any>[] = [];
      for (const inv of data) {
        for (const li of (inv.line_items || [])) {
          const taxable = (Number(li.quantity) || 0) * (Number(li.amount_per_unit) || 0);
          lineItemRows.push({
            'Invoice ID': inv.invoice_id_code,
            'Invoice Number': inv.invoice_number,
            'Description': li.description,
            'HSN/SAC': li.hsn_sac || '',
            'Quantity': Number(li.quantity),
            'Unit Price': Number(li.amount_per_unit),
            'Taxable Amount': taxable,
            'SGST': Number(li.sgst_amount),
            'CGST': Number(li.cgst_amount),
            'IGST': Number(li.igst_amount),
            'Other Tax': Number(li.other_tax_amount),
            'Line Total': taxable + Number(li.sgst_amount) + Number(li.cgst_amount) + Number(li.igst_amount) + Number(li.other_tax_amount),
          });
        }
      }
      if (lineItemRows.length > 0) {
        const wsLineItems = XLSX.utils.json_to_sheet(lineItemRows);
        wsLineItems['!cols'] = Object.keys(lineItemRows[0]).map(() => ({ wch: 18 }));
        XLSX.utils.book_append_sheet(wb, wsLineItems, 'Line Items');
      }

      // Sheet 4: Payments
      const paymentRows: Record<string, any>[] = [];
      for (const inv of data) {
        for (const pay of (inv.payments || [])) {
          paymentRows.push({
            'Invoice ID': inv.invoice_id_code,
            'Invoice Number': inv.invoice_number,
            'Payment ID': (pay as any).payment_id_code || '',
            'Payment Date': pay.payment_date,
            'Payment Mode': pay.payment_mode,
            'Paid From': pay.paid_from,
            'Payment Source': pay.payment_source || '',
            'Transaction ID / UTR': pay.transaction_id || '',
            'Amount Paid': Number(pay.amount_paid),
            'Receipt Number': pay.receipt_number || '',
            'Payment Status': pay.payment_status,
            'Payment Remark': pay.payment_remark || '',
          });
        }
      }
      if (paymentRows.length > 0) {
        const wsPayments = XLSX.utils.json_to_sheet(paymentRows);
        wsPayments['!cols'] = Object.keys(paymentRows[0]).map(() => ({ wch: 18 }));
        XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');
      }

      // Sheet 5: Documents (with embedded files)
      const docRows: Record<string, any>[] = [];
      const docBuffers: { rowIdx: number; buffer: ArrayBuffer; ext: string }[] = [];
      let docIdx = 0;

      for (const inv of data) {
        for (const doc of (inv.documents || [])) {
          const signedUrl = (doc as any).signed_url;
          let fileBuffer: ArrayBuffer | null = null;
          let ext = 'pdf';
          if (signedUrl) {
            try {
              const resp = await fetch(signedUrl);
              if (resp.ok) {
                fileBuffer = await resp.arrayBuffer();
                const ct = resp.headers.get('content-type') || '';
                if (ct.includes('image/png')) ext = 'png';
                else if (ct.includes('image/jpeg')) ext = 'jpg';
                else if (ct.includes('image/webp')) ext = 'webp';
              }
            } catch { /* skip */ }
          }
          docRows.push({
            'Invoice ID': inv.invoice_id_code,
            'Invoice Number': inv.invoice_number,
            'Document Type': doc.document_type,
            'File Path': doc.file_url,
            'Uploaded At': new Date(doc.uploaded_at).toLocaleString('en-IN'),
            'File Attached': fileBuffer ? 'Yes' : 'No (private/inaccessible)',
          });
          if (fileBuffer) docBuffers.push({ rowIdx: docIdx, buffer: fileBuffer, ext });
          docIdx++;
        }
        for (const pay of (inv.payments || [])) {
          for (const doc of ((pay as any).documents || [])) {
            const signedUrl = (doc as any).signed_url;
            let fileBuffer: ArrayBuffer | null = null;
            let ext = 'pdf';
            if (signedUrl) {
              try {
                const resp = await fetch(signedUrl);
                if (resp.ok) {
                  fileBuffer = await resp.arrayBuffer();
                  const ct = resp.headers.get('content-type') || '';
                  if (ct.includes('image/png')) ext = 'png';
                  else if (ct.includes('image/jpeg')) ext = 'jpg';
                  else if (ct.includes('image/webp')) ext = 'webp';
                }
              } catch { /* skip */ }
            }
            docRows.push({
              'Invoice ID': inv.invoice_id_code,
              'Invoice Number': inv.invoice_number,
              'Payment ID': (pay as any).payment_id_code || '',
              'Document Type': doc.document_type,
              'File Path': doc.file_url,
              'Uploaded At': new Date(doc.uploaded_at).toLocaleString('en-IN'),
              'File Attached': fileBuffer ? 'Yes' : 'No (private/inaccessible)',
            });
            if (fileBuffer) docBuffers.push({ rowIdx: docIdx, buffer: fileBuffer, ext });
            docIdx++;
          }
        }
      }

      if (docRows.length > 0) {
        const wsDocs = XLSX.utils.json_to_sheet(docRows);
        wsDocs['!cols'] = Object.keys(docRows[0]).map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(wb, wsDocs, 'Documents');
      }

      // Embed files into the workbook as a zip-like structure
      // xlsx library doesn't support embedding arbitrary files directly,
      // so we write them as base64 in a separate "Files" sheet
      if (docBuffers.length > 0) {
        const fileRows = docBuffers.map((b, i) => ({
          'Index': i + 1,
          'Document Row': b.rowIdx + 2, // +2 for header row in Documents sheet
          'File Extension': b.ext,
          'Base64 Data': arrayBufferToBase64(b.buffer),
        }));
        const wsFiles = XLSX.utils.json_to_sheet(fileRows);
        wsFiles['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, wsFiles, 'Embedded Files');
      }

      const fileName = `invoices_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      setMessage({ type: 'success', text: `Exported ${data.length} invoice(s) to Excel` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to export' });
    } finally {
      setExporting(false);
    }
  };

  const selectedVendor = vendors.find(v => v.id === formData.vendor_id);

  if (permLoading) return null;
  if (loading) {
    return <AdminLayout><div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" /></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoicing</h1>
            <p className="text-gray-600 mt-1">Manage invoices, payments, and reconciliation</p>
          </div>
          {!showForm && canEdit && (
            <button onClick={() => { setFormData(EMPTY_FORM); setShowForm(true); setMessage(null); setDupWarning(null); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-5 h-5" /> New Invoice
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
            <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>{message.text}</p>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-gray-300 p-6 space-y-6 mb-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                  <ReceiptText className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{formData.id ? 'Edit Invoice' : 'Create New Invoice'}</h2>
              </div>
              <button type="button" onClick={() => { setShowForm(false); setFormData(EMPTY_FORM); }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {dupWarning && (
              <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-900">{dupWarning}</p>
                  <p className="text-xs text-orange-700 mt-1">Click "Save" again to confirm and create this invoice anyway.</p>
                </div>
              </div>
            )}

            {/* Invoice Header */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Invoice Header</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor <span className="text-red-600">*</span></label>
                  <select value={formData.vendor_id} onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                    <option value="">Select Vendor...</option>
                    {vendors.filter(v => v.id).map(v => <option key={v.id} value={v.id}>{v.legal_name} ({v.vendor_code})</option>)}
                  </select>
                </div>
                {selectedVendor && (
                  <div className="md:col-span-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                    <div className="grid grid-cols-2 gap-2">
                      <span><strong>GST:</strong> {selectedVendor.gst_number || '—'}</span>
                      <span><strong>PAN:</strong> {selectedVendor.pan_number || '—'}</span>
                      <span><strong>Email:</strong> {selectedVendor.email || '—'}</span>
                      <span><strong>Payment Terms:</strong> {selectedVendor.payment_terms || '—'}</span>
                    </div>
                  </div>
                )}
                <Field label="Invoice Number" required value={formData.invoice_number} onChange={(v) => setFormData({ ...formData, invoice_number: v })} />
                <Field label="Invoice Date" required type="date" value={formData.invoice_date} onChange={(v) => setFormData({ ...formData, invoice_date: v })} />
                <Field label="Due Date" type="date" value={formData.due_date} onChange={(v) => setFormData({ ...formData, due_date: v })} />
                <Field label="PO Number" value={formData.po_number} onChange={(v) => setFormData({ ...formData, po_number: v })} />
                <Field label="Currency" value={formData.currency} onChange={(v) => setFormData({ ...formData, currency: v })} />
                <Field label="Place of Supply" value={formData.place_of_supply} onChange={(v) => setFormData({ ...formData, place_of_supply: v })} />
                <Field label="Expense Category" value={formData.expense_category} onChange={(v) => setFormData({ ...formData, expense_category: v })} />
                <Field label="Additional Remark" value={formData.additional_remark} onChange={(v) => setFormData({ ...formData, additional_remark: v })} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Status</label>
                  <select value={formData.invoice_status} onChange={(e) => setFormData({ ...formData, invoice_status: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                    {['draft', 'submitted', 'approved'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Line Items</h3>
                <button type="button" onClick={() => setFormData({ ...formData, line_items: [...formData.line_items, { description: '', hsn_sac: '', quantity: 1, amount_per_unit: 0, sgst_amount: 0, cgst_amount: 0, igst_amount: 0, other_tax_amount: 0 }] })}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#8c76f0] bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Line Item
                </button>
              </div>
              <div className="space-y-3">
                {formData.line_items.map((item, idx) => {
                  const taxable = (Number(item.quantity) || 0) * (Number(item.amount_per_unit) || 0);
                  const lineTotal = taxable + (Number(item.sgst_amount) || 0) + (Number(item.cgst_amount) || 0) + (Number(item.igst_amount) || 0) + (Number(item.other_tax_amount) || 0);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                      <div className="col-span-12 md:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                        <input type="text" value={item.description} onChange={(e) => { const li = [...formData.line_items]; li[idx] = { ...li[idx], description: e.target.value }; setFormData({ ...formData, line_items: li }); }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#8c76f0]" />
                      </div>
                      <div className="col-span-6 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">HSN/SAC</label>
                        <input type="text" value={item.hsn_sac} onChange={(e) => { const li = [...formData.line_items]; li[idx] = { ...li[idx], hsn_sac: e.target.value }; setFormData({ ...formData, line_items: li }); }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#8c76f0]" />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
                        <input type="number" step="0.01" value={item.quantity} onChange={(e) => { const li = [...formData.line_items]; li[idx] = { ...li[idx], quantity: Number(e.target.value) }; setFormData({ ...formData, line_items: li }); }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#8c76f0]" />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Unit ₹</label>
                        <input type="number" step="0.01" value={item.amount_per_unit} onChange={(e) => { const li = [...formData.line_items]; li[idx] = { ...li[idx], amount_per_unit: Number(e.target.value) }; setFormData({ ...formData, line_items: li }); }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#8c76f0]" />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">SGST</label>
                        <input type="number" step="0.01" value={item.sgst_amount} onChange={(e) => { const li = [...formData.line_items]; li[idx] = { ...li[idx], sgst_amount: Number(e.target.value) }; setFormData({ ...formData, line_items: li }); }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#8c76f0]" />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">CGST</label>
                        <input type="number" step="0.01" value={item.cgst_amount} onChange={(e) => { const li = [...formData.line_items]; li[idx] = { ...li[idx], cgst_amount: Number(e.target.value) }; setFormData({ ...formData, line_items: li }); }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#8c76f0]" />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">IGST</label>
                        <input type="number" step="0.01" value={item.igst_amount} onChange={(e) => { const li = [...formData.line_items]; li[idx] = { ...li[idx], igst_amount: Number(e.target.value) }; setFormData({ ...formData, line_items: li }); }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#8c76f0]" />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Other</label>
                        <input type="number" step="0.01" value={item.other_tax_amount} onChange={(e) => { const li = [...formData.line_items]; li[idx] = { ...li[idx], other_tax_amount: Number(e.target.value) }; setFormData({ ...formData, line_items: li }); }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#8c76f0]" />
                      </div>
                      <div className="col-span-6 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Total</label>
                        <p className="text-sm font-medium text-gray-900 py-1.5">₹{lineTotal.toFixed(2)}</p>
                      </div>
                      <div className="col-span-6 md:col-span-1">
                        {formData.line_items.length > 1 && (
                          <button type="button" onClick={() => setFormData({ ...formData, line_items: formData.line_items.filter((_, i) => i !== idx) })}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Totals Summary */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-purple-50 rounded-xl">
                <TotalBox label="Subtotal" value={totals.subtotal} />
                <TotalBox label="SGST" value={totals.totalSgst} />
                <TotalBox label="CGST" value={totals.totalCgst} />
                <TotalBox label="IGST" value={totals.totalIgst} />
                <TotalBox label="Total Tax" value={totals.totalTax} />
                <TotalBox label="Grand Total" value={totals.grandTotal} highlight />
              </div>
            </div>

            {/* Invoice File Upload */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Invoice Document</h3>
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                {pendingInvoiceFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pendingInvoiceFile.type.startsWith('image/') ? <FileImage className="w-5 h-5 text-[#8c76f0]" /> : <FileText className="w-5 h-5 text-[#8c76f0]" />}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{pendingInvoiceFile.name}</p>
                        <p className="text-xs text-gray-500">{(pendingInvoiceFile.size / 1024).toFixed(0)} KB • Will upload after saving</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setPendingInvoiceFile(null)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-4">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <p className="text-sm text-gray-600">Click to attach invoice file (PDF or image)</p>
                    <p className="text-xs text-gray-400">Max 5 MB</p>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 5 * 1024 * 1024) { setMessage({ type: 'error', text: 'File exceeds 5 MB limit' }); return; } setPendingInvoiceFile(f); } e.target.value = ''; }} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {formData.id ? 'Update Invoice' : 'Create Invoice'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormData(EMPTY_FORM); setPendingInvoiceFile(null); }}
                className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {/* Search & Filters */}
        {!showForm && (
          <>
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 mb-6 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search invoice ID, number, PO..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                  <option value="">All Invoice Statuses</option>
                  {['draft', 'submitted', 'approved', 'partially_paid', 'fully_paid', 'overdue', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
                <select value={payStatusFilter} onChange={(e) => setPayStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                  <option value="">All Payment Statuses</option>
                  {['no_payment', 'pending', 'partially_paid', 'fully_paid'].map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={fetchInvoices} className="flex-1 px-3 py-2 bg-[#8c76f0] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Search</button>
                  <button onClick={resetFilters} className="px-3 py-2 text-gray-700 bg-gray-100 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"><RotateCcw className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date Range</span>
                <select value={dateType} onChange={(e) => setDateType(e.target.value as 'invoice' | 'payment')}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                  <option value="invoice">Invoice Date</option>
                  <option value="payment">Payment Date</option>
                </select>
                <div className="flex items-center gap-2">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]" />
                  <span className="text-sm text-gray-400 font-medium">to</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]" />
                </div>
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => exportInvoices(false)} disabled={exporting} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#8c76f0] bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50">{exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Export Filtered</button>
                  <button onClick={() => exportInvoices(true)} disabled={exporting} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">{exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Export All</button>
                </div>
              </div>
            </div>

            {/* Invoice Table */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Invoice ID', 'Vendor', 'Invoice No.', 'Date', 'Due Date', 'Grand Total', 'Total Paid', 'Pending', 'Inv Status', 'Pay Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">No invoices found</td></tr>
                    ) : invoices.map(inv => {
                      const pending = Number(inv.grand_total) - Number(inv.total_paid);
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-mono text-gray-700 whitespace-nowrap">{inv.invoice_id_code}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.vendor?.legal_name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{inv.invoice_date}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{inv.due_date || '—'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">₹{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-sm text-green-600 font-medium">₹{Number(inv.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-sm text-orange-600 font-medium">₹{pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3"><StatusBadge status={inv.invoice_status} /></td>
                          <td className="px-4 py-3"><PayStatusBadge status={inv.payment_status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setViewInvoice(inv)} className="p-1.5 text-gray-500 hover:text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                              {canEdit && inv.invoice_status !== 'cancelled' && <button onClick={() => handleEdit(inv)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>}
                              {canEdit && inv.invoice_status !== 'cancelled' && <button onClick={() => { setPaymentModal({ invoice: inv, payment: null }); setPaymentForm(EMPTY_PAYMENT); }} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Add Payment"><CreditCard className="w-4 h-4" /></button>}
                              {canEdit && inv.invoice_status !== 'cancelled' && <button onClick={() => { setCancelModal(inv); setCancelReason(''); }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cancel"><Ban className="w-4 h-4" /></button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* View Invoice Modal */}
        {viewInvoice && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewInvoice(null)}>
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center"><ReceiptText className="w-5 h-5 text-[#8c76f0]" /></div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{viewInvoice.invoice_id_code}</h2>
                    <p className="text-xs text-gray-500">{viewInvoice.invoice_number} • {viewInvoice.vendor?.legal_name}</p>
                  </div>
                </div>
                <button onClick={() => setViewInvoice(null)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6">
                {/* PDF Actions */}
                <div className="flex items-center gap-2">
                  <button onClick={() => handleGenerateInvoicePdf(viewInvoice.id, 'view')} disabled={generatingPdf}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#8c76f0] bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50">
                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} View Invoice PDF
                  </button>
                  <button onClick={() => handleGenerateInvoicePdf(viewInvoice.id, 'download')} disabled={generatingPdf}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PDF
                  </button>
                </div>
                {/* Invoice Details */}
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Invoice Date" value={viewInvoice.invoice_date} />
                  <DetailRow label="Due Date" value={viewInvoice.due_date} />
                  <DetailRow label="PO Number" value={viewInvoice.po_number} />
                  <DetailRow label="Currency" value={viewInvoice.currency} />
                  <DetailRow label="Place of Supply" value={viewInvoice.place_of_supply} />
                  <DetailRow label="Expense Category" value={viewInvoice.expense_category} />
                  <DetailRow label="Invoice Status" value={viewInvoice.invoice_status} />
                  <DetailRow label="Payment Status" value={viewInvoice.payment_status} />
                  {viewInvoice.cancellation_reason && <DetailRow label="Cancellation Reason" value={viewInvoice.cancellation_reason} />}
                </div>

                {/* Line Items */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Line Items</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50"><tr>
                        {['Description', 'HSN', 'Qty', 'Unit', 'Taxable', 'SGST', 'CGST', 'IGST', 'Total'].map(h => <th key={h} className="px-2 py-2 text-left text-xs font-bold text-gray-600">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {(viewInvoice.line_items || []).map((li, i) => {
                          const taxable = (Number(li.quantity) || 0) * (Number(li.amount_per_unit) || 0);
                          return (
                            <tr key={i}>
                              <td className="px-2 py-2 text-sm text-gray-700">{li.description}</td>
                              <td className="px-2 py-2 text-sm text-gray-600">{li.hsn_sac || '—'}</td>
                              <td className="px-2 py-2 text-sm text-gray-600">{li.quantity}</td>
                              <td className="px-2 py-2 text-sm text-gray-600">₹{Number(li.amount_per_unit).toFixed(2)}</td>
                              <td className="px-2 py-2 text-sm text-gray-600">₹{taxable.toFixed(2)}</td>
                              <td className="px-2 py-2 text-sm text-gray-600">₹{Number(li.sgst_amount).toFixed(2)}</td>
                              <td className="px-2 py-2 text-sm text-gray-600">₹{Number(li.cgst_amount).toFixed(2)}</td>
                              <td className="px-2 py-2 text-sm text-gray-600">₹{Number(li.igst_amount).toFixed(2)}</td>
                              <td className="px-2 py-2 text-sm font-medium text-gray-900">₹{Number(li.total_amount).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-purple-50 rounded-xl">
                  <TotalBox label="Subtotal" value={Number(viewInvoice.subtotal)} />
                  <TotalBox label="Total Tax" value={Number(viewInvoice.total_tax)} />
                  <TotalBox label="Grand Total" value={Number(viewInvoice.grand_total)} highlight />
                  <TotalBox label="Total Paid" value={Number(viewInvoice.total_paid)} />
                </div>
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Pending Amount</p>
                    <p className="text-2xl font-bold text-orange-600">₹{(Number(viewInvoice.grand_total) - Number(viewInvoice.total_paid)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* Invoice Documents */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Invoice Documents</h3>
                  <div className="space-y-2">
                    {(viewInvoice.documents || []).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {doc.document_type.includes('image') ? <FileImage className="w-4 h-4 text-[#8c76f0]" /> : <FileText className="w-4 h-4 text-[#8c76f0]" />}
                          <div>
                            <p className="text-sm font-medium text-gray-900 capitalize">{doc.document_type.replace('_', ' ')}</p>
                            <p className="text-xs text-gray-400">Uploaded {new Date(doc.uploaded_at).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleViewDoc(doc.id, 'invoice')} disabled={downloadingDoc === doc.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-[#8c76f0] hover:bg-purple-50 rounded transition-colors disabled:opacity-50">
                            {downloadingDoc === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />} View
                          </button>
                          <button onClick={() => handleDownloadDoc(doc.id, 'invoice')} disabled={downloadingDoc === `${doc.id}_dl`}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50">
                            {downloadingDoc === `${doc.id}_dl` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download
                          </button>
                        </div>
                      </div>
                    ))}
                    {canEdit && viewInvoice.invoice_status !== 'cancelled' && (
                      <FileUploadButton
                        label="Attach Invoice File (PDF/Image)"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        uploading={uploadingDoc === `invoice_${viewInvoice.id}_invoice_pdf`}
                        onFile={(file) => uploadFile(file, 'invoice_pdf', 'invoice', viewInvoice.id)}
                      />
                    )}
                    {(viewInvoice.documents || []).length === 0 && !canEdit && (
                      <p className="text-sm text-gray-400 py-2 text-center">No documents attached</p>
                    )}
                  </div>
                </div>

                {/* Payments */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Payments</h3>
                    {canEdit && viewInvoice.invoice_status !== 'cancelled' && (
                      <button onClick={() => { setPaymentModal({ invoice: viewInvoice, payment: null }); setPaymentForm(EMPTY_PAYMENT); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#8c76f0] bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"><Plus className="w-3.5 h-3.5" /> Add Payment</button>
                    )}
                  </div>
                  {(viewInvoice.payments || []).length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No payments recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {(viewInvoice.payments || []).map((pay) => (
                        <div key={pay.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{pay.payment_id_code}</p>
                                <p className="text-xs text-gray-500">{pay.payment_date} • {pay.payment_mode.replace('_', ' ')} • {pay.paid_from.replace('_', ' ')}</p>
                                {pay.transaction_id && <p className="text-xs text-gray-400">Txn: {pay.transaction_id}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">₹{Number(pay.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                <PayStatusBadge status={pay.payment_status} />
                              </div>
                              {canEdit && pay.payment_status !== 'cancelled' && (
                                <button onClick={() => { setPaymentModal({ invoice: viewInvoice, payment: pay }); setPaymentForm({ payment_date: pay.payment_date, payment_mode: pay.payment_mode, paid_from: pay.paid_from, payment_source: pay.payment_source || '', transaction_id: pay.transaction_id || '', amount_paid: pay.amount_paid, receipt_number: pay.receipt_number || '', payment_status: pay.payment_status, payment_remark: pay.payment_remark || '' }); }}
                                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                              )}
                              {canEdit && pay.payment_status !== 'cancelled' && (
                                <button onClick={() => handleCancelPayment(viewInvoice, pay)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Ban className="w-4 h-4" /></button>
                              )}
                            </div>
                          </div>
                          {/* Payment Documents */}
                          {pay.id && (
                            <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payment Documents</p>
                              {((pay as any).documents || paymentDocs[pay.id] || []).map((doc: FinanceDocument) => (
                                <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
                                  <div className="flex items-center gap-2">
                                    {doc.document_type.includes('snapshot') ? <FileImage className="w-3.5 h-3.5 text-[#8c76f0]" /> : <FileText className="w-3.5 h-3.5 text-[#8c76f0]" />}
                                    <div>
                                      <p className="text-xs font-medium text-gray-700 capitalize">{doc.document_type === 'receipt' ? 'Payment Receipt' : doc.document_type === 'snapshot' ? 'Payment Snapshot' : doc.document_type}</p>
                                      <p className="text-xs text-gray-400">{new Date(doc.uploaded_at).toLocaleDateString('en-IN')}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleViewDoc(doc.id, 'payment')} disabled={downloadingDoc === doc.id}
                                      className="flex items-center gap-1 px-2 py-1 text-xs text-[#8c76f0] hover:bg-purple-50 rounded transition-colors disabled:opacity-50">
                                      {downloadingDoc === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />} View
                                    </button>
                                    <button onClick={() => handleDownloadDoc(doc.id, 'payment')} disabled={downloadingDoc === `${doc.id}_dl`}
                                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50">
                                      {downloadingDoc === `${doc.id}_dl` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Download
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {canEdit && pay.payment_status !== 'cancelled' && (
                                <div className="flex gap-2 mt-1">
                                  <FileUploadButton
                                    label="Receipt (PDF/Image)"
                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                    uploading={uploadingDoc === `payment_${pay.id}_receipt`}
                                    onFile={(file) => uploadFile(file, 'receipt', 'payment', pay.id!)}
                                    compact
                                  />
                                  <FileUploadButton
                                    label="Snapshot (PDF/Image)"
                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                    uploading={uploadingDoc === `payment_${pay.id}_snapshot`}
                                    onFile={(file) => uploadFile(file, 'snapshot', 'payment', pay.id!)}
                                    compact
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Invoice Modal */}
        {cancelModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCancelModal(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Invoice</h3>
                <p className="text-sm text-gray-600 mb-4">Invoice: <span className="font-medium">{cancelModal.invoice_id_code}</span></p>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cancellation Reason <span className="text-red-600">*</span></label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent"
                  placeholder="Enter reason for cancellation..." />
                <div className="flex gap-3 mt-6">
                  <button onClick={handleCancelInvoice} disabled={saving || !cancelReason.trim()}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Cancel Invoice'}
                  </button>
                  <button onClick={() => setCancelModal(null)} className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {paymentModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPaymentModal(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
                <h3 className="text-lg font-semibold text-gray-900">{paymentModal.payment ? 'Edit Payment' : 'Add Payment'}</h3>
                <button onClick={() => setPaymentModal(null)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment Date" required type="date" value={paymentForm.payment_date} onChange={(v) => setPaymentForm({ ...paymentForm, payment_date: v })} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mode of Payment</label>
                    <select value={paymentForm.payment_mode} onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                      className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                      {['cash', 'upi', 'bank_transfer', 'cheque', 'payment_gateway'].map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Paid From</label>
                    <select value={paymentForm.paid_from} onChange={(e) => setPaymentForm({ ...paymentForm, paid_from: e.target.value })}
                      className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                      <option value="company_account">Company Account</option>
                      <option value="personal_account">Personal Account</option>
                    </select>
                  </div>
                  <Field label="Payment Source" value={paymentForm.payment_source} onChange={(v) => setPaymentForm({ ...paymentForm, payment_source: v })} />
                  <Field label="Transaction ID / UTR" value={paymentForm.transaction_id} onChange={(v) => setPaymentForm({ ...paymentForm, transaction_id: v })} />
                  <Field label="Amount Paid" required type="number" value={String(paymentForm.amount_paid)} onChange={(v) => setPaymentForm({ ...paymentForm, amount_paid: Number(v) || 0 })} />
                  <Field label="Receipt Number" value={paymentForm.receipt_number} onChange={(v) => setPaymentForm({ ...paymentForm, receipt_number: v })} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                    <select value={paymentForm.payment_status} onChange={(e) => setPaymentForm({ ...paymentForm, payment_status: e.target.value })}
                      className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                      {['pending', 'successful', 'failed', 'reversed', 'cancelled'].map(s => <option key={s} value={s}>{s.replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Field label="Payment Remark" value={paymentForm.payment_remark} onChange={(v) => setPaymentForm({ ...paymentForm, payment_remark: v })} />
                  </div>
                </div>

                {/* Payment File Uploads */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Payment Documents</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Receipt */}
                    <div className="p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      {pendingReceiptFile ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {pendingReceiptFile.type.startsWith('image/') ? <FileImage className="w-4 h-4 text-[#8c76f0]" /> : <FileText className="w-4 h-4 text-[#8c76f0]" />}
                            <div>
                              <p className="text-xs font-medium text-gray-900">{pendingReceiptFile.name}</p>
                              <p className="text-xs text-gray-500">{(pendingReceiptFile.size / 1024).toFixed(0)} KB</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => setPendingReceiptFile(null)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-1 cursor-pointer py-3">
                          <Paperclip className="w-6 h-6 text-gray-400" />
                          <p className="text-xs text-gray-600">Attach Receipt (PDF/Image)</p>
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 5 * 1024 * 1024) { setMessage({ type: 'error', text: 'File exceeds 5 MB limit' }); return; } setPendingReceiptFile(f); } e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                    {/* Snapshot */}
                    <div className="p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      {pendingSnapshotFile ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {pendingSnapshotFile.type.startsWith('image/') ? <FileImage className="w-4 h-4 text-[#8c76f0]" /> : <FileText className="w-4 h-4 text-[#8c76f0]" />}
                            <div>
                              <p className="text-xs font-medium text-gray-900">{pendingSnapshotFile.name}</p>
                              <p className="text-xs text-gray-500">{(pendingSnapshotFile.size / 1024).toFixed(0)} KB</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => setPendingSnapshotFile(null)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-1 cursor-pointer py-3">
                          <FileImage className="w-6 h-6 text-gray-400" />
                          <p className="text-xs text-gray-600">Attach Snapshot (PDF/Image)</p>
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 5 * 1024 * 1024) { setMessage({ type: 'error', text: 'File exceeds 5 MB limit' }); return; } setPendingSnapshotFile(f); } e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Files will be uploaded automatically after saving the payment.</p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button onClick={handleSavePayment} disabled={saving || !paymentForm.amount_paid}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Payment
                  </button>
                  <button onClick={() => { setPaymentModal(null); setPendingReceiptFile(null); setPendingSnapshotFile(null); }} className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700', submitted: 'bg-blue-100 text-blue-700', approved: 'bg-indigo-100 text-indigo-700',
    partially_paid: 'bg-orange-100 text-orange-700', fully_paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700', cancelled: 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status.replace('_', ' ')}</span>;
}

function PayStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    no_payment: 'bg-gray-100 text-gray-600', pending: 'bg-yellow-100 text-yellow-700',
    partially_paid: 'bg-orange-100 text-orange-700', fully_paid: 'bg-green-100 text-green-700',
  };
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || 'bg-gray-100 text-gray-600'}`}>{status.replace('_', ' ')}</span>;
}

function Field({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label} {required && <span className="text-red-600">*</span>}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent" />
    </div>
  );
}

function TotalBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-2 rounded-lg ${highlight ? 'bg-[#8c76f0] text-white' : 'bg-white'}`}>
      <p className={`text-xs font-medium ${highlight ? 'text-purple-100' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-white' : 'text-gray-900'}`}>₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-700 mt-0.5 capitalize">{value || '—'}</p>
    </div>
  );
}

function FileUploadButton({ label, accept, uploading, onFile, compact }: { label: string; accept: string; uploading: boolean; onFile: (file: File) => void; compact?: boolean }) {
  return (
    <label className={`flex items-center gap-1.5 ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} font-medium text-[#8c76f0] bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
      {label}
      <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}
