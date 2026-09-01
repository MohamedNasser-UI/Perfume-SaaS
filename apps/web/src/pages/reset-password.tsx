import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { liveApi } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { Button, Input, Label } from "@/components/ui";
import { LanguageSwitcher } from "@/components/language-switcher";

export function ResetPasswordPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.passwordMin"));
      return;
    }
    setPending(true);
    try {
      await liveApi("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
      toast.success(t("auth.resetDone"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4 sm:p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-paper p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="font-serif text-3xl text-ink">{t("appName")}</div>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-6 font-serif text-2xl">{t("auth.resetTitle")}</h1>
        {!token ? (
          <p className="mt-3 text-sm text-red-700">{t("auth.resetMissing")}</p>
        ) : done ? (
          <p className="mt-3 text-sm text-stone-600">{t("auth.resetDone")}</p>
        ) : (
          <div className="mt-8 space-y-4">
            <div>
              <Label>{t("auth.newPassword")}</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} />
            </div>
            <Button className="w-full" disabled={pending}>
              {pending ? t("auth.saving") : t("auth.resetSubmit")}
            </Button>
          </div>
        )}
        <Link to="/login" className="mt-6 block text-center text-sm text-gold">
          {t("auth.backToSignIn")}
        </Link>
      </form>
    </div>
  );
}
