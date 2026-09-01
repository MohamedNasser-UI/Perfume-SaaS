import { BadRequestException } from "@nestjs/common";
import { Unit } from "@prisma/client";
import { D, Decimal } from "./money";

export function toStockQuantity(quantity: Decimal.Value, from: Unit, stockUnit: Unit): Decimal {
  if (from === stockUnit) return D(quantity);
  if (from === "L" && stockUnit === "ML") return D(quantity).mul(1000);
  if (from === "ML" && stockUnit === "L") return D(quantity).div(1000);
  throw new BadRequestException(`Cannot convert ${from} to ${stockUnit}`);
}

export function toStockUnitCost(unitCost: Decimal.Value, from: Unit, stockUnit: Unit): Decimal {
  if (from === stockUnit) return D(unitCost);
  if (from === "L" && stockUnit === "ML") return D(unitCost).div(1000);
  if (from === "ML" && stockUnit === "L") return D(unitCost).mul(1000);
  throw new BadRequestException(`Cannot convert unit cost from ${from} to ${stockUnit}`);
}

export function unitLabel(unit: Unit): string {
  if (unit === "ML") return "ml";
  if (unit === "L") return "L";
  return "pcs";
}
