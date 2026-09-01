import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button, Input, Label } from "@/components/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import { toast } from "sonner";
import type { MessageKey } from "@/lib/locales";
import { homePathForUser } from "@/lib/staff-pages";

export function LoginPage() {
  const { login, loginOffline, authorizedUsers, authStatus, tenant, online, user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("owner@noor.perfume");
  const [password, setPassword] = useState("ChangeMe123!");
  const [pending, setPending] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const shopUsers = useMemo(
    () => authorizedUsers.filter((u) => u.role !== "PLATFORM_ADMIN"),
    [authorizedUsers],
  );
  const offlinePicker = !online && shopUsers.length > 0 && authStatus !== "RENEWAL_REQUIRED" && authStatus !== "LICENSE_EXPIRED";
  const renewal = authStatus === "RENEWAL_REQUIRED" || authStatus === "LICENSE_EXPIRED";

  if (!loading && user && (authStatus === "ONLINE_AUTHENTICATED" || authStatus === "OFFLINE_AUTHENTICATED")) {
    return <Navigate to={homePathForUser(user.role, user.staffPages)} replace />;
  }

  async function finish(next: { role: string; staffPages?: string[] }) {
    navigate(homePathForUser(next.role, next.staffPages));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      if (offlinePicker && selectedUserId) {
        await finish(await loginOffline(selectedUserId, password));
        return;
      }
      await finish(await login(email, password));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setPending(false);
    }
  }

  if (renewal && !online) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink p-4 sm:p-6" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
        <div className="w-full max-w-md rounded-3xl bg-paper p-8 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="font-serif text-3xl text-ink">{t("appName")}</div>
            <LanguageSwitcher />
          </div>
          <h1 className="mt-6 font-serif text-2xl">{t("license.renewTitle")}</h1>
          <p className="mt-3 text-sm text-stone-600">{t("license.renewBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4 sm:p-6" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-paper p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="font-serif text-3xl text-ink">{t("appName")}</div>
          <LanguageSwitcher />
        </div>
        {tenant?.name ? <p className="mt-2 text-sm text-gold">{tenant.name}</p> : null}
        <p className="mt-2 text-sm text-stone-500">{offlinePicker ? t("login.whoAreYou") : t("login.subtitle")}</p>
        <div className="mt-8 space-y-4">
          {offlinePicker ? (
            <div className="space-y-2">
              {shopUsers.map((u) => (
                <button
                  type="button"
                  key={u.userId}
                  onClick={() => setSelectedUserId(u.userId)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${
                    selectedUserId === u.userId ? "border-gold bg-gold/10" : "border-stone-200"
                  }`}
                >
                  <span className="font-medium">{u.displayName}</span>
                  <span className="text-stone-500">{t(`role.${u.role}` as MessageKey)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <Label>{t("email")}</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
          )}
          <div>
            <Label>{t("password")}</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </div>
          {!offlinePicker ? (
            <Link to="/forgot-password" className="block text-sm text-gold">
              {t("auth.forgotLink")}
            </Link>
          ) : null}
          {!online && !shopUsers.length ? (
            <p className="text-sm text-red-700">{t("login.offlineFirst")}</p>
          ) : null}
          <Button className="w-full" disabled={pending || (offlinePicker && !selectedUserId)}>
            {pending ? t("signingIn") : t("signIn")}
          </Button>
        </div>
      </form>
    </div>
  );
}
