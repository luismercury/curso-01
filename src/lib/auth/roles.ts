import { z } from "zod";

export const UserRole = {
  CLIENTE: "CLIENTE",
  ADMINISTRADOR: "ADMINISTRADOR",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const userRoleSchema = z.enum(["CLIENTE", "ADMINISTRADOR"]);

export function isValidRole(value: string): value is UserRoleType {
  return (Object.values(UserRole) as string[]).includes(value);
}
