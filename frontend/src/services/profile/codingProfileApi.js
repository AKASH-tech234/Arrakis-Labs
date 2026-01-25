
import apiClient from "../common/api";

export async function getCodingProfiles() {
  const res = await apiClient.get("/profile/platforms");
  return res.data?.data || [];
}

export async function addCodingProfile(payload) {
  const res = await apiClient.post("/profile/platform", payload);
  return res.data?.data;
}

export async function updateCodingProfile(id, payload) {
  const res = await apiClient.put(`/profile/platform/${id}`, payload);
  return res.data?.data;
}

export async function deleteCodingProfile(id) {
  const res = await apiClient.delete(`/profile/platform/${id}`);
  return res.data;
}

export async function syncCodingProfile(id) {
  const res = await apiClient.post(`/profile/platform/${id}/sync`);
  return res.data;
}

export async function getCodingProfileSummary() {
  const res = await apiClient.get("/profile/coding-summary");
  return res.data?.data;
}
