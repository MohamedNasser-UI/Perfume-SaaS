import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, Input, PageHeader, Button } from "@/components/ui";
import { fmtDate, money } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePos } from "@/lib/pos-store";

export function CustomersPage() {
  const [q, setQ] = useState("");
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const { data } = useQuery({
    queryKey: ["customers", q],
    queryFn: () => api<any[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
  return (
    <div>
      <PageHeader title={t("customers.title")} />
      <Input className="mb-4 max-w-sm" placeholder={t("customers.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-start">
            <tr>
              <th className="p-3">{t("name")}</th>
              <th>{t("customers.mobile")}</th>
              <th>{t("customers.orders")}</th>
              <th>{t("customers.spend")}</th>
              <th>{t("customers.lastPurchase")}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <Link className="text-gold" to={`/customers/${c.id}`}>{c.name}</Link>
                </td>
                <td>{c.mobile}</td>
                <td>{c.orders}</td>
                <td>{money(c.totalSpend, tenant?.currency, locale)}</td>
                <td>{c.lastPurchase ? fmtDate(c.lastPurchase, locale) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function CustomerProfilePage() {
  const { id } = useParams();
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const pos = usePos();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["customer", id], queryFn: () => api<any>(`/customers/${id}`) });
  if (!data) return <div>{t("loading")}</div>;

  function repeat(cfg: any) {
    pos.setCustomer({ id: data.id, name: data.name, mobile: data.mobile });
    pos.addLine({
      key: crypto.randomUUID(),
      lineType: "CUSTOMIZED",
      label: `${cfg.oil.name} · ${cfg.concentration.name} · ${cfg.bottleSizeMl}ml`,
      qty: 1,
      unitPrice: 0,
      payload: {
        oilId: cfg.oilId,
        concentrationId: cfg.concentrationId,
        bottleId: cfg.bottleId,
        oilActualQtyMl: Number(cfg.oilActualQtyMl),
        stabilizerId: cfg.stabilizerId ?? undefined,
        stabilizerQtyMl: Number(cfg.stabilizerQtyMl || 0) || undefined,
        packagingId: cfg.packagingId ?? undefined,
        customerSuppliedBottle: cfg.customerSuppliedBottle,
      },
    });
    navigate("/sales/new");
  }

  return (
    <div>
      <PageHeader title={data.name} subtitle={data.mobile} />
      <div className="mb-4 text-sm text-stone-600">
        {t("customers.orderCount", { count: data.orderCount, spend: money(data.totalSpend, tenant?.currency, locale) })}
      </div>
      <Card>
        {(data.orders ?? []).map((o: any) => (
          <div key={o.id} className="border-b py-3 last:border-0">
            <div className="flex justify-between text-sm">
              <Link className="font-medium text-gold" to={`/sales/${o.id}`}>{o.orderNumber}</Link>
              <span>{fmtDate(o.createdAt, locale)}</span>
            </div>
            {o.lines.map((l: any) =>
              l.configuration ? (
                <div key={l.id} className="mt-2 flex items-center justify-between text-sm">
                  <span>
                    {t("sales.recipe", {
                      oil: l.configuration.oil.name,
                      concentration: l.configuration.concentration.name,
                      size: l.configuration.bottleSizeMl,
                    })}
                  </span>
                  <Button variant="outline" onClick={() => repeat(l.configuration)}>
                    {t("customers.repeat")}
                  </Button>
                </div>
              ) : null,
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
