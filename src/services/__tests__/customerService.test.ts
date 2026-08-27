import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { DomainError } from "@/lib/errors";
import { CustomerEmailTakenError } from "@/services/errors";

// Mock password hashing — deterministic, track calls and order
const hashPasswordMock = vi.fn(async (password: string) => `hashed:${password}`);

vi.mock("@/lib/auth/password", () => ({
  hashPassword: (...args: unknown[]) => hashPasswordMock(...(args as [string])),
  verifyPassword: vi.fn(),
}));

import { customerCreateInputSchema, createCustomer } from "@/services/customerService";

const validInput = {
  nombre: "Juan",
  apellido: "Perez",
  email: "juan@example.com",
  telefono: "+54 11 1234-5678",
  password: "Secret123",
};

// Helper to create mock DbOrTx with controllable tx inserts
function createMockDb(scenario: {
  clientesInsert?: unknown[];
  clientesError?: unknown;
  usersInsertError?: unknown;
}) {
  const mockTx = {
    insert: vi.fn(),
  };
  const insertedClientes: unknown[] = [];
  const insertedUsers: unknown[] = [];

  let callIndex = 0;
  mockTx.insert.mockImplementation(() => {
    callIndex += 1;
    const isFirstInsert = callIndex === 1;

    if (isFirstInsert) {
      return {
        values: vi.fn().mockImplementation((vals: unknown) => {
          insertedClientes.push(vals);
          return {
            returning: vi.fn().mockImplementation(async () => {
              if (scenario.clientesError) throw scenario.clientesError;
              if (scenario.clientesInsert) return scenario.clientesInsert;
              return [
                {
                  id: "00000000-0000-4000-a000-000000000001",
                  nombre: validInput.nombre,
                  apellido: validInput.apellido,
                  email: "juan@example.com",
                  telefono: validInput.telefono,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ];
            }),
          };
        }),
      } as unknown as ReturnType<typeof mockTx.insert>;
    }

    // users insert — service awaits .values() directly without .returning()
    return {
      values: vi.fn().mockImplementation(async (vals: unknown) => {
        insertedUsers.push(vals);
        if (scenario.usersInsertError) throw scenario.usersInsertError;
        return [{ id: "user-id", email: "juan@example.com" }];
      }),
    } as unknown as ReturnType<typeof mockTx.insert>;
  });

  const mockDb = {
    transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  };

  return { mockDb, mockTx, insertedClientes, insertedUsers };
}

describe("customerCreateInputSchema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates success with normalized fields", () => {
    const parsed = customerCreateInputSchema.parse(validInput);
    expect(parsed.email).toBe("juan@example.com");
    expect(parsed.nombre).toBe("Juan");
  });

  it("trims and lowercases email: '  Juan@Example.COM  ' -> 'juan@example.com'", () => {
    const parsed = customerCreateInputSchema.parse({
      ...validInput,
      email: "  Juan@Example.COM  ",
    });
    expect(parsed.email).toBe("juan@example.com");
  });

  it("rejects nombre length 1", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, nombre: "J" }),
    ).toThrow(z.ZodError);
  });

  it("rejects nombre length 101", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, nombre: "a".repeat(101) }),
    ).toThrow(z.ZodError);
  });

  it("rejects nombre whitespace-only (trim to empty)", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, nombre: "   " }),
    ).toThrow(z.ZodError);
  });

  it("rejects apellido length 1", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, apellido: "P" }),
    ).toThrow(z.ZodError);
  });

  it("rejects apellido length 101", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, apellido: "a".repeat(101) }),
    ).toThrow(z.ZodError);
  });

  it("rejects telefono 6 chars (too short)", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, telefono: "123456" }),
    ).toThrow(z.ZodError);
  });

  it("rejects telefono 21 chars (too long)", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, telefono: "1".repeat(21) }),
    ).toThrow(z.ZodError);
  });

  it("rejects telefono with invalid chars", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, telefono: "abc-1234" }),
    ).toThrow(z.ZodError);
  });

  it("accepts telefono 7 chars boundary", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, telefono: "1234567" }),
    ).not.toThrow();
  });

  it("accepts telefono 20 chars boundary", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, telefono: "1".repeat(20) }),
    ).not.toThrow();
  });

  it("rejects password 7 chars", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, password: "1234567" }),
    ).toThrow(z.ZodError);
  });

  it("rejects password 73 chars", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, password: "a".repeat(73) }),
    ).toThrow(z.ZodError);
  });

  it("accepts password 8 chars boundary", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, password: "12345678" }),
    ).not.toThrow();
  });

  it("accepts password 72 chars boundary", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, password: "a".repeat(72) }),
    ).not.toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, email: "not-an-email" }),
    ).toThrow(z.ZodError);
  });

  it("rejects strict unknown fields", () => {
    expect(() =>
      customerCreateInputSchema.parse({ ...validInput, extra: "field" } as unknown as typeof validInput),
    ).toThrow(z.ZodError);
  });

  it("does not mutate clienteInputSchema — base still validates raw email without normalization", async () => {
    const { clienteInputSchema } = await import("@/db/validators/cliente");
    // clienteInputSchema allows raw email with case, not forced lower — parse succeeds
    const result = clienteInputSchema.parse({
      nombre: "Juan",
      apellido: "Perez",
      email: "Juan@Example.COM",
      telefono: "+54 11 1234-5678",
    });
    expect(result.email).toBe("Juan@Example.COM");
  });
});

