import assert from "node:assert/strict";
import test from "node:test";
import { D } from "../../common/money";
import { allocateLineDiscounts, lineNetTotal, settleTender } from "./sale-tender";

test("case A: pay exact subtotal", () => {
  const s = settleTender({ subtotal: D(1000), amountReceived: 1000, presetDiscountPct: D(0), maxDiscountPct: D(15) });
  assert.equal(s.discountAmount.toFixed(4), "0.0000");
  assert.equal(s.finalAmount.toFixed(4), "1000.0000");
  assert.equal(s.amountReceived.toFixed(4), "1000.0000");
  assert.equal(s.changeAmount.toFixed(4), "0.0000");
});

test("case B: pay 995 allocates 5 discount and no change", () => {
  const s = settleTender({ subtotal: D(1000), amountReceived: 995, presetDiscountPct: D(0), maxDiscountPct: D(15) });
  assert.equal(s.discountAmount.toFixed(4), "5.0000");
  assert.equal(s.finalAmount.toFixed(4), "995.0000");
  assert.equal(s.changeAmount.toFixed(4), "0.0000");
  const discounts = allocateLineDiscounts([D(300), D(700)], s.discountAmount);
  assert.equal(discounts[0].toFixed(4), "1.5000");
  assert.equal(discounts[1].toFixed(4), "3.5000");
  assert.equal(D(300).sub(discounts[0]).add(D(700).sub(discounts[1])).toFixed(4), "995.0000");
});

test("case C: overpay returns change and no discount", () => {
  const s = settleTender({ subtotal: D(1000), amountReceived: 1050, presetDiscountPct: D(0), maxDiscountPct: D(15) });
  assert.equal(s.discountAmount.toFixed(4), "0.0000");
  assert.equal(s.finalAmount.toFixed(4), "1000.0000");
  assert.equal(s.changeAmount.toFixed(4), "50.0000");
});

test("case D: 10 percent underpay is allowed when max is 15", () => {
  const s = settleTender({ subtotal: D(1000), amountReceived: 900, presetDiscountPct: D(0), maxDiscountPct: D(15) });
  assert.equal(s.discountAmount.toFixed(4), "100.0000");
  assert.equal(s.finalAmount.toFixed(4), "900.0000");
});

test("rejects discount above configured maximum", () => {
  assert.throws(
    () => settleTender({ subtotal: D(1000), amountReceived: 500, presetDiscountPct: D(0), maxDiscountPct: D(15) }),
    /maximum configured discount/,
  );
});

test("legacy omitted amountReceived uses preset percentage", () => {
  const s = settleTender({ subtotal: D(1000), presetDiscountPct: D(5), maxDiscountPct: D(15) });
  assert.equal(s.discountAmount.toFixed(4), "50.0000");
  assert.equal(s.finalAmount.toFixed(4), "950.0000");
  assert.equal(s.amountReceived.toFixed(4), "950.0000");
  assert.equal(s.changeAmount.toFixed(4), "0.0000");
});

test("qty greater than 1 allocates from line totals and residual stays exact", () => {
  const discounts = allocateLineDiscounts([D(600), D(400)], D("3.33"));
  const net = D(600).sub(discounts[0]).add(D(400).sub(discounts[1]));
  assert.equal(discounts[0].add(discounts[1]).toFixed(4), "3.3300");
  assert.equal(net.toFixed(4), "996.6700");
});

test("decimal prices allocate without leftover", () => {
  const discounts = allocateLineDiscounts([D("99.99"), D("10.01")], D(1));
  assert.equal(discounts[0].add(discounts[1]).toFixed(4), "1.0000");
});

test("historical lines without net fields use original lineTotal", () => {
  assert.equal(lineNetTotal({ lineTotal: 100, netLineTotal: 0, discountAmount: 0 }).toFixed(4), "100.0000");
});

test("allocated discount uses stored net even when net is zero", () => {
  assert.equal(lineNetTotal({ lineTotal: 100, netLineTotal: 0, discountAmount: 100 }).toFixed(4), "0.0000");
  assert.equal(lineNetTotal({ lineTotal: 100, netLineTotal: 95, discountAmount: 5 }).toFixed(4), "95.0000");
});
