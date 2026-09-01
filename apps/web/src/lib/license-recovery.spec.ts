import assert from "node:assert/strict";
import test from "node:test";
import { isOtherBusinessLicenseError, withOtherBusinessRetry } from "./license-recovery";

test("detects the other-business license 403", () => {
  assert.equal(
    isOtherBusinessLicenseError({ status: 403, message: "This device is registered to another business" }),
    true,
  );
  assert.equal(
    isOtherBusinessLicenseError({ status: 403, body: { message: "This device is registered to another business" } }),
    true,
  );
  assert.equal(isOtherBusinessLicenseError({ status: 403, message: "Outlet not found" }), false);
  assert.equal(isOtherBusinessLicenseError({ status: 401, message: "This device is registered to another business" }), false);
});

test("rotates the device id and retries license once on other-business 403", async () => {
  let attempts = 0;
  let rotated = 0;
  const result = await withOtherBusinessRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("This device is registered to another business"), { status: 403 });
      }
      return { ok: true, attempts };
    },
    async () => {
      rotated += 1;
    },
    () => undefined,
  );
  assert.deepEqual(result, { ok: true, attempts: 2 });
  assert.equal(rotated, 1);
});

test("does not rotate again when the retry also returns 403", async () => {
  let attempts = 0;
  let rotated = 0;
  await assert.rejects(
    () =>
      withOtherBusinessRetry(
        async () => {
          attempts += 1;
          throw Object.assign(new Error("This device is registered to another business"), { status: 403 });
        },
        async () => {
          rotated += 1;
        },
        () => undefined,
      ),
    (err: unknown) => {
      assert.equal(isOtherBusinessLicenseError(err), true);
      return true;
    },
  );
  assert.equal(attempts, 2);
  assert.equal(rotated, 1);
});

test("does not rotate for unrelated 403s", async () => {
  let rotated = 0;
  await assert.rejects(() =>
    withOtherBusinessRetry(
      async () => {
        throw Object.assign(new Error("Outlet not found"), { status: 403 });
      },
      async () => {
        rotated += 1;
      },
      () => undefined,
    ),
  );
  assert.equal(rotated, 0);
});
