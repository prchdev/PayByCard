import { KycStatus } from './types';

const config: Record<KycStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-600' },
  verification_pending: { label: 'Needs Review', className: 'bg-amber-100 text-amber-700' },
  verified: { label: 'Verified', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
};

export default function KycStatusBadge({ status }: { status: KycStatus | undefined | null }) {
  const s = status ?? 'pending';
  const { label, className } = config[s] ?? config.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
