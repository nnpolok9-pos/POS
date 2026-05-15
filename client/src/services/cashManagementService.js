import api from "./api";

export const cashManagementService = {
  getUsers: async () => {
    const response = await api.get("/cash-management/users");
    return response.data;
  },
  createHandover: async (payload) => {
    const response = await api.post("/cash-management/handovers", payload);
    return response.data;
  },
  getPosition: async (params) => {
    const response = await api.get("/cash-management/position", { params });
    return response.data;
  }
};
