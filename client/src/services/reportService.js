import api from "./api";

export const reportService = {
  getSales: async () => {
    const { data } = await api.get("/reports/sales");
    return data;
  },
  getSalesRange: async (params) => {
    const { data } = await api.get("/reports/sales-range", { params });
    return data;
  },
  getCashPosition: async (params) => {
    const { data } = await api.get("/reports/cash-position", { params });
    return data;
  },
  getOrdersByDate: async (date) => {
    const { data } = await api.get("/reports/orders-by-date", { params: { date } });
    return data;
  },
  getLowStock: async () => {
    const { data } = await api.get("/reports/low-stock");
    return data;
  },
  getDashboard: async () => {
    const { data } = await api.get("/reports/dashboard");
    return data;
  }
};
