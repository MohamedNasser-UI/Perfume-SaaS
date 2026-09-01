import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader, Button } from "@/components/ui";
import { money } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";

const kinds = [
  { id: "sales", key: "reports.sales" },
  { id: "inventory", key: "reports.inventory" },
  { id: "procurement", key: "reports.procurement" },
  { id: "customers", key: "reports.customers" },
  { id: "profitability", key: "reports.profitability" },
] as const;

export function ReportsPage() {
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<(typeof kinds)[number]["id"]>("sales");
  const { data } = useQuery({ queryKey: ["report", kind], queryFn: () => api<any>(`/reports/${kind}`) });
  return (
    <div>
      <PageHeader title={t("reports.title")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {kinds.map((k) => (
          <Button key={k.id} variant={kind === k.id ? "primary" : "outline"} onClick={() => setKind(k.id)}>
            {t(k.key as MessageKey)}
          </Button>
        ))}
      </div>
      <Card>
        {kind === "sales" && data?.summary && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t("reports.revenue")} value={money(data.summary.revenue, tenant?.currency, locale)} />
            <Stat label={t("reports.orders")} value={String(data.summary.orders)} />
            <Stat label={t("reports.grossProfit")} value={money(data.summary.grossProfit, tenant?.currency, locale)} />
          </div>
        )}
        {kind === "inventory" && data && (
          <div>
            <div className="mb-3 font-semibold">{t("reports.valuation", { amount: money(data.valuation, tenant?.currency, locale) })}</div>
            {(data.balances ?? []).map((b: any) => (
              <div key={b.name} className="flex justify-between border-b py-1 text-sm">
                <span>{b.name}</span>
                <span>{money(b.value, tenant?.currency, locale)}</span>
              </div>
            ))}
          </div>
        )}
        {kind === "procurement" && data && (
          <div className="text-sm">
            {t("reports.purchasesPayments", {
              purchases: money(data.purchaseTotal, tenant?.currency, locale),
              payments: money(data.paymentTotal, tenant?.currency, locale),
            })}
          </div>
        )}
        {kind === "customers" && data && (
          <div>
            <div className="mb-3">{t("reports.totalCustomers", { count: data.total })}</div>
            {(data.oils ?? []).map((o: any) => (
              <div key={o.name} className="flex justify-between text-sm">
                <span>{o.name}</span>
                <span>{o.count}</span>
              </div>
            ))}
          </div>
        )}
        {kind === "profitability" && data && (
          <div>
            {(data.byType ?? []).map((row: any) => (
              <div key={row.type} className="flex justify-between border-b py-2 text-sm">
                <span>{row.type}</span>
                <span>
                  {money(row.revenue, tenant?.currency, locale)} · {t("reports.margin", { pct: row.margin })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-stone-500">{label}</div>
      <div className="font-serif text-2xl">{value}</div>
    </div>
  );
}
