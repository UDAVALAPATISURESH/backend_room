-- Migrate users.role enum -> roles/scopes tables (preserves existing data)

CREATE TABLE IF NOT EXISTS scopes (
  id TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  module TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_scopes (
  role_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  PRIMARY KEY (role_id, scope_id),
  CONSTRAINT role_scopes_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT role_scopes_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO scopes (key, label, module) VALUES
  ('dashboard.admin', 'Admin Dashboard', 'Dashboard'),
  ('dashboard.member', 'Member Dashboard', 'Dashboard'),
  ('members.view', 'View Members', 'Members'),
  ('members.manage', 'Manage Members', 'Members'),
  ('expenses.view', 'View Expenses', 'Expenses'),
  ('expenses.manage', 'Manage Expenses', 'Expenses'),
  ('payments.view', 'View Payments', 'Payments'),
  ('payments.manage', 'Manage Payments', 'Payments'),
  ('bills.view', 'View Bills', 'Bills'),
  ('bills.manage', 'Manage Bills', 'Bills'),
  ('reports.export', 'Export Reports', 'Reports'),
  ('roles.view', 'View Roles', 'Roles'),
  ('roles.manage', 'Manage Roles', 'Roles')
ON CONFLICT (key) DO NOTHING;

INSERT INTO roles (name, slug, description, is_system) VALUES
  ('Admin', 'admin', 'Full access to all features', true),
  ('Member', 'member', 'Member dashboard, bills and own payments', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_scopes (role_id, scope_id)
SELECT r.id, s.id FROM roles r CROSS JOIN scopes s WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_scopes (role_id, scope_id)
SELECT r.id, s.id FROM roles r
JOIN scopes s ON s.key IN (
  'dashboard.member', 'bills.view', 'bills.manage', 'payments.view'
) WHERE r.slug = 'member'
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN role_id TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role_id IS NULL
  AND r.slug = CASE WHEN u.role::text = 'ADMIN' THEN 'admin' ELSE 'member' END;

UPDATE users u
SET role_id = (SELECT id FROM roles WHERE slug = 'member' LIMIT 1)
WHERE u.role_id IS NULL;

ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users DROP COLUMN IF EXISTS role;

DROP TYPE IF EXISTS "Role";
