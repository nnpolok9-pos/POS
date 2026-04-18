import api from "./api";

export const promoService = {
  previewPromo: async (payload) => {
    const { data } = await api.post("/promos/preview", payload);
    return data;
  },
  getPromos: async () => {
    const { data } = await api.get("/promos");
    return data;
  },
  createPromo: async (payload) => {
    const { data } = await api.post("/promos", payload);
    return data;
  },
  updatePromo: async (id, payload) => {
    const { data } = await api.put(`/promos/${id}`, payload);
    return data;
  },
  deletePromo: async (id) => {
    const { data } = await api.delete(`/promos/${id}`);
    return data;
  }
};
