import type { PricingTier, ProductClassification, PackagingType } from "@prisma/client";

export type ReadyMadeDef = {
  sku: string;
  name: string;
  brand: string;
  styleNote: string;
  classification: ProductClassification;
  sizeMl: number;
  barcode: string;
  cost: number;
  sellingPrice: number;
  lowStockThreshold: number;
  openingQty: number;
};

export type OilDef = {
  code: string;
  name: string;
  pricingTier: PricingTier;
  costPerMl: number;
  lowStockThreshold: number;
  openingQty: number;
};

export type BottleDef = {
  code: string;
  design: string;
  sizeMl: number;
  cost: number;
  lowStockThreshold: number;
  openingQty: number;
};

export type PackagingDef = {
  code: string;
  name: string;
  type: PackagingType;
  cost: number;
  lowStockThreshold: number;
  openingQty: number;
};

export type ComponentDef = {
  code: string;
  name: string;
  kind: "ALCOHOL" | "STABILIZER" | "PUMP";
  cost: number;
  lowStockThreshold: number;
  openingQty: number;
  purchaseUnit: "L" | "PCS";
  stockUnit: "ML" | "PCS";
};

/** Fictional ready-made catalog — Arabic names, EGP pricing */
export const READY_MADE: ReadyMadeDef[] = [
  { sku: "RDY-001", name: "رويال عود 100 مل", brand: "ميزون رويال", styleNote: "نيش", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000001", cost: 850, sellingPrice: 1450, lowStockThreshold: 3, openingQty: 8 },
  { sku: "RDY-002", name: "رويال عود 50 مل", brand: "ميزون رويال", styleNote: "نيش", classification: "ORIGINAL", sizeMl: 50, barcode: "6221001000002", cost: 480, sellingPrice: 850, lowStockThreshold: 3, openingQty: 10 },
  { sku: "RDY-003", name: "ليالي القاهرة 100 مل", brand: "عطور النيل", styleNote: "شرقي", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000003", cost: 620, sellingPrice: 1100, lowStockThreshold: 4, openingQty: 12 },
  { sku: "RDY-004", name: "ليالي القاهرة 75 مل", brand: "عطور النيل", styleNote: "شرقي", classification: "ORIGINAL", sizeMl: 75, barcode: "6221001000004", cost: 490, sellingPrice: 890, lowStockThreshold: 3, openingQty: 9 },
  { sku: "RDY-005", name: "مسك الصحراء 100 مل", brand: "دار العنبر", styleNote: "شرقي", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000005", cost: 540, sellingPrice: 980, lowStockThreshold: 3, openingQty: 11 },
  { sku: "RDY-006", name: "ورد الإسكندرية 50 مل", brand: "بستان الزهور", styleNote: "إيكو ديزاينر", classification: "ORIGINAL", sizeMl: 50, barcode: "6221001000006", cost: 320, sellingPrice: 580, lowStockThreshold: 4, openingQty: 14 },
  { sku: "RDY-007", name: "ياسمين النيل 30 مل", brand: "بستان الزهور", styleNote: "إيكو ديزاينر", classification: "ORIGINAL", sizeMl: 30, barcode: "6221001000007", cost: 210, sellingPrice: 390, lowStockThreshold: 5, openingQty: 16 },
  { sku: "RDY-008", name: "عنبر الملوك 100 مل", brand: "دار العنبر", styleNote: "ألترا نيش", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000008", cost: 1200, sellingPrice: 2100, lowStockThreshold: 2, openingQty: 5 },
  { sku: "RDY-009", name: "عنبر الملوك 50 مل", brand: "دار العنبر", styleNote: "ألترا نيش", classification: "ORIGINAL", sizeMl: 50, barcode: "6221001000009", cost: 680, sellingPrice: 1250, lowStockThreshold: 2, openingQty: 6 },
  { sku: "RDY-010", name: "نسيم البحر 100 مل", brand: "أوركيد كايرو", styleNote: "ديزاينر", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000010", cost: 410, sellingPrice: 750, lowStockThreshold: 4, openingQty: 15 },
  { sku: "RDY-011", name: "نسيم البحر 75 مل", brand: "أوركيد كايرو", styleNote: "ديزاينر", classification: "ORIGINAL", sizeMl: 75, barcode: "6221001000011", cost: 340, sellingPrice: 620, lowStockThreshold: 4, openingQty: 13 },
  { sku: "RDY-012", name: "خشب الصندل الملكي 100 مل", brand: "ميزون رويال", styleNote: "نيش", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000012", cost: 780, sellingPrice: 1380, lowStockThreshold: 3, openingQty: 7 },
  { sku: "RDY-013", name: "فانيليا الشرق 50 مل", brand: "عطور النيل", styleNote: "شرقي", classification: "ORIGINAL", sizeMl: 50, barcode: "6221001000013", cost: 360, sellingPrice: 650, lowStockThreshold: 4, openingQty: 12 },
  { sku: "RDY-014", name: "حمضيات الصباح 30 مل", brand: "أوركيد كايرو", styleNote: "ديزاينر", classification: "ORIGINAL", sizeMl: 30, barcode: "6221001000014", cost: 180, sellingPrice: 340, lowStockThreshold: 5, openingQty: 18 },
  { sku: "RDY-015", name: "سر الليل 100 مل", brand: "فيلا أروما", styleNote: "نيش", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000015", cost: 920, sellingPrice: 1650, lowStockThreshold: 2, openingQty: 4 },
  { sku: "RDY-016", name: "عطر الياسمين الخاص 75 مل", brand: "فيلا أروما", styleNote: "إيكو ديزاينر", classification: "ORIGINAL", sizeMl: 75, barcode: "6221001000016", cost: 450, sellingPrice: 820, lowStockThreshold: 3, openingQty: 10 },
  { sku: "RDY-017", name: "نسخة رويال عود 100 مل", brand: "بيت الخلطات", styleNote: "نيش", classification: "HIGH_COPY", sizeMl: 100, barcode: "6221002000001", cost: 180, sellingPrice: 320, lowStockThreshold: 5, openingQty: 25 },
  { sku: "RDY-018", name: "نسخة ليالي القاهرة 100 مل", brand: "بيت الخلطات", styleNote: "شرقي", classification: "HIGH_COPY", sizeMl: 100, barcode: "6221002000002", cost: 150, sellingPrice: 280, lowStockThreshold: 5, openingQty: 28 },
  { sku: "RDY-019", name: "نسخة مسك الصحراء 50 مل", brand: "بيت الخلطات", styleNote: "شرقي", classification: "HIGH_COPY", sizeMl: 50, barcode: "6221002000003", cost: 95, sellingPrice: 190, lowStockThreshold: 6, openingQty: 30 },
  { sku: "RDY-020", name: "نسخة نسيم البحر 75 مل", brand: "عطور الأناقة", styleNote: "ديزاينر", classification: "HIGH_COPY", sizeMl: 75, barcode: "6221002000004", cost: 110, sellingPrice: 220, lowStockThreshold: 5, openingQty: 22 },
  { sku: "RDY-021", name: "نسخة عنبر الملوك 50 مل", brand: "عطور الأناقة", styleNote: "ألترا نيش", classification: "HIGH_COPY", sizeMl: 50, barcode: "6221002000005", cost: 140, sellingPrice: 260, lowStockThreshold: 4, openingQty: 18 },
  { sku: "RDY-022", name: "نسخة ورد الإسكندرية 30 مل", brand: "بيت الخلطات", styleNote: "إيكو ديزاينر", classification: "HIGH_COPY", sizeMl: 30, barcode: "6221002000006", cost: 70, sellingPrice: 140, lowStockThreshold: 8, openingQty: 35 },
  { sku: "RDY-023", name: "نسخة خشب الصندل 100 مل", brand: "عطور الأناقة", styleNote: "نيش", classification: "HIGH_COPY", sizeMl: 100, barcode: "6221002000007", cost: 160, sellingPrice: 300, lowStockThreshold: 5, openingQty: 20 },
  { sku: "RDY-024", name: "نسخة سر الليل 50 مل", brand: "بيت الخلطات", styleNote: "نيش", classification: "HIGH_COPY", sizeMl: 50, barcode: "6221002000008", cost: 125, sellingPrice: 240, lowStockThreshold: 4, openingQty: 16 },
  // Intentionally low stock for demo low-stock alerts
  { sku: "RDY-025", name: "عود السلطان 100 مل", brand: "دار العنبر", styleNote: "ألترا نيش", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000017", cost: 1350, sellingPrice: 2400, lowStockThreshold: 4, openingQty: 2 },
];

/** Legacy SKUs from old seed — remapped to Arabic fictional products */
export const LEGACY_READY_MADE_REMAP: ReadyMadeDef[] = [
  { sku: "RM-SAUVAGE", name: "عطر الغابة 100 مل", brand: "أوركيد كايرو", styleNote: "ديزاينر", classification: "ORIGINAL", sizeMl: 100, barcode: "6221001000099", cost: 700, sellingPrice: 1250, lowStockThreshold: 3, openingQty: 6 },
  { sku: "RM-SAUV-HC", name: "نسخة عطر الغابة 100 مل", brand: "بيت الخلطات", styleNote: "ديزاينر", classification: "HIGH_COPY", sizeMl: 100, barcode: "6221002000099", cost: 90, sellingPrice: 180, lowStockThreshold: 5, openingQty: 20 },
];

const OIL_NAMES: { name: string; tier: PricingTier; cost: number }[] = [
  { name: "عود هندي فاخر", tier: "LUXURY", cost: 8.5 },
  { name: "عود كمبودي", tier: "NICHE", cost: 7.2 },
  { name: "عود هندي اقتصادي", tier: "ECONOMY", cost: 3.2 },
  { name: "مسك أبيض", tier: "STANDARD", cost: 4.0 },
  { name: "مسك أسود", tier: "PREMIUM", cost: 5.5 },
  { name: "مسك طاهرة", tier: "ECONOMY", cost: 2.8 },
  { name: "عنبر رمادي", tier: "PREMIUM", cost: 5.8 },
  { name: "عنبر ملكي", tier: "LUXURY", cost: 9.0 },
  { name: "عنبر شرقي", tier: "STANDARD", cost: 4.2 },
  { name: "فانيليا مدغشقر", tier: "PREMIUM", cost: 5.0 },
  { name: "فانيليا كريمية", tier: "STANDARD", cost: 3.8 },
  { name: "ورد الطائف", tier: "NICHE", cost: 6.5 },
  { name: "ورد بلغاري", tier: "PREMIUM", cost: 5.2 },
  { name: "ورد دمشق", tier: "STANDARD", cost: 4.1 },
  { name: "ياسمين مصري", tier: "PREMIUM", cost: 5.4 },
  { name: "ياسمين هندي", tier: "STANDARD", cost: 3.9 },
  { name: "برغموت إيطالي", tier: "STANDARD", cost: 3.5 },
  { name: "ليمون صقلي", tier: "ECONOMY", cost: 2.5 },
  { name: "برتقال حلو", tier: "ECONOMY", cost: 2.4 },
  { name: "جريب فروت", tier: "ECONOMY", cost: 2.6 },
  { name: "خشب الصندل", tier: "PREMIUM", cost: 5.6 },
  { name: "خشب الأرز", tier: "STANDARD", cost: 3.7 },
  { name: "باتشولي", tier: "PREMIUM", cost: 5.1 },
  { name: "فيتيفر", tier: "NICHE", cost: 6.0 },
  { name: "لافندر فرنسي", tier: "STANDARD", cost: 3.6 },
  { name: "نعناع منعش", tier: "ECONOMY", cost: 2.3 },
  { name: "إكليبتوس", tier: "ECONOMY", cost: 2.2 },
  { name: "زهرة البرتقال", tier: "PREMIUM", cost: 5.3 },
  { name: "توليب أبيض", tier: "STANDARD", cost: 3.8 },
  { name: "سوسن", tier: "NICHE", cost: 6.8 },
  { name: "تفاح أخضر", tier: "ECONOMY", cost: 2.7 },
  { name: "خوخ ناضج", tier: "STANDARD", cost: 3.4 },
  { name: "توت بري", tier: "STANDARD", cost: 3.5 },
  { name: "مانجو استوائي", tier: "ECONOMY", cost: 2.9 },
  { name: "قرفة شرقية", tier: "PREMIUM", cost: 4.8 },
  { name: "هيل عربي", tier: "STANDARD", cost: 4.0 },
  { name: "زعفران نادر", tier: "LUXURY", cost: 10.5 },
  { name: "توليب شرقي", tier: "NICHE", cost: 6.2 },
  { name: "مسك الورد", tier: "PREMIUM", cost: 5.0 },
  { name: "عود وورد", tier: "NICHE", cost: 7.0 },
  { name: "عنبر وفانيليا", tier: "PREMIUM", cost: 5.7 },
  { name: "حمضيات منعشة", tier: "ECONOMY", cost: 2.5 },
  { name: "خشب وجلد", tier: "NICHE", cost: 6.4 },
  { name: "زهري ناعم", tier: "STANDARD", cost: 3.9 },
  { name: "شرقي كلاسيكي", tier: "PREMIUM", cost: 5.2 },
  { name: "فاكهي صيفي", tier: "ECONOMY", cost: 2.8 },
  { name: "مسك فاخر", tier: "LUXURY", cost: 8.8 },
  { name: "عود أبيض", tier: "NICHE", cost: 6.9 },
  { name: "ورد جوري", tier: "STANDARD", cost: 4.0 },
  { name: "ياسمين ليلي", tier: "PREMIUM", cost: 5.5 },
  { name: "صندل هندي", tier: "PREMIUM", cost: 5.8 },
  { name: "عنبر ليلي", tier: "NICHE", cost: 6.6 },
  { name: "فانيليا مدخنة", tier: "NICHE", cost: 6.3 },
  { name: "ليمون وتوابل", tier: "STANDARD", cost: 3.6 },
  { name: "مسك صحراوي", tier: "PREMIUM", cost: 5.1 },
  { name: "عود بخور", tier: "LUXURY", cost: 9.5 },
  { name: "ورد ومسك", tier: "PREMIUM", cost: 5.4 },
  { name: "برتقال وزعفران", tier: "NICHE", cost: 6.1 },
  { name: "نعناع وحمضيات", tier: "ECONOMY", cost: 2.4 },
  { name: "خشب الغابة", tier: "STANDARD", cost: 3.8 },
  { name: "زهرة الليل", tier: "PREMIUM", cost: 5.0 },
  { name: "فاكهة الغابة", tier: "STANDARD", cost: 3.5 },
  { name: "شرقي حديث", tier: "NICHE", cost: 6.0 },
  { name: "عطر البحر", tier: "STANDARD", cost: 3.7 },
  { name: "مسك بودري", tier: "ECONOMY", cost: 2.9 },
];

export const OILS: OilDef[] = OIL_NAMES.map((o, i) => {
  const n = String(i + 1).padStart(3, "0");
  const low = o.tier === "ECONOMY" ? 400 : o.tier === "LUXURY" ? 200 : 300;
  const opening = o.tier === "LUXURY" ? 2500 : o.tier === "ECONOMY" ? 8000 : 5000;
  return {
    code: `OL-${n}`,
    name: o.name,
    pricingTier: o.tier,
    costPerMl: o.cost,
    lowStockThreshold: low,
    openingQty: opening,
  };
});

/** Legacy oil codes remapped */
export const LEGACY_OILS: OilDef[] = [
  { code: "OIL-OUD", name: "عود كلاسيكي", pricingTier: "PREMIUM", costPerMl: 5.25, lowStockThreshold: 500, openingQty: 5000 },
  { code: "OIL-MUSK", name: "مسك كلاسيكي", pricingTier: "STANDARD", costPerMl: 4.0, lowStockThreshold: 500, openingQty: 3000 },
  { code: "OIL-ROSE", name: "ورد كلاسيكي", pricingTier: "PREMIUM", costPerMl: 6.0, lowStockThreshold: 300, openingQty: 2000 },
];

export const BOTTLES: BottleDef[] = [
  { code: "BT-CL-30", design: "كلاسيك", sizeMl: 30, cost: 18, lowStockThreshold: 15, openingQty: 80 },
  { code: "BT-CL-50", design: "كلاسيك", sizeMl: 50, cost: 24, lowStockThreshold: 15, openingQty: 90 },
  { code: "BT-CL-100", design: "كلاسيك", sizeMl: 100, cost: 30, lowStockThreshold: 12, openingQty: 100 },
  { code: "BT-SQ-30", design: "مربع", sizeMl: 30, cost: 20, lowStockThreshold: 12, openingQty: 60 },
  { code: "BT-SQ-50", design: "مربع", sizeMl: 50, cost: 26, lowStockThreshold: 12, openingQty: 70 },
  { code: "BT-SQ-100", design: "مربع", sizeMl: 100, cost: 34, lowStockThreshold: 10, openingQty: 55 },
  { code: "BT-CV-50", design: "منحني", sizeMl: 50, cost: 28, lowStockThreshold: 10, openingQty: 45 },
  { code: "BT-CV-100", design: "منحني", sizeMl: 100, cost: 36, lowStockThreshold: 8, openingQty: 40 },
  // Legacy codes
  { code: "BTL-CL-30", design: "كلاسيك", sizeMl: 30, cost: 18, lowStockThreshold: 10, openingQty: 40 },
  { code: "BTL-CL-50", design: "كلاسيك", sizeMl: 50, cost: 24, lowStockThreshold: 10, openingQty: 40 },
  { code: "BTL-CL-100", design: "كلاسيك", sizeMl: 100, cost: 30, lowStockThreshold: 10, openingQty: 40 },
];

export const PACKAGING: PackagingDef[] = [
  { code: "PK-STD", name: "علبة قياسية", type: "STANDARD_BOX", cost: 8, lowStockThreshold: 20, openingQty: 120 },
  { code: "PK-PRM", name: "علبة فاخرة", type: "PREMIUM_BOX", cost: 15, lowStockThreshold: 15, openingQty: 80 },
  { code: "PK-GIFT", name: "تغليف هدايا", type: "GIFT_WRAPPING", cost: 12, lowStockThreshold: 15, openingQty: 70 },
  { code: "PKG-STD", name: "علبة قياسية", type: "STANDARD_BOX", cost: 8, lowStockThreshold: 10, openingQty: 40 },
  { code: "PKG-GIFT", name: "علبة هدايا", type: "PREMIUM_BOX", cost: 10, lowStockThreshold: 5, openingQty: 30 },
];

export const COMPONENTS: ComponentDef[] = [
  { code: "CO-01", name: "كحول عطور", kind: "ALCOHOL", cost: 0.8, lowStockThreshold: 2000, openingQty: 30000, purchaseUnit: "L", stockUnit: "ML" },
  { code: "ST-01", name: "مثبت عطور", kind: "STABILIZER", cost: 2.0, lowStockThreshold: 200, openingQty: 3000, purchaseUnit: "L", stockUnit: "ML" },
  { code: "PM-A", name: "بخاخ نوع أ", kind: "PUMP", cost: 5, lowStockThreshold: 20, openingQty: 200, purchaseUnit: "PCS", stockUnit: "PCS" },
  // Legacy
  { code: "ALC-01", name: "كحول عطور", kind: "ALCOHOL", cost: 0.8, lowStockThreshold: 2000, openingQty: 15000, purchaseUnit: "L", stockUnit: "ML" },
  { code: "STB-01", name: "مثبت عطور", kind: "STABILIZER", cost: 2.0, lowStockThreshold: 100, openingQty: 1000, purchaseUnit: "L", stockUnit: "ML" },
  { code: "PMP-A", name: "بخاخ نوع أ", kind: "PUMP", cost: 5, lowStockThreshold: 10, openingQty: 100, purchaseUnit: "PCS", stockUnit: "PCS" },
];
