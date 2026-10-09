import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Save, X, AlertCircle, CheckCircle, Loader2, Pencil,
  Search, Download, Eye, Ban, CheckSquare, XCircle, RotateCcw, FileText,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';
import { downloadCsv } from '../../utils/csvExport';
import { useTableSort, SortableTh } from './TableSort';

interface Vendor {
  id: string;
  vendor_code: string;
  legal_name: string;
  trade_name: string | null;
  contact_person: string | null;
  address: string | null;
  country: string;
  email: string | null;
  phone: string | null;
  domestic_or_international: string;
  registration_status: string;
  registration_type: string | null;
  cin_number: string | null;
  pan_number: string | null;
  gst_number: string | null;
  gst_registration_state: string | null;
  bank_account_holder: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_account_type: string | null;
  payment_terms: string | null;
  expense_category: string | null;
  additional_remark: string | null;
  status: string;
  status_reason: string | null;
  created_at: string;
}

interface VendorForm {
  id?: string;
  legal_name: string;
  trade_name: string;
  contact_person: string;
  address: string;
  country: string;
  email: string;
  phone: string;
  domestic_or_international: string;
  registration_status: string;
  registration_type: string;
  cin_number: string;
  pan_number: string;
  gst_number: string;
  gst_registration_state: string;
  bank_account_holder: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_account_type: string;
  payment_terms: string;
  expense_category: string;
  additional_remark: string;
}

const EMPTY_FORM: VendorForm = {
  legal_name: '', trade_name: '', contact_person: '', address: '', country: 'India',
  email: '', phone: '', domestic_or_international: 'domestic', registration_status: 'registered',
  registration_type: '', cin_number: '', pan_number: '', gst_number: '', gst_registration_state: '',
  bank_account_holder: '', bank_name: '', bank_account_number: '', bank_ifsc: '', bank_account_type: '',
  payment_terms: '', expense_category: '', additional_remark: '',
};

const REG_TYPES = [
  { v: 'sole_proprietorship', l: 'Sole Proprietorship' },
  { v: 'partnership', l: 'Partnership Firm' },
  { v: 'llp', l: 'Limited Liability Partnership (LLP)' },
  { v: 'private_limited', l: 'Private Limited Company' },
  { v: 'public_limited', l: 'Public Limited Company' },
];

