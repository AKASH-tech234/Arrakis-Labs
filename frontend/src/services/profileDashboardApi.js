import apiClient from "./api";

export async function getMyPlatformProfiles() {
  const res = await apiClient.get("/profile/platforms");
  return res.data?.data || [];
}

export async function addPlatformProfile(payload) {
  const res = await apiClient.post("/profile/platform", payload);
  return res.data?.data;
}

export async function updatePlatformProfile(id, payload) {
  const res = await apiClient.put(`/profile/platform/${id}`, payload);
  return res.data?.data;
}

export async function syncPlatformProfile(id) {
  const res = await apiClient.post(`/profile/platform/${id}/sync`);
  return res.data;
}

export async function getCombinedStats() {
  const res = await apiClient.get("/stats/combined");
  return res.data?.data;
}

export async function getSkills() {
  const res = await apiClient.get("/stats/skills");
  return res.data?.data || {};
}

export async function getDifficulty() {
  const res = await apiClient.get("/stats/difficulty");
  return res.data?.data;
}

export async function getPlatformsWithStats() {
  const res = await apiClient.get("/stats/me/platforms");
  return res.data?.data || [];
}

export async function getPublicSettings() {
  const res = await apiClient.get("/profile/public-settings");
  return res.data?.data;
}

export async function updatePublicSettings(payload) {
  const res = await apiClient.put("/profile/public-settings", payload);
  return res.data?.data;
}

export async function getPublicProfile(username) {
  const res = await apiClient.get(`/public/${encodeURIComponent(username)}`);
  return res.data?.data;
}

export async function exportProfilePdf(payload) {
  const res = await apiClient.post("/export/pdf", payload);
  return res.data?.data;
}
