/**
 * Demo session. The active role is a cookie, switched from the demo home page.
 *
 * This is NOT authentication and is labelled as such in the UI. It exists so the
 * demonstration can show the same screen behaving differently for a technician,
 * a quality inspector and a service adviser.
 */

import { cookies } from "next/headers";
import type { Actor, Role } from "@/lib/types";
import { getState } from "@/lib/store/store";

export const ROLE_COOKIE = "c01_role";
export const DEFAULT_ROLE: Role = "service-adviser";

export const EMPLOYEE_ROLES: Role[] = ["technician", "quality-inspector", "service-adviser"];

export const ROLE_LABELS: Record<Role, string> = {
  technician: "Technician",
  "quality-inspector": "Quality inspector",
  "service-adviser": "Service adviser",
  customer: "Customer",
};

export function isRole(value: unknown): value is Role {
  return (
    value === "technician" ||
    value === "quality-inspector" ||
    value === "service-adviser" ||
    value === "customer"
  );
}

export async function currentRole(): Promise<Role> {
  const store = await cookies();
  const value = store.get(ROLE_COOKIE)?.value;
  return isRole(value) ? value : DEFAULT_ROLE;
}

/** The acting employee for the current role, from the synthetic overlay. */
export async function currentActor(): Promise<Actor> {
  const role = await currentRole();
  const employee = getState().employees.find((e) => e.role === role);
  return employee ?? { id: "CUSTOMER", displayLabel: "Customer", role };
}
