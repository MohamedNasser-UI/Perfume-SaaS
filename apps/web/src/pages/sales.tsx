import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { fmtDate, money } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { canSeeItemCost } from "@/lib/staff-pages";
import { useState } from "react";
import { paginate, TablePager } from "@/components/table-pager";

export function SalesListPage() {
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["sales", q],
    queryFn: () => api<Array<{ id: string; orderNumber: string; createdAt: string; finalAmount: string; status: string; customer: { name: string; mobile: string }; paymentMethod: { name: string } }>>(`/sales?q=${encodeURIComponent(q)}`),
  });
  const paged = paginate(data ?? [], page);
  return (
    <div>
      <PageHeader title={t("sales.title")} actions={<Link to="/sales/new"><Button>{t("sales.new")}</Button></Link>} />
      <Input
        className="mb-4 max-w-sm"
        placeholder={t("sales.search")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <Card className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-start">
            <tr>
              <th className="p-3">{t("sales.order")}</th>
              <th>{t("sales.customer")}</th>
              <th>{t("date")}</th>
              <th>{t("sales.payment")}</th>
              <th>{t("total")}</th>
              <th>{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.slice.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3">
                  <Link className="font-medium text-gold" to={`/sales/${o.id}`}>{o.orderNumber}</Link>
                </td>
                <td>{o.customer.name} · {o.customer.mobile}</td>
                <td>{fmtDate(o.createdAt, locale)}</td>
                <td>{o.paymentMethod.name}</td>
                <td>{money(Number(o.finalAmount), tenant?.currency, locale)}</td>
                <td>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePager page={paged.current} pageCount={paged.pageCount} onPage={setPage} />
      </Card>
    </div>
  );
}

export function SaleDetailPage() {
  const { id } = useParams();
  const { tenant, user } = useAuth();
  const { t, locale } = useI18n();
  const seeCost = canSeeItemCost(user?.role, user?.seeItemCost);
  const { data } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => api<any>(`/sales/${id}`),
  });
  if (!data) return <div>{t("loading")}</div>;
  return (
    <div>
      <PageHeader title={data.orderNumber} subtitle={`${data.customer.name} · ${data.customer.mobile}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          {(data.lines as any[]).map((l) => (
            <div key={l.id} className="mb-4 border-b pb-3 last:border-0">
              <div className="font-semibold">{l.lineType}</div>
              {l.configuration && (
                <div className="mt-1 text-sm text-stone-600">
                  {t("sales.recipe", {
                    oil: l.configuration.oil.name,
                    concentration: l.configuration.concentration.name,
                    size: l.configuration.bottleSizeMl,
                  })}
                  <br />
                  {t("sales.oilAlcohol", {
                    oil: l.configuration.oilActualQtyMl,
                    std: l.configuration.oilStandardQtyMl,
                    alcohol: l.configuration.alcoholQtyMl,
                  })}
                  {l.configuration.customerSuppliedBottle ? ` · ${t("sales.customerBottle")}` : ""}
                </div>
              )}
              {l.product && <div className="text-sm">{l.product.name}</div>}
              <div className="mt-1 text-sm">
                {seeCost
                  ? t("sales.costPrice", {
                      cost: money(Number(l.costAtSale), tenant?.currency, locale),
                      price: money(Number(l.lineTotal), tenant?.currency, locale),
                    })
                  : t("sales.linePrice", {
                      price: money(Number(l.lineTotal), tenant?.currency, locale),
                    })}
              </div>
            </div>
          ))}
          <div className="flex justify-between font-semibold">
            <span>{t("total")}</span>
            <span>{money(Number(data.finalAmount), tenant?.currency, locale)}</span>
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">{t("sales.consumed")}</h3>
          {(data.movements ?? []).map((m: any) => (
            <div key={m.id} className="flex justify-between text-sm">
              <span>{m.item.name}</span>
              <span>
                {Number(m.quantity)} {m.unit.toLowerCase()}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
