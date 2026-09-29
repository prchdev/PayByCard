/*
# Create Finance Module: Vendor Management & Invoicing

## Overview
This migration creates the complete database schema for the Finance section of the admin dashboard.
It adds exactly two admin pages (Vendor Management and Invoicing) with all supporting tables.

## New Tables

### 1. finance_vendors
Stores vendor master records.
- id (uuid, PK)
- vendor_code (text, unique) — auto-generated vendor ID like VND-000001
- legal_name (text, not null)
- trade_name (text)
- contact_person (text)
- address (text)
- country (text, default 'India')
- email (text)
- phone (text)
- domestic_or_international (text: 'domestic' | 'international', default 'domestic')
- registration_status (text: 'registered' | 'non_registered', default 'registered')
- registration_type (text: sole_proprietorship, partnership, llp, private_limited, public_limited)
- cin_number (text)
- pan_number (text)
- gst_number (text)
- gst_registration_state (text)
- bank_account_holder (text)
- bank_name (text)
- bank_account_number (text)
- bank_ifsc (text)
- bank_account_type (text)
- payment_terms (text)
- expense_category (text)
- additional_remark (text)
- status (text: 'active' | 'disabled' | 'blacklisted', default 'active')
- status_reason (text) — reason for disabling/blacklisting
- created_by (uuid, FK admin_users)
- created_at, updated_at (timestamptz)

### 2. finance_vendor_documents
Optional vendor supporting documents (GST cert, PAN, bank proof, agreement, other).
- id (uuid, PK)
- vendor_id (uuid, FK finance_vendors ON DELETE CASCADE)
- document_type (text: gst_certificate, pan_document, bank_proof, agreement, other)
- file_url (text) — storage path in vendor-documents bucket
- uploaded_by (uuid, FK admin_users)
- uploaded_at (timestamptz)

### 3. finance_invoices
Stores invoice header records.
- id (uuid, PK)
- invoice_id_code (text, unique) — auto-generated like INV-000001
- vendor_id (uuid, FK finance_vendors)
- invoice_number (text) — vendor's invoice number
- invoice_date (date)
- due_date (date)
- po_number (text)
- currency (text, default 'INR')
- place_of_supply (text)
- expense_category (text)
- additional_remark (text)
- subtotal / total_sgst / total_cgst / total_igst / total_tax / grand_total (numeric(15,2))
- total_paid (numeric(15,2), default 0)
- invoice_status (text: draft, submitted, approved, partially_paid, fully_paid, overdue, cancelled)
- payment_status (text: pending, partially_paid, fully_paid, no_payment)
- cancellation_reason (text)
- created_by (uuid, FK admin_users)
- created_at, updated_at (timestamptz)

### 4. finance_invoice_line_items
Multiple line items per invoice.
- id (uuid, PK)
- invoice_id (uuid, FK finance_invoices ON DELETE CASCADE)
- description (text)
- hsn_sac (text)
- quantity (numeric(12,2))
- amount_per_unit (numeric(15,2))
- taxable_amount (numeric(15,2))
- sgst_amount (numeric(15,2))
- cgst_amount (numeric(15,2))
- igst_amount (numeric(15,2))
- other_tax_amount (numeric(15,2), default 0)
- total_amount (numeric(15,2))
- display_order (integer)

### 5. finance_invoice_payments
Multiple payments per invoice.
- id (uuid, PK)
- payment_id_code (text, unique) — auto-generated like PAY-000001
- invoice_id (uuid, FK finance_invoices ON DELETE CASCADE)
- payment_date (date)
- payment_mode (text: cash, upi, bank_transfer, cheque, payment_gateway)
- paid_from (text: personal_account, company_account)
- payment_source (text)
- transaction_id (text)
- amount_paid (numeric(15,2))
- receipt_number (text)
- payment_status (text: pending, successful, failed, reversed, cancelled)
- payment_remark (text)
- created_by (uuid, FK admin_users)
- created_at, updated_at (timestamptz)

### 6. finance_payment_documents
Documents attached to payments (receipts, snapshots, PDFs).
- id (uuid, PK)
- payment_id (uuid, FK finance_invoice_payments ON DELETE CASCADE)
- document_type (text: receipt, snapshot, other)
- file_url (text)
- uploaded_by (uuid, FK admin_users)
- uploaded_at (timestamptz)

### 7. finance_invoice_documents
Invoice-level documents (the invoice PDF/image itself).
- id (uuid, PK)
- invoice_id (uuid, FK finance_invoices ON DELETE CASCADE)
- document_type (text: invoice_pdf, invoice_image, other)
- file_url (text)
- uploaded_by (uuid, FK admin_users)
- uploaded_at (timestamptz)

### 8. finance_audit_trail
Audit trail for all important financial actions.
- id (uuid, PK)
- entity_type (text: vendor, invoice, payment, line_item, document)
- entity_id (uuid)
- action (text: create, update, status_change, cancel, delete, document_upload, document_replace)
- field_name (text, nullable)
- previous_value (text, nullable)
- new_value (text, nullable)
- performed_by (uuid, FK admin_users)
- performed_at (timestamptz)

## Storage Buckets
- vendor-documents (private) — for vendor supporting documents
- invoice-documents (private) — for invoice PDFs/images
- payment-documents (private) — for payment receipts/snapshots

## Security
- RLS enabled on all tables
- All tables restricted to service role only (admin access via edge functions using service role key)
- No direct anon/authenticated access — all operations go through edge functions

## Admin Pages
- Inserts two new admin_pages rows: 'vendor-management' and 'invoicing'
- Seeds role_permissions for super_admin (full access) and admin (view + edit)
*/

