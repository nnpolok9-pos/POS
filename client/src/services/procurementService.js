import api from "./api";

export const procurementService = {
  getPurchases: async (params) => {
    const { data } = await api.get("/procurement", { params });
    return data;
  },
  createPurchase: async (payload) => {
    const { data } = await api.post("/procurement", payload);
    return data;
  },
  updatePurchase: async (id, payload) => {
    const { data } = await api.put(`/procurement/${id}`, payload);
    return data;
  },
  deletePurchase: async (id, pin) => {
    const { data } = await api.delete(`/procurement/${id}`, { data: { pin } });
    return data;
  },
  getVendors: async (params) => {
    const { data } = await api.get("/procurement/vendors", { params });
    return data;
  },
  getPurchaseUsers: async () => {
    const { data } = await api.get("/procurement/users");
    return data;
  },
  getCostNames: async (params) => {
    const { data } = await api.get("/procurement/cost-names", { params });
    return data;
  },
  getCosts: async (params) => {
    const { data } = await api.get("/procurement/costs", { params });
    return data;
  },
  createCost: async (payload) => {
    const { data } = await api.post("/procurement/costs", payload);
    return data;
  },
  updateCost: async (id, payload) => {
    const { data } = await api.put(`/procurement/costs/${id}`, payload);
    return data;
  },
  deleteCost: async (id, pin) => {
    const { data } = await api.delete(`/procurement/costs/${id}`, { data: { pin } });
    return data;
  },
  createPayment: async (payload) => {
    const { data } = await api.post("/procurement/payments", payload);
    return data;
  },
  getItemwiseReport: async (params) => {
    const { data } = await api.get("/procurement/reports/itemwise", { params });
    return data;
  },
  getCostwiseReport: async (params) => {
    const { data } = await api.get("/procurement/reports/costwise", { params });
    return data;
  },
  getVendorWiseReport: async (params) => {
    const { data } = await api.get("/procurement/reports/vendor-wise", { params });
    return data;
  }
};
