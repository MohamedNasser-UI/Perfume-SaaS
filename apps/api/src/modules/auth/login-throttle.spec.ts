import assert from "node:assert/strict";
import test from "node:test";
import { LoginThrottle } from "./login-throttle";

test("LoginThrottle does not delay the first failures", async () => {
  const throttle = new LoginThrottle();
  const key = throttle.key("a@b.c", "1.1.1.1");
  const start = Date.now();
  await throttle.wait(key);
  throttle.fail(key);
  await throttle.wait(key);
  assert.ok(Date.now() - start < 50);
});

test("LoginThrottle.reset clears the counter", async () => {
  const throttle = new LoginThrottle();
  const key = throttle.key("a@b.c", "1.1.1.1");
  for (let i = 0; i < 8; i++) throttle.fail(key);
  throttle.reset(key);
  const start = Date.now();
  await throttle.wait(key);
  assert.ok(Date.now() - start < 50);
});
