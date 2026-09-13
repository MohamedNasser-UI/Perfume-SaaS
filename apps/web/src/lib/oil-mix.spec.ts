import assert from "node:assert/strict";
import test from "node:test";
import { evenSplitMl, mixLabel, mixTotalMl, splitMix } from "./oil-mix";

test("even-split puts leftover on the last oil", () => {
  assert.deepEqual(evenSplitMl(10, 3), [3.3, 3.3, 3.4]);
  assert.deepEqual(evenSplitMl(10, 2), [5, 5]);
  assert.deepEqual(evenSplitMl(7.5, 1), [7.5]);
  assert.deepEqual(evenSplitMl(10, 0), []);
});

test("splitMix maps ids to even quantities", () => {
  const mix = splitMix(["oud", "amber"], 10);
  assert.deepEqual(mix, [
    { oilId: "oud", qtyMl: 5 },
    { oilId: "amber", qtyMl: 5 },
  ]);
  assert.equal(mixTotalMl(mix), 10);
});

test("mixLabel joins oil names", () => {
  assert.equal(mixLabel(["Oud", "Amber"]), "Oud + Amber");
});
