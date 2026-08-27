import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { users } from "@/db/schema";
import type { UserDTO } from "@/db/mappers/user";
import { toUserDTO } from "@/db/mappers/user";
import { DomainError, hasPgCode } from "@/lib/errors";
import { hashPassword } from "@/lib/auth/password";

export class UserEmailTakenError extends DomainError {
  readonly email: string;
  constructor(email: string, options?: { cause?: unknown }) {
    super(`A user with email "${email}" already exists`);
    this.name = "UserEmailTakenError";
    this.email = email;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export async function createUser(
  db: DbOrTx,
  input: { email: string; password: string; role?: "CLIENTE" | "ADMINISTRADOR" },
): Promise<UserDTO> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const role = input.role ?? "CLIENTE";
  try {
    const [row] = await db
      .insert(users)
      .values({ email, passwordHash, role })
      .returning();
    if (!row) throw new Error("INSERT INTO users returned no rows");
    return toUserDTO(row);
  } catch (error) {
    if (hasPgCode(error, "23505")) {
      throw new UserEmailTakenError(email, { cause: error });
    }
    throw error;
  }
}

export async function findUserByEmail(
  db: DbOrTx,
  email: string,
): Promise<(UserDTO & { passwordHash: string }) | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...toUserDTO(row), passwordHash: row.passwordHash };
}

export async function findUserById(db: DbOrTx, id: string): Promise<UserDTO | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ? toUserDTO(rows[0]) : null;
}
