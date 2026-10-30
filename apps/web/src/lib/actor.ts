import { cookies } from "next/headers";
import { ROLES, type Role } from "./revisions";

// Demo identity: a role selector stored in a cookie. Real deployments would use an identity provider.
export function currentActor(): { role: Role; actor: string } {
  const c = cookies();
  const role = (ROLES as readonly string[]).includes(c.get("sgm.role")?.value ?? "") ? (c.get("sgm.role")!.value as Role) : "editor";
  const names: Record<Role, string> = {
    editor: "M. Gander (Product editor, synthetic)",
    reviewer: "P. Plume (Underwriting reviewer, synthetic)",
    compliance: "D. Drake (Compliance, synthetic)",
    publisher: "W. Waddle (Publishing, synthetic)",
  };
  return { role, actor: names[role] };
}
