import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";
import { setAuthToken } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setAuthToken(token);
        const currentUser = await authService.me();
        setUser(currentUser);
      } catch (error) {
        localStorage.removeItem("token");
        setAuthToken(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [token]);

  const login = async (credentials) => {
    const response = await authService.login(credentials);
    setToken(response.token);
    setAuthToken(response.token);
    setUser(response.user);
    localStorage.setItem("token", response.token);
    return response.user;
  };

  const refreshUser = async () => {
    if (!token) {
      return null;
    }

    setAuthToken(token);
    const currentUser = await authService.me();
    setUser(currentUser);
    return currentUser;
  };

  const setCurrentUser = (nextUser) => {
    setUser(nextUser);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    localStorage.removeItem("token");
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      refreshUser,
      setCurrentUser,
      logout,
      isAuthenticated: Boolean(token && user)
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
