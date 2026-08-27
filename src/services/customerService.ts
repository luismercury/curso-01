import "server-only";

import { z } from "zod";

import type { Db, DbOrTx, Tx } from "@/db";
import { clientes, users } from "@/db/schema";
import { clienteInputSchema } from "@/db/validators/cliente";
import { hashPassword } from "@/lib/auth/password";
import { hasPgCode } from "@/lib/errors";
import { CustomerEmailTakenError } from "@/services/errors";
import type { ClienteDTO } from "@/db/mappers/cliente";

/**
 * Normalized email: trim, lower-case, then validate format.
 * Defined at service boundary so both `clientes` and `users` store lower-case.
 */
const normalizedEmail = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .pipe(z.string().email());

/**
 * Input schema for atomic customer creation.
 * Composes `clienteInputSchema` without mutating it — overrides `email`
 * with `normalizedEmail` and adds `password` 8..72.
 */
export const customerCreateInputSchema = clienteInputSchema
  .extend({
    email: normalizedEmail,
    password: z.string().min(8).max(72),
  })
  .strict();

export type CustomerCreateInput = z.input<typeof customerCreateInputSchema>;
export type CustomerCreateParsed = z.infer<typeof customerCreateInputSchema>;

export type CustomerDTO = Pick<
  ClienteDTO,
  "id" | "nombre" | "apellido" | "email" | "telefono"
>;

/**
 * Atomic customer registration: validates, hashes password before transaction,
 * inserts into `clientes` then `users` (role CLIENTE) in a single transaction,
 * maps PG 23505 from either table to unified error,
 * returns DTO with exactly 5 fields.
 *
 * No authentication required — unauthenticated service per spec.
 */
export async function createCustomer(
  dbOrTx: DbOrTx,
  input: CustomerCreateInput,
): Promise<CustomerDTO> {
  const parsed = customerCreateInputSchema.parse(input) as CustomerCreateParsed;

  const { password, ...clienteData } = parsed;

  // Hash outside transaction per INV-03
  const passwordHash = await hashPassword(password);

  try {
    // Casting to Db for transaction typing — DbOrTx union (Db|Tx) both expose .transaction
    // but the generic union is not callable without a cast. Runtime handle works for both.
    const result = await (dbOrTx as unknown as { transaction: Db["transaction"] }).transaction(
      async (tx: Tx) => {
        const [clienteRow] = await tx.insert(clientes).values(clienteData).returning();

        if (!clienteRow) {
          throw new Error("INSERT INTO clientes returned no rows");
        }

        await tx.insert(users).values({
          email: clienteData.email,
          passwordHash,
          role: "CLIENTE",
        });

        const dto: CustomerDTO = {
          id: clienteRow.id,
          nombre: clienteRow.nombre,
          apellido: clienteRow.apellido,
          email: clienteRow.email,
          telefono: clienteRow.telefono,
        };

        return dto;
      },
    );

    return result;
  } catch (error) {
    if (hasPgCode(error, "23505")) {
      throw new CustomerEmailTakenError(clienteData.email);
    }
    throw error;
  }
}
