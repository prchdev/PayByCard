-- Add file size limits and MIME type allowlists to finance storage buckets
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/webp','application/pdf']
WHERE id IN ('invoice-documents', 'payment-documents', 'vendor-documents');
