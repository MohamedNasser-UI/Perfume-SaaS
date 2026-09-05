import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePos, CustomPreview, PosLine } from "@/lib/pos-store";
import { maxPosLineQty, type InventoryOnHand, type PosStockCatalog } from "@/lib/pos-stock";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { money } from "@/lib/utils";
import { canSeeItemCost } from "@/lib/staff-pages";

type ItemRef = { id: string; inventoryItemId?: string; inventoryItem?: { id: string }; active?: boolean };

type Catalog = {
  oils: Array<ItemRef & { name: string }>;
  concentrations: { id: string; name: string; oilPercentage: number; active?: boolean }[];
  bottles: Array<
    ItemRef & {
      design: string;
      sizeMl: number;
      imageUrl?: string | null;
      pump?: ItemRef & { name: string };
    }
  >;
  packaging: Array<ItemRef & { name: string }>;
  stabilizers: Array<ItemRef & { name: string }>;
  alcohols: Array<ItemRef & { name: string; active?: boolean }>;
  products: Array<ItemRef & { name: string; classification: "ORIGINAL" | "HIGH_COPY"; sellingPrice: number; barcode?: string }>;
  others: Array<ItemRef & { name: string; classification: "OTHER"; sellingPrice: number }>;
  discounts: { id: string; name: string; percentage: number; active: boolean }[];
  paymentMethods: { id: string; name: string; code: string; active: boolean }[];
  markup: number;
};

