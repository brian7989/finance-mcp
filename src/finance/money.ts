import { DecimalSchema } from "./schemas.js";

export function decimal(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return DecimalSchema.parse(value);
  }
  if (!Number.isFinite(value)) {
    throw new Error("Invalid monetary amount");
  }
  return DecimalSchema.parse(expandExponent(String(value)));
}
export function addAmounts(left: string, right: string): string {
  DecimalSchema.parse(left);
  DecimalSchema.parse(right);
  const scale = Math.max(decimalPlaces(left), decimalPlaces(right));
  const total = scaledInteger(left, scale) + scaledInteger(right, scale);
  return formatInteger(total, scale);
}
export function negateAmount(value: string): string {
  return addAmounts("0", value.startsWith("-") ? value.slice(1) : `-${value}`);
}
function decimalPlaces(value: string): number {
  return value.split(".")[1]?.length ?? 0;
}
function scaledInteger(value: string, scale: number): bigint {
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".");
  const integer = BigInt(whole + fraction.padEnd(scale, "0"));
  return value.startsWith("-") ? -integer : integer;
}
function formatInteger(value: bigint, scale: number): string {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value).toString().padStart(scale + 1, "0");
  if (!scale) {
    return sign + digits;
  }
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : sign + whole;
}
function expandExponent(value: string): string {
  if (!/[eE]/.test(value)) {
    return value;
  }
  const [coefficient = "0", exponent = "0"] = value.toLowerCase().split("e");
  const negative = coefficient.startsWith("-");
  const [whole = "0", fraction = ""] = coefficient.replace("-", "").split(".");
  const digits = whole + fraction;
  const position = whole.length + Number(exponent);
  let expanded: string;
  if (position <= 0) {
    expanded = `0.${"0".repeat(-position)}${digits}`;
  } else if (position >= digits.length) {
    expanded = digits + "0".repeat(position - digits.length);
  } else {
    expanded = `${digits.slice(0, position)}.${digits.slice(position)}`;
  }
  return negative ? `-${expanded}` : expanded;
}
