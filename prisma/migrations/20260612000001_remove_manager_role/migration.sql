-- Remove legacy Manager role (keep only Admin and Member)
UPDATE users u
SET role_id = m.id
FROM roles mgr
JOIN roles m ON m.slug = 'member'
WHERE u.role_id = mgr.id AND mgr.slug = 'manager';

DELETE FROM role_scopes
WHERE role_id IN (SELECT id FROM roles WHERE slug = 'manager');

DELETE FROM roles WHERE slug = 'manager';
