import api from "./api";

export const userService = {
  getProfile: async () => {
    const { data } = await api.get("/users/profile");
    return data;
  },
  updateProfile: async (formData) => {
    const { data } = await api.put("/users/profile", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },
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
