export type PurchaseFilter = {
  dateFrom: string;
  dateTo: string;
  supplierId: string;
  itemId: string;
};

export type FilterablePurchase = {
  invoiceDate?: string | Date;
  supplierId?: string;
  supplier?: { id?: string };
  lines?: { itemId?: string }[];
};

export const EMPTY_PURCHASE_FILTER: PurchaseFilter = {
  dateFrom: "",
  dateTo: "",
  supplierId: "",
  itemId: "",
};

export function hasPurchaseFilter(filter: PurchaseFilter) {
  return Boolean(filter.dateFrom || filter.dateTo || filter.supplierId || filter.itemId);
}

/** Every filled field must match; blank fields are ignored. */
export function matchesPurchaseFilter(purchase: FilterablePurchase, filter: PurchaseFilter) {
  const day = String(purchase.invoiceDate ?? "").slice(0, 10);
  if (filter.dateFrom && (!day || day < filter.dateFrom)) return false;
  if (filter.dateTo && (!day || day > filter.dateTo)) return false;
  if (filter.supplierId && (purchase.supplierId ?? purchase.supplier?.id) !== filter.supplierId) return false;
  if (filter.itemId && !(purchase.lines ?? []).some((line) => line.itemId === filter.itemId)) return false;
  return true;
}

export function filterPurchases<T extends FilterablePurchase>(purchases: T[], filter: PurchaseFilter) {
  return purchases.filter((purchase) => matchesPurchaseFilter(purchase, filter));
}
