import api from "./api";

export const authService = {
  login: async (credentials) => {
    const { data } = await api.post("/auth/login", credentials);
    return data;
  },
  me: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  }
};