-- ============================================================
-- 1. FINANCE VENDORS
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code text UNIQUE NOT NULL,
  legal_name text NOT NULL,
  trade_name text,
  contact_person text,
  address text,
  country text DEFAULT 'India',
  email text,
  phone text,
  domestic_or_international text DEFAULT 'domestic' CHECK (domestic_or_international IN ('domestic', 'international')),
  registration_status text DEFAULT 'registered' CHECK (registration_status IN ('registered', 'non_registered')),
  registration_type text CHECK (registration_type IN ('sole_proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited')),
  cin_number text,
  pan_number text,
  gst_number text,
  gst_registration_state text,
  bank_account_holder text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  bank_account_type text,
  payment_terms text,
  expense_category text,
  additional_remark text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'blacklisted')),
  status_reason text,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE finance_vendors ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. FINANCE VENDOR DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES finance_vendors(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('gst_certificate', 'pan_document', 'bank_proof', 'agreement', 'other')),
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES admin_users(id),
  uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE finance_vendor_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. FINANCE INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id_code text UNIQUE NOT NULL,
  vendor_id uuid NOT NULL REFERENCES finance_vendors(id),
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  due_date date,
  po_number text,
  currency text DEFAULT 'INR',
  place_of_supply text,
  expense_category text,
  additional_remark text,
  subtotal numeric(15,2) DEFAULT 0,
  total_sgst numeric(15,2) DEFAULT 0,
  total_cgst numeric(15,2) DEFAULT 0,
  total_igst numeric(15,2) DEFAULT 0,
  total_tax numeric(15,2) DEFAULT 0,
  grand_total numeric(15,2) DEFAULT 0,
  total_paid numeric(15,2) DEFAULT 0,
  invoice_status text DEFAULT 'draft' CHECK (invoice_status IN ('draft', 'submitted', 'approved', 'partially_paid', 'fully_paid', 'overdue', 'cancelled')),
  payment_status text DEFAULT 'no_payment' CHECK (payment_status IN ('pending', 'partially_paid', 'fully_paid', 'no_payment')),
  cancellation_reason text,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. FINANCE INVOICE LINE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  hsn_sac text,
  quantity numeric(12,2) DEFAULT 1,
  amount_per_unit numeric(15,2) DEFAULT 0,
  taxable_amount numeric(15,2) DEFAULT 0,
  sgst_amount numeric(15,2) DEFAULT 0,
  cgst_amount numeric(15,2) DEFAULT 0,
  igst_amount numeric(15,2) DEFAULT 0,
  other_tax_amount numeric(15,2) DEFAULT 0,
  total_amount numeric(15,2) DEFAULT 0,
  display_order integer DEFAULT 0
);
ALTER TABLE finance_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. FINANCE INVOICE PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id_code text UNIQUE NOT NULL,
  invoice_id uuid NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  payment_mode text CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'payment_gateway')),
  paid_from text CHECK (paid_from IN ('personal_account', 'company_account')),
  payment_source text,
  transaction_id text,
  amount_paid numeric(15,2) NOT NULL DEFAULT 0,
  receipt_number text,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'successful', 'failed', 'reversed', 'cancelled')),
  payment_remark text,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE finance_invoice_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. FINANCE PAYMENT DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_payment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES finance_invoice_payments(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('receipt', 'snapshot', 'other')),
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES admin_users(id),
  uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE finance_payment_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. FINANCE INVOICE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_invoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('invoice_pdf', 'invoice_image', 'other')),
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES admin_users(id),
  uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE finance_invoice_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. FINANCE AUDIT TRAIL
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('vendor', 'invoice', 'payment', 'line_item', 'document')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'status_change', 'cancel', 'delete', 'document_upload', 'document_replace')),
  field_name text,
  previous_value text,
  new_value text,
  performed_by uuid REFERENCES admin_users(id),
  performed_at timestamptz DEFAULT now()
);
ALTER TABLE finance_audit_trail ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_finance_vendors_status ON finance_vendors(status);
CREATE INDEX IF NOT EXISTS idx_finance_vendors_gst ON finance_vendors(gst_number);
CREATE INDEX IF NOT EXISTS idx_finance_vendors_pan ON finance_vendors(pan_number);
CREATE INDEX IF NOT EXISTS idx_finance_vendors_created ON finance_vendors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_vendor_docs_vendor ON finance_vendor_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_vendor ON finance_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON finance_invoices(invoice_status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_payment_status ON finance_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_date ON finance_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_created ON finance_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_line_items_invoice ON finance_invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_invoice ON finance_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_status ON finance_invoice_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_finance_payment_docs_payment ON finance_payment_documents(payment_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoice_docs_invoice ON finance_invoice_documents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_audit_entity ON finance_audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_finance_audit_performed ON finance_audit_trail(performed_at DESC);

-- ============================================================
-- STORAGE BUCKETS (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('vendor-documents', 'vendor-documents', false),
  ('invoice-documents', 'invoice-documents', false),
  ('payment-documents', 'payment-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADMIN PAGES + ROLE PERMISSIONS
-- ============================================================
INSERT INTO admin_pages (page_key, page_name, page_path, description, icon, display_order)
VALUES
  ('vendor-management', 'Vendor Management', '/admin/vendor-management', 'Manage vendors with documents and status', 'Building2', 9),
  ('invoicing', 'Invoicing', '/admin/invoicing', 'Manage invoices, payments, and reconciliation', 'ReceiptText', 10)
ON CONFLICT (page_key) DO NOTHING;

-- Super Admin: full access
INSERT INTO role_permissions (role, page_id, can_view, can_edit)
SELECT 'super_admin', id, true, true
FROM admin_pages
WHERE page_key IN ('vendor-management', 'invoicing')
ON CONFLICT (role, page_id) DO NOTHING;

-- Admin: view + edit
INSERT INTO role_permissions (role, page_id, can_view, can_edit)
SELECT 'admin', id, true, true
FROM admin_pages
WHERE page_key IN ('vendor-management', 'invoicing')
ON CONFLICT (role, page_id) DO NOTHING;

-- Moderator: view only
INSERT INTO role_permissions (role, page_id, can_view, can_edit)
SELECT 'moderator', id, true, false
FROM admin_pages
WHERE page_key IN ('vendor-management', 'invoicing')
ON CONFLICT (role, page_id) DO NOTHING;

-- ============================================================
-- SEQUENCE for vendor codes and invoice codes
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS finance_vendor_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS finance_invoice_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS finance_payment_code_seq START 1;
