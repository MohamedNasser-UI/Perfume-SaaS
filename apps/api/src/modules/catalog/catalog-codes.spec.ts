import assert from "node:assert/strict";
import test from "node:test";
import { nextCatalogCodeFromList } from "./catalog-codes";

test("empty tenant starts at OL1", () => {
  assert.equal(nextCatalogCodeFromList("OL", []), "OL1");
});

test("existing OL2 yields OL3", () => {
  assert.equal(nextCatalogCodeFromList("OL", ["OL2"]), "OL3");
});

test("legacy OIL-MUSK does not affect the OL sequence", () => {
  assert.equal(nextCatalogCodeFromList("OL", ["OIL-MUSK", "OL1"]), "OL2");
  assert.equal(nextCatalogCodeFromList("OL", ["OIL-MUSK"]), "OL1");
});

test("takes the highest matching number even when codes are unordered", () => {
  assert.equal(nextCatalogCodeFromList("RDY", ["RDY10", "RDY2", "RDY-OLD"]), "RDY11");
});
