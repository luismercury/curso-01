import { z } from "zod";

export const confirmedIdSchema = z.string().uuid();

export function parseConfirmedId(
  raw: string | undefined | null,
): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0) return null;
  const parsed = confirmedIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
