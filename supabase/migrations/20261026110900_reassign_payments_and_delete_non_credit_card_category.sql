-- Reassign all 6 payments from the "Non Credit Card Payment Options" category
-- to "Housing, Rent & Maintenance Payments"
UPDATE payments
SET business_category_id = 'cca8af45-0925-4bb5-825e-a49addd6a568'
WHERE business_category_id = 'f23ca556-d413-4d53-9aca-032fed566abe';

-- Now safe to delete the category (FK is ON DELETE RESTRICT, so reassignment must happen first)
DELETE FROM payment_categories
WHERE id = 'f23ca556-d413-4d53-9aca-032fed566abe';
