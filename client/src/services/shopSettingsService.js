import api from "./api";

export const shopSettingsService = {
  getPublic: async () => {
    const { data } = await api.get("/shop-settings/public");
    return data;
  },
  get: async () => {
    const { data } = await api.get("/shop-settings");
    return data;
  },
  update: async (formData) => {
    const { data } = await api.put("/shop-settings", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  }
};
