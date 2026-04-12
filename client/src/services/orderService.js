import api from "./api";

export const orderService = {
  createPublicQueueOrder: async (payload) => {
    const { data } = await api.post("/orders/public/queue", payload);
    return data;
  },
  createOrder: async (payload) => {
    const { data } = await api.post("/orders", payload);
    return data;
  },
  updateOrder: async (id, payload) => {
    const { data } = await api.put(`/orders/${id}`, payload);
    return data;
  },
  getOrders: async (params) => {
    const { data } = await api.get("/orders", { params });
    return data;
  },
  getEditedOrders: async (params) => {
    const { data } = await api.get("/orders/edited-list", { params });
    return data;
  },
  getOrderById: async (id) => {
    const { data } = await api.get(`/orders/${id}`);
    return data;
  },
  serveOrder: async (id, payload = {}) => {
    const { data } = await api.patch(`/orders/${id}/serve`, payload);
    return data;
  },
  voidOrder: async (id, payload) => {
    const { data } = await api.patch(`/orders/${id}/void`, payload);
    return data;
  },
  deleteOrder: async (id, pin) => {
    const { data } = await api.delete(`/orders/${id}`, { data: { pin } });
    return data;
  }
};
