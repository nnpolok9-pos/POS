import api from "./api";

export const partnerService = {
  getPartners: async () => {
    const { data } = await api.get("/partners");
    return data;
  },
  getPartner: async (partnerKey) => {
    const { data } = await api.get(`/partners/${partnerKey}`);
    return data;
  },
  updatePartner: async (partnerKey, payload) => {
    const { data } = await api.put(`/partners/${partnerKey}`, payload);
    return data;
  }
};
