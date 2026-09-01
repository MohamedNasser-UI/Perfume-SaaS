import assert from "node:assert/strict";
import test from "node:test";
import { generateOpaqueToken, hashToken, parseDuration, readCookie, tokensEqual } from "../../common/auth-tokens";

test("parseDuration reads s/m/h/d", () => {
  assert.equal(parseDuration("15m", 0), 15 * 60 * 1000);
  assert.equal(parseDuration("7d", 0), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseDuration("bogus", 42), 42);
  assert.equal(parseDuration(undefined, 9), 9);
});

test("hashToken is deterministic and not the raw value", () => {
  const raw = generateOpaqueToken();
  const hashed = hashToken(raw);
  assert.equal(hashed, hashToken(raw));
  assert.notEqual(hashed, raw);
  assert.equal(hashed.length, 64);
});

test("tokensEqual is length-safe", () => {
  assert.equal(tokensEqual("abc", "abc"), true);
  assert.equal(tokensEqual("abc", "abd"), false);
  assert.equal(tokensEqual("abc", "ab"), false);
});

test("readCookie parses a header", () => {
  assert.equal(readCookie("a=1; refresh_token=secret%2Bval", "refresh_token"), "secret+val");
  assert.equal(readCookie(undefined, "refresh_token"), undefined);
});
