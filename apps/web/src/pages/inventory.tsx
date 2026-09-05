import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { fmtDate, money } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import { canSeeItemCost } from "@/lib/staff-pages";
import { paginate, TablePager } from "@/components/table-pager";

type ItemType =
  | "OIL"
  | "ALCOHOL"
  | "STABILIZER"
  | "BOTTLE"
  | "PUMP"
  | "PACKAGING"
  | "READY_MADE"
  | "FINISHED_CUSTOMIZED"
  | "OTHER";

type InventoryRow = {
  itemId: string;
  code: string;
  name: string;
  itemType: ItemType;
  onHand: number;
  unit: string;
  averageCost?: number;
  value?: number;
  isLowStock: boolean;
  design?: string | null;
  sizeMl?: number | null;
  packagingType?: string | null;
  classification?: string | null;
  brand?: string | null;
};

const CATEGORIES: { id: "ALL" | ItemType; key: MessageKey }[] = [
  { id: "ALL", key: "inventory.all" },
  { id: "OIL", key: "products.oils" },
  { id: "BOTTLE", key: "products.bottles" },
  { id: "PACKAGING", key: "products.packaging" },
  { id: "PUMP", key: "products.pumps" },
  { id: "ALCOHOL", key: "products.alcohol" },
  { id: "STABILIZER", key: "products.stabilizers" },
  { id: "READY_MADE", key: "products.readyMade" },
  { id: "OTHER", key: "products.others" },
  { id: "FINISHED_CUSTOMIZED", key: "inventory.finished" },
];

function subcategoryOf(row: InventoryRow) {
  if (row.itemType === "BOTTLE") {
    if (row.design) return row.design;
    const match = row.name.match(/^(.*?)\s+\d+\s*ml$/i);
    return match?.[1]?.trim() || row.name;
  }
  if (row.itemType === "PACKAGING") return row.packagingType || row.name;
  if (row.itemType === "READY_MADE") return row.classification || row.brand || null;
  return null;
}

function sizeOf(row: InventoryRow) {
  if (row.sizeMl) return row.sizeMl;
  const match = row.name.match(/(\d+)\s*ml/i);
  return match ? Number(match[1]) : null;
}

