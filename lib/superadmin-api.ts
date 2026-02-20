import api from "./api";
import type { SuperadminOrg, SuperadminStats, SuperadminUser } from "@/types/api";

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
