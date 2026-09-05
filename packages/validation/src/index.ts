import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceId: z.string().min(8).max(80).optional(),
  deviceLabel: z.string().max(120).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(8),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export const licenseRenewSchema = z.object({
  deviceId: z.string().min(8).max(80),
  deviceLabel: z.string().max(120).optional(),
});

export const syncPushSchema = z.object({
  deviceId: z.string().min(8).max(80),
  operations: z
    .array(
      z.object({
        localId: z.string().min(1).max(80),
        type: z.string().min(1).max(64),
        payload: z.unknown(),
        createdAt: z.string(),
        userId: z.string().optional(),
        outletId: z.string().optional(),
      }),
    )
    .max(100),
});

export const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
  currency: z.string().min(3).max(3).default("EGP"),
  timezone: z.string().default("Africa/Cairo"),
  locale: z.string().default("en-EG"),
  country: z.string().min(2).max(2).default("EG"),
  notes: z.string().optional(),
  outletName: z.string().min(2),
  outletAddress: z.string().optional(),
  outletPhone: z.string().optional(),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(2),
  ownerPassword: z.string().min(8),
});

export const updateTenantStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  notes: z.string().optional(),
});

export const updateBusinessProfileSchema = z.object({
  name: z.string().min(2).optional(),
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  country: z.string().min(2).max(2).optional(),
});

export const createOutletSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const STAFF_PAGES = ["dashboard", "procurement", "suppliers", "reports", "settings"] as const;
export type StaffPage = (typeof STAFF_PAGES)[number];
export const DEFAULT_STAFF_PAGES: StaffPage[] = ["dashboard", "suppliers"];

export const createUserSchema = z
  .object({
    email: z.string().email(),
    displayName: z.string().min(2),
    password: z.string().min(8),
    role: z.enum(["OWNER", "STAFF"]),
    outletIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STAFF" && !(data.outletIds?.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outletIds"],
        message: "Staff must be assigned to at least one outlet",
      });
    }
  });

export const updateStaffPagesSchema = z.object({
  pages: z.array(z.enum(["dashboard", "procurement", "suppliers", "reports", "settings"])),
  seeItemCost: z.boolean().optional(),
});

export const inventoryItemSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  itemType: z.enum([
    "OIL",
    "ALCOHOL",
    "STABILIZER",
    "BOTTLE",
    "PUMP",
    "PACKAGING",
    "READY_MADE",
    "FINISHED_CUSTOMIZED",
    "OTHER",
  ]),
  purchaseUnit: z.enum(["ML", "L", "PCS"]).default("PCS"),
  stockUnit: z.enum(["ML", "L", "PCS"]).default("PCS"),
  lowStockThreshold: z.number().nonnegative().optional(),
  active: z.boolean().default(true),
});

export const oilSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
  lowStockThreshold: z.number().nonnegative().optional(),
});

export const bottleSchema = z.object({
  design: z.string().min(1),
  sizeMl: z.number().positive(),
  pumpId: z.string().optional(),
  active: z.boolean().default(true),
});

export const pumpSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
});

export const packagingSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["STANDARD_BOX", "PREMIUM_BOX", "GIFT_WRAPPING"]),
  active: z.boolean().default(true),
});

export const readyMadeSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  classification: z.enum(["ORIGINAL", "HIGH_COPY"]),
  sizeMl: z.number().positive(),
  barcode: z.string().optional(),
  sellingPrice: z.number().positive(),
  active: z.boolean().default(true),
});

export const othersSchema = z.object({
  name: z.string().min(1),
  sellingPrice: z.number().positive(),
  active: z.boolean().default(true),
});

export const oilUpdateSchema = oilSchema.pick({ name: true, active: true, lowStockThreshold: true }).partial();
export const pumpUpdateSchema = pumpSchema.pick({ name: true, active: true }).partial();
export const bottleUpdateSchema = bottleSchema
  .pick({ design: true, sizeMl: true, active: true })
  .partial()
  .extend({ pumpId: z.string().nullable().optional() });
export const packagingUpdateSchema = packagingSchema.pick({ name: true, type: true, active: true }).partial();
export const readyMadeUpdateSchema = readyMadeSchema.partial();
export const othersUpdateSchema = othersSchema.partial();

export const concentrationSchema = z.object({
  name: z.string().min(1),
  oilPercentage: z.number().positive().max(100),
  active: z.boolean().default(true),
});

export const markupSchema = z.object({
  markupPercentage: z.number().nonnegative(),
});

export const themeSchema = z.object({
  theme: z.enum(["gold", "oud", "rose", "emerald", "midnight", "terracotta"]),
});

