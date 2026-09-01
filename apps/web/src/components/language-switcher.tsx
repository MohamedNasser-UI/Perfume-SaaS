import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const { locale, setLocale } = useI18n();
  const active = tone === "dark" ? "bg-white text-ink" : "bg-ink text-white";
  const idle = tone === "dark" ? "bg-transparent text-stone-200 hover:bg-white/10" : "bg-white text-stone-600";
  return (
    <div className={cn("inline-flex overflow-hidden rounded-lg border text-sm", tone === "dark" ? "border-white/30" : "border-stone-300", className)}>
      <button
        type="button"
        className={cn("px-3 py-1.5 font-semibold", locale === "en" ? active : idle)}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={cn("px-3 py-1.5 font-semibold", locale === "ar" ? active : idle)}
        onClick={() => setLocale("ar")}
      >
        ع
      </button>
    </div>
  );
}
