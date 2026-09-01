import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { liveApi } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { Button, Input, Label } from "@/components/ui";
import { LanguageSwitcher } from "@/components/language-switcher";

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const data = await liveApi<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success(data.message || t("auth.forgotSent"));
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
        <h1 className="mt-6 font-serif text-2xl">{t("auth.forgotTitle")}</h1>
        <p className="mt-2 text-sm text-stone-500">{t("auth.forgotHint")}</p>
        <div className="mt-8 space-y-4">
          <div>
            <Label>{t("email")}</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <Button className="w-full" disabled={pending}>
            {pending ? t("auth.sending") : t("auth.sendReset")}
          </Button>
          <Link to="/login" className="block text-center text-sm text-gold">
            {t("auth.backToSignIn")}
          </Link>
        </div>
      </form>
    </div>
  );
}
