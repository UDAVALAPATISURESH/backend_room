export const BILL_CATEGORIES = [
  { key: 'ROOM_RENT', label: 'Room Rent', icon: '🏠' },
  { key: 'GAS', label: 'Gas', icon: '🔥' },
  { key: 'ELECTRIC', label: 'Electric', icon: '💡' },
  { key: 'GROCERY', label: 'Grocery', icon: '🛒' },
  { key: 'OTHER', label: 'Other', icon: '📦' },
] as const;

export type BillCategoryKey = (typeof BILL_CATEGORIES)[number]['key'];

export const BILL_CATEGORY_KEYS = BILL_CATEGORIES.map((c) => c.key);

export function getBillCategoryLabel(key: string) {
  return BILL_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function getBillCategoryIcon(key: string) {
  return BILL_CATEGORIES.find((c) => c.key === key)?.icon ?? '📦';
}
