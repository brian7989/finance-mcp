import Big from "big.js";
import { DecimalSchema } from "../schemas.js";

export function decimal(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return DecimalSchema.parse(new Big(value).toFixed());
}
export function addAmounts(left: string, right: string): string {
  return new Big(DecimalSchema.parse(left)).plus(DecimalSchema.parse(right)).toFixed();
}
export function negateAmount(value: string): string {
  return new Big(DecimalSchema.parse(value)).neg().toFixed();
}
