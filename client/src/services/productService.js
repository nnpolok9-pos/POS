import api from "./api";

const PUBLIC_MENU_CACHE_KEY = "public-menu-cache";

export const productService = {
  getProducts: async (params) => {
    const { data } = await api.get("/products", { params });
    localStorage.setItem("pos-products-cache", JSON.stringify(data));
    return data;
  },
  getPublicMenu: async (params) => {
    const { data } = await api.get("/products/public/menu", { params });
    localStorage.setItem(PUBLIC_MENU_CACHE_KEY, JSON.stringify(data));
    return data;
  },
  getCachedProducts: () => {
    const cached = localStorage.getItem("pos-products-cache");
    return cached ? JSON.parse(cached) : [];
  },
  getCachedPublicMenu: () => {
    const cached = localStorage.getItem(PUBLIC_MENU_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  },
  getAdminProducts: async () => {
    const { data } = await api.get("/products/admin/all");
    return data;
  },
  createProduct: async (formData) => {
    const { data } = await api.post("/products", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },
  updateProduct: async (id, formData) => {
    const { data } = await api.put(`/products/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },
  updateStock: async (id, payload) => {
    const body = typeof payload === "object" ? payload : { receivedQuantity: payload };
    const { data } = await api.patch(`/products/${id}/stock`, body);
    return data;
  },
  deductStock: async (id, deductionQuantity, reason) => {
    const { data } = await api.patch(`/products/${id}/stock/deduct`, { deductionQuantity, reason });
    return data;
  },
  verifyForceStockPin: async (pin) => {
    const { data } = await api.post("/products/stock/force/verify-pin", { pin });
    return data;
  },
  forceUpdateStock: async (id, payload) => {
    const body = typeof payload === "object" ? payload : { stockQuantity: payload };
    const { data } = await api.patch(`/products/${id}/stock/force`, body);
    return data;
  },
  deleteProduct: async (id) => {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  }
};
