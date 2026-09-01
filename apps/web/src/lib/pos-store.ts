import { create } from "zustand";

export type CustomPreview = {
  oilId: string;
  oilName: string;
  concentrationId: string;
  concentrationName: string;
  bottleId: string;
  bottleDesign: string;
  bottleSizeMl: number;
  oilStandardQtyMl: number;
  oilActualQtyMl: number;
  alcoholQtyMl: number;
  stabilizerId?: string;
  stabilizerQtyMl: number;
  packagingId?: string;
  customerSuppliedBottle: boolean;
  materialCost?: number;
  calculatedPrice: number;
  shortages?: { itemName: string; shortage: number; unit: string }[];
};

export type PosLine =
  | {
      key: string;
      lineType: "CUSTOMIZED";
      label: string;
      qty: number;
      unitPrice: number;
      payload: {
        oilId: string;
        concentrationId: string;
        bottleId: string;
        oilActualQtyMl: number;
        stabilizerId?: string;
        stabilizerQtyMl?: number;
        packagingId?: string;
        customerSuppliedBottle: boolean;
      };
    }
  | {
      key: string;
      lineType: "ORIGINAL" | "HIGH_COPY";
      label: string;
      qty: number;
      unitPrice: number;
      productId: string;
    }
  | {
      key: string;
      lineType: "FINISHED_CUSTOMIZED";
      label: string;
      qty: 1;
      unitPrice: number;
      finishedItemId: string;
    };

type Customer = { id: string; name: string; mobile: string };

type PosState = {
  customer: Customer | null;
  lines: PosLine[];
  discountId?: string;
  discountPct: number;
  paymentMethodId?: string;
  setCustomer: (c: Customer | null) => void;
  addLine: (line: PosLine) => void;
  removeLine: (key: string) => void;
  setDiscount: (id: string | undefined, pct: number) => void;
  setPayment: (id: string) => void;
  clear: () => void;
};

export const usePos = create<PosState>((set) => ({
  customer: null,
  lines: [],
  discountPct: 0,
  setCustomer: (customer) => set({ customer }),
  addLine: (line) => set((s) => ({ lines: [...s.lines, line] })),
  removeLine: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
  setDiscount: (discountId, discountPct) => set({ discountId, discountPct }),
  setPayment: (paymentMethodId) => set({ paymentMethodId }),
  clear: () => set({ customer: null, lines: [], discountId: undefined, discountPct: 0, paymentMethodId: undefined }),
}));
