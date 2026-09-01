import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card, PageHeader } from "@/components/ui";
import { money } from "@/lib/utils";
import { themeRgb } from "@/lib/themes";

type Dash = {
  sales: { revenue: number; orders: number; averageOrderValue: number; discounts: number; grossProfit: number; grossMargin: number };
  inventory: {
    totalValue: number;
    lowStock: { id?: string; name: string; onHand: number; unit: string }[];
    oilConsumptionMl: number;
    wasteValue: number;
  };
  suppliers: { outstanding: number; approachingLimit: { name: string; balance: number }[] };
  customers: { newToday: number; returningToday: number };
  charts: { last7: { date: string; revenue: number }[]; byType: { type: string; total: number }[] };
};

export function DashboardPage() {
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dash>("/reports/dashboard") });
  const c = tenant?.currency ?? "EGP";
  if (!data) return <div>{t("loading")}</div>;

  const kpis = [
    [t("dash.revenue"), money(data.sales.revenue, c, locale)],
    [t("dash.orders"), String(data.sales.orders)],
    [t("dash.avgOrder"), money(data.sales.averageOrderValue, c, locale)],
    [t("dash.grossProfit"), money(data.sales.grossProfit, c, locale)],
    [t("dash.margin"), `${data.sales.grossMargin}%`],
    [t("dash.inventoryValue"), money(data.inventory.totalValue, c, locale)],
    [t("dash.oilUsed"), t("pos.oilUsedLabel", { qty: data.inventory.oilConsumptionMl })],
    [t("dash.supplierOutstanding"), money(data.suppliers.outstanding, c, locale)],
  ];

  const chart = data.charts.last7.map((row) => ({
    ...row,
    label: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { month: "short", day: "numeric" }).format(new Date(row.date)),
  }));

  return (
    <div>
      <PageHeader title={t("dash.title")} subtitle={t("dash.subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([k, v]) => (
          <Card key={k}>
            <div className="text-xs uppercase tracking-wide text-stone-500">{k}</div>
            <div className="mt-2 font-serif text-2xl">{v}</div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold">{t("dash.salesTrend")}</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="revenue" fill={themeRgb("gold")} radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="mb-4 font-semibold">{t("dash.lowStock")}</h3>
          {data.inventory.lowStock.length === 0 ? (
            <p className="text-sm text-stone-500">{t("dash.noLowStock")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.inventory.lowStock.map((i) => (
                <li key={i.id ?? i.name} className="flex justify-between gap-3">
                  <span>{i.name}</span>
                  <span className={i.onHand <= 0 ? "font-semibold text-red-700" : "text-stone-600"}>
                    {i.onHand <= 0 ? t("dash.oos") : `${i.onHand} ${i.unit.toLowerCase()}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
