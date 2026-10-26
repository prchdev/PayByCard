UPDATE payment_categories
SET is_enabled = false,
    updated_at = now()
WHERE id = 'f23ca556-d413-4d53-9aca-032fed566abe';
