import assert from "node:assert/strict";
import test from "node:test";
import { reconcileOutletId } from "./outlet";

const outlets = [
  { id: "o1", name: "Main", active: true },
  { id: "o2", name: "Second", active: true },
];

test("keeps a stored outlet that is still in the current list", () => {
  assert.equal(reconcileOutletId("o2", outlets), "o2");
});

test("replaces a stale stored outlet with a valid one", () => {
  assert.equal(reconcileOutletId("gone", outlets), "o1");
});

test("selects a valid outlet when none is stored", () => {
  assert.equal(reconcileOutletId(null, outlets), "o1");
  assert.equal(reconcileOutletId("", outlets), "o1");
});

test("prefers an explicit default outlet when replacing", () => {
  assert.equal(
    reconcileOutletId("gone", [
      { id: "o1", active: true },
      { id: "o2", active: true, isDefault: true },
    ]),
    "o2",
  );
});

test("does not invent an id when there are no outlets", () => {
  assert.equal(reconcileOutletId(null, []), null);
  assert.equal(reconcileOutletId("stale", []), "stale");
});

test("skips inactive outlets when a replacement is needed", () => {
  assert.equal(
    reconcileOutletId("gone", [
      { id: "closed", active: false },
      { id: "open", active: true },
    ]),
    "open",
  );
});
