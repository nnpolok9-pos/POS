import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { shopSettingsService } from "../services/shopSettingsService";

const ShopSettingsContext = createContext(null);

const fallbackSettings = {
  shopName: "ASEN POS",
  address: "",
  logo: ""
};

export const ShopSettingsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(fallbackSettings);
  const [loading, setLoading] = useState(false);

  const refreshSettings = async () => {
    if (!isAuthenticated) {
      setSettings(fallbackSettings);
      return;
    }

    setLoading(true);
    try {
      const data = await shopSettingsService.get();
      setSettings({
        shopName: data.shopName || fallbackSettings.shopName,
        address: data.address || "",
        logo: data.logo || ""
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      refreshSettings,
      setSettings
    }),
    [settings, loading]
  );

  return <ShopSettingsContext.Provider value={value}>{children}</ShopSettingsContext.Provider>;
};

export const useShopSettings = () => useContext(ShopSettingsContext);
