export type KycStatus = 'pending' | 'verification_pending' | 'verified' | 'rejected';

export interface AuditFields {
  uploaded_at: string | null;
  upload_ip: string | null;
  approved_by_admin_id: string | null;
  approval_at: string | null;
  approval_ip: string | null;
}

export interface PanData extends Partial<AuditFields> {
  id?: string;
  pan_number: string;
  pan_photo_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  digilocker_verified?: boolean | null;
  digilocker_provider?: string | null;
}

export interface AddressData extends Partial<AuditFields> {
  id?: string;
  id_number: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  proof_type: 'aadhar' | 'passport' | 'voter_id' | 'driving_license' | '';
  front_photo_url: string | null;
  back_photo_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  digilocker_verified?: boolean | null;
  digilocker_provider?: string | null;
}

export interface BusinessData extends Partial<AuditFields> {
  id?: string;
  company_type: string;
  business_name: string;
  incorporation_number: string;
  business_pan: string;
  gst_number: string;
  business_address: string;
  business_email: string;
  business_phone: string;
  incorporation_certificate_url: string | null;
  company_pan_photo_url: string | null;
  gst_certificate_url: string | null;
  loa_url: string | null;
  moa_url: string | null;
  aoa_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
}

export const COMPANY_TYPES = [
  'Sole Proprietorship',
  'Partnership',
  'Limited Liability Partnership (LLP)',
  'Private Limited Company',
  'One Person Company (OPC)',
  'Public Limited Company',
];

export const COMPANY_TYPES_REQUIRING_INC_CERT = [
  'Limited Liability Partnership (LLP)',
  'Private Limited Company',
  'One Person Company (OPC)',
  'Public Limited Company',
];

export interface UserProfile {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
}

export interface KycAllData {
  pan: PanData | null;
  address: AddressData | null;
  business: BusinessData | null;
  kycCompleted: boolean;
  userProfile: UserProfile | null;
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export const PROOF_TYPES = [
  { value: 'aadhar', label: 'Aadhar Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'driving_license', label: 'Driving License' },
];
