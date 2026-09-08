import { D, Decimal } from "../../common/money";

export function reverseInboundBalance(
  oldQty: Decimal.Value,
  oldAvg: Decimal.Value,
  removeQty: Decimal.Value,
  removeUnitCost: Decimal.Value,
) {
  const qty = D(oldQty);
  const avg = D(oldAvg);
  const take = D(removeQty);
  const unitCost = D(removeUnitCost);
  const oldValue = qty.mul(avg);
  const newQty = qty.sub(take);
  const newValue = oldValue.sub(take.mul(unitCost));
  const newAvg = newQty.eq(0) ? D(0) : newValue.div(newQty);
  return {
    newQty,
    newAvg,
    newValue: newQty.eq(0) ? D(0) : newQty.mul(newAvg),
  };
}
