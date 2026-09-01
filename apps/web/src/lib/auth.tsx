import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { liveApi, refreshAccessToken } from "./http";
import { applyTheme, type ThemeId } from "./themes";
import { getOrCreateDeviceId, deviceLabel } from "./device";
import { checkLicense, storeLicense, type SignedLicense } from "./license";
import {
  clearSession,
  findAuthorizedUser,
  listAuthorizedUsers,
  loadSession,
  registerAuthorizedUser,
  saveSession,
  verifyLocalPassword,
  type AuthorizedUser,
} from "./offline-auth";
import { flushOutbox, pullSnapshot, renewLicense } from "./sync";
import { persistReconciledOutletId } from "./outlet";
import { DEFAULT_STAFF_PAGES } from "./staff-pages";

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: "PLATFORM_ADMIN" | "OWNER" | "STAFF";
  tenantId: string | null;
  staffPages: string[];
  seeItemCost: boolean;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  timezone: string;
  locale: string;
  country: string;
  theme: string;
};

export type Outlet = { id: string; name: string; address?: string | null; phone?: string | null; active: boolean };

export type AuthStatus =
  | "UNAUTHENTICATED"
  | "ONLINE_AUTHENTICATED"
  | "OFFLINE_AUTHENTICATED"
  | "LICENSE_EXPIRED"
  | "RENEWAL_REQUIRED";

type LoginResult = {
  token: string;
  user: User;
  tenant: Tenant | null;
  outlets: Outlet[];
  license: SignedLicense | null;
};

type AuthState = {
  user: User | null;
  tenant: Tenant | null;
  outlets: Outlet[];
  outletId: string | null;
  loading: boolean;
  online: boolean;
  authStatus: AuthStatus;
  authorizedUsers: AuthorizedUser[];
  login: (email: string, password: string) => Promise<User>;
  loginOffline: (userId: string, password: string) => Promise<User>;
  logout: () => void;
  logoutAll: () => Promise<void>;
  setOutletId: (id: string) => void;
  setTenantTheme: (theme: ThemeId) => void;
};

const AuthContext = createContext<AuthState | null>(null);

function toUser(row: AuthorizedUser): User {
  return {
    id: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    tenantId: row.tenantId,
    staffPages: Array.isArray(row.staffPages)
      ? row.staffPages
      : row.role === "STAFF"
        ? [...DEFAULT_STAFF_PAGES]
        : [],
    seeItemCost: row.role === "STAFF" ? row.seeItemCost !== false : true,
  };
}

