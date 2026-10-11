import * as z from "zod";
import { SchemaError } from "../../errors.js";

export const identifier = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(200);

export function parseWith<T>(schema: z.ZodType<T>, data: unknown, what: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new SchemaError(`Unexpected ${what} payload from Benepass`);
  }
  return parsed.data;
}

export function parseItems<T>(itemSchema: z.ZodType<T>, payload: unknown, what: string): T[] {
  const ItemsSchema = z.union([
    z.array(itemSchema),
    z.object({
      data: z.array(itemSchema),
    }),
    z.object({
      results: z.array(itemSchema),
    }),
  ]);
  const value = parseWith(ItemsSchema, payload, what);
  if (Array.isArray(value)) {
    return value;
  }
  return "data" in value ? value.data : value.results;
}
