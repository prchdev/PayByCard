import { useState, useEffect, useCallback } from 'react';
import { KycAllData } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const headers = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export function useKycData(userId: string | null) {
  const [kycData, setKycData] = useState<KycAllData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKycData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-kyc-data`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch KYC data');
      setKycData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-kyc-data`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch KYC data');
      setKycData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [userId]);

  useEffect(() => { fetchKycData(); }, [fetchKycData]);

  return { kycData, loading, error, refetch: fetchKycData, refresh };
}

export async function uploadKycFile(
  file: File,
  userId: string,
  fileKey: string
): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`File "${file.name}" exceeds the 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  formData.append('fileKey', fileKey);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-kyc-file`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-pbc-session': sessionStorage.getItem('pbc_session') || '',
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

export async function saveKycSection(
  userId: string,
  section: 'pan' | 'address' | 'business',
  data: Record<string, unknown>,
  ipAddress?: string | null
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/save-kyc-data`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, section, data, ipAddress }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Save failed');
}