export function PosPage() {
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const pos = usePos();
  const queryClient = useQueryClient();
  const ccy = tenant?.currency ?? "EGP";
  const [mobile, setMobile] = useState("");
  const [newName, setNewName] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [mobileQuery, setMobileQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestBox = useRef<HTMLDivElement>(null);

  const oils = useQuery({ queryKey: ["oils"], queryFn: () => api<Catalog["oils"]>("/oils") });
  const bottles = useQuery({ queryKey: ["bottles"], queryFn: () => api<Catalog["bottles"]>("/bottles") });
  const packaging = useQuery({ queryKey: ["packaging"], queryFn: () => api<Catalog["packaging"]>("/packaging") });
  const stabilizers = useQuery({ queryKey: ["stabilizers"], queryFn: () => api<Catalog["stabilizers"]>("/stabilizers") });
  const alcohols = useQuery({ queryKey: ["alcohols"], queryFn: () => api<Catalog["alcohols"]>("/alcohols") });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api<Catalog["products"]>("/products") });
  const others = useQuery({ queryKey: ["others"], queryFn: () => api<Catalog["others"]>("/others") });
  const inventory = useQuery({ queryKey: ["inventory"], queryFn: () => api<InventoryOnHand[]>("/inventory") });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      api<{
        concentrations: Catalog["concentrations"];
        discounts: Catalog["discounts"];
        paymentMethods: Catalog["paymentMethods"];
        pricing: { markupPercentage: string };
      }>("/settings"),
  });
  const finished = useQuery({
    queryKey: ["finished"],
    queryFn: () =>
      api<{ id: string; sellingPrice: string; configuration: { oil: { name: string }; bottleSizeMl: number } }[]>(
        "/finished-customized",
      ),
  });

  useEffect(() => {
    const digits = mobile.replace(/\D/g, "");
    const timer = setTimeout(() => setMobileQuery(digits), 200);
    return () => clearTimeout(timer);
  }, [mobile]);

  const suggestions = useQuery({
    queryKey: ["customer-suggest", mobileQuery],
    queryFn: () => api<{ id: string; name: string; mobile: string }[]>(`/customers/suggest?mobile=${encodeURIComponent(mobileQuery)}`),
    enabled: mobileQuery.length >= 3,
  });

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!suggestBox.current?.contains(event.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const stockCatalog = useMemo<PosStockCatalog>(
    () => ({
      products: [...(products.data ?? []), ...(others.data ?? [])],
      oils: oils.data ?? [],
      bottles: bottles.data ?? [],
      alcohols: alcohols.data ?? [],
      stabilizers: stabilizers.data ?? [],
      packaging: packaging.data ?? [],
    }),
    [products.data, others.data, oils.data, bottles.data, alcohols.data, stabilizers.data, packaging.data],
  );

  const subtotal = pos.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discountAmt = subtotal * (pos.discountPct / 100);
  const total = subtotal - discountAmt;

  async function findCustomer() {
    const found = await api<{ id: string; name: string; mobile: string } | null>(
      `/customers/search?mobile=${encodeURIComponent(mobile)}`,
    );
    if (found) {
      pos.setCustomer(found);
      setMobile(found.mobile);
      setShowSuggestions(false);
      toast.success(t("pos.customerFound", { name: found.name }));
    } else {
      toast.message(t("pos.customerMissing"));
    }
  }

  async function createCustomer() {
    const created = await api<{ id: string; name: string; mobile: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({ name: newName, mobile }),
    });
    pos.setCustomer(created);
    toast.success(t("pos.customerCreated"));
  }

  const complete = useMutation({
    mutationFn: async () => {
      if (!pos.customer) throw new Error(t("pos.needCustomer"));
      if (!pos.lines.length) throw new Error(t("pos.needLine"));
      if (!pos.paymentMethodId) throw new Error(t("pos.needPayment"));
      const lines = pos.lines.map((l) => {
        if (l.lineType === "CUSTOMIZED") {
          return { lineType: "CUSTOMIZED" as const, quantity: l.qty, ...l.payload };
        }
        if (l.lineType === "FINISHED_CUSTOMIZED") {
          return { lineType: "FINISHED_CUSTOMIZED" as const, finishedItemId: l.finishedItemId, quantity: 1 as const };
        }
        return { lineType: l.lineType, productId: l.productId, quantity: l.qty };
      });
      return api<{ orderNumber: string }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: pos.customer.id,
          discountId: pos.discountId,
          paymentMethodId: pos.paymentMethodId,
          lines,
        }),
      });
    },
    onSuccess: (order: { orderNumber: string }) => {
      toast.success(t("pos.salePosted", { number: order.orderNumber }));
      pos.clear();
      setMobile("");
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err) => {
      const body = err instanceof ApiError ? err.body : null;
      const shortages = body && typeof body === "object" && "shortages" in body ? (body as { shortages: { itemName: string; shortage: number; unit: string }[] }).shortages : null;
      if (shortages?.length) {
        toast.error(shortages.map((s) => t("pos.shortage", { name: s.itemName, qty: s.shortage, unit: s.unit })).join(" · "));
      } else {
        toast.error(err instanceof Error ? err.message : t("pos.saleFailed"));
      }
    },
  });

  async function addByBarcode() {
    if (!barcode) return;
    const p = await api<Catalog["products"][number] | null>(`/products/barcode/${barcode}`);
    if (!p) {
      toast.error(t("pos.barcodeMissing"));
      return;
    }
    pos.addLine({
      key: crypto.randomUUID(),
      lineType: p.classification,
      label: p.name,
      qty: 1,
      unitPrice: Number(p.sellingPrice),
      productId: p.id,
    });
    setBarcode("");
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="space-y-4">
        <div>
          <Label>{t("pos.customerMobile")}</Label>
          <div className="relative" ref={suggestBox}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setShowSuggestions(true);
                  if (pos.customer) pos.setCustomer(null);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="010xxxxxxxx"
                autoComplete="off"
              />
              <Button type="button" className="sm:shrink-0" onClick={findCustomer}>
                {t("search")}
              </Button>
            </div>
            {showSuggestions && mobileQuery.length >= 3 && !pos.customer ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg">
                {(suggestions.data ?? []).length ? (
                  suggestions.data!.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-paper"
                      onClick={() => {
                        pos.setCustomer(c);
                        setMobile(c.mobile);
                        setShowSuggestions(false);
                        toast.success(t("pos.customerFound", { name: c.name }));
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-stone-500">{c.mobile}</span>
                    </button>
                  ))
                ) : suggestions.isFetching ? (
                  <div className="px-3 py-2 text-sm text-stone-500">{t("loading")}</div>
                ) : (
                  <div className="px-3 py-2 text-sm text-stone-500">{t("pos.noCustomerMatches")}</div>
                )}
              </div>
            ) : null}
          </div>
          {pos.customer ? (
            <p className="mt-2 text-sm font-medium">
              {pos.customer.name} · {pos.customer.mobile}
            </p>
          ) : (
            <div className="mt-2 flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("pos.newCustomerName")} />
              <Button type="button" variant="outline" onClick={createCustomer}>
                {t("create")}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setBuilderOpen(true)}>
            {t("pos.customPerfume")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setReadyOpen(true)}>
            {t("pos.readyMade")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setOthersOpen(true)}>
            {t("pos.others")}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder={t("pos.scanBarcode")} />
          <Button type="button" variant="outline" onClick={addByBarcode}>
            {t("add")}
          </Button>
        </div>

        <div className="space-y-2">
          {pos.lines.length === 0 && <p className="text-sm text-stone-500">{t("pos.noLines")}</p>}
          {pos.lines.map((l) => {
            const maxQty = maxPosLineQty({
              inventory: inventory.data,
              catalog: stockCatalog,
              lines: pos.lines,
              lineKey: l.key,
            });
            return (
            <div key={l.key} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{l.label}</div>
                <div className="text-xs text-stone-500">{l.lineType}</div>
              </div>
              {l.lineType !== "FINISHED_CUSTOMIZED" ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-9 px-0 text-lg"
                    aria-label={t("pos.qtyDecrease")}
                    disabled={l.qty <= 1}
                    onClick={() => pos.setLineQty(l.key, l.qty - 1, maxQty)}
                  >
                    −
                  </Button>
                  <span className="min-w-8 text-center font-medium tabular-nums" aria-live="polite">
                    {l.qty}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-9 px-0 text-lg"
                    aria-label={t("pos.qtyIncrease")}
                    disabled={maxQty != null && l.qty >= maxQty}
                    onClick={() => pos.setLineQty(l.key, l.qty + 1, maxQty)}
                  >
                    +
                  </Button>
                </div>
              ) : null}
              <div className="flex shrink-0 items-center gap-3">
                <div className="font-semibold">{money(l.unitPrice * l.qty, ccy, locale)}</div>
                <Button variant="ghost" onClick={() => pos.removeLine(l.key)}>
                  {t("pos.remove")}
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>{t("pos.subtotal")}</span>
            <span>{money(subtotal, ccy, locale)}</span>
          </div>
          <div>
            <Label>{t("pos.discount")}</Label>
            <Select
              value={pos.discountId ?? ""}
              onChange={(e) => {
                const d = settings.data?.discounts.find((x) => x.id === e.target.value);
                pos.setDiscount(d?.id, Number(d?.percentage ?? 0));
              }}
            >
              <option value="">{t("none")}</option>
              {settings.data?.discounts.filter((d) => d.active).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <div className="mt-1 flex justify-between text-stone-500">
              <span>{t("pos.discount")}</span>
              <span>- {money(discountAmt, ccy, locale)}</span>
            </div>
          </div>
          <div className="flex justify-between font-serif text-2xl">
            <span>{t("total")}</span>
            <span>{money(total, ccy, locale)}</span>
          </div>
          <div className="flex gap-2">
            {settings.data?.paymentMethods.filter((p) => p.active).map((p) => (
              <Button
                key={p.id}
                type="button"
                variant={pos.paymentMethodId === p.id ? "primary" : "outline"}
                className="flex-1"
                onClick={() => pos.setPayment(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
          <Button className="w-full py-3" disabled={complete.isPending} onClick={() => complete.mutate()}>
            {t("pos.completeSale")}
          </Button>
        </div>
      </Card>

      {builderOpen && oils.data && bottles.data && settings.data && (
        <PerfumeBuilder
          oils={oils.data}
          bottles={bottles.data}
          concentrations={settings.data.concentrations.filter((c) => c.active !== false)}
          packaging={packaging.data ?? []}
          stabilizers={stabilizers.data ?? []}
          currency={ccy}
          onClose={() => setBuilderOpen(false)}
          onAdd={(line) => {
            pos.addLine(line);
            setBuilderOpen(false);
          }}
        />
      )}

      {readyOpen && (
        <ReadyMadePicker
          products={products.data ?? []}
          finished={finished.data ?? []}
          currency={ccy}
          locale={locale}
          onAddProduct={(p) => {
            pos.addLine({
              key: crypto.randomUUID(),
              lineType: p.classification,
              label: p.name,
              qty: 1,
              unitPrice: Number(p.sellingPrice),
              productId: p.id,
            });
            setReadyOpen(false);
          }}
          onAddFinished={(f) => {
            pos.addLine({
              key: crypto.randomUUID(),
              lineType: "FINISHED_CUSTOMIZED",
              label: `Returned ${f.configuration.oil.name} ${f.configuration.bottleSizeMl}ml`,
              qty: 1,
              unitPrice: Number(f.sellingPrice),
              finishedItemId: f.id,
            });
            setReadyOpen(false);
          }}
          onClose={() => setReadyOpen(false)}
        />
      )}

      {othersOpen && (
        <OthersPicker
          items={others.data ?? []}
          currency={ccy}
          locale={locale}
          onAdd={(p) => {
            pos.addLine({
              key: crypto.randomUUID(),
              lineType: "OTHER",
              label: p.name,
              qty: 1,
              unitPrice: Number(p.sellingPrice),
              productId: p.id,
            });
            setOthersOpen(false);
          }}
          onClose={() => setOthersOpen(false)}
        />
      )}
    </div>
  );
}

function matchesFilter(haystack: string, query: string) {
  const q = query.trim().toLowerCase();
  return !q || haystack.toLowerCase().includes(q);
}

type ReadyProduct = Catalog["products"][number];
type FinishedItem = {
  id: string;
  sellingPrice: string;
  configuration: { oil: { name: string }; bottleSizeMl: number };
};

function ReadyMadePicker({
  products,
  finished,
  currency,
  locale,
  onAddProduct,
  onAddFinished,
  onClose,
}: {
  products: ReadyProduct[];
  finished: FinishedItem[];
  currency: string;
  locale: "en" | "ar";
  onAddProduct: (product: ReadyProduct) => void;
  onAddFinished: (item: FinishedItem) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const filteredProducts = useMemo(
    () => products.filter((p) => matchesFilter(`${p.name} ${p.classification} ${p.barcode ?? ""}`, q)),
    [products, q],
  );
  const filteredFinished = useMemo(
    () =>
      finished.filter((f) =>
        matchesFilter(`${f.configuration.oil.name} ${t("pos.returned", { oil: f.configuration.oil.name })}`, q),
      ),
    [finished, q, t],
  );
  const empty = filteredProducts.length === 0 && filteredFinished.length === 0;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[80vh] w-full max-w-lg overflow-auto">
        <h2 className="font-serif text-2xl">{t("pos.readyMadeTitle")}</h2>
        <Input
          autoFocus
          className="mt-4"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("pos.filter")}
        />
        <div className="mt-4 space-y-2">
          {empty ? (
            <p className="text-sm text-stone-500">{t("pos.noMatches")}</p>
          ) : (
            <>
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center justify-between rounded-xl border p-3 text-start hover:bg-stone-50"
                  onClick={() => onAddProduct(p)}
                >
                  <span>
                    {p.name} · {p.classification}
                  </span>
                  <span>{money(Number(p.sellingPrice), currency, locale)}</span>
                </button>
              ))}
              {filteredFinished.map((f) => (
                <button
                  key={f.id}
                  className="flex w-full items-center justify-between rounded-xl border p-3 text-start hover:bg-stone-50"
                  onClick={() => onAddFinished(f)}
                >
                  <span>{t("pos.returned", { oil: f.configuration.oil.name })}</span>
                  <span>{money(Number(f.sellingPrice), currency, locale)}</span>
                </button>
              ))}
            </>
          )}
        </div>
        <Button className="mt-4" variant="ghost" onClick={onClose}>
          {t("close")}
        </Button>
      </Card>
    </div>
  );
}

function OthersPicker({
  items,
  currency,
  locale,
  onAdd,
  onClose,
}: {
  items: Catalog["others"];
  currency: string;
  locale: "en" | "ar";
  onAdd: (item: Catalog["others"][number]) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => items.filter((p) => matchesFilter(p.name, q)), [items, q]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[80vh] w-full max-w-lg overflow-auto">
        <h2 className="font-serif text-2xl">{t("pos.othersTitle")}</h2>
        <Input
          autoFocus
          className="mt-4"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("pos.filter")}
        />
        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-stone-500">{t("pos.noMatches")}</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center justify-between rounded-xl border p-3 text-start hover:bg-stone-50"
                onClick={() => onAdd(p)}
              >
                <span>{p.name}</span>
                <span>{money(Number(p.sellingPrice), currency, locale)}</span>
              </button>
            ))
          )}
        </div>
        <Button className="mt-4" variant="ghost" onClick={onClose}>
          {t("close")}
        </Button>
      </Card>
    </div>
  );
}

