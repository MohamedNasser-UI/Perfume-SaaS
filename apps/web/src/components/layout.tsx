import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Package,
  Truck,
  Building2,
  FlaskConical,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { MessageKey } from "@/lib/locales";
import { hasStaffPage, type StaffPage } from "@/lib/staff-pages";

const nav: { to: string; key: MessageKey; icon: typeof LayoutDashboard; end?: boolean; owner?: boolean; page?: StaffPage }[] = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard, end: true, page: "dashboard" },
  { to: "/sales/new", key: "nav.newSale", icon: ShoppingBag },
  { to: "/sales", key: "nav.salesHistory", icon: ShoppingBag },
  { to: "/returns", key: "nav.returns", icon: ShoppingBag },
  { to: "/customers", key: "nav.customers", icon: Users },
  { to: "/inventory", key: "nav.inventory", icon: Package },
  { to: "/procurement", key: "nav.procurement", icon: Truck, page: "procurement" },
  { to: "/suppliers", key: "nav.suppliers", icon: Building2, page: "suppliers" },
  { to: "/products", key: "nav.products", icon: FlaskConical, owner: true },
  { to: "/reports", key: "nav.reports", icon: BarChart3, page: "reports" },
  { to: "/settings", key: "nav.settings", icon: Settings, page: "settings" },
];

export function AppLayout() {
  const { user, tenant, outlets, outletId, setOutletId, logout, online, authStatus } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const roleKey = user?.role === "OWNER" ? "role.OWNER" : user?.role === "STAFF" ? "role.STAFF" : "role.PLATFORM_ADMIN";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const items = nav.filter((item) => {
    if (item.owner && user?.role !== "OWNER") return false;
    if (item.page && !hasStaffPage(user?.role, user?.staffPages, item.page)) return false;
    return true;
  });

  function signOut() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label={t("nav.close")}
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-64 flex-col bg-ink text-stone-200 transition-transform duration-200",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          "lg:static lg:translate-x-0 rtl:lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-6">
          <div className="min-w-0">
            <div className="font-serif text-xl text-gold-light">{t("appName")}</div>
            <div className="mt-1 truncate text-xs text-stone-400">{tenant?.name}</div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-stone-400 hover:bg-white/10 lg:hidden"
            aria-label={t("nav.close")}
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  isActive ? "bg-white/10 text-white" : "hover:bg-white/5",
                  item.to === "/sales/new" && "bg-gold/20 text-gold-light hover:bg-gold/30",
                )
              }
            >
              <item.icon size={16} />
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
        <button
          className="m-3 flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-400 hover:bg-white/5"
          onClick={signOut}
        >
          <LogOut size={16} /> {t("signOut")}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white",
            "px-3 py-3 sm:px-6",
            "pt-[max(0.75rem,env(safe-area-inset-top))]",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-ink hover:bg-stone-100 lg:hidden"
              aria-label={t("nav.menu")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="truncate text-sm text-stone-500">
              {user?.displayName} · {t(roleKey)}
              {!online || authStatus === "OFFLINE_AUTHENTICATED" ? (
                <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{t("offline.badge")}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            {outlets.length > 1 ? (
              <select
                className="max-w-40 rounded-lg border border-stone-300 px-3 py-1.5 text-sm sm:max-w-none"
                value={outletId ?? ""}
                onChange={(e) => setOutletId(e.target.value)}
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="truncate text-sm text-stone-500">
                {outlets.find((o) => o.id === outletId)?.name ?? outlets[0]?.name}
              </span>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          {online && authStatus === "OFFLINE_AUTHENTICATED" ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              {t("offline.reconnect")}
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