function Chip({
  selected,
  onClick,
  accent,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        selected
          ? accent
            ? "bg-gold text-white"
            : "bg-ink text-white"
          : "border border-stone-300 bg-white text-ink hover:bg-stone-50"
      }`}
    >
      {children}
    </button>
  );
}

export function InventoryPage() {
  const { tenant, user } = useAuth();
  const { t, locale } = useI18n();
  const seeCost = canSeeItemCost(user?.role, user?.seeItemCost);
  const { data } = useQuery({ queryKey: ["inventory"], queryFn: () => api<InventoryRow[]>("/inventory") });
  const [category, setCategory] = useState<"ALL" | ItemType>("ALL");
  const [subcategory, setSubcategory] = useState("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  function typeLabel(type: ItemType) {
    const found = CATEGORIES.find((c) => c.id === type);
    return found ? t(found.key) : type;
  }

  function subLabel(type: ItemType, value: string) {
    if (type === "PACKAGING") {
      if (value === "STANDARD_BOX") return t("products.standardBox");
      if (value === "PREMIUM_BOX") return t("products.premiumBox");
      if (value === "GIFT_WRAPPING") return t("products.giftWrap");
    }
    if (type === "READY_MADE") {
      if (value === "ORIGINAL") return t("products.original");
      if (value === "HIGH_COPY") return t("products.highCopy");
    }
    return value;
  }

  const rows = data ?? [];
  const byCategory = category === "ALL" ? rows : rows.filter((r) => r.itemType === category);
  const subOptions = Array.from(new Set(byCategory.map(subcategoryOf).filter((v): v is string => Boolean(v)))).sort((a, b) =>
    a.localeCompare(b),
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return byCategory
      .filter((r) => (subcategory === "ALL" ? true : subcategoryOf(r) === subcategory))
      .filter((r) => {
        if (!needle) return true;
        return `${r.name} ${r.code} ${r.design ?? ""} ${r.brand ?? ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const ga = subcategoryOf(a) ?? a.itemType;
        const gb = subcategoryOf(b) ?? b.itemType;
        const g = ga.localeCompare(gb);
        if (g !== 0) return g;
        return (sizeOf(a) ?? 0) - (sizeOf(b) ?? 0) || a.name.localeCompare(b.name);
      });
  }, [byCategory, subcategory, q]);

  const paged = paginate(filtered, page);

  const groups = useMemo(() => {
    const grouped = new Map<string, InventoryRow[]>();
    for (const row of paged.slice) {
      const sub = subcategoryOf(row);
      const key = category === "ALL" ? (sub ? `${row.itemType}::${sub}` : row.itemType) : (sub ?? row.itemType);
      const bucket = grouped.get(key) ?? [];
      bucket.push(row);
      grouped.set(key, bucket);
    }
    return Array.from(grouped.entries()).map(([key, list]) => {
      const first = list[0]!;
      const sub = subcategoryOf(first);
      const qty = list.reduce((s, r) => s + r.onHand, 0);
      const hasSizes = list.some((r) => sizeOf(r));
      let title: string | null = null;
      if (category === "ALL") {
        title = sub ? `${typeLabel(first.itemType)} · ${subLabel(first.itemType, sub)}` : typeLabel(first.itemType);
      } else if (sub && (grouped.size > 1 || subcategory === "ALL" || hasSizes)) {
        title = subLabel(first.itemType, sub);
      }
      return { key, title, rows: list, hasSizes, qty, unit: String(first.unit).toLowerCase() };
    });
  }, [paged.slice, category, subcategory, locale]);

  const showSize = filtered.some((r) => sizeOf(r));
  const colCount = 3 + (showSize ? 1 : 0) + (seeCost ? 2 : 0);

  return (
    <div>
      <PageHeader
        title={t("inventory.title")}
        actions={
          <div className="flex gap-2">
            <Link to="/inventory/movements">
              <Button variant="outline">{t("inventory.movements")}</Button>
            </Link>
            <Link to="/inventory/waste">
              <Button variant="outline">{t("inventory.waste")}</Button>
            </Link>
            <Link to="/inventory/adjustments">
              <Button variant="outline">{t("inventory.adjustments")}</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const count = c.id === "ALL" ? rows.length : rows.filter((r) => r.itemType === c.id).length;
          return (
            <Chip
              key={c.id}
              selected={category === c.id}
              onClick={() => {
                setCategory(c.id);
                setSubcategory("ALL");
                setPage(1);
              }}
            >
              {t(c.key)}
              <span className={`ms-2 text-xs ${category === c.id ? "text-stone-300" : "text-stone-400"}`}>{count}</span>
            </Chip>
          );
        })}
      </div>

      {subOptions.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip
            accent
            selected={subcategory === "ALL"}
            onClick={() => {
              setSubcategory("ALL");
              setPage(1);
            }}
          >
            {t("inventory.all")}
          </Chip>
          {subOptions.map((opt) => {
            const sample = byCategory.find((r) => subcategoryOf(r) === opt);
            const label = sample ? subLabel(sample.itemType, opt) : opt;
            const count = byCategory.filter((r) => subcategoryOf(r) === opt).length;
            return (
              <Chip
                key={opt}
                accent
                selected={subcategory === opt}
                onClick={() => {
                  setSubcategory(opt);
                  setPage(1);
                }}
              >
                {label}
                <span className={`ms-2 text-xs ${subcategory === opt ? "text-amber-100" : "text-stone-400"}`}>{count}</span>
              </Chip>
            );
          })}
        </div>
      ) : null}

      <Input
        className="mb-4 max-w-sm"
        placeholder={t("search")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />

      <Card className="overflow-auto p-0">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-stone-500">{t("inventory.noItems")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-start">
              <tr>
                <th className="p-3">{t("item")}</th>
                <th>{t("products.code")}</th>
                {showSize ? <th>{t("inventory.size")}</th> : null}
                <th>{t("inventory.onHand")}</th>
                {seeCost ? <th>{t("inventory.avgCost")}</th> : null}
                {seeCost ? <th>{t("value")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.key}>
                  {group.title ? (
                    <tr className="border-t bg-paper">
                      <td className="p-3 font-semibold" colSpan={colCount}>
                        {group.title}
                        <span className="ms-2 font-normal text-stone-500">
                          {group.hasSizes
                            ? t("inventory.sizesCount", { count: group.rows.length, qty: group.qty, unit: group.unit })
                            : t("inventory.itemsCount", { count: group.rows.length, qty: group.qty, unit: group.unit })}
                        </span>
                      </td>
                    </tr>
                  ) : null}
                  {group.rows.map((r) => (
                    <tr key={r.itemId} className={`border-t ${r.isLowStock ? "bg-red-50" : ""}`}>
                      <td className="p-3">{r.name}</td>
                      <td className="text-stone-500">{r.code}</td>
                      {showSize ? <td>{sizeOf(r) ? `${sizeOf(r)}ml` : "—"}</td> : null}
                      <td>
                        {r.onHand} {String(r.unit).toLowerCase()}
                      </td>
                      {seeCost ? <td>{money(r.averageCost ?? 0, tenant?.currency, locale)}</td> : null}
                      {seeCost ? <td>{money(r.value ?? 0, tenant?.currency, locale)}</td> : null}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        <TablePager page={paged.current} pageCount={paged.pageCount} onPage={setPage} />
      </Card>
    </div>
  );
}

export function MovementsPage() {
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ["movements"], queryFn: () => api<any[]>("/inventory/movements") });
  return (
    <div>
      <PageHeader title={t("inventory.movementsTitle")} />
      <Card className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-start">
            <tr>
              <th className="p-3">{t("date")}</th>
              <th>{t("item")}</th>
              <th>{t("type")}</th>
              <th>{t("quantity")}</th>
              <th>{t("inventory.ref")}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-3">{fmtDate(m.createdAt, locale)}</td>
                <td>{m.item.name}</td>
                <td>{m.movementType}</td>
                <td>
                  {Number(m.quantity)} {m.unit.toLowerCase()}
                </td>
                <td>
                  {m.referenceType} {m.referenceId.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function WastePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["catalog-items"], queryFn: () => api<any[]>("/catalog/items") });
  const list = useQuery({ queryKey: ["waste"], queryFn: () => api<any[]>("/inventory/waste") });
  const [form, setForm] = useState({ itemId: "", quantity: 0, unit: "ML", reason: "SPILLAGE", notes: "" });
  const mutate = useMutation({
    mutationFn: () => api("/inventory/waste", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success(t("inventory.wasteSaved"));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader title={t("inventory.wasteTitle")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <Label>{t("item")}</Label>
          <Select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">{t("select")}</option>
            {(items.data ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
          <Label>{t("quantity")}</Label>
          <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          <Label>{t("unit")}</Label>
          <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option>ML</option>
            <option>L</option>
            <option>PCS</option>
          </Select>
          <Label>{t("reason")}</Label>
          <Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
            <option>SPILLAGE</option>
            <option>DAMAGE</option>
            <option>WRONG_MIX</option>
            <option>OTHER</option>
          </Select>
          <Button onClick={() => mutate.mutate()}>{t("save")}</Button>
        </Card>
        <Card>
          {(list.data ?? []).map((w) => (
            <div key={w.id} className="flex justify-between border-b py-2 text-sm">
              <span>
                {w.item.name} · {w.reason}
              </span>
              <span>
                {Number(w.quantity)} {w.unit.toLowerCase()}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function AdjustmentsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["catalog-items"], queryFn: () => api<any[]>("/catalog/items") });
  const list = useQuery({ queryKey: ["adj"], queryFn: () => api<any[]>("/inventory/adjustments") });
  const [form, setForm] = useState({ itemId: "", quantity: 0, unit: "ML", reason: "Count", isOpeningBalance: false, unitCost: 0 });
  const mutate = useMutation({
    mutationFn: () => api("/inventory/adjustments", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success(t("inventory.posted"));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader title={t("inventory.adjustTitle")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <Label>{t("item")}</Label>
          <Select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">{t("select")}</option>
            {(items.data ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
          <Label>{t("inventory.adjustQty")}</Label>
          <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          <Label>{t("unit")}</Label>
          <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option>ML</option>
            <option>L</option>
            <option>PCS</option>
          </Select>
          <Label>{t("reason")}</Label>
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isOpeningBalance} onChange={(e) => setForm({ ...form, isOpeningBalance: e.target.checked })} />
            {t("inventory.opening")}
          </label>
          <Button onClick={() => mutate.mutate()}>{t("inventory.post")}</Button>
        </Card>
        <Card>
          {(list.data ?? []).map((a) => (
            <div key={a.id} className="flex justify-between border-b py-2 text-sm">
              <span>
                {a.item.name} · {a.reason}
              </span>
              <span>{Number(a.quantity)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
