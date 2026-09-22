export type KycStatus = 'pending' | 'verification_pending' | 'verified' | 'rejected';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
}

export interface UserRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  kyc_completed: boolean;
  created_at: string;
  is_disabled?: boolean;
  is_restricted?: boolean;
}

export interface PanRecord {
  id: string;
  user_id: string;
  pan_number: string | null;
  pan_photo_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  uploaded_at: string | null;
  upload_ip: string | null;
  approved_by_admin_id: string | null;
  approval_at: string | null;
  approval_ip: string | null;
  digilocker_verified: boolean | null;
  digilocker_provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddressRecord {
  id: string;
  user_id: string;
  id_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  proof_type: string | null;
  front_photo_url: string | null;
  back_photo_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  uploaded_at: string | null;
  upload_ip: string | null;
  approved_by_admin_id: string | null;
  approval_at: string | null;
  approval_ip: string | null;
  digilocker_verified: boolean | null;
  digilocker_provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessRecord {
  id: string;
  user_id: string;
  company_type: string | null;
  business_name: string | null;
  incorporation_number: string | null;
  business_pan: string | null;
  gst_number: string | null;
  business_address: string | null;
  business_email: string | null;
  business_phone: string | null;
  incorporation_certificate_url: string | null;
  company_pan_photo_url: string | null;
  gst_certificate_url: string | null;
  loa_url: string | null;
  moa_url: string | null;
  aoa_url: string | null;
  business_category_surge_charge: number;
  status: KycStatus;
  rejection_reason: string | null;
  uploaded_at: string | null;
  upload_ip: string | null;
  approved_by_admin_id: string | null;
  approval_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KycUserEntry {
  user: UserRecord;
  pan: PanRecord | null;
  address: AddressRecord | null;
  business: BusinessRecord | null;
  invoice_status?: string | null;
  bill_file_url?: string | null;
  payment_reference?: string | null;
}
