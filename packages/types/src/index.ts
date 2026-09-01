export const USER_ROLES = ["PLATFORM_ADMIN", "OWNER", "STAFF"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TENANT_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const ITEM_TYPES = [
  "OIL",
  "ALCOHOL",
  "STABILIZER",
  "BOTTLE",
  "PUMP",
  "PACKAGING",
  "READY_MADE",
  "FINISHED_CUSTOMIZED",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const PRODUCT_CLASSIFICATIONS = ["CUSTOMIZED", "ORIGINAL", "HIGH_COPY"] as const;
export type ProductClassification = (typeof PRODUCT_CLASSIFICATIONS)[number];

export const MOVEMENT_TYPES = [
  "OPENING_BALANCE",
  "PURCHASE_RECEIPT",
  "CUSTOMIZED_SALE_CONSUMPTION",
  "READY_MADE_SALE",
  "FINISHED_CUSTOMIZED_SALE",
  "RETURN",
  "WASTE",
  "DAMAGE",
  "SPILLAGE",
  "STOCK_ADJUSTMENT",
  "STOCK_COUNT_ADJUSTMENT",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const PURCHASE_STATUSES = ["DRAFT", "POSTED"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const SALES_STATUSES = ["COMPLETED", "RETURNED", "PARTIALLY_RETURNED"] as const;
export type SalesStatus = (typeof SALES_STATUSES)[number];

export const LINE_TYPES = ["CUSTOMIZED", "ORIGINAL", "HIGH_COPY", "FINISHED_CUSTOMIZED"] as const;
export type LineType = (typeof LINE_TYPES)[number];

export type CreditTerms = string;

export const SUPPLIER_LEDGER_TYPES = ["OPENING_BALANCE", "PURCHASE_INVOICE", "PAYMENT", "ADJUSTMENT"] as const;
export type SupplierLedgerType = (typeof SUPPLIER_LEDGER_TYPES)[number];

export const RETURN_DISPOSITIONS = ["RETURN_TO_FINISHED_STOCK", "DAMAGED", "DISPOSED"] as const;
export type ReturnDisposition = (typeof RETURN_DISPOSITIONS)[number];

export const FINISHED_STATUSES = ["SOLD", "AVAILABLE", "RETURNED", "DAMAGED", "DISPOSED"] as const;
export type FinishedCustomizedStatus = (typeof FINISHED_STATUSES)[number];

export const WASTE_REASONS = ["SPILLAGE", "DAMAGE", "WRONG_MIX", "OTHER"] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export const UNITS = ["ML", "L", "PCS"] as const;
export type Unit = (typeof UNITS)[number];

export const PACKAGING_TYPES = ["NONE", "STANDARD_BOX", "PREMIUM_BOX", "GIFT_WRAPPING"] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string | null;
  outletIds: string[];
};

export type TenantPublic = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  currency: string;
  timezone: string;
  locale: string;
  country: string;
};

export type OutletPublic = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
};
