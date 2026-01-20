// src/services/profileDashboardApi.js
import apiClient from "./api";

// =====================
// Coding Platforms
// =====================

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

// =====================
// Contest Profile (read-only)
// =====================

export async function getContestHistory({ username } = {}) {
  const res = await apiClient.get("/contest-profile/history", {
    params: username ? { username } : undefined,
  });
  return res.data?.data;
}

export async function getContestStats({ username } = {}) {
  const res = await apiClient.get("/contest-profile/stats", {
    params: username ? { username } : undefined,
  });
  return res.data?.data;
}

export async function getContestRating({ username } = {}) {
  const res = await apiClient.get("/contest-profile/rating", {
    params: username ? { username } : undefined,
  });
  return res.data?.data;
}
