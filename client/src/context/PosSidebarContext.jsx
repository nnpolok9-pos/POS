import { createContext, useContext, useMemo, useState } from "react";

const PosSidebarContext = createContext(null);

export const PosSidebarProvider = ({ children }) => {
  const [config, setConfig] = useState(null);

  const value = useMemo(
    () => ({
      config,
      setConfig
    }),
    [config]
  );

  return <PosSidebarContext.Provider value={value}>{children}</PosSidebarContext.Provider>;
};

export const usePosSidebar = () => {
  const context = useContext(PosSidebarContext);

  if (!context) {
    throw new Error("usePosSidebar must be used within PosSidebarProvider");
  }

  return context;
};
