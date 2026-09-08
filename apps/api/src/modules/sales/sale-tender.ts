import { BadRequestException } from "@nestjs/common";
import { D, Decimal } from "../../common/money";

const PCT_EPS = D("0.01");

export type TenderSettlement = {
  discountAmount: Decimal;
  discountPercentage: Decimal;
  finalAmount: Decimal;
  amountReceived: Decimal;
  changeAmount: Decimal;
};

export function settleTender(input: {
  subtotal: Decimal;
  amountReceived?: number;
  presetDiscountPct: Decimal;
  maxDiscountPct: Decimal;
}): TenderSettlement {
  const subtotal = input.subtotal;
  if (subtotal.lt(0)) throw new BadRequestException("Invalid subtotal");

  let discountAmount: Decimal;
  let finalAmount: Decimal;
  let amountReceived: Decimal;
  let changeAmount: Decimal;

  if (input.amountReceived == null) {
    discountAmount = subtotal.mul(input.presetDiscountPct).div(100).toDecimalPlaces(4);
    finalAmount = subtotal.sub(discountAmount).toDecimalPlaces(4);
    amountReceived = finalAmount;
    changeAmount = D(0);
  } else {
    if (!Number.isFinite(input.amountReceived) || input.amountReceived < 0) {
      throw new BadRequestException("Amount received must be zero or greater");
    }
    amountReceived = D(input.amountReceived).toDecimalPlaces(4);
    if (amountReceived.gte(subtotal)) {
      discountAmount = D(0);
      finalAmount = subtotal.toDecimalPlaces(4);
      changeAmount = amountReceived.sub(finalAmount).toDecimalPlaces(4);
    } else {
      discountAmount = subtotal.sub(amountReceived).toDecimalPlaces(4);
      finalAmount = amountReceived.toDecimalPlaces(4);
      changeAmount = D(0);
    }
  }

  const pct = subtotal.eq(0) ? D(0) : discountAmount.div(subtotal).mul(100);
  if (pct.gt(input.maxDiscountPct.add(PCT_EPS))) {
    throw new BadRequestException("Discount exceeds the maximum configured discount");
  }

  return {
    discountAmount,
    discountPercentage: pct.toDecimalPlaces(2),
    finalAmount,
    amountReceived,
    changeAmount,
  };
}

export function allocateLineDiscounts(lineTotals: Decimal[], discountAmount: Decimal): Decimal[] {
  if (lineTotals.length === 0) return [];
  const subtotal = lineTotals.reduce((sum, total) => sum.add(total), D(0));
  if (subtotal.eq(0) || discountAmount.eq(0)) {
    return lineTotals.map(() => D(0).toDecimalPlaces(4));
  }

  const discounts = lineTotals.map((total) => total.div(subtotal).mul(discountAmount).toDecimalPlaces(4));
  const allocated = discounts.reduce((sum, value) => sum.add(value), D(0));
  const residual = discountAmount.toDecimalPlaces(4).sub(allocated);
  let last = discounts.length - 1;
  for (let i = discounts.length - 1; i >= 0; i--) {
    if (lineTotals[i].gt(0)) {
      last = i;
      break;
    }
  }
  discounts[last] = Decimal.max(D(0), discounts[last].add(residual)).toDecimalPlaces(4);
  if (discounts[last].gt(lineTotals[last])) {
    discounts[last] = lineTotals[last].toDecimalPlaces(4);
  }
  return discounts;
}

export function lineNetTotal(line: { lineTotal: Decimal.Value; netLineTotal?: Decimal.Value | null; discountAmount?: Decimal.Value | null }) {
  const net = D(line.netLineTotal ?? 0);
  const allocated = D(line.discountAmount ?? 0);
  if (net.gt(0) || allocated.gt(0)) return net;
  return D(line.lineTotal);
}
