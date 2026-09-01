export const OTHER_BUSINESS_LICENSE_MESSAGE = "This device is registered to another business";

export function isOtherBusinessLicenseError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = "status" in err ? Number((err as { status?: number }).status) : undefined;
  if (status !== 403) return false;
  const message =
    "message" in err && typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  const body = "body" in err ? (err as { body?: unknown }).body : undefined;
  const bodyMessage =
    typeof body === "object" && body && "message" in body ? String((body as { message: unknown }).message) : "";
  return message.includes("another business") || bodyMessage.includes("another business");
}

export async function withOtherBusinessRetry<T>(
  run: () => Promise<T>,
  rotate: () => Promise<unknown>,
  log: (message: string) => void = console.info,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isOtherBusinessLicenseError(err)) throw err;
    log("device ID rotated because it belongs to another business");
    await rotate();
    try {
      const result = await run();
      log("license retry succeeded");
      return result;
    } catch (retryErr) {
      log("license retry failed");
      throw retryErr;
    }
  }
}