export const discountSchema = z.object({
  name: z.string().min(1),
  percentage: z.number().nonnegative().max(100),
  active: z.boolean().default(true),
});

export const discountUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  percentage: z.number().nonnegative().max(100).optional(),
  active: z.boolean().optional(),
});

export const paymentMethodSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  active: z.boolean().default(true),
});

export const customerSchema = z.object({
  id: z.string().min(8).max(64).optional(),
  name: z.string().min(1),
  mobile: z.string().min(8),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  notes: z.string().optional(),
});

export const supplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  creditTerms: z.string().max(120).optional(),
  creditLimit: z.number().nonnegative().optional(),
  openingBalance: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

export const supplierUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  creditTerms: z.string().max(120).optional(),
  creditLimit: z.number().nonnegative().nullable().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

export const purchaseLineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(["ML", "L", "PCS"]),
  unitCost: z.number().positive(),
});

export const purchaseInvoiceSchema = z.object({
  supplierId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string(),
  notes: z.string().optional(),
  lines: z.array(purchaseLineSchema).min(1),
});

export const supplierPaymentSchema = z.object({
  supplierId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]),
  paymentDate: z.string(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const wasteSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(["ML", "L", "PCS"]),
  reason: z.enum(["SPILLAGE", "DAMAGE", "WRONG_MIX", "OTHER"]),
  notes: z.string().optional(),
});

export const adjustmentSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number(),
  unit: z.enum(["ML", "L", "PCS"]),
  reason: z.string().min(1),
  notes: z.string().optional(),
  isOpeningBalance: z.boolean().optional(),
  isStockCount: z.boolean().optional(),
  unitCost: z.number().nonnegative().optional(),
});

export const customizedLineSchema = z.object({
  lineType: z.literal("CUSTOMIZED"),
  oilId: z.string().min(1),
  concentrationId: z.string().min(1),
  bottleId: z.string().min(1),
  oilActualQtyMl: z.number().positive(),
  stabilizerId: z.string().optional(),
  stabilizerQtyMl: z.number().nonnegative().optional(),
  packagingId: z.string().optional(),
  customerSuppliedBottle: z.boolean().default(false),
  quantity: z.number().int().positive().default(1),
});

export const readyMadeLineSchema = z.object({
  lineType: z.enum(["ORIGINAL", "HIGH_COPY", "OTHER"]),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const finishedLineSchema = z.object({
  lineType: z.literal("FINISHED_CUSTOMIZED"),
  finishedItemId: z.string().min(1),
  quantity: z.literal(1),
});

export const saleLineSchema = z.discriminatedUnion("lineType", [
  customizedLineSchema,
  readyMadeLineSchema,
  finishedLineSchema,
]);

export const createSaleSchema = z.object({
  customerId: z.string().min(1),
  discountId: z.string().optional(),
  paymentMethodId: z.string().min(1),
  paymentReference: z.string().optional(),
  lines: z.array(saleLineSchema).min(1),
});

export const pricingPreviewSchema = z.object({
  oilId: z.string().min(1),
  concentrationId: z.string().min(1),
  bottleId: z.string().min(1),
  oilActualQtyMl: z.number().positive(),
  stabilizerId: z.string().optional(),
  stabilizerQtyMl: z.number().nonnegative().optional(),
  packagingId: z.string().optional(),
  customerSuppliedBottle: z.boolean().default(false),
});

export const returnLineSchema = z.object({
  originalOrderLineId: z.string().min(1),
  quantity: z.number().int().positive(),
  disposition: z.enum(["RETURN_TO_FINISHED_STOCK", "DAMAGED", "DISPOSED"]),
});

export const createReturnSchema = z.object({
  originalOrderId: z.string().min(1),
  reason: z.string().min(1),
  lines: z.array(returnLineSchema).min(1),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type PricingPreviewInput = z.infer<typeof pricingPreviewSchema>;
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateThemeInput = z.infer<typeof themeSchema>;
export type DiscountUpdateInput = z.infer<typeof discountUpdateSchema>;
export type LicenseRenewInput = z.infer<typeof licenseRenewSchema>;
export type SyncPushInput = z.infer<typeof syncPushSchema>;
export type UpdateStaffPagesInput = z.infer<typeof updateStaffPagesSchema>;
export type OilUpdateInput = z.infer<typeof oilUpdateSchema>;
export type PumpUpdateInput = z.infer<typeof pumpUpdateSchema>;
export type BottleUpdateInput = z.infer<typeof bottleUpdateSchema>;
export type PackagingUpdateInput = z.infer<typeof packagingUpdateSchema>;
export type ReadyMadeUpdateInput = z.infer<typeof readyMadeUpdateSchema>;