const ACCOUNT_TYPES = [
  { v: 'current_account', l: 'Current Account' },
  { v: 'savings_account', l: 'Savings Account' },
];
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function VendorManagement() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('vendor-management');

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<VendorForm>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [regFilter, setRegFilter] = useState('');
  const [domesticFilter, setDomesticFilter] = useState('');
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const [statusModal, setStatusModal] = useState<{ vendor: Vendor; action: string } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  useEffect(() => {
    if (!adminId) navigate('/admin/login');
  }, [adminId, navigate]);

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-get-vendors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          search: searchTerm,
          status: statusFilter,
          registrationStatus: regFilter,
          domesticOrInternational: domesticFilter,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch vendors');
      setVendors(data.vendors || []);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load vendors' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.legal_name.trim()) {
      setMessage({ type: 'error', text: 'Legal name is required' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-save-vendor`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, ...formData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save vendor');
      setMessage({ type: 'success', text: formData.id ? 'Vendor updated successfully' : 'Vendor created successfully' });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      fetchVendors();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save vendor' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (v: Vendor) => {
    setFormData({
      id: v.id, legal_name: v.legal_name, trade_name: v.trade_name || '', contact_person: v.contact_person || '',
      address: v.address || '', country: v.country, email: v.email || '', phone: v.phone || '',
      domestic_or_international: v.domestic_or_international, registration_status: v.registration_status,
      registration_type: v.registration_type || '', cin_number: v.cin_number || '', pan_number: v.pan_number || '',
      gst_number: v.gst_number || '', gst_registration_state: v.gst_registration_state || '',
      bank_account_holder: v.bank_account_holder || '', bank_name: v.bank_name || '',
      bank_account_number: v.bank_account_number || '', bank_ifsc: v.bank_ifsc || '',
      bank_account_type: v.bank_account_type || '', payment_terms: v.payment_terms || '',
      expense_category: v.expense_category || '', additional_remark: v.additional_remark || '',
    });
    setShowForm(true);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusChange = async () => {
    if (!statusModal) return;
    setSaving(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-save-vendor`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId, id: statusModal.vendor.id, action: 'status_change',
          newStatus: statusModal.action, reason: statusReason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update status');
      setMessage({ type: 'success', text: `Vendor status updated to ${statusModal.action}` });
      setStatusModal(null);
      setStatusReason('');
      fetchVendors();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update status' });
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm(''); setStatusFilter(''); setRegFilter(''); setDomesticFilter('');
    fetchVendors();
  };

  const { sortedData, sortConfig, handleSort } = useTableSort<Vendor>(vendors, (v, key) => {
    switch (key) {
      case 'vendorCode': return v.vendor_code;
      case 'name': return v.legal_name;
      case 'type': return v.domestic_or_international;
      case 'registration': return v.registration_status;
      case 'di': return v.domestic_or_international;
      case 'gst': return v.gst_number;
      case 'pan': return v.pan_number;
      case 'phone': return v.phone;
      case 'status': return v.status;
      case 'created': return new Date(v.created_at).getTime();
      default: return null;
    }
  });
  const totalPages = Math.ceil(sortedData.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedVendors = sortedData.slice(startIndex, endIndex);
  useEffect(() => { setCurrentPage(1); }, [vendors, recordsPerPage]);

  const exportVendors = (all: boolean) => {
    const data = all ? vendors : vendors.filter(v =>
      (!searchTerm || v.legal_name.toLowerCase().includes(searchTerm.toLowerCase()) || v.vendor_code.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!statusFilter || v.status === statusFilter) &&
      (!regFilter || v.registration_status === regFilter) &&
      (!domesticFilter || v.domestic_or_international === domesticFilter)
    );
    const headers = ['Vendor Code', 'Legal Name', 'Trade Name', 'Contact Person', 'Email', 'Phone', 'Type', 'Registration', 'GST', 'PAN', 'Status', 'Created Date'];
    const rows = data.map(v => [
      v.vendor_code, v.legal_name, v.trade_name || '', v.contact_person || '', v.email || '', v.phone || '',
      v.domestic_or_international, v.registration_status, v.gst_number || '', v.pan_number || '',
      v.status, new Date(v.created_at).toLocaleDateString('en-IN'),
    ]);
    downloadCsv('vendors.csv', headers, rows);
  };

  if (permLoading) return null;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendor Management</h1>
            <p className="text-gray-600 mt-1">Manage vendors, documents, and status</p>
          </div>
          {!showForm && canEdit && (
            <button onClick={() => { setFormData(EMPTY_FORM); setShowForm(true); setMessage(null); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-5 h-5" /> Add Vendor
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
                  <Building2 className="w-5 h-5 text-[#8c76f0]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{formData.id ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              </div>
              <button type="button" onClick={() => { setShowForm(false); setFormData(EMPTY_FORM); }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Basic Details */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Basic Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Legal Name" required value={formData.legal_name} onChange={(v) => setFormData({ ...formData, legal_name: v })} />
                <Field label="Trade / Display Name" value={formData.trade_name} onChange={(v) => setFormData({ ...formData, trade_name: v })} />
                <Field label="Contact Person" value={formData.contact_person} onChange={(v) => setFormData({ ...formData, contact_person: v })} />
                <Field label="Address" textarea value={formData.address} onChange={(v) => setFormData({ ...formData, address: v })} />
                <Field label="Country" value={formData.country} onChange={(v) => setFormData({ ...formData, country: v })} />
                <Field label="Email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} />
                <Field label="Phone" value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Domestic / International</label>
                  <div className="flex gap-4">
                    {[{ v: 'domestic', l: 'Domestic' }, { v: 'international', l: 'International' }].map(opt => (
                      <label key={opt.v} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="domestic" checked={formData.domestic_or_international === opt.v}
                          onChange={() => setFormData({ ...formData, domestic_or_international: opt.v })}
                          className="w-4 h-4 text-[#8c76f0]" />
                        <span className="text-sm text-gray-700">{opt.l}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <SelectField label="Registration Status" value={formData.registration_status}
                  options={[{ v: 'registered', l: 'Registered' }, { v: 'non_registered', l: 'Non-Registered' }]}
                  onChange={(v) => setFormData({ ...formData, registration_status: v })} />
                <SelectField label="Registration Type" value={formData.registration_type}
                  options={REG_TYPES}
                  onChange={(v) => setFormData({ ...formData, registration_type: v })} />
                <Field label="CIN Number" value={formData.cin_number} onChange={(v) => setFormData({ ...formData, cin_number: v })} />
                <Field label="PAN / Tax Number" value={formData.pan_number} onChange={(v) => setFormData({ ...formData, pan_number: v })} />
                <Field label="GST Number" value={formData.gst_number} onChange={(v) => setFormData({ ...formData, gst_number: v })} />
                <Field label="GST Registration State" value={formData.gst_registration_state} onChange={(v) => setFormData({ ...formData, gst_registration_state: v })} />
              </div>
            </div>

            {/* Bank Details */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Bank Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Account Holder Name" value={formData.bank_account_holder} onChange={(v) => setFormData({ ...formData, bank_account_holder: v })} />
                <Field label="Bank Name" value={formData.bank_name} onChange={(v) => setFormData({ ...formData, bank_name: v })} />
                <Field label="Account Number" value={formData.bank_account_number} onChange={(v) => setFormData({ ...formData, bank_account_number: v })} />
                <Field label="IFSC" value={formData.bank_ifsc} onChange={(v) => setFormData({ ...formData, bank_ifsc: v })} />
                <SelectField label="Account Type" value={formData.bank_account_type} options={ACCOUNT_TYPES} onChange={(v) => setFormData({ ...formData, bank_account_type: v })} />
              </div>
            </div>

            {/* Commercial Details */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Commercial Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Payment Terms" value={formData.payment_terms} onChange={(v) => setFormData({ ...formData, payment_terms: v })} />
                <Field label="Expense Category" value={formData.expense_category} onChange={(v) => setFormData({ ...formData, expense_category: v })} />
                <Field label="Additional Remark" value={formData.additional_remark} onChange={(v) => setFormData({ ...formData, additional_remark: v })} />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {formData.id ? 'Update Vendor' : 'Create Vendor'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormData(EMPTY_FORM); }}
                className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Search & Filters */}
        {!showForm && (
          <>
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search name, code, GST, PAN..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
                <select value={regFilter} onChange={(e) => setRegFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                  <option value="">All Registration</option>
                  <option value="registered">Registered</option>
                  <option value="non_registered">Non-Registered</option>
                </select>
                <select value={domesticFilter} onChange={(e) => setDomesticFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0]">
                  <option value="">All Types</option>
                  <option value="domestic">Domestic</option>
                  <option value="international">International</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={fetchVendors} className="flex-1 px-3 py-2 bg-[#8c76f0] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Search</button>
                  <button onClick={resetFilters} className="px-3 py-2 text-gray-700 bg-gray-100 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => exportVendors(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#8c76f0] bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export Filtered
                </button>
                <button onClick={() => exportVendors(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export All
                </button>
              </div>
            </div>

            {/* Vendor Table */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <SortableTh label="Vendor Code" sortKey="vendorCode" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="Name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="Type" sortKey="type" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="Registration" sortKey="registration" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="D/I" sortKey="di" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="GST" sortKey="gst" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="PAN" sortKey="pan" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="Phone" sortKey="phone" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <SortableTh label="Created" sortKey="created" sortConfig={sortConfig} onSort={handleSort} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap" />
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vendors.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">No vendors found</td></tr>
                    ) : paginatedVendors.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-gray-700 whitespace-nowrap">{v.vendor_code}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.legal_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">{v.domestic_or_international}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">{v.registration_status.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{v.domestic_or_international === 'domestic' ? 'D' : 'I'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">{v.gst_number || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">{v.pan_number || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{v.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(v.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewVendor(v)} className="p-1.5 text-gray-500 hover:text-[#8c76f0] hover:bg-purple-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                            {canEdit && <button onClick={() => handleEdit(v)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>}
                            {canEdit && v.status === 'active' && (
                              <button onClick={() => { setStatusModal({ vendor: v, action: 'disabled' }); setStatusReason(''); }} className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Disable"><Ban className="w-4 h-4" /></button>
                            )}
                            {canEdit && v.status === 'disabled' && (
                              <button onClick={() => { setStatusModal({ vendor: v, action: 'active' }); setStatusReason(''); }} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Enable"><CheckSquare className="w-4 h-4" /></button>
                            )}
                            {canEdit && v.status !== 'blacklisted' && (
                              <button onClick={() => { setStatusModal({ vendor: v, action: 'blacklisted' }); setStatusReason(''); }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Blacklist"><XCircle className="w-4 h-4" /></button>
                            )}
                            {canEdit && v.status === 'blacklisted' && (
                              <button onClick={() => { setStatusModal({ vendor: v, action: 'active' }); setStatusReason(''); }} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Remove Blacklist"><CheckSquare className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {vendors.length > 0 && (
                <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>Show</span>
                    <select
                      value={recordsPerPage}
                      onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8c76f0]"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span>records per page</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 mr-2">
                      Showing {startIndex + 1}-{Math.min(endIndex, vendors.length)} of {vendors.length}
                    </span>
                    {totalPages > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white border-[#8c76f0]'
                                  : 'border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* View Vendor Modal */}
        {viewVendor && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewVendor(null)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#8c76f0]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{viewVendor.legal_name}</h2>
                    <p className="text-xs text-gray-500 font-mono">{viewVendor.vendor_code}</p>
                  </div>
                </div>
                <button onClick={() => setViewVendor(null)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6">
                <DetailSection title="Basic Details">
                  <DetailRow label="Trade Name" value={viewVendor.trade_name} />
                  <DetailRow label="Contact Person" value={viewVendor.contact_person} />
                  <DetailRow label="Address" value={viewVendor.address} />
                  <DetailRow label="Country" value={viewVendor.country} />
                  <DetailRow label="Email" value={viewVendor.email} />
                  <DetailRow label="Phone" value={viewVendor.phone} />
                  <DetailRow label="Type" value={viewVendor.domestic_or_international === 'domestic' ? 'Domestic' : 'International'} />
                  <DetailRow label="Registration" value={viewVendor.registration_status === 'registered' ? 'Registered' : 'Non-Registered'} />
                  <DetailRow label="Registration Type" value={REG_TYPES.find(r => r.v === viewVendor.registration_type)?.l} />
                  <DetailRow label="CIN" value={viewVendor.cin_number} />
                  <DetailRow label="PAN" value={viewVendor.pan_number} />
                  <DetailRow label="GST" value={viewVendor.gst_number} />
                  <DetailRow label="GST State" value={viewVendor.gst_registration_state} />
                </DetailSection>
                <DetailSection title="Bank Details">
                  <DetailRow label="Account Holder" value={viewVendor.bank_account_holder} />
                  <DetailRow label="Bank Name" value={viewVendor.bank_name} />
                  <DetailRow label="Account Number" value={viewVendor.bank_account_number} />
                  <DetailRow label="IFSC" value={viewVendor.bank_ifsc} />
                  <DetailRow label="Account Type" value={viewVendor.bank_account_type} />
                </DetailSection>
                <DetailSection title="Commercial Details">
                  <DetailRow label="Payment Terms" value={viewVendor.payment_terms} />
                  <DetailRow label="Expense Category" value={viewVendor.expense_category} />
                  <DetailRow label="Additional Remark" value={viewVendor.additional_remark} />
                  <DetailRow label="Status" value={viewVendor.status} />
                  {viewVendor.status_reason && <DetailRow label="Status Reason" value={viewVendor.status_reason} />}
                </DetailSection>
              </div>
            </div>
          </div>
        )}

        {/* Status Change Modal */}
        {statusModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setStatusModal(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {statusModal.action === 'blacklisted' ? 'Blacklist' : statusModal.action === 'disabled' ? 'Disable' : 'Enable'} Vendor
                </h3>
                <p className="text-sm text-gray-600 mb-4">Vendor: <span className="font-medium">{statusModal.vendor.legal_name}</span></p>
                {(statusModal.action === 'disabled' || statusModal.action === 'blacklisted') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason <span className="text-red-600">*</span></label>
                    <textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} rows={3}
                      className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent"
                      placeholder="Enter reason for this action..." />
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  <button onClick={handleStatusChange} disabled={saving || ((statusModal.action === 'disabled' || statusModal.action === 'blacklisted') && !statusReason.trim())}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirm'}
                  </button>
                  <button onClick={() => setStatusModal(null)} className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors">Cancel</button>
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
    active: 'bg-green-100 text-green-700',
    disabled: 'bg-orange-100 text-orange-700',
    blacklisted: 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
}

function Field({ label, value, onChange, required, textarea }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; textarea?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label} {required && <span className="text-red-600">*</span>}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent" />
      )}
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8c76f0] focus:border-transparent">
        <option value="">Select...</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-700 mt-0.5">{value || '—'}</p>
    </div>
  );
}
