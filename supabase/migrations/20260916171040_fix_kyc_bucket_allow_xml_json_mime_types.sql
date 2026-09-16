-- DigiLocker KYC documents include XML and JSON files (pan_photo.xml,
-- address_front.xml, pan_data.json, aadhaar_data.json). The hardening
-- migration 20260831175100 restricted allowed_mime_types to images and
-- PDF only, which blocked signed-URL downloads of DigiLocker files.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'application/xml',
  'text/xml',
  'application/json'
]
WHERE id = 'kyc-documents';
