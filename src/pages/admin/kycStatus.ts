import { KycUserEntry, KycStatus } from './types';

export function hasBusinessDocs(entry: KycUserEntry): boolean {
  return Boolean(
    entry.business?.incorporation_certificate_url ||
    entry.business?.company_pan_photo_url ||
    entry.business?.gst_certificate_url ||
    entry.business?.loa_url
  );
}

export function getOverallStatus(entry: KycUserEntry): KycStatus {
  const panStatus = entry.pan?.status;
  const addressStatus = entry.address?.status;
  const businessStatus = entry.business?.status;

  if (!panStatus || !addressStatus) return 'pending';

  if (panStatus === 'rejected' || addressStatus === 'rejected') return 'rejected';

  const hasDocs = hasBusinessDocs(entry);
  if (hasDocs && businessStatus === 'rejected') return 'rejected';

  if (panStatus === 'verification_pending' || addressStatus === 'verification_pending') {
    return 'verification_pending';
  }

  if (hasDocs && businessStatus === 'verification_pending') {
    return 'verification_pending';
  }

  if (panStatus === 'verified' && addressStatus === 'verified') {
    if (hasDocs) {
      return businessStatus === 'verified' ? 'verified' : 'verification_pending';
    }
    return 'verified';
  }

  return 'pending';
}
