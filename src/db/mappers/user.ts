import type { UserRow } from "@/db/schema";

export interface UserDTO {
  id: string;
  email: string;
  role: "CLIENTE" | "ADMINISTRADOR";
  createdAt: Date;
  updatedAt: Date;
}

export function toUserDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserDTO["role"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
