import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PermissionState {
  canView: boolean;
  canEdit: boolean;
  loading: boolean;
}

const cache = new Map<string, { canView: boolean; canEdit: boolean; ts: number }>();
const CACHE_TTL = 60_000;

export function useAdminPermission(pageKey: string): PermissionState {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem('adminId') ?? localStorage.getItem('adminId') ?? '';
  const adminRole = sessionStorage.getItem('adminRole') ?? localStorage.getItem('adminRole') ?? '';

  const [state, setState] = useState<PermissionState>({ canView: false, canEdit: false, loading: true });

  useEffect(() => {
    if (!adminId) {
      navigate('/admin/login', { replace: true });
      return;
    }

    // super_admin always has full access — but verify server-side via get-user-permissions
    // Never trust client-stored role alone for authorization decisions.
    if (pageKey === 'dashboard' || pageKey === 'change-password') {
      setState({ canView: true, canEdit: false, loading: false });
      return;
    }

    const cacheKey = `${adminId}:${pageKey}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (!cached.canView) {
        navigate('/admin/dashboard', { replace: true });
        return;
      }
      setState({ canView: cached.canView, canEdit: cached.canEdit, loading: false });
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    fetch(`${supabaseUrl}/functions/v1/get-user-permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminId }),
    })
      .then((r) => r.json())
      .then((data) => {
        const perms: Array<{ page_key: string; can_view: boolean; can_edit: boolean }> =
          data.permissions ?? [];
        const match = perms.find((p) => p.page_key === pageKey);
        const canView = match?.can_view ?? false;
        const canEdit = match?.can_edit ?? false;
        cache.set(cacheKey, { canView, canEdit, ts: Date.now() });
        if (!canView) {
          navigate('/admin/dashboard', { replace: true });
          return;
        }
        setState({ canView, canEdit, loading: false });
      })
      .catch(() => {
        navigate('/admin/dashboard', { replace: true });
      });
  }, [adminId, pageKey]);

  return state;
}
