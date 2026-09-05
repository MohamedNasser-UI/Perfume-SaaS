import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { SearchSelect } from "@/components/search-select";
import { fmtDate, money } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { paginate, TablePager } from "@/components/table-pager";

type CatalogItem = {
  id: string;
  name: string;
  code?: string;
  itemType?: string;
  purchaseUnit?: string;
};

type PurchaseLine = {
  itemId: string;
  quantity: number;
  unit: "ML" | "L" | "PCS";
  unitCost: number;
};

function asPurchaseUnit(value?: string): PurchaseLine["unit"] {
  return value === "ML" || value === "L" || value === "PCS" ? value : "PCS";
}

function emptyLine(): PurchaseLine {
  return { itemId: "", quantity: 1, unit: "L", unitCost: 0 };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchasesPage() {
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ["purchases"], queryFn: () => api<any[]>("/purchases") });
  const paged = paginate(data ?? [], page);
  return (
    <div>
      <PageHeader title={t("proc.title")} actions={<Link to="/procurement/new"><Button>{t("proc.new")}</Button></Link>} />
      <Card className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-start">
            <tr>
              <th className="p-3">{t("proc.number")}</th>
              <th>{t("proc.supplier")}</th>
              <th>{t("date")}</th>
              <th>{t("total")}</th>
              <th>{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.slice.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <Link className="text-gold" to={`/procurement/${p.id}`}>{p.number}</Link>
                </td>
                <td>{p.supplier.name}</td>
                <td>{fmtDate(p.invoiceDate, locale)}</td>
                <td>{money(Number(p.totalAmount), tenant?.currency, locale)}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePager page={paged.current} pageCount={paged.pageCount} onPage={setPage} />
      </Card>
    </div>
  );
}

export function NewPurchasePage() {
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => api<any[]>("/suppliers") });
  const items = useQuery({ queryKey: ["catalog-items"], queryFn: () => api<CatalogItem[]>("/catalog/items") });
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayDate);
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()]);
  const pickerItems = useMemo(
    () => (items.data ?? []).map((it) => ({ id: it.id, label: it.name, hint: it.code })),
    [items.data],
  );

  function resetForm() {
    setSupplierId("");
    setInvoiceNumber("");
    setInvoiceDate(todayDate());
    setLines([emptyLine()]);
  }

  function setLineItem(index: number, itemId: string) {
    const catalogItem = (items.data ?? []).find((it) => it.id === itemId);
    setLines(
      lines.map((x, idx) =>
        idx === index
          ? { ...x, itemId, unit: catalogItem ? asPurchaseUnit(catalogItem.purchaseUnit) : x.unit }
          : x,
      ),
    );
  }

  const mutate = useMutation({
    mutationFn: () =>
      api("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          invoiceNumber,
          invoiceDate,
          lines: lines.filter((l) => l.itemId).map(({ itemId, quantity, unit, unitCost }) => ({ itemId, quantity, unit, unitCost })),
        }),
      }),
    onSuccess: (res: any) => {
      toast.success(res.creditWarning ? t("proc.creditWarn") : t("proc.posted"));
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  return (
    <div>
      <PageHeader title={t("proc.newTitle")} />
      <Card className="space-y-3">
        <Label>{t("proc.supplier")}</Label>
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">{t("select")}</option>
          {(suppliers.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("proc.invoiceNo")}</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <Label>{t("date")}</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-black px-2 py-2 text-sm font-medium text-white sm:grid-cols-4">
          <span>{t("proc.item")}</span>
          <span>{t("proc.qty")}</span>
          <span>{t("proc.unit")}</span>
          <span>{t("proc.unitCost")}</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SearchSelect
              items={pickerItems}
              value={l.itemId}
              onChange={(id) => setLineItem(i, id)}
              placeholder={t("proc.searchItems")}
              emptyLabel={t("proc.noItemMatches")}
            />
            <Input
              type="number"
              min={0}
              value={l.quantity}
              onChange={(e) => setLines(lines.map((x, idx) => (idx === i ? { ...x, quantity: Number(e.target.value) } : x)))}
            />
            <Select
              value={l.unit}
              onChange={(e) =>
                setLines(lines.map((x, idx) => (idx === i ? { ...x, unit: asPurchaseUnit(e.target.value) } : x)))
              }
            >
              <option value="L">L</option>
              <option value="ML">ML</option>
              <option value="PCS">PCS</option>
            </Select>
            <Input
              type="number"
              min={0}
              value={l.unitCost}
              onChange={(e) => setLines(lines.map((x, idx) => (idx === i ? { ...x, unitCost: Number(e.target.value) } : x)))}
            />
          </div>
        ))}
        <Button variant="outline" onClick={() => setLines([...lines, emptyLine()])}>
          {t("proc.addLine")}
        </Button>
        <div className="text-end font-serif text-2xl">{money(total, tenant?.currency, locale)}</div>
        <Button onClick={() => mutate.mutate()} disabled={!lines.some((l) => l.itemId) || mutate.isPending}>
          {t("proc.post")}
        </Button>
      </Card>
    </div>
  );
}

export function PurchaseDetailPage() {
  const { id } = useParams();
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ["purchase", id], queryFn: () => api<any>(`/purchases/${id}`) });
  if (!data) return <div>{t("loading")}</div>;
  return (
    <div>
      <PageHeader title={data.number} subtitle={data.supplier.name} />
      <Card>
        {(data.lines ?? []).map((l: any) => (
          <div key={l.id} className="flex justify-between border-b py-2 text-sm">
            <span>{l.item.name} · {Number(l.quantity)} {l.unit}</span>
            <span>{money(Number(l.lineTotal), tenant?.currency, locale)}</span>
          </div>
        ))}
        <div className="mt-3 text-end font-semibold">{money(Number(data.totalAmount), tenant?.currency, locale)}</div>
      </Card>
    </div>
  );
}