type PickerKind = "oil" | "concentration" | "bottle";

type PickerItem = { id: string; title: string; subtitle?: string; imageUrl?: string | null };

function PerfumeBuilder({
  oils,
  bottles,
  concentrations,
  packaging,
  stabilizers,
  currency,
  onClose,
  onAdd,
}: {
  oils: { id: string; name: string }[];
  bottles: { id: string; design: string; sizeMl: number; imageUrl?: string | null; pump?: { name: string } }[];
  concentrations: { id: string; name: string; oilPercentage: number; active?: boolean }[];
  packaging: { id: string; name: string }[];
  stabilizers: { id: string; name: string }[];
  currency: string;
  onClose: () => void;
  onAdd: (line: PosLine) => void;
}) {
  const [oilId, setOilId] = useState("");
  const [concentrationId, setConcentrationId] = useState("");
  const [bottleId, setBottleId] = useState("");
  const [picking, setPicking] = useState<PickerKind | null>(null);
  const oil = oils.find((o) => o.id === oilId);
  const bottle = bottles.find((b) => b.id === bottleId);
  const conc = concentrations.find((c) => c.id === concentrationId);
  const standard = bottle && conc ? (bottle.sizeMl * Number(conc.oilPercentage)) / 100 : 0;
  const [oilActual, setOilActual] = useState(0);
  const [stabId, setStabId] = useState("");
  const [stabQty, setStabQty] = useState(0);
  const [packId, setPackId] = useState("");
  const [customerBottle, setCustomerBottle] = useState(false);
  const [preview, setPreview] = useState<CustomPreview | null>(null);
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const showCost = canSeeItemCost(user?.role, user?.seeItemCost);

  useEffect(() => {
    if (standard) setOilActual(standard);
  }, [standard]);

  const payload = useMemo(
    () => ({
      oilId,
      concentrationId,
      bottleId,
      oilActualQtyMl: oilActual,
      stabilizerId: stabId || undefined,
      stabilizerQtyMl: stabQty || undefined,
      packagingId: packId || undefined,
      customerSuppliedBottle: customerBottle,
    }),
    [oilId, concentrationId, bottleId, oilActual, stabId, stabQty, packId, customerBottle],
  );

  useEffect(() => {
    if (!oilId || !concentrationId || !bottleId || !oilActual) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      api<CustomPreview>("/pricing/preview", { method: "POST", body: JSON.stringify(payload) })
        .then(setPreview)
        .catch((e) => toast.error(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [payload, oilId, concentrationId, bottleId, oilActual]);

  function pick(kind: PickerKind, id: string) {
    if (kind === "oil") setOilId(id);
    if (kind === "concentration") setConcentrationId(id);
    if (kind === "bottle") setBottleId(id);
    setPicking(null);
  }

  const pickerItems: Record<PickerKind, PickerItem[]> = {
    oil: oils.map((o) => ({ id: o.id, title: o.name })),
    concentration: concentrations.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: t("pos.oilPct", { pct: Number(c.oilPercentage) }),
    })),
    bottle: bottles.map((b) => ({
      id: b.id,
      title: `${b.design} ${b.sizeMl}ml`,
      subtitle: b.pump ? b.pump.name : undefined,
      imageUrl: b.imageUrl,
    })),
  };

  const selectedId = picking === "oil" ? oilId : picking === "concentration" ? concentrationId : bottleId;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-3">
      <Card className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden p-0">
        {picking ? (
          <CardPicker
            title={
              picking === "oil"
                ? t("pos.chooseOil")
                : picking === "concentration"
                  ? t("pos.chooseConcentration")
                  : t("pos.chooseBottle")
            }
            items={pickerItems[picking]}
            selectedId={selectedId}
            onSelect={(id) => pick(picking, id)}
            onBack={() => setPicking(null)}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-5 py-4">
              <h2 className="font-serif text-2xl">{t("pos.builderTitle")}</h2>
              <p className="text-sm text-stone-500">{t("pos.builderHint")}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <ChoiceTile label={t("pos.oil")} value={oil?.name} placeholder={t("pos.tapToChoose")} onClick={() => setPicking("oil")} />
                <ChoiceTile
                  label={t("pos.concentration")}
                  value={conc ? `${conc.name} · ${Number(conc.oilPercentage)}%` : undefined}
                  placeholder={t("pos.tapToChoose")}
                  onClick={() => setPicking("concentration")}
                />
                <ChoiceTile
                  label={t("pos.bottle")}
                  value={bottle ? `${bottle.design} ${bottle.sizeMl}ml` : undefined}
                  placeholder={t("pos.tapToChoose")}
                  imageUrl={bottle?.imageUrl}
                  onClick={() => setPicking("bottle")}
                />
              </div>

              {oilId && concentrationId && bottleId ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-paper p-3">
                      <Label>{t("pos.standardOil")}</Label>
                      <div className="font-serif text-xl">{t("pos.oilUsedLabel", { qty: standard })}</div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 p-3">
                      <Label>{t("pos.actualOil")}</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Button type="button" variant="outline" className="h-11 w-11 px-0 text-lg" onClick={() => setOilActual((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}>
                          −
                        </Button>
                        <div className="flex-1 text-center font-serif text-xl">{t("pos.oilUsedLabel", { qty: oilActual })}</div>
                        <Button type="button" variant="outline" className="h-11 w-11 px-0 text-lg" onClick={() => setOilActual((v) => +(v + 0.5).toFixed(1))}>
                          +
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>{t("pos.stabilizer")}</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Chip selected={!stabId} onClick={() => { setStabId(""); setStabQty(0); }}>
                        {t("none")}
                      </Chip>
                      {stabilizers.map((s) => (
                        <Chip key={s.id} selected={stabId === s.id} onClick={() => setStabId(s.id)}>
                          {s.name}
                        </Chip>
                      ))}
                    </div>
                    {stabId ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Button type="button" variant="outline" className="h-11 w-11 px-0" onClick={() => setStabQty((v) => Math.max(0, +(v - 0.5).toFixed(1)))}>
                          −
                        </Button>
                        <span className="min-w-16 text-center font-serif text-lg">{t("pos.oilUsedLabel", { qty: stabQty })}</span>
                        <Button type="button" variant="outline" className="h-11 w-11 px-0" onClick={() => setStabQty((v) => +(v + 0.5).toFixed(1))}>
                          +
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <Label>{t("pos.packaging")}</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Chip selected={!packId} onClick={() => setPackId("")}>
                        {t("none")}
                      </Chip>
                      {packaging.map((p) => (
                        <Chip key={p.id} selected={packId === p.id} onClick={() => setPackId(p.id)}>
                          {p.name}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <Chip selected={customerBottle} onClick={() => setCustomerBottle((v) => !v)}>
                    {t("pos.customerBottle")}
                  </Chip>

                  {preview && (
                    <div className="rounded-2xl bg-paper p-4 text-sm">
                      <div>{t("pos.alcohol", { qty: preview.alcoholQtyMl })}</div>
                      {showCost && preview.materialCost != null ? (
                        <div>{t("pos.cost", { amount: money(preview.materialCost, currency, locale) })}</div>
                      ) : null}
                      <div className="font-serif text-2xl">
                        {t("pos.suggested", { amount: money(preview.calculatedPrice, currency, locale) })}
                      </div>
                      {preview.shortages?.length ? (
                        <div className="mt-2 text-red-700">
                          {preview.shortages.map((s) => (
                            <div key={s.itemName}>
                              {t("pos.shortage", { name: s.itemName, qty: s.shortage, unit: s.unit })}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-stone-500">{t("pos.chooseAll")}</p>
              )}
            </div>
            <div className="flex gap-2 border-t p-4">
              <Button variant="ghost" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button
                className="flex-1 py-3"
                disabled={!preview}
                onClick={() => {
                  if (!preview) return;
                  onAdd({
                    key: crypto.randomUUID(),
                    lineType: "CUSTOMIZED",
                    label: `${preview.oilName} · ${preview.concentrationName} · ${preview.bottleSizeMl}ml`,
                    qty: 1,
                    unitPrice: preview.calculatedPrice,
                    payload,
                  });
                }}
              >
                {t("pos.addToOrder")}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ChoiceTile({
  label,
  value,
  placeholder,
  imageUrl,
  onClick,
}: {
  label: string;
  value?: string;
  placeholder: string;
  imageUrl?: string | null;
  onClick: () => void;
}) {
  const src = mediaUrl(imageUrl);
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border-2 border-stone-200 bg-white p-4 text-start transition hover:border-gold hover:bg-paper"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      {src ? (
        <div className="mt-2 overflow-hidden rounded-xl bg-paper">
          <img src={src} alt="" className="h-20 w-full object-contain" />
        </div>
      ) : null}
      <div className={`mt-2 font-serif text-xl leading-tight ${value ? "text-ink" : "text-stone-400"}`}>
        {value ?? placeholder}
      </div>
    </button>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        selected ? "bg-ink text-white" : "border border-stone-300 bg-white text-ink hover:bg-stone-50"
      }`}
    >
      {children}
    </button>
  );
}

function CardPicker({
  title,
  items,
  selectedId,
  onSelect,
  onBack,
}: {
  title: string;
  items: PickerItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const filtered = items.filter((item) => {
    const hay = `${item.title} ${item.subtitle ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const showSearch = items.length > 8;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t("back")}
        </Button>
        <h2 className="font-serif text-2xl">{title}</h2>
      </div>
      {showSearch ? (
        <div className="border-b px-4 py-3">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("pos.filter")}
          />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-stone-500">{t("pos.noMatches")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((item) => {
              const selected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`min-h-24 rounded-2xl border-2 p-3 text-start transition ${
                    selected ? "border-ink bg-ink text-white" : "border-stone-200 bg-white hover:border-gold hover:bg-paper"
                  }`}
                >
                  {item.imageUrl ? (
                    <div className={`mb-2 overflow-hidden rounded-xl ${selected ? "bg-white/10" : "bg-paper"}`}>
                      <img src={mediaUrl(item.imageUrl)} alt="" className="h-28 w-full object-contain" />
                    </div>
                  ) : null}
                  <div className="font-serif text-lg leading-tight">{item.title}</div>
                  {item.subtitle ? (
                    <div className={`mt-1 text-sm ${selected ? "text-stone-300" : "text-stone-500"}`}>{item.subtitle}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
