import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { THEMES, type ThemeId } from "@/lib/themes";
import type { MessageKey } from "@/lib/locales";
import { cn } from "@/lib/utils";
import { pendingOutbox } from "@/lib/sync";
import { DEFAULT_STAFF_PAGES, STAFF_PAGES, type StaffPage } from "@/lib/staff-pages";

export function SettingsPage() {
  const { t } = useI18n();
  const { tenant, setTenantTheme, user, logoutAll } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api<any>("/settings") });
  const outlets = useQuery({ queryKey: ["outlets"], queryFn: () => api<any[]>("/outlets") });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<any[]>("/users") });
  const [markup, setMarkup] = useState<number>();
  const [outletName, setOutletName] = useState("");
  const [userForm, setUserForm] = useState({ email: "", displayName: "", password: "", role: "STAFF", outletId: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const currentTheme = (tenant?.theme ?? data?.profile?.theme ?? "gold") as ThemeId;

  const saveMarkup = useMutation({
    mutationFn: () => api("/settings/pricing", { method: "PATCH", body: JSON.stringify({ markupPercentage: markup }) }),
    onSuccess: () => {
      toast.success(t("settings.markupUpdated"));
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
  const addOutlet = useMutation({
    mutationFn: () => api("/outlets", { method: "POST", body: JSON.stringify({ name: outletName }) }),
    onSuccess: () => {
      toast.success(t("settings.outletCreated"));
      qc.invalidateQueries({ queryKey: ["outlets"] });
    },
  });
  const addUser = useMutation({
    mutationFn: () => {
      if (!navigator.onLine) {
        throw new Error(t("settings.inviteOffline"));
      }
      const { outletId, ...fields } = userForm;
      return api("/users", {
        method: "POST",
        body: JSON.stringify({
          ...fields,
          outletIds: fields.role === "STAFF" && outletId ? [outletId] : undefined,
        }),
      });
    },
    onSuccess: () => {
      toast.success(t("settings.userCreated"));
      qc.invalidateQueries({ queryKey: ["users"] });
      setUserForm({ email: "", displayName: "", password: "", role: "STAFF", outletId: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const changePassword = useMutation({
    mutationFn: () =>
      api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm),
      }),
    onSuccess: () => {
      toast.success(t("auth.passwordChanged"));
      setPasswordForm({ currentPassword: "", newPassword: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const signOutAll = useMutation({
    mutationFn: () => logoutAll(),
    onSuccess: () => toast.success(t("auth.signedOutAll")),
    onError: (e: Error) => toast.error(e.message),
  });
  const saveTheme = useMutation({
    mutationFn: (theme: ThemeId) => api("/settings/theme", { method: "PATCH", body: JSON.stringify({ theme }) }),
    onMutate: (theme) => {
      const previous = tenant?.theme;
      setTenantTheme(theme);
      return { previous };
    },
    onSuccess: () => {
      toast.success(t("settings.themeSaved"));
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error, _theme, ctx) => {
      if (ctx?.previous) setTenantTheme(ctx.previous as ThemeId);
      toast.error(e.message);
    },
  });

  if (!data) return <div>{t("loading")}</div>;
  return (
    <div>
      <PageHeader title={t("settings.title")} />
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_12.5rem_minmax(0,1.45fr)] md:items-stretch">
        <Card className="flex flex-col justify-center">
          <h3 className="mb-1 font-semibold">{t("settings.profile")}</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <div>
              <div className="text-[11px] text-stone-500">{t("name")}</div>
              <div className="truncate font-medium">{data.profile?.name}</div>
            </div>
            <div>
              <div className="text-[11px] text-stone-500">{t("settings.currency")}</div>
              <div className="truncate font-medium">{data.profile?.currency}</div>
            </div>
            <div>
              <div className="text-[11px] text-stone-500">{t("settings.timezone")}</div>
              <div className="truncate font-medium">{data.profile?.timezone}</div>
            </div>
            <div>
              <div className="text-[11px] text-stone-500">{t("settings.country")}</div>
              <div className="truncate font-medium">{data.profile?.country}</div>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col justify-center">
          <h3 className="mb-1 font-semibold">{t("language")}</h3>
          <p className="mb-3 text-xs text-stone-500">{t("settings.languageHint")}</p>
          <LanguageSwitcher />
        </Card>
        <Card>
          <h3 className="mb-1 font-semibold">{t("settings.theme")}</h3>
          <p className="mb-2 text-xs text-stone-500">{t("settings.themeHint")}</p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((theme) => {
              const selected = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  disabled={saveTheme.isPending}
                  onClick={() => saveTheme.mutate(theme.id)}
                  className={cn(
                    "rounded-xl border-2 p-1.5 text-start transition",
                    selected ? "border-ink bg-paper" : "border-stone-200 bg-white hover:border-gold",
                  )}
                >
                  <div className="mb-1.5 flex h-6 overflow-hidden rounded-md">
                    <div className="w-2/5" style={{ background: theme.preview.ink }} />
                    <div className="w-1/5" style={{ background: theme.preview.gold }} />
                    <div className="w-2/5" style={{ background: theme.preview.paper }} />
                  </div>
                  <div className="truncate text-[11px] font-semibold leading-tight">{t(`theme.${theme.id}` as MessageKey)}</div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="font-semibold">{t("auth.changePassword")}</h3>
          <div>
            <Label>{t("auth.currentPassword")}</Label>
            <Input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("auth.newPassword")}</Label>
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending}>
            {t("auth.savePassword")}
          </Button>
        </Card>
        <Card className="space-y-3">
          <h3 className="font-semibold">{t("auth.sessions")}</h3>
          <p className="text-xs text-stone-500">{t("auth.sessionsHint")}</p>
          <Button
            className="w-fit"
            onClick={() => {
              if (window.confirm(t("auth.signOutAllConfirm"))) signOutAll.mutate();
            }}
            disabled={signOutAll.isPending}
          >
            {t("auth.signOutAll")}
          </Button>
        </Card>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex h-full flex-col space-y-3">
          <h3 className="font-semibold">{t("settings.concentrations")}</h3>
          <p className="text-xs text-stone-500">{t("settings.concentrationHint")}</p>
          <div className="flex-1 space-y-3">
            {(data.concentrations ?? []).map((c: any) => (
              <ConcentrationRow key={c.id} concentration={c} />
            ))}
          </div>
          <ConcentrationAddForm />
        </Card>
        <Card className="flex h-full flex-col space-y-3">
          <h3 className="font-semibold">{t("settings.discounts")}</h3>
          <p className="text-xs text-stone-500">{t("settings.discountHint")}</p>
          <div className="flex-1 space-y-3">
            {(data.discounts ?? []).map((d: any) => (
              <DiscountRow key={d.id} discount={d} />
            ))}
          </div>
          <DiscountAddForm />
        </Card>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex h-full flex-col space-y-2">
          <h3 className="font-semibold">{t("settings.markup")}</h3>
          <Input
            type="number"
            defaultValue={Number(data.pricing?.markupPercentage ?? 50)}
            onChange={(e) => setMarkup(Number(e.target.value))}
          />
          <Button className="mt-auto w-fit" onClick={() => saveMarkup.mutate()}>{t("settings.saveMarkup")}</Button>
        </Card>
        <Card className="flex h-full flex-col">
          <h3 className="mb-3 font-semibold">{t("settings.payments")}</h3>
          <div className="flex-1 space-y-1">
            {(data.paymentMethods ?? []).map((p: any) => (
              <div key={p.id} className="text-sm">{p.name}</div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h3 className="font-semibold">{t("settings.outlets")}</h3>
          {(outlets.data ?? []).map((o) => (
            <div key={o.id} className="text-sm">{o.name}</div>
          ))}
          <Input value={outletName} onChange={(e) => setOutletName(e.target.value)} placeholder={t("settings.newOutlet")} />
          <Button onClick={() => addOutlet.mutate()}>{t("settings.addOutlet")}</Button>
        </Card>
        <Card className="space-y-3">
          <h3 className="font-semibold">{t("settings.users")}</h3>
          {user?.role === "OWNER" ? (
            <div>
              <p className="text-sm font-medium">{t("settings.staffPages")}</p>
              <p className="text-xs text-stone-500">{t("settings.staffPagesHint")}</p>
              <p className="mt-1 text-xs text-stone-500">{t("settings.seeItemCostHint")}</p>
            </div>
          ) : null}
          {(users.data ?? []).map((u) => (
            <div key={u.id} className="space-y-2 border-b border-stone-100 pb-3 last:border-0">
              <div className="text-sm">
                {u.displayName} · {t(`role.${u.role}` as MessageKey)}
              </div>
              {user?.role === "OWNER" && u.role === "STAFF" ? (
                <>
                  <StaffPagesToggles
                    userId={u.id}
                    pages={u.staffPages ?? DEFAULT_STAFF_PAGES}
                    seeItemCost={u.seeItemCost !== false}
                  />
                  <StaffPasswordReset userId={u.id} />
                </>
              ) : null}
            </div>
          ))}
          <Label>{t("settings.newUser")}</Label>
          <Input placeholder={t("name")} value={userForm.displayName} onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })} />
          <Input placeholder={t("email")} value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          <Input placeholder={t("password")} type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
          {user?.role === "OWNER" ? (
            <Select
              value={userForm.role}
              onChange={(e) =>
                setUserForm({ ...userForm, role: e.target.value, outletId: e.target.value === "OWNER" ? "" : userForm.outletId })
              }
            >
              <option value="STAFF">{t("role.STAFF")}</option>
              <option value="OWNER">{t("role.OWNER")}</option>
            </Select>
          ) : null}
          {userForm.role === "STAFF" ? (
            <div>
              <Label>{t("settings.staffOutlet")}</Label>
              <p className="mb-1 text-xs text-stone-500">{t("settings.staffOutletHint")}</p>
              <Select value={userForm.outletId} onChange={(e) => setUserForm({ ...userForm, outletId: e.target.value })}>
                <option value="">{t("select")}</option>
                {(outlets.data ?? [])
                  .filter((o) => o.active !== false)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </Select>
            </div>
          ) : null}
          <Button
            onClick={() => addUser.mutate()}
            disabled={
              addUser.isPending ||
              !userForm.email ||
              userForm.displayName.trim().length < 2 ||
              userForm.password.length < 8 ||
              (userForm.role === "STAFF" && !userForm.outletId)
            }
          >
            {t("settings.invite")}
          </Button>
        </Card>
        <DevicesCard />
      </div>
    </div>
  );
}

function StaffPasswordReset({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const save = useMutation({
    mutationFn: () =>
      api(`/users/${userId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: password }),
      }),
    onSuccess: () => {
      toast.success(t("auth.staffPasswordSet"));
      setPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[10rem] flex-1">
        <Label>{t("auth.setStaffPassword")}</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button
        disabled={save.isPending || password.length < 8}
        onClick={() => save.mutate()}
      >
        {t("auth.savePassword")}
      </Button>
    </div>
  );
}

const PAGE_TOGGLE_KEYS: { page: StaffPage; key: MessageKey }[] = [
  { page: "dashboard", key: "nav.dashboard" },
  { page: "procurement", key: "nav.procurement" },
  { page: "suppliers", key: "nav.suppliers" },
  { page: "reports", key: "nav.reports" },
  { page: "settings", key: "nav.settings" },
];

function StaffPagesToggles({
  userId,
  pages,
  seeItemCost,
}: {
  userId: string;
  pages: string[];
  seeItemCost: boolean;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const allowed = new Set(pages);
  const save = useMutation({
    mutationFn: (body: { pages: StaffPage[]; seeItemCost: boolean }) =>
      api(`/users/${userId}/pages`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success(t("settings.staffPagesUpdated"));
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(page: StaffPage, checked: boolean) {
    const next = STAFF_PAGES.filter((p) => (p === page ? checked : allowed.has(p)));
    save.mutate({ pages: next, seeItemCost });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {PAGE_TOGGLE_KEYS.map(({ page, key }) => (
          <label key={page} className="flex items-center gap-1.5 text-xs text-stone-700">
            <input
              type="checkbox"
              className="rounded border-stone-300"
              checked={allowed.has(page)}
              disabled={save.isPending}
              onChange={(e) => toggle(page, e.target.checked)}
            />
            {t(key)}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-stone-700">
        <input
          type="checkbox"
          className="rounded border-stone-300"
          checked={seeItemCost}
          disabled={save.isPending}
          onChange={(e) => save.mutate({ pages: STAFF_PAGES.filter((p) => allowed.has(p)), seeItemCost: e.target.checked })}
        />
        {t("settings.seeItemCost")}
      </label>
    </div>
  );
}

function ConcentrationAddForm() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [oilPercentage, setOilPercentage] = useState("");
  const add = useMutation({
    mutationFn: () =>
      api("/settings/concentrations", {
        method: "POST",
        body: JSON.stringify({ name, oilPercentage: Number(oilPercentage) }),
      }),
    onSuccess: () => {
      toast.success(t("settings.concentrationCreated"));
      setName("");
      setOilPercentage("");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-3">
      <div className="min-w-32 flex-1">
        <Label>{t("settings.concentrationName")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="EDP" />
      </div>
      <div className="w-24">
        <Label>{t("settings.oilPercentage")}</Label>
        <Input type="number" min={0.1} max={100} step={0.1} value={oilPercentage} onChange={(e) => setOilPercentage(e.target.value)} />
      </div>
      <Button onClick={() => add.mutate()} disabled={!name.trim() || !oilPercentage}>
        {t("settings.addConcentration")}
      </Button>
    </div>
  );
}

function ConcentrationRow({
  concentration,
}: {
  concentration: { id: string; name: string; oilPercentage: number | string; active: boolean };
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(concentration.name);
  const [oilPercentage, setOilPercentage] = useState(String(Number(concentration.oilPercentage)));
  const save = useMutation({
    mutationFn: (body: { name?: string; oilPercentage?: number; active?: boolean }) =>
      api(`/settings/concentrations/${concentration.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success(t("settings.concentrationUpdated"));
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className={`flex flex-wrap items-end gap-2 ${concentration.active ? "" : "opacity-50"}`}>
      <div className="min-w-32 flex-1">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="w-24">
        <Input type="number" min={0.1} max={100} step={0.1} value={oilPercentage} onChange={(e) => setOilPercentage(e.target.value)} />
      </div>
      <Button
        variant="outline"
        onClick={() => save.mutate({ name, oilPercentage: Number(oilPercentage) })}
        disabled={!name.trim() || !oilPercentage}
      >
        {t("save")}
      </Button>
      <Button variant="ghost" onClick={() => save.mutate({ active: !concentration.active })}>
        {concentration.active ? t("settings.deactivate") : t("settings.activate")}
      </Button>
    </div>
  );
}

function DiscountAddForm() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("");
  const add = useMutation({
    mutationFn: () =>
      api("/settings/discounts", {
        method: "POST",
        body: JSON.stringify({ name, percentage: Number(percentage) }),
      }),
    onSuccess: () => {
      toast.success(t("settings.discountCreated"));
      setName("");
      setPercentage("");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-3">
      <div className="min-w-32 flex-1">
        <Label>{t("name")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP" />
      </div>
      <div className="w-24">
        <Label>{t("settings.discountPercentage")}</Label>
        <Input type="number" min={0} max={100} step={0.1} value={percentage} onChange={(e) => setPercentage(e.target.value)} />
      </div>
      <Button onClick={() => add.mutate()} disabled={!name.trim() || percentage === ""}>
        {t("settings.addDiscount")}
      </Button>
    </div>
  );
}

function DiscountRow({
  discount,
}: {
  discount: { id: string; name: string; percentage: number | string; active: boolean };
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(discount.name);
  const [percentage, setPercentage] = useState(String(Number(discount.percentage)));
  const save = useMutation({
    mutationFn: (body: { name?: string; percentage?: number; active?: boolean }) =>
      api(`/settings/discounts/${discount.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success(t("settings.discountUpdated"));
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className={`flex flex-wrap items-end gap-2 ${discount.active ? "" : "opacity-50"}`}>
      <div className="min-w-32 flex-1">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="w-24">
        <Input type="number" min={0} max={100} step={0.1} value={percentage} onChange={(e) => setPercentage(e.target.value)} />
      </div>
      <Button
        variant="outline"
        onClick={() => save.mutate({ name, percentage: Number(percentage) })}
        disabled={!name.trim() || percentage === ""}
      >
        {t("save")}
      </Button>
      <Button variant="ghost" onClick={() => save.mutate({ active: !discount.active })}>
        {discount.active ? t("settings.deactivate") : t("settings.activate")}
      </Button>
    </div>
  );
}

function DevicesCard() {
  const { t } = useI18n();
  const { authorizedUsers, online } = useAuth();
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () =>
      api<
        {
          id: string;
          label: string | null;
          lastSeenAt: string;
          lastLicenseExpiresAt: string | null;
          users: { displayName: string; role: string; email: string }[];
        }[]
      >("/devices"),
    enabled: online,
  });
  const pending = useQuery({ queryKey: ["outbox-pending"], queryFn: pendingOutbox, refetchInterval: 8000 });

  return (
    <Card className="space-y-2 lg:col-span-2">
      <h3 className="font-semibold">{t("settings.devices")}</h3>
      <p className="text-xs text-stone-500">{t("settings.devicesHint")}</p>
      <div className="text-sm">
        {t("settings.pendingOutbox")}: {pending.data?.length ?? 0}
      </div>
      {(devices.data ?? []).map((d) => (
        <div key={d.id} className="border-t py-2 text-sm">
          <div className="font-medium">{d.label || d.id}</div>
          <div className="text-xs text-stone-500">
            {t("settings.lastSeen")}: {new Date(d.lastSeenAt).toLocaleString()} · {t("settings.licenseUntil")}:{" "}
            {d.lastLicenseExpiresAt ? new Date(d.lastLicenseExpiresAt).toLocaleString() : "—"}
          </div>
          <div className="text-xs text-stone-500">
            {d.users.map((u) => `${u.displayName} (${u.role})`).join(" · ")}
          </div>
        </div>
      ))}
      {!devices.data?.length ? (
        <div className="text-xs text-stone-500">
          {authorizedUsers.map((u) => u.displayName).join(" · ") || t("none")}
        </div>
      ) : null}
    </Card>
  );
}
