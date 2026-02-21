import api from "./api";
import type { SuperadminOrg, SuperadminStats, SuperadminUser, OrgInvite } from "@/types/api";

export async function getOrgs(): Promise<{ orgs: SuperadminOrg[]; total: number }> {
  const { data } = await api.get<{ orgs: SuperadminOrg[]; total: number }>("/superadmin/orgs");
  return data;
}

export async function getOrgUsers(orgId: string) {
  const { data } = await api.get(`/superadmin/orgs/${orgId}/users`);
  return data;
}

export async function getAllUsers(params?: { tier?: string; search?: string }): Promise<SuperadminUser[]> {
  const { data } = await api.get<SuperadminUser[]>("/superadmin/users", { params });
  return data;
}

export async function updateUserTier(userId: string, tier: string) {
  const { data } = await api.put(`/superadmin/users/${userId}/tier`, { tier });
  return data;
}

export async function impersonateUser(userId: string): Promise<{
  token: string;
  user_id: string;
  email: string;
  expires_in: number;
}> {
  const { data } = await api.post(`/superadmin/users/${userId}/impersonate`);
  return data;
}

export async function getStats(): Promise<SuperadminStats> {
  const { data } = await api.get<SuperadminStats>("/superadmin/stats");
  return data;
}

export async function getOrgInvites(orgId: string): Promise<OrgInvite[]> {
  const { data } = await api.get<OrgInvite[]>("/org/invites", { params: { org_id: orgId } });
  return data;
}

export async function createOrgInvite(
  email: string,
  hockeyRole: string,
  orgId?: string
): Promise<{ invite_id: string; invite_url: string; expires_at: string; email_sent: boolean }> {
  const body: Record<string, string> = { email, hockey_role: hockeyRole };
  if (orgId) body.org_id = orgId;
  const { data } = await api.post("/org/invite", body);
  return data;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await api.delete(`/org/invite/${inviteId}`);
}
