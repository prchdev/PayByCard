import React from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { KycStatus } from './types';

interface StatusBadgeProps {
  status: KycStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    pending: { label: 'Not Submitted', icon: AlertCircle, classes: 'bg-gray-100 text-gray-600' },
    verification_pending: { label: 'Verification Pending', icon: Clock, classes: 'bg-amber-100 text-amber-700' },
    verified: { label: 'Verified', icon: CheckCircle, classes: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', icon: XCircle, classes: 'bg-red-100 text-red-700' },
  }[status];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.classes}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}
