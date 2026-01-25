import api from '../common/api';

const BASE_URL = '/admin/contests';

/**
 * Admin Contest API Service
 * CRUD operations for contest management
 */
const adminContestApi = {
  // Get all contests with filters
  getContests: (params = {}) => api.get(BASE_URL, { params }),

  // Get single contest
  getContest: (id) => api.get(`${BASE_URL}/${id}`),

  // Create new contest
  createContest: (data) => api.post(BASE_URL, data),

  // Update contest
  updateContest: (id, data) => api.put(`${BASE_URL}/${id}`, data),

  // Delete contest
  deleteContest: (id) => api.delete(`${BASE_URL}/${id}`),

  // Publish contest (make it visible to users)
  publishContest: (id) => api.post(`${BASE_URL}/${id}/publish`),

  // Cancel contest
  cancelContest: (id, reason) => api.post(`${BASE_URL}/${id}/cancel`, { reason }),

  // Force start contest
  startContest: (id) => api.post(`${BASE_URL}/${id}/start`),

  // Force end contest
  endContest: (id) => api.post(`${BASE_URL}/${id}/end`),

  // Get contest registrations
  getRegistrations: (id, params = {}) => api.get(`${BASE_URL}/${id}/registrations`, { params }),

  // Disqualify user
  disqualifyUser: (id, userId, reason) => api.post(`${BASE_URL}/${id}/disqualify`, { userId, reason }),

  // Get all submissions for a contest
  getSubmissions: (id, params = {}) => api.get(`${BASE_URL}/${id}/submissions`, { params }),

  // Post announcement
  postAnnouncement: (id, announcement) => api.post(`${BASE_URL}/${id}/announcements`, announcement),

  // Delete announcement
  deleteAnnouncement: (id, announcementId) => api.delete(`${BASE_URL}/${id}/announcements/${announcementId}`),
};

export default adminContestApi;
