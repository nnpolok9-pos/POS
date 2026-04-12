import api from "./api";

const SHOP_SETTINGS_CACHE_KEY = "public-shop-settings-cache";

export const shopSettingsService = {
  getPublic: async () => {
    const { data } = await api.get("/shop-settings/public");
    localStorage.setItem(SHOP_SETTINGS_CACHE_KEY, JSON.stringify(data));
    return data;
  },
  getCachedPublic: () => {
    const cached = localStorage.getItem(SHOP_SETTINGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
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
