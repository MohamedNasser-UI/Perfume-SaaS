import assert from "node:assert/strict";
import test from "node:test";
import { D } from "../../common/money";
import { reverseInboundBalance } from "./reverse-inbound";

test("reverses a purchase at original cost not current average", () => {
  const result = reverseInboundBalance(D(20), D(10), D(10), D(8));
  assert.equal(result.newQty.toFixed(4), "10.0000");
  assert.equal(result.newAvg.toFixed(6), "12.000000");
});

test("allows on-hand to go negative", () => {
  const result = reverseInboundBalance(D(3), D(10), D(10), D(10));
  assert.equal(result.newQty.toFixed(4), "-7.0000");
});

test("zero remaining quantity clears average", () => {
  const result = reverseInboundBalance(D(5), D(4), D(5), D(4));
  assert.equal(result.newQty.toFixed(4), "0.0000");
  assert.equal(result.newAvg.toFixed(6), "0.000000");
  assert.equal(result.newValue.toFixed(4), "0.0000");
});