describe("createCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashPasswordMock.mockImplementation(async (password: string) => `hashed:${password}`);
  });

  it("validates before hashing or DB access — ZodError surfaces, hashPassword not called, transaction not called", async () => {
    const { mockDb } = createMockDb({});
    const invalidInput = { ...validInput, nombre: "J" };

    await expect(createCustomer(mockDb as never, invalidInput)).rejects.toThrow(z.ZodError);

    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it("hashes password before transaction (order verification)", async () => {
    const order: string[] = [];
    hashPasswordMock.mockImplementation(async (p: string) => {
      order.push("hash");
      return `hashed:${p}`;
    });
    const { mockDb } = createMockDb({});
    (mockDb.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        order.push("transaction");
        // need to invoke cb with a tx that returns row
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: "id-1",
                  nombre: "Juan",
                  apellido: "Perez",
                  email: "juan@example.com",
                  telefono: validInput.telefono,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
            }),
          }),
        };
        return cb(mockTx as never);
      },
    );

    await createCustomer(mockDb as never, validInput);

    expect(order).toEqual(["hash", "transaction"]);
  });

  it("normalizes email and inserts normalized into both tables", async () => {
    const { mockDb, mockTx, insertedClientes, insertedUsers } = createMockDb({
      clientesInsert: [
        {
          id: "00000000-0000-4000-a000-000000000001",
          nombre: "Juan",
          apellido: "Perez",
          email: "juan@example.com",
          telefono: validInput.telefono,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const result = await createCustomer(mockDb as never, {
      ...validInput,
      email: "  Juan@Example.COM  ",
    });

    expect(mockTx.insert).toHaveBeenCalledTimes(2);
    expect(result.email).toBe("juan@example.com");
    expect(hashPasswordMock).toHaveBeenCalledWith("Secret123");
    // Verify both tables received normalized email
    expect(insertedClientes[0]).toMatchObject({ email: "juan@example.com" });
    expect(insertedUsers[0]).toMatchObject({ email: "juan@example.com" });
  });

  it("returns DTO with exactly 5 fields, no passwordHash/role/timestamps", async () => {
    const { mockDb } = createMockDb({
      clientesInsert: [
        {
          id: "00000000-0000-4000-a000-000000000001",
          nombre: "Juan",
          apellido: "Perez",
          email: "juan@example.com",
          telefono: validInput.telefono,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    });

    const dto = await createCustomer(mockDb as never, validInput);

    expect(Object.keys(dto).sort()).toEqual(
      ["apellido", "email", "id", "nombre", "telefono"].sort(),
    );
    expect(dto).toEqual({
      id: "00000000-0000-4000-a000-000000000001",
      nombre: "Juan",
      apellido: "Perez",
      email: "juan@example.com",
      telefono: validInput.telefono,
    });
    expect(dto).not.toHaveProperty("passwordHash");
    expect(dto).not.toHaveProperty("role");
    expect(dto).not.toHaveProperty("createdAt");
    expect(dto).not.toHaveProperty("updatedAt");
    expect(dto).not.toHaveProperty("password");
  });

  it("does not expose password in error or return", async () => {
    const { mockDb } = createMockDb({
      clientesError: { code: "23505", message: "duplicate" },
    });
    try {
      await createCustomer(mockDb as never, validInput);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CustomerEmailTakenError);
      const msg = (error as Error).message;
      expect(msg).not.toContain(validInput.password);
      expect(msg).not.toContain("hashed:");
    }
  });

  it("throws CustomerEmailTakenError when clientes insert collides (23505)", async () => {
    const { mockDb } = createMockDb({
      clientesError: { code: "23505" },
    });

    await expect(createCustomer(mockDb as never, validInput)).rejects.toThrow(
      CustomerEmailTakenError,
    );

    // fresh mock for code check — reuse would shift insert callIndex
    const { mockDb: mockDb2 } = createMockDb({
      clientesError: { code: "23505" },
    });
    await expect(createCustomer(mockDb2 as never, validInput)).rejects.toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
    });
  });

  it("throws CustomerEmailTakenError when users insert collides (23505)", async () => {
    const { mockDb } = createMockDb({
      usersInsertError: { code: "23505" },
    });

    await expect(createCustomer(mockDb as never, validInput)).rejects.toThrow(
      CustomerEmailTakenError,
    );
  });

  it("maps PG 23505 via cause chain (wrapped error)", async () => {
    const wrapped = new Error("wrapped", {
      cause: { code: "23505" },
    });
    const { mockDb } = createMockDb({
      clientesError: wrapped,
    });

    await expect(createCustomer(mockDb as never, validInput)).rejects.toBeInstanceOf(
      CustomerEmailTakenError,
    );
  });

  it("propagates atomicity failure — error bubbles, no swallowed exception", async () => {
    const { mockDb } = createMockDb({
      usersInsertError: { code: "23505" },
    });

    const promise = createCustomer(mockDb as never, validInput);

    await expect(promise).rejects.toThrow(CustomerEmailTakenError);
    // transaction wrapper propagates; mock ensures cb throws -> transaction rejects
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it("throws original error for non-23505 PG code", async () => {
    const otherError = { code: "23514", message: "check violation" };
    const { mockDb } = createMockDb({
      clientesError: otherError,
    });

    await expect(createCustomer(mockDb as never, validInput)).rejects.toEqual(otherError);

    const { mockDb: mockDb2 } = createMockDb({
      clientesError: otherError,
    });
    await expect(createCustomer(mockDb2 as never, validInput)).rejects.not.toBeInstanceOf(
      CustomerEmailTakenError,
    );
  });

  it("CustomerEmailTakenError extends DomainError and has correct name/code", () => {
    const err = new CustomerEmailTakenError("test@example.com");
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(CustomerEmailTakenError);
    expect(err.name).toBe("CustomerEmailTakenError");
    expect(err.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(err.email).toBe("test@example.com");
  });

  it("does not import requireAuth", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/services/customerService.ts", "utf8");
    expect(content).not.toMatch(/requireAuth/);
  });
});
