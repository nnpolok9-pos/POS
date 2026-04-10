import api from "./api";

export const productService = {
  getProducts: async (params) => {
    const { data } = await api.get("/products", { params });
    localStorage.setItem("pos-products-cache", JSON.stringify(data));
    return data;
  },
  getPublicMenu: async (params) => {
    const { data } = await api.get("/products/public/menu", { params });
    return data;
  },
  getCachedProducts: () => {
    const cached = localStorage.getItem("pos-products-cache");
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
  updateStock: async (id, receivedQuantity) => {
    const { data } = await api.patch(`/products/${id}/stock`, { receivedQuantity });
    return data;
  },
  deductStock: async (id, deductionQuantity, reason) => {
    const { data } = await api.patch(`/products/${id}/stock/deduct`, { deductionQuantity, reason });
    return data;
  },
  deleteProduct: async (id) => {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  }
};
