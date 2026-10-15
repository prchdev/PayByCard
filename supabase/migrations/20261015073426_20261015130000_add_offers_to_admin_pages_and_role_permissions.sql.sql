DO $$
DECLARE
  v_page_id uuid;
BEGIN
  INSERT INTO admin_pages (page_key, page_name, page_path, description, icon, display_order, is_active)
  VALUES ('offers', 'Offers', '/admin/offers', 'Create and manage promotional offers on the public website', 'Tag', 221, true)
  ON CONFLICT (page_key) DO UPDATE SET
    page_name = EXCLUDED.page_name,
    page_path = EXCLUDED.page_path,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active
  RETURNING id INTO v_page_id;

  IF v_page_id IS NOT NULL THEN
    INSERT INTO role_permissions (role, page_id, can_view, can_edit)
    VALUES
      ('super_admin', v_page_id, true, true),
      ('admin', v_page_id, true, true),
      ('moderator', v_page_id, true, false)
    ON CONFLICT (role, page_id) DO UPDATE SET
      can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit;
  END IF;
END $$;
