export const SCOPE_DEFINITIONS = [
  { key: 'dashboard.admin', label: 'Admin Dashboard', module: 'Dashboard' },
  { key: 'dashboard.member', label: 'Member Dashboard', module: 'Dashboard' },
  { key: 'members.view', label: 'View Members', module: 'Members' },
  { key: 'members.manage', label: 'Manage Members', module: 'Members' },
  { key: 'expenses.view', label: 'View Expenses', module: 'Expenses' },
  { key: 'expenses.manage', label: 'Manage Expenses', module: 'Expenses' },
  { key: 'payments.view', label: 'View Payments', module: 'Payments' },
  { key: 'payments.manage', label: 'Manage Payments', module: 'Payments' },
  { key: 'bills.view', label: 'View Bills', module: 'Bills' },
  { key: 'bills.manage', label: 'Manage Bills', module: 'Bills' },
  { key: 'reports.export', label: 'Export Reports', module: 'Reports' },
  { key: 'roles.view', label: 'View Roles', module: 'Roles' },
  { key: 'roles.manage', label: 'Manage Roles', module: 'Roles' },
] as const;

export type ScopeKey = (typeof SCOPE_DEFINITIONS)[number]['key'];

export const ALL_SCOPE_KEYS = SCOPE_DEFINITIONS.map((s) => s.key);

export const MEMBER_SCOPES: ScopeKey[] = [
  'dashboard.member',
  'bills.view',
  'bills.manage',
  'payments.view',
];

export const ADMIN_SCOPES: ScopeKey[] = [...ALL_SCOPE_KEYS];
