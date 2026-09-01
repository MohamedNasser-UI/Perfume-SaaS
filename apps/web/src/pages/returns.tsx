import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { money } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function ReturnsPage() {
  const { tenant } = useAuth();
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const sales = useQuery({ queryKey: ["sales"], queryFn: () => api<any[]>("/sales") });
  const returns = useQuery({ queryKey: ["returns"], queryFn: () => api<any[]>("/returns") });
  const detail = useQuery({
    queryKey: ["sale", orderId],
    queryFn: () => api<any>(`/sales/${orderId}`),
    enabled: !!orderId,
  });
  const [lines, setLines] = useState<Record<string, { qty: number; disposition: string }>>({});
  const reasonValue = reason || t("returns.reasonDefault");

  const mutate = useMutation({
    mutationFn: () =>
      api("/returns", {
        method: "POST",
        body: JSON.stringify({
          originalOrderId: orderId,
          reason: reasonValue,
          lines: Object.entries(lines)
            .filter(([, v]) => v.qty > 0)
            .map(([id, v]) => ({ originalOrderLineId: id, quantity: v.qty, disposition: v.disposition })),
        }),
      }),
    onSuccess: () => {
      toast.success(t("returns.posted"));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title={t("returns.title")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Label>{t("returns.original")}</Label>
          <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">{t("select")}</option>
            {(sales.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} · {o.customer.name}
              </option>
            ))}
          </Select>
          <div className="mt-3">
            <Label>{t("reason")}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("returns.reasonDefault")} />
          </div>
          {detail.data?.lines?.map((l: any) => (
            <div key={l.id} className="mt-3 rounded-lg border p-3 text-sm">
              <div className="font-medium">
                {t("returns.remaining", { type: l.lineType, qty: l.quantity - l.returnedQty })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={0}
                  max={l.quantity - l.returnedQty}
                  onChange={(e) =>
                    setLines((s) => ({
                      ...s,
                      [l.id]: { qty: Number(e.target.value), disposition: s[l.id]?.disposition ?? "RETURN_TO_FINISHED_STOCK" },
                    }))
                  }
                />
                <Select
                  value={lines[l.id]?.disposition ?? "RETURN_TO_FINISHED_STOCK"}
                  onChange={(e) =>
                    setLines((s) => ({
                      ...s,
                      [l.id]: { qty: s[l.id]?.qty ?? 0, disposition: e.target.value },
                    }))
                  }
                >
                  <option value="RETURN_TO_FINISHED_STOCK">{t("returns.toStock")}</option>
                  <option value="DAMAGED">{t("returns.damaged")}</option>
                  <option value="DISPOSED">{t("returns.disposed")}</option>
                </Select>
              </div>
            </div>
          ))}
          <Button className="mt-4" onClick={() => mutate.mutate()} disabled={!orderId || mutate.isPending}>
            {t("returns.post")}
          </Button>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">{t("returns.recent")}</h3>
          {(returns.data ?? []).map((r) => (
            <div key={r.id} className="flex justify-between border-b py-2 text-sm">
              <span>
                {r.number} · {r.originalOrder?.orderNumber}
              </span>
              <span>{money(Number(r.refundAmount), tenant?.currency, locale)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
