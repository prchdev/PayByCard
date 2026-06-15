import { useState, useCallback } from 'react';
import { KycUserEntry } from './types';

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export function useAdminKyc(adminId: string) {
  const [entries, setEntries] = useState<KycUserEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async (statusFilter = 'all') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin-get-kyc-list`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ adminId, statusFilter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setEntries(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  const reviewKyc = useCallback(async (
    recordId: string,
    table: string,
    action: 'verified' | 'rejected',
    rejectionReason?: string,
    businessCategorySurgeCharge?: number
  ) => {
    const res = await fetch(`${BASE}/admin-review-kyc`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ adminId, recordId, table, action, rejectionReason, businessCategorySurgeCharge }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Review failed');
    return data;
  }, [adminId]);

  return { entries, loading, error, fetchList, reviewKyc };
}
