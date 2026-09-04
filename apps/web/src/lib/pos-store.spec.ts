import assert from "node:assert/strict";
import test from "node:test";
import { usePos, type PosLine } from "./pos-store";

function readyMade(
  over: Partial<{ key: string; label: string; qty: number; unitPrice: number; productId: string }> = {},
): PosLine {
  return {
    key: "ready-1",
    lineType: "ORIGINAL",
    label: "Sauvage",
    qty: 1,
    unitPrice: 100,
    productId: "p1",
    ...over,
  };
}

test("setLineQty raises and clamps ready-made and customized lines", () => {
  usePos.getState().clear();
  usePos.getState().addLine(readyMade());
  usePos.getState().addLine({
    key: "custom-1",
    lineType: "CUSTOMIZED",
    label: "ROGE",
    qty: 1,
    unitPrice: 50,
    payload: {
      oilId: "o1",
      concentrationId: "c1",
      bottleId: "b1",
      oilActualQtyMl: 10,
      customerSuppliedBottle: false,
    },
  });

  usePos.getState().setLineQty("ready-1", 3);
  usePos.getState().setLineQty("custom-1", 2);
  const after = usePos.getState().lines;
  assert.equal(after.find((l) => l.key === "ready-1")?.qty, 3);
  assert.equal(after.find((l) => l.key === "custom-1")?.qty, 2);

  usePos.getState().setLineQty("ready-1", 0);
  assert.equal(usePos.getState().lines.find((l) => l.key === "ready-1")?.qty, 1);

  usePos.getState().setLineQty("ready-1", 9, 4);
  assert.equal(usePos.getState().lines.find((l) => l.key === "ready-1")?.qty, 4);

  usePos.getState().setLineQty("ready-1", 3, 0);
  assert.equal(usePos.getState().lines.find((l) => l.key === "ready-1")?.qty, 3);
});

test("setLineQty does not change finished customized bottles", () => {
  usePos.getState().clear();
  usePos.getState().addLine({
    key: "fin-1",
    lineType: "FINISHED_CUSTOMIZED",
    label: "Finished",
    qty: 1,
    unitPrice: 80,
    finishedItemId: "f1",
  });
  usePos.getState().setLineQty("fin-1", 4);
  assert.equal(usePos.getState().lines[0]?.qty, 1);
});
