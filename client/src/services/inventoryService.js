import api from "./api";

export const inventoryService = {
  getReport: async (params) => {
    const { data } = await api.get("/inventory/report", { params });
    return data;
  }
};
