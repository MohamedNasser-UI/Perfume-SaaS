import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { fmtDate, money } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";

export function SuppliersPage() {
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["suppliers"], queryFn: () => api<any[]>("/suppliers") });
  const [form, setForm] = useState({ name: "", creditTerms: "", creditLimit: "", openingBalance: "" });
  const mutate = useMutation({
    mutationFn: () =>
      api("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          creditTerms: form.creditTerms,
          creditLimit: form.creditLimit === "" ? undefined : Number(form.creditLimit),
          openingBalance: form.openingBalance === "" ? 0 : Number(form.openingBalance),
        }),
      }),
    onSuccess: () => {
      toast.success(t("suppliers.created"));
      setForm({ name: "", creditTerms: "", creditLimit: "", openingBalance: "" });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader title={t("suppliers.title")} />
      <Card className="mb-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>{t("name")}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("suppliers.newName")} />
          </div>
          <div>
            <Label>{t("suppliers.terms")}</Label>
            <Input
              value={form.creditTerms}
              onChange={(e) => setForm({ ...form, creditTerms: e.target.value })}
              placeholder={t("suppliers.termsPlaceholder")}
            />
          </div>
          <div>
            <Label>{t("suppliers.creditLimit")}</Label>
            <Input
              type="number"
              min={0}
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              placeholder={t("suppliers.creditLimitHint")}
            />
          </div>
          <div>
            <Label>{t("suppliers.openingBalance")}</Label>
            <Input
              type="number"
              min={0}
              value={form.openingBalance}
              onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              placeholder="0"
            />
            <p className="mt-1 text-[11px] text-stone-500">{t("suppliers.openingBalanceHint")}</p>
          </div>
        </div>
        <Button onClick={() => mutate.mutate()}>{t("add")}</Button>
      </Card>
      <Card className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-start">
            <tr>
              <th className="p-3">{t("proc.supplier")}</th>
              <th>{t("suppliers.balance")}</th>
              <th>{t("suppliers.creditLimit")}</th>
              <th>{t("suppliers.terms")}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">
                  <Link className="text-gold" to={`/suppliers/${s.id}`}>{s.name}</Link>
                </td>
                <td>{money(s.balance, tenant?.currency, locale)}</td>
                <td>{s.creditLimit ? money(s.creditLimit, tenant?.currency, locale) : "—"}</td>
                <td>{s.creditTerms || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function SupplierDetailPage() {
  const { id } = useParams();
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["supplier", id], queryFn: () => api<any>(`/suppliers/${id}`) });
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("CASH");
  const [account, setAccount] = useState({ creditTerms: "", creditLimit: "" });

  useEffect(() => {
    if (!data?.supplier) return;
    setAccount({
      creditTerms: data.supplier.creditTerms ?? "",
      creditLimit: data.supplier.creditLimit == null ? "" : String(data.supplier.creditLimit),
    });
  }, [data?.supplier]);

  const pay = useMutation({
    mutationFn: () =>
      api(`/suppliers/${id}/payments`, {
        method: "POST",
        body: JSON.stringify({ supplierId: id, amount, paymentMethod: method, paymentDate: new Date().toISOString() }),
      }),
    onSuccess: () => {
      toast.success(t("suppliers.paid"));
      setAmount(0);
      qc.invalidateQueries({ queryKey: ["supplier", id] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAccount = useMutation({
    mutationFn: () =>
      api(`/suppliers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          creditTerms: account.creditTerms,
          creditLimit: account.creditLimit === "" ? null : Number(account.creditLimit),
        }),
      }),
    onSuccess: () => {
      toast.success(t("suppliers.updated"));
      qc.invalidateQueries({ queryKey: ["supplier", id] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <div>{t("loading")}</div>;
  return (
    <div>
      <PageHeader
        title={data.supplier.name}
        subtitle={`${t("suppliers.balanceOf", { amount: money(data.supplier.balance, tenant?.currency, locale) })} · ${t("suppliers.paidTotal")} ${money(data.supplier.totalPaid ?? 0, tenant?.currency, locale)}`}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="font-semibold">{t("suppliers.account")}</h3>
          <div>
            <Label>{t("suppliers.terms")}</Label>
            <Input
              value={account.creditTerms}
              onChange={(e) => setAccount({ ...account, creditTerms: e.target.value })}
              placeholder={t("suppliers.termsPlaceholder")}
            />
          </div>
          <div>
            <Label>{t("suppliers.creditLimit")}</Label>
            <Input
              type="number"
              min={0}
              value={account.creditLimit}
              onChange={(e) => setAccount({ ...account, creditLimit: e.target.value })}
              placeholder={t("suppliers.creditLimitHint")}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-paper p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("suppliers.balance")}</div>
              <div className="font-serif text-xl">{money(data.supplier.balance, tenant?.currency, locale)}</div>
            </div>
            <div className="rounded-xl border border-stone-200 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("suppliers.paidTotal")}</div>
              <div className="font-serif text-xl">{money(data.supplier.totalPaid ?? 0, tenant?.currency, locale)}</div>
            </div>
          </div>
          <Button onClick={() => saveAccount.mutate()}>{t("suppliers.saveAccount")}</Button>
        </Card>
        <Card className="space-y-3">
          <Label>{t("suppliers.payAmount")}</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Label>{t("suppliers.method")}</Label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">{t("suppliers.cash")}</option>
            <option value="BANK_TRANSFER">{t("suppliers.bank")}</option>
          </Select>
          <Button onClick={() => pay.mutate()}>{t("suppliers.pay")}</Button>
        </Card>
      </div>
      <Card>
        {(data.ledger ?? []).map((l: any) => {
          const paid = Number(l.credit) > 0;
          const typeKey = `suppliers.type.${l.transactionType}` as MessageKey;
          return (
            <div key={l.id} className="flex items-start justify-between gap-3 border-b py-2 text-sm last:border-0">
              <div>
                <div>{fmtDate(l.transactionDate, locale)} · {t(typeKey)}</div>
                {paid ? (
                  <div className="text-xs text-stone-500">{t("suppliers.paidTotal")} {money(l.credit, tenant?.currency, locale)}</div>
                ) : Number(l.debit) > 0 ? (
                  <div className="text-xs text-stone-500">{t("suppliers.invoiceAmount")} {money(l.debit, tenant?.currency, locale)}</div>
                ) : null}
              </div>
              <div className="text-end">
                <div className={`font-medium ${paid ? "text-emerald-800" : ""}`}>
                  {paid ? "−" : "+"}
                  {money(paid ? l.credit : l.debit, tenant?.currency, locale)}
                </div>
                <div className="text-xs text-stone-500">{t("suppliers.runningBalance", { amount: money(l.balance, tenant?.currency, locale) })}</div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
