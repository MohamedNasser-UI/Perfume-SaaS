import { ApiError, isPublicAuthPath, liveApi, mediaUrl } from "./http";
import { previewCustomizedLocal } from "./offline-pricing";
import { setCache } from "./offline-pricing";
import { enqueueMutation, mutationTypeFor, readOfflineGet, writeThroughCache } from "./sync";
import { getOrCreateDeviceId } from "./device";
import { loadSession } from "./offline-auth";

export { ApiError, mediaUrl, isPublicAuthPath };

type ApiInit = RequestInit & { skipOffline?: boolean };

function isNetworkError(err: unknown) {
  return err instanceof TypeError || (err instanceof ApiError && err.status === 0);
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const skipOffline = Boolean(init.skipOffline);
  const token = localStorage.getItem("token");
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  if (path === "/pricing/preview" && method === "POST" && (!online || !token)) {
    const payload = init.body ? JSON.parse(String(init.body)) : {};
    return previewCustomizedLocal(payload) as Promise<T>;
  }

  if (!skipOffline && method === "GET" && (!online || !token)) {
    const cached = await readOfflineGet(path);
    if (cached !== undefined) return cached as T;
    if (!online) {
      throw new ApiError(0, { message: "This data is not available offline yet. Connect to the internet once to sync." });
    }
  }

  if (online && (token || isPublicAuthPath(path) || skipOffline)) {
    try {
      const result = await liveApi<T>(path, init);
      if (method === "GET") await setCache(path.split("?")[0], result).catch(() => undefined);
      return result;
    } catch (err) {
      if (method === "GET" && isNetworkError(err)) {
        const cached = await readOfflineGet(path);
        if (cached !== undefined) return cached as T;
      }
      throw err;
    }
  }

  if (method !== "GET") {
    const type = mutationTypeFor(method, path.split("?")[0]);
    if (!type) {
      throw new ApiError(0, { message: "This action requires an internet connection" });
    }
    const session = await loadSession();
    const deviceId = await getOrCreateDeviceId();
    const localId = crypto.randomUUID();
    const payload = init.body ? JSON.parse(String(init.body)) : {};
    if (type === "CUSTOMER" && !payload.id) payload.id = localId;
    if (type === "OIL_UPDATE" || type === "BOTTLE_UPDATE" || type === "CONCENTRATION_UPDATE" || type === "DISCOUNT_UPDATE") {
      const id = path.split("?")[0].split("/").filter(Boolean).pop();
      payload.id = payload.id ?? id;
    }
    await enqueueMutation({
      localId,
      deviceId,
      userId: session?.userId ?? "",
      type,
      path,
      method,
      payload,
      outletId: localStorage.getItem("outletId") ?? undefined,
    });
    return writeThroughCache(method, path.split("?")[0], payload, localId) as Promise<T>;
  }

  throw new ApiError(0, { message: "This action requires an internet connection" });
}

export async function uploadFile<T>(path: string, file: File, field = "file"): Promise<T> {
  if (!navigator.onLine || !localStorage.getItem("token")) {
    throw new ApiError(0, { message: "Uploading files requires an internet connection" });
  }
  const token = localStorage.getItem("token");
  const outletId = localStorage.getItem("outletId");
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (outletId) headers.set("X-Outlet-Id", outletId);
  const form = new FormData();
  form.append(field, file);
  const res = await fetch(`${import.meta.env.VITE_API_URL || "/api/v1"}${path}`, {
    method: "POST",
    headers,
    body: form,
    credentials: "include",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
