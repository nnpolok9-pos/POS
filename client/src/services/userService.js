import api from "./api";

export const userService = {
  getUsers: async () => {
    const { data } = await api.get("/users");
    return data;
  },
  createUser: async (payload) => {
    const { data } = await api.post("/users", payload);
    return data;
  },
  updateUser: async (id, payload) => {
    const { data } = await api.put(`/users/${id}`, payload);
    return data;
  }
};
