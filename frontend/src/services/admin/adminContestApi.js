import api from '../common/api';

const BASE_URL = '/admin/contests';

const adminContestApi = {
  
  getContests: (params = {}) => api.get(BASE_URL, { params }),

  getContest: (id) => api.get(`${BASE_URL}/${id}`),

  createContest: (data) => api.post(BASE_URL, data),

  updateContest: (id, data) => api.put(`${BASE_URL}/${id}`, data),

  deleteContest: (id) => api.delete(`${BASE_URL}/${id}`),

  publishContest: (id) => api.post(`${BASE_URL}/${id}/publish`),

  cancelContest: (id, reason) => api.post(`${BASE_URL}/${id}/cancel`, { reason }),

  startContest: (id) => api.post(`${BASE_URL}/${id}/start`),

  endContest: (id) => api.post(`${BASE_URL}/${id}/end`),

  getRegistrations: (id, params = {}) => api.get(`${BASE_URL}/${id}/registrations`, { params }),

  disqualifyUser: (id, userId, reason) => api.post(`${BASE_URL}/${id}/disqualify`, { userId, reason }),

  getSubmissions: (id, params = {}) => api.get(`${BASE_URL}/${id}/submissions`, { params }),

  postAnnouncement: (id, announcement) => api.post(`${BASE_URL}/${id}/announcements`, announcement),

  deleteAnnouncement: (id, announcementId) => api.delete(`${BASE_URL}/${id}/announcements/${announcementId}`),
};

export default adminContestApi;
