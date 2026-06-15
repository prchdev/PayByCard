import React from 'react';

interface AuditInfoProps {
  uploadedAt?: string | null;
  uploadIp?: string | null;
  approvedByAdminId?: string | null;
  approvalAt?: string | null;
  approvalIp?: string | null;
}

export default function AuditInfo({ uploadedAt, uploadIp, approvedByAdminId, approvalAt, approvalIp }: AuditInfoProps) {
  return null;
}
