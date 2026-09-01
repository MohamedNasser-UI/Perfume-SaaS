import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function D(value: Decimal.Value): Decimal {
  return new Decimal(value ?? 0);
}

export function money(value: Decimal.Value, places = 2): number {
  return D(value).toDecimalPlaces(places).toNumber();
}

export function qty(value: Decimal.Value, places = 4): number {
  return D(value).toDecimalPlaces(places).toNumber();
}

export function cost(value: Decimal.Value, places = 6): number {
  return D(value).toDecimalPlaces(places).toNumber();
}
