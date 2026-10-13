import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Save, AlertCircle, CheckCircle, Loader2, RefreshCw, Power, Clock, IndianRupee } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAdminPermission } from './useAdminPermission';

interface SettlementSetting {
  id: string;
  gateway_name: string;
  on_demand_settlement_enabled: boolean;
  minimum_settlement_amount: number;
  settlement_trigger_minutes: number;
  last_settlement_at: string | null;
  last_settlement_status: string | null;
  last_settlement_amount: number | null;
  gateway_enabled: boolean;
  pending_settlement_amount: number;
  pending_settlement_error: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  initiated: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  settled: 'bg-green-50 text-green-700 border-green-200',
  onhold: 'bg-red-50 text-red-700 border-red-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  not_applicable: 'bg-gray-50 text-gray-600 border-gray-200',
  check_failed: 'bg-amber-50 text-amber-700 border-amber-200',
  below_minimum: 'bg-gray-50 text-gray-600 border-gray-200',
  skipped: 'bg-gray-50 text-gray-600 border-gray-200',
};

function formatStatus(status: string | null): string {
  if (!status) return 'Never run';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

export default function PaymentGatewaySettlement() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId');
  const { loading: permLoading, canEdit } = useAdminPermission('gateway-settlement');

  const [settings, setSettings] = useState<SettlementSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { minimum: string; minutes: string }>>({});

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login');
    }
  }, [adminId, navigate]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const sessionToken = sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-gateway-settlement`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer PBC ${sessionToken || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get', adminId }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSettings(data.settings || []);
        const ev: Record<string, { minimum: string; minutes: string }> = {};
        for (const s of data.settings || []) {
          ev[s.gateway_name] = {
            minimum: String(s.minimum_settlement_amount ?? 0),
            minutes: String(s.settlement_trigger_minutes ?? 60),
          };
        }
        setEditValues(ev);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load settlement settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error while loading settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (gatewayName: string, enabled: boolean) => {
    setSavingId(gatewayName);
    setMessage(null);
    try {
      const sessionToken = sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-gateway-settlement`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer PBC ${sessionToken || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          gateway_name: gatewayName,
          on_demand_settlement_enabled: enabled,
          adminId,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSettings(prev => prev.map(s => s.gateway_name === gatewayName ? { ...s, on_demand_settlement_enabled: enabled } : s));
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update toggle' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error while updating toggle' });
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = async (gatewayName: string) => {
    const ev = editValues[gatewayName];
    if (!ev) return;
    const minAmt = Number(ev.minimum);
    const mins = Number(ev.minutes);
    if (isNaN(minAmt) || minAmt < 0) {
      setMessage({ type: 'error', text: 'Minimum amount must be a valid non-negative number' });
      return;
    }
    if (isNaN(mins) || mins < 1) {
      setMessage({ type: 'error', text: 'Trigger interval must be at least 1 minute' });
      return;
    }

    setSavingId(gatewayName);
    setMessage(null);
    try {
      const sessionToken = sessionStorage.getItem('pbc_admin_session') || localStorage.getItem('pbc_admin_session');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-gateway-settlement`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer PBC ${sessionToken || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          gateway_name: gatewayName,
          minimum_settlement_amount: minAmt,
          settlement_trigger_minutes: mins,
          adminId,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSettings(prev => prev.map(s => s.gateway_name === gatewayName ? {
          ...s,
          minimum_settlement_amount: minAmt,
          settlement_trigger_minutes: Math.round(mins),
        } : s));
        setMessage({ type: 'success', text: `${gatewayName} settlement settings saved` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error while saving' });
    } finally {
      setSavingId(null);
    }
  };

  if (permLoading || loading) {
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
      <div className="max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Gateway Settlement</h1>
          <p className="text-gray-600 mt-1">Configure on-demand settlement for each payment gateway</p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>
              {message.text}
            </p>
          </div>
        )}

        {/* Info banner */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">How On-Demand Settlement Works</p>
              <p className="text-sm text-blue-800 mt-1">
                When enabled, a background job runs every 5 minutes and checks if the pending settlement amount meets your minimum threshold after the configured time interval. If the settlement gateway returns an "on hold" status, all payment options using that gateway are automatically disabled until the issue is resolved.
              </p>
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <div className="mb-6">
          <button
            onClick={fetchSettings}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Gateway cards */}
        <div className="space-y-6">
          {settings.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-gray-300 p-12 text-center text-gray-500">
              No payment gateways found. Configure gateways in Payment Gateway settings first.
            </div>
          )}
          {settings.map((s) => {
            const ev = editValues[s.gateway_name] || { minimum: '0', minutes: '60' };
            const statusColor = STATUS_COLORS[s.last_settlement_status || ''] || 'bg-gray-50 text-gray-600 border-gray-200';
            const isSaving = savingId === s.gateway_name;

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border-2 p-6 transition-shadow hover:shadow-md ${
                  s.on_demand_settlement_enabled ? 'border-[#8c76f0]/30' : 'border-gray-300'
                }`}
              >
                {/* Card header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      s.gateway_enabled ? 'bg-green-50' : 'bg-gray-100'
                    }`}>
                      <Power className={`w-5 h-5 ${s.gateway_enabled ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{s.gateway_name}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          s.gateway_enabled
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {s.gateway_enabled ? 'Gateway Active' : 'Gateway Inactive'}
                        </span>
                        {s.on_demand_settlement_enabled && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#8c76f0]/10 text-[#8c76f0]">
                            On-Demand Enabled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">
                      {s.on_demand_settlement_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => handleToggle(s.gateway_name, !s.on_demand_settlement_enabled)}
                      disabled={!canEdit || isSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        s.on_demand_settlement_enabled ? 'bg-[#8c76f0]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          s.on_demand_settlement_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Card body — settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  {/* Minimum Amount */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                      <IndianRupee className="w-4 h-4" />
                      Minimum Amount for Settlement
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">&#8377;</span>
                      <input
                        type="number"
                        value={ev.minimum}
                        onChange={(e) => setEditValues(prev => ({
                          ...prev,
                          [s.gateway_name]: { ...prev[s.gateway_name], minimum: e.target.value }
                        }))}
                        disabled={!canEdit || isSaving}
                        min="0"
                        step="0.01"
                        className="w-full pl-7 pr-3 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* Trigger Minutes */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4" />
                      Time in Mins to Trigger Settlement
                    </label>
                    <input
                      type="number"
                      value={ev.minutes}
                      onChange={(e) => setEditValues(prev => ({
                        ...prev,
                        [s.gateway_name]: { ...prev[s.gateway_name], minutes: e.target.value }
                      }))}
                      disabled={!canEdit || isSaving}
                      min="1"
                      step="1"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-4 focus:ring-purple-50 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                </div>

                {/* Save button */}
                <div className="pt-6">
                  <button
                    onClick={() => handleSave(s.gateway_name)}
                    disabled={!canEdit || isSaving}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>

                {/* Status row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Pending Settlement</p>
                    {s.pending_settlement_error ? (
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(s.pending_settlement_amount)}</p>
                        <span className="flex items-center gap-0.5 text-xs text-amber-600" title={s.pending_settlement_error}>
                          <AlertCircle className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(s.pending_settlement_amount)}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">Live from gateway API</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Last Settlement Status</p>
                    <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium border ${statusColor}`}>
                      {formatStatus(s.last_settlement_status)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Last Settlement Amount</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(s.last_settlement_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Last Settlement At</p>
                    <p className="text-sm font-semibold text-gray-900">{formatDate(s.last_settlement_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
