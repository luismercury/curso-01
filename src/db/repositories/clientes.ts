import { eq } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import { clientes } from "@/db/schema";
import type { ClienteDTO } from "@/db/mappers/cliente";
import { toClienteDTO } from "@/db/mappers/cliente";
import type { ClienteInput } from "@/db/validators/cliente";
import { clienteInputSchema } from "@/db/validators/cliente";
import { DomainError, hasPgCode } from "@/lib/errors";

export class ClienteEmailTakenError extends DomainError {
  readonly email: string;

  constructor(email: string) {
    super(`A cliente with email "${email}" already exists`);
    this.name = "ClienteEmailTakenError";
    this.email = email;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return hasPgCode(error, "23505");
}

/**
 * Thin repository (design D3): single-statement operations, no transactions
 * in v1. All functions take the db handle as first argument for testability.
 */
export async function createCliente(
  db: DbOrTx,
  input: ClienteInput,
): Promise<ClienteDTO> {
  const validated = clienteInputSchema.parse(input);
  try {
    const [row] = await db.insert(clientes).values(validated).returning();
    if (!row) {
      throw new Error("INSERT INTO clientes returned no rows");
    }
    return toClienteDTO(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ClienteEmailTakenError(validated.email);
    }
    throw error;
  }
}

export async function findClienteById(
  db: DbOrTx,
  id: string,
): Promise<ClienteDTO | null> {
  const rows = await db
    .select()
    .from(clientes)
    .where(eq(clientes.id, id))
    .limit(1);
  return rows[0] ? toClienteDTO(rows[0]) : null;
}

export async function findClienteByEmail(
  db: DbOrTx,
  email: string,
): Promise<ClienteDTO | null> {
  const rows = await db
    .select()
    .from(clientes)
    .where(eq(clientes.email, email))
    .limit(1);
  return rows[0] ? toClienteDTO(rows[0]) : null;
}
