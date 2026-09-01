const BASE = import.meta.env.VITE_API_URL || "/api/v1";

const PUBLIC_AUTH = new Set([
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
]);

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(typeof body === "object" && body && "message" in body ? String((body as { message: string }).message) : "Request failed");
    this.status = status;
    this.body = body;
  }
}

type LiveInit = RequestInit & { _retry?: boolean };

let refreshInFlight: Promise<string | null> | null = null;

function pathKey(path: string) {
  return path.split("?")[0];
}

export function isPublicAuthPath(path: string) {
  return PUBLIC_AUTH.has(pathKey(path));
}

async function parseJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
      const body = await parseJson(res);
      if (!res.ok) return null;
      const token = (body as { token?: string })?.token;
      if (!token) return null;
      localStorage.setItem("token", token);
      return token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function liveApi<T>(path: string, init: LiveInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const outletId = localStorage.getItem("outletId");
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (outletId) headers.set("X-Outlet-Id", outletId);
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
  const body = await parseJson(res);
  if (res.status === 401 && !init._retry && !isPublicAuthPath(path)) {
    const next = await refreshAccessToken();
    if (next) return liveApi<T>(path, { ...init, _retry: true });
    localStorage.removeItem("token");
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function mediaUrl(imageUrl?: string | null) {
  if (!imageUrl) return undefined;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (api && /^https?:\/\//i.test(api)) {
    try {
      return `${new URL(api).origin}${imageUrl}`;
    } catch {
      return imageUrl;
    }
  }
  return imageUrl;
}