function normalizeUser(user: User): User {
  return {
    ...user,
    staffPages: Array.isArray(user.staffPages)
      ? user.staffPages
      : user.role === "STAFF"
        ? [...DEFAULT_STAFF_PAGES]
        : [],
    seeItemCost: user.role === "STAFF" ? user.seeItemCost !== false : true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletIdState] = useState<string | null>(localStorage.getItem("outletId"));
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("UNAUTHENTICATED");
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);

  useEffect(() => {
    applyTheme(user?.role === "PLATFORM_ADMIN" ? "gold" : tenant?.theme ?? "gold");
  }, [tenant?.theme, user?.role]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getOrCreateDeviceId();
        const users = await listAuthorizedUsers();
        if (!cancelled) setAuthorizedUsers(users);
        const license = await checkLicense();
        const token = localStorage.getItem("token");
        const session = await loadSession();

        if (navigator.onLine) {
          try {
            if (!token) {
              const next = await refreshAccessToken();
              if (!next) throw new Error("no session");
            }
            const data = await liveApi<{ user: User; tenant: Tenant | null; outlets: Outlet[] }>("/auth/me");
            if (cancelled) return;
            setUser(normalizeUser(data.user));
            setTenant(data.tenant);
            setOutlets(data.outlets);
            const nextOutletId = persistReconciledOutletId(data.outlets);
            if (nextOutletId) setOutletIdState(nextOutletId);
            setAuthStatus("ONLINE_AUTHENTICATED");
            if (data.user.role !== "PLATFORM_ADMIN") {
              await renewLicense().catch(() => undefined);
              await flushOutbox().catch(() => undefined);
              await pullSnapshot().catch(() => undefined);
            }
            return;
          } catch {
            localStorage.removeItem("token");
          }
        }

        if (userIsPlatform(session) && !navigator.onLine) {
          if (!cancelled) setAuthStatus("UNAUTHENTICATED");
          return;
        }

        if (!license.ok) {
          if (license.reason === "expired" || license.reason === "invalid" || license.reason === "suspended") {
            if (!cancelled) setAuthStatus(license.reason === "invalid" ? "LICENSE_EXPIRED" : "RENEWAL_REQUIRED");
            return;
          }
        }

        if (session && license.ok && session.tenantId === license.license.payload.tenantId) {
          const localUser = users.find((u) => u.userId === session.userId);
          if (localUser && !cancelled) {
            hydrateOffline(localUser, license.license.payload.tenantId);
            return;
          }
        }

        if (!cancelled) setAuthStatus("UNAUTHENTICATED");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!online || !user || user.role === "PLATFORM_ADMIN" || !localStorage.getItem("token")) return;
    flushOutbox().catch(() => undefined);
    renewLicense().catch(() => undefined);
  }, [online, user]);

  function hydrateOffline(localUser: AuthorizedUser, tenantId: string) {
    setUser(toUser(localUser));
    setAuthStatus("OFFLINE_AUTHENTICATED");
    void tenantId;
    import("./offline-pricing").then(async ({ getCache }) => {
      const settings = await getCache<{ profile?: Tenant }>("/settings");
      if (settings?.profile) setTenant(settings.profile);
      const cachedOutlets = await getCache<Outlet[]>("/outlets");
      if (cachedOutlets?.length) {
        const allowed =
          localUser.role === "OWNER" ? cachedOutlets : cachedOutlets.filter((o) => localUser.outletIds.includes(o.id));
        setOutlets(allowed);
        const nextOutletId = persistReconciledOutletId(allowed);
        if (nextOutletId) setOutletIdState(nextOutletId);
      }
    });
  }

  async function applyLogin(data: LoginResult, password: string) {
    localStorage.setItem("token", data.token);
    setUser(normalizeUser(data.user));
    setTenant(data.tenant);
    setOutlets(data.outlets);
    const nextOutletId = persistReconciledOutletId(data.outlets);
    if (nextOutletId) setOutletIdState(nextOutletId);
    setAuthStatus("ONLINE_AUTHENTICATED");
    if (data.license) void storeLicense(data.license);
    if (data.user.role !== "PLATFORM_ADMIN" && data.user.tenantId) {
      void registerAuthorizedUser({
        userId: data.user.id,
        tenantId: data.user.tenantId,
        email: data.user.email,
        displayName: data.user.displayName,
        role: data.user.role,
        outletIds: data.outlets.map((o) => o.id),
        staffPages: data.user.staffPages,
        seeItemCost: data.user.seeItemCost,
        password,
      }).then(() => listAuthorizedUsers().then(setAuthorizedUsers));
      void saveSession({
        mode: "online",
        userId: data.user.id,
        tenantId: data.user.tenantId,
        deviceId: "",
        role: data.user.role,
        email: data.user.email,
        displayName: data.user.displayName,
        outletIds: data.outlets.map((o) => o.id),
        createdAt: new Date().toISOString(),
        licenseId: data.license?.payload.licenseId ?? "",
      });
      if (!data.license) {
        await renewLicense().catch(() => undefined);
      }
      void pullSnapshot().catch(() => undefined);
    }
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      tenant,
      outlets,
      outletId,
      loading,
      online,
      authStatus,
      authorizedUsers,
      login: async (email, password) => {
        if (!navigator.onLine) {
          const local = await findAuthorizedUser(email);
          if (!local) throw new Error("Internet connection required to sign in this user on this device");
          return (await (async () => {
            const license = await checkLicense({ tenantId: local.tenantId });
            if (!license.ok) {
              setAuthStatus(license.reason === "expired" ? "RENEWAL_REQUIRED" : "LICENSE_EXPIRED");
              throw new Error("Internet required to verify subscription");
            }
            const ok = await verifyLocalPassword(local, password);
            if (!ok) throw new Error("Invalid credentials");
            const deviceId = await getOrCreateDeviceId();
            await saveSession({
              mode: "offline",
              userId: local.userId,
              tenantId: local.tenantId,
              deviceId,
              role: local.role,
              email: local.email,
              displayName: local.displayName,
              outletIds: local.outletIds,
              createdAt: new Date().toISOString(),
              licenseId: license.license.payload.licenseId,
            });
            setUser(toUser(local));
            setAuthStatus("OFFLINE_AUTHENTICATED");
            const { getCache } = await import("./offline-pricing");
            const settings = await getCache<{ profile?: Tenant }>("/settings");
            if (settings?.profile) setTenant(settings.profile);
            const cachedOutlets = await getCache<Outlet[]>("/outlets");
            if (cachedOutlets?.length) {
              const allowed =
                local.role === "OWNER" ? cachedOutlets : cachedOutlets.filter((o) => local.outletIds.includes(o.id));
              setOutlets(allowed);
              const nextOutletId = persistReconciledOutletId(allowed);
              if (nextOutletId) setOutletIdState(nextOutletId);
            }
            return toUser(local);
          })());
        }
        const deviceId = await getOrCreateDeviceId();
        const data = await liveApi<LoginResult>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password, deviceId, deviceLabel: deviceLabel() }),
        });
        await applyLogin(data, password);
        const id = await getOrCreateDeviceId();
        if (data.user.tenantId) {
          await saveSession({
            mode: "online",
            userId: data.user.id,
            tenantId: data.user.tenantId,
            deviceId: id,
            role: data.user.role,
            email: data.user.email,
            displayName: data.user.displayName,
            outletIds: data.outlets.map((o) => o.id),
            createdAt: new Date().toISOString(),
            licenseId: data.license?.payload.licenseId ?? "",
          });
        }
        return data.user;
      },
      loginOffline: async (userId, password) => {
        const local = (await listAuthorizedUsers()).find((u) => u.userId === userId);
        if (!local) throw new Error("Internet connection required to sign in this user on this device");
        const license = await checkLicense({ tenantId: local.tenantId });
        if (!license.ok) {
          if (license.reason === "expired" || license.reason === "invalid") {
            setAuthStatus(license.reason === "expired" ? "RENEWAL_REQUIRED" : "LICENSE_EXPIRED");
          }
          throw new Error("Internet required to verify subscription");
        }
        const ok = await verifyLocalPassword(local, password);
        if (!ok) throw new Error("Invalid credentials");
        const deviceId = await getOrCreateDeviceId();
        await saveSession({
          mode: "offline",
          userId: local.userId,
          tenantId: local.tenantId,
          deviceId,
          role: local.role,
          email: local.email,
          displayName: local.displayName,
          outletIds: local.outletIds,
          createdAt: new Date().toISOString(),
          licenseId: license.license.payload.licenseId,
        });
        setUser(toUser(local));
        setAuthStatus("OFFLINE_AUTHENTICATED");
        const { getCache } = await import("./offline-pricing");
        const settings = await getCache<{ profile?: Tenant }>("/settings");
        if (settings?.profile) setTenant(settings.profile);
        const cachedOutlets = await getCache<Outlet[]>("/outlets");
        if (cachedOutlets?.length) {
          const allowed = local.role === "OWNER" ? cachedOutlets : cachedOutlets.filter((o) => local.outletIds.includes(o.id));
          setOutlets(allowed);
          const nextOutletId = persistReconciledOutletId(allowed);
          if (nextOutletId) setOutletIdState(nextOutletId);
        }
        return toUser(local);
      },
      logout: () => {
        if (navigator.onLine) {
          void liveApi("/auth/logout", { method: "POST" }).catch(() => undefined);
        }
        localStorage.removeItem("token");
        void clearSession();
        setUser(null);
        setTenant(null);
        setOutlets([]);
        setAuthStatus("UNAUTHENTICATED");
      },
      logoutAll: async () => {
        if (navigator.onLine) {
          await liveApi("/auth/logout-all", { method: "POST" });
        }
        localStorage.removeItem("token");
        void clearSession();
        setUser(null);
        setTenant(null);
        setOutlets([]);
        setAuthStatus("UNAUTHENTICATED");
      },
      setOutletId: (id) => {
        localStorage.setItem("outletId", id);
        setOutletIdState(id);
        window.location.reload();
      },
      setTenantTheme: (theme) => {
        applyTheme(theme);
        setTenant((current) => (current ? { ...current, theme } : current));
      },
    }),
    [user, tenant, outlets, outletId, loading, online, authStatus, authorizedUsers],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function userIsPlatform(session: { role?: string } | undefined) {
  return session?.role === "PLATFORM_ADMIN";
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
