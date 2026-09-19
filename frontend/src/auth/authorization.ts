import type { UserRole } from "../types/auth";

export const ADMIN_ONLY_ROLES = ["admin"] as const satisfies readonly UserRole[];

export function hasAllowedRole(
  role: UserRole | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  return role !== null && role !== undefined && allowedRoles.includes(role);
}
