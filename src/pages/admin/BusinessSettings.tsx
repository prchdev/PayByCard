import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Eye, Download, X, Save, ToggleLeft, ToggleRight, Loader2, Building, Phone, Mail, MapPin, FileText, Wallet, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface BusinessUser {
  user_id: string;
  business_name: string;
  company_type: string;
  gst_number: string;
  business_pan: string;
  business_address: string;
  business_email: string;
  business_phone: string;
  kyc_status: string;
  kyc_date: string;
  email: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  mobile_number: string;
  user_created_at: string;
}

interface BusinessDetails {
  business: any;
  user: any;
  settings: any;
}

interface PayoutRow {
  id: string;
  payout_reference: string;
  amount: number;
  charges: number;
  gst: number;
  net_amount: number;
  total_deduction: number;
  status: string;
  utr_number: string;
  gateway_transaction_id: string;
  transfer_type: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  bank_name: string;
  created_at: string;
  completed_at: string;
  payout_date: string;
  instant_settlement: boolean;
  payout_type: string;
  payment_id: string;
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

export default function BusinessSettings() {
  const navigate = useNavigate();
  const { loading: permLoading, canEdit } = useAdminPermission('business-settings');
  const canEditBool = canEdit;
  const adminId = localStorage.getItem('adminId');

  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<BusinessUser | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!adminId) { navigate('/admin/login'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-business-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({ admin_id: adminId, action: 'list' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load business users'); return; }
      setUsers(data.users || []);
    } catch {
      setError('Failed to load business users');
    } finally {
      setLoading(false);
    }
  }, [adminId, navigate]);

  useEffect(() => {
    if (permLoading) return;
    fetchUsers();
  }, [permLoading, fetchUsers]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      (u.business_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.gst_number || '').toLowerCase().includes(q) ||
      (u.business_pan || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleView = (user: BusinessUser) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  if (permLoading) return null;

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Building2 className="w-7 h-7 text-[#8c76f0]" />
          Business Settings
        </h1>
        <p className="text-gray-600 text-sm mt-1">Manage business KYCed users, enable services, and view payouts</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-purple-100 rounded-xl p-3"><Building2 className="w-6 h-6 text-[#8c76f0]" /></div>
          <div><p className="text-2xl font-bold text-gray-900">{users.length}</p><p className="text-xs text-gray-500">Total Business Users</p></div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-green-100 rounded-xl p-3"><Building className="w-6 h-6 text-green-600" /></div>
          <div><p className="text-2xl font-bold text-gray-900">{filteredUsers.length}</p><p className="text-xs text-gray-500">Filtered Results</p></div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-blue-100 rounded-xl p-3"><FileText className="w-6 h-6 text-blue-600" /></div>
          <div><p className="text-2xl font-bold text-gray-900">Verified</p><p className="text-xs text-gray-500">KYC Completed</p></div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {/* Search bar */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name, email, GST, PAN..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-300 focus:border-[#8c76f0] focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#8c76f0]" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No business users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Contact Person</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Company Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">GST / PAN</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleView(u)}
                        className="text-sm font-semibold text-[#8c76f0] hover:underline text-left"
                      >
                        {u.business_name || 'N/A'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.email || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.company_type || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div>{u.gst_number || '-'}</div>
                      <div className="text-xs text-gray-400">{u.business_pan || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleView(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 text-[#8c76f0] hover:bg-purple-100 transition-colors text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && selectedUser && (
        <BusinessSettingsModal
          user={selectedUser}
          adminId={adminId!}
          canEdit={canEditBool}
          onClose={() => { setShowModal(false); setSelectedUser(null); }}
        />
      )}
    </AdminLayout>
  );
}

type TabKey = 'company' | 'services' | 'payouts';

function BusinessSettingsModal({
  user, adminId, canEdit, onClose,
}: {
  user: BusinessUser;
  adminId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('company');
  const [details, setDetails] = useState<BusinessDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const fetchDetails = useCallback(async () => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-business-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({ admin_id: adminId, action: 'get_details', user_id: user.user_id }),
      });
      const data = await res.json();
      if (res.ok) { setDetails(data); }
    } catch { /* ignore */ } finally {
      setLoadingDetails(false);
    }
  }, [adminId, user.user_id]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'company', label: 'Company Details', icon: Building },
    { key: 'services', label: 'Enable Services', icon: ToggleLeft },
    { key: 'payouts', label: 'Payouts', icon: Wallet },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#8c76f0] to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">{user.business_name || 'Business Settings'}</h2>
              <p className="text-purple-100 text-xs">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  active ? 'border-[#8c76f0] text-[#8c76f0]' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#8c76f0]" />
            </div>
          ) : activeTab === 'company' ? (
            <CompanyTab user={user} details={details} adminId={adminId} canEdit={canEdit} onSaved={fetchDetails} />
          ) : activeTab === 'services' ? (
            <ServicesTab user={user} details={details} adminId={adminId} canEdit={canEdit} onSaved={fetchDetails} />
          ) : (
            <PayoutsTab user={user} adminId={adminId} />
          )}
        </div>
      </div>
    </div>
  );
}

function CompanyTab({
  user, details, adminId, canEdit, onSaved,
}: {
  user: BusinessUser;
  details: BusinessDetails | null;
  adminId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const business = details?.business;
  const contactUser = details?.user;
  const settings = details?.settings;

  const [bankForm, setBankForm] = useState({
    account_holder_name: settings?.account_holder_name || '',
    ifsc_code: settings?.ifsc_code || '',
    account_number: settings?.account_number || '',
    account_type: settings?.account_type || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setBankForm({
      account_holder_name: settings?.account_holder_name || '',
      ifsc_code: settings?.ifsc_code || '',
      account_number: settings?.account_number || '',
      account_type: settings?.account_type || '',
    });
  }, [settings]);

  const handleSaveBank = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-business-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({ admin_id: adminId, action: 'save_bank_details', user_id: user.user_id, ...bankForm }),
      });
      const data = await res.json();
      if (res.ok) { setMsg('Bank details saved successfully'); onSaved(); }
      else { setMsg(data.error || 'Failed to save'); }
    } catch { setMsg('Failed to save'); } finally { setSaving(false); }
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Company Details */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Company Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoRow icon={Building} label="Business Name" value={business?.business_name || user.business_name} />
          <InfoRow icon={FileText} label="Company Type" value={business?.company_type || user.company_type} />
          <InfoRow icon={FileText} label="GST Number" value={business?.gst_number || user.gst_number} />
          <InfoRow icon={FileText} label="Business PAN" value={business?.business_pan || user.business_pan} />
          <InfoRow icon={Mail} label="Business Email" value={business?.business_email || user.business_email} />
          <InfoRow icon={Phone} label="Business Phone" value={business?.business_phone || user.business_phone} />
          <div className="sm:col-span-2">
            <InfoRow icon={MapPin} label="Business Address" value={business?.business_address || user.business_address} />
          </div>
        </div>
      </div>

      {/* Contact Person */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Contact Person (KYC Submitted By)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoRow icon={FileText} label="Full Name" value={contactUser?.full_name || `${contactUser?.first_name || ''} ${contactUser?.middle_name || ''} ${contactUser?.last_name || ''}`.trim()} />
          <InfoRow icon={Mail} label="Email" value={contactUser?.email} />
          <InfoRow icon={Phone} label="Mobile" value={contactUser?.mobile_number} />
          <InfoRow icon={FileText} label="KYC Completed" value={contactUser?.kyc_completed ? 'Yes' : 'No'} />
        </div>
      </div>

      {/* Company Bank Details */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Company Bank Details</h3>
        <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Account Holder Name" value={bankForm.account_holder_name} onChange={(v) => setBankForm({ ...bankForm, account_holder_name: v })} disabled={!canEdit || saving} />
            <FormField label="IFSC Code" value={bankForm.ifsc_code} onChange={(v) => setBankForm({ ...bankForm, ifsc_code: v.toUpperCase() })} disabled={!canEdit || saving} />
            <FormField label="Account Number" value={bankForm.account_number} onChange={(v) => setBankForm({ ...bankForm, account_number: v })} disabled={!canEdit || saving} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type of Account</label>
              <select
                value={bankForm.account_type}
                onChange={(e) => setBankForm({ ...bankForm, account_type: e.target.value })}
                disabled={!canEdit || saving}
                className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-[#8c76f0] focus:outline-none text-sm disabled:bg-gray-100"
              >
                <option value="">Select type</option>
                <option value="savings">Savings</option>
                <option value="current">Current</option>
                <option value="nri">NRI</option>
                <option value="nre">NRE</option>
                <option value="nro">NRO</option>
              </select>
            </div>
          </div>
          {msg && (
            <div className={`mt-3 text-sm rounded-lg p-2 ${msg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>
          )}
          {canEdit && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveBank}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Bank Details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServicesTab({
  user, details, adminId, canEdit, onSaved,
}: {
  user: BusinessUser;
  details: BusinessDetails | null;
  adminId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const settings = details?.settings;

  const [form, setForm] = useState({
    payout_enabled: settings?.payout_enabled || false,
    min_transaction_amount: settings?.min_transaction_amount?.toString() || '0',
    max_transaction_amount: settings?.max_transaction_amount?.toString() || '0',
    charges_percentage: settings?.charges_percentage?.toString() || '0',
    min_charges_inr: settings?.min_charges_inr?.toString() || '0',
    max_charges_inr: settings?.max_charges_inr?.toString() || '0',
    gst_percentage: settings?.gst_percentage?.toString() || '0',
    charges_deduction_mode: settings?.charges_deduction_mode || 'additional',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setForm({
      payout_enabled: settings?.payout_enabled || false,
      min_transaction_amount: settings?.min_transaction_amount?.toString() || '0',
      max_transaction_amount: settings?.max_transaction_amount?.toString() || '0',
      charges_percentage: settings?.charges_percentage?.toString() || '0',
      min_charges_inr: settings?.min_charges_inr?.toString() || '0',
      max_charges_inr: settings?.max_charges_inr?.toString() || '0',
      gst_percentage: settings?.gst_percentage?.toString() || '0',
      charges_deduction_mode: settings?.charges_deduction_mode || 'additional',
    });
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-business-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({ admin_id: adminId, action: 'save_services', user_id: user.user_id, ...form }),
      });
      const data = await res.json();
      if (res.ok) { setMsg('Service settings saved successfully'); onSaved(); }
      else { setMsg(data.error || 'Failed to save'); }
    } catch { setMsg('Failed to save'); } finally { setSaving(false); }
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Payout Services */}
      <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#8c76f0]" /> Payout Services
        </h3>

        {/* Toggle */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200">
          <div>
            <p className="text-sm font-medium text-gray-800">Enable Payout Service</p>
            <p className="text-xs text-gray-500">Allow this business to use payout functionality</p>
          </div>
          <button
            onClick={() => canEdit && setForm({ ...form, payout_enabled: !form.payout_enabled })}
            disabled={!canEdit || saving}
            className="flex items-center gap-2"
          >
            {form.payout_enabled ? (
              <ToggleRight className="w-12 h-12 text-green-500" />
            ) : (
              <ToggleLeft className="w-12 h-12 text-gray-400" />
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Minimum Allowed Transaction Amount (INR)" value={form.min_transaction_amount} onChange={(v) => setForm({ ...form, min_transaction_amount: v })} disabled={!canEdit || saving} type="number" />
          <FormField label="Maximum Allowed Transaction Amount (INR)" value={form.max_transaction_amount} onChange={(v) => setForm({ ...form, max_transaction_amount: v })} disabled={!canEdit || saving} type="number" />
          <FormField label="Charges in Percentage (%)" value={form.charges_percentage} onChange={(v) => setForm({ ...form, charges_percentage: v })} disabled={!canEdit || saving} type="number" />
          <FormField label="GST (%)" value={form.gst_percentage} onChange={(v) => setForm({ ...form, gst_percentage: v })} disabled={!canEdit || saving} type="number" />
          <FormField label="Minimum Charges in INR" value={form.min_charges_inr} onChange={(v) => setForm({ ...form, min_charges_inr: v })} disabled={!canEdit || saving} type="number" />
          <FormField label="Maximum Charges in INR" value={form.max_charges_inr} onChange={(v) => setForm({ ...form, max_charges_inr: v })} disabled={!canEdit || saving} type="number" />
        </div>

        {/* Deduction Mode Radio */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Charges Deduction Mode</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-colors text-sm ${form.charges_deduction_mode === 'from_amount' ? 'border-[#8c76f0] bg-purple-50 text-[#8c76f0]' : 'border-gray-300 text-gray-600'}`}>
              <input
                type="radio"
                name="deduction_mode"
                value="from_amount"
                checked={form.charges_deduction_mode === 'from_amount'}
                onChange={(e) => setForm({ ...form, charges_deduction_mode: e.target.value })}
                disabled={!canEdit || saving}
                className="accent-[#8c76f0]"
              />
              Deduct Charges from Amount
            </label>
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-colors text-sm ${form.charges_deduction_mode === 'additional' ? 'border-[#8c76f0] bg-purple-50 text-[#8c76f0]' : 'border-gray-300 text-gray-600'}`}>
              <input
                type="radio"
                name="deduction_mode"
                value="additional"
                checked={form.charges_deduction_mode === 'additional'}
                onChange={(e) => setForm({ ...form, charges_deduction_mode: e.target.value })}
                disabled={!canEdit || saving}
                className="accent-[#8c76f0]"
              />
              Deduct Charges Additionally
            </label>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`text-sm rounded-lg p-3 ${msg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Service Settings
          </button>
        </div>
      )}
    </div>
  );
}

function PayoutsTab({ user, adminId }: { user: BusinessUser; adminId: string }) {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-business-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({
          admin_id: adminId, action: 'get_payouts', user_id: user.user_id,
          page, per_page: perPage,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) { setPayouts(data.payouts || []); setTotal(data.total || 0); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [adminId, user.user_id, page, perPage, dateFrom, dateTo]);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  const totalPages = Math.ceil(total / perPage);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-business-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-pbc-admin-session': sessionStorage.getItem('pbc_admin_session') || '',
        },
        body: JSON.stringify({
          admin_id: adminId, action: 'export_payouts_csv', user_id: user.user_id,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.csv) {
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payouts_${user.business_name || user.user_id}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ } finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-[#8c76f0] focus:outline-none text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-[#8c76f0] focus:outline-none text-sm" />
        </div>
        <div className="flex gap-2">
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }} className="px-3 py-2 rounded-lg border-2 border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Clear</button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#8c76f0]" />
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">No payouts found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600">Reference</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600">Date</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600">Amount</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600">Charges</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600">Net</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600">UTR / Order ID</th>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-800">{p.payout_reference}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-gray-800">{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-gray-600">{Number(p.charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-xs text-right font-medium text-gray-800">{Number(p.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{p.utr_number || p.gateway_transaction_id || '-'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total}</span>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="px-2 py-1 rounded-lg border border-gray-300 text-xs">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-30 hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages || 1}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-30 hover:bg-gray-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-800 truncate">{value || 'N/A'}</p>
      </div>
    </div>
  );
}

function FormField({
  label, value, onChange, disabled, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-[#8c76f0] focus:outline-none text-sm disabled:bg-gray-100"
      />
    </div>
  );
}
