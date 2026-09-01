import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useNavigate } from "react-router-dom";

export function PlatformLayout({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b bg-ink px-6 py-4 text-white">
        <div className="font-serif text-xl text-gold-light">{t("platform.admin")}</div>
        <div className="flex items-center gap-4 text-sm">
          <LanguageSwitcher tone="dark" />
          <span>{user?.email}</span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            {t("signOut")}
          </button>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function PlatformPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["tenants"], queryFn: () => api<any[]>("/platform/tenants") });
  const [openId, setOpenId] = useState<string | null>(null);
  const devices = useQuery({
    queryKey: ["platform-devices", openId],
    queryFn: () =>
      api<
        {
          id: string;
          label: string | null;
          lastSeenAt: string;
          lastLicenseExpiresAt: string | null;
          users: { displayName: string; email: string; role: string }[];
        }[]
      >(`/platform/tenants/${openId}/devices`),
    enabled: Boolean(openId),
  });
  const [form, setForm] = useState({
    name: "",
    slug: "",
    currency: "EGP",
    country: "EG",
    outletName: "Main Outlet",
    ownerEmail: "",
    ownerName: "",
    ownerPassword: "ChangeMe123!",
  });
  const create = useMutation({
    mutationFn: () => api("/platform/tenants", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success(t("platform.created"));
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/platform/tenants/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants"] }),
  });

  return (
    <PlatformLayout>
      <PageHeader title={t("platform.title")} subtitle={t("platform.subtitle")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <Label>{t("platform.business")}</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} />
          <Label>{t("platform.slug")}</Label>
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Label>{t("platform.outlet")}</Label>
          <Input value={form.outletName} onChange={(e) => setForm({ ...form, outletName: e.target.value })} />
          <Label>{t("platform.ownerName")}</Label>
          <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          <Label>{t("platform.ownerEmail")}</Label>
          <Input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
          <Label>{t("platform.tempPassword")}</Label>
          <Input value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
          <Button onClick={() => create.mutate()}>{t("platform.create")}</Button>
        </Card>
        <Card>
          {(data ?? []).map((tenant) => (
            <div key={tenant.id} className="border-b py-3">
              <div className="flex items-center justify-between">
                <button className="text-left" onClick={() => setOpenId(openId === tenant.id ? null : tenant.id)}>
                  <div className="font-medium">{tenant.name}</div>
                  <div className="text-xs text-stone-500">
                    {tenant.slug} · {tenant.status} · {t("platform.outletsCount", { count: tenant._count?.outlets ?? 0 })}
                  </div>
                </button>
                <Button
                  variant="outline"
                  onClick={() => toggle.mutate({ id: tenant.id, status: tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}
                >
                  {tenant.status === "ACTIVE" ? t("platform.suspend") : t("platform.activate")}
                </Button>
              </div>
              {openId === tenant.id ? (
                <div className="mt-2 space-y-1 text-xs text-stone-600">
                  <div className="font-medium">{t("platform.devices")}</div>
                  {(devices.data ?? []).map((d) => (
                    <div key={d.id}>
                      {d.label || d.id} · {d.users.map((u) => u.displayName).join(", ") || "—"} ·{" "}
                      {d.lastLicenseExpiresAt ? new Date(d.lastLicenseExpiresAt).toLocaleDateString() : "—"}
                    </div>
                  ))}
                  {!devices.data?.length && !devices.isFetching ? <div>{t("none")}</div> : null}
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      </div>
    </PlatformLayout>
  );
}
