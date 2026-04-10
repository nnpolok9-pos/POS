import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ShopSettingsProvider } from "./context/ShopSettingsContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ShopSettingsProvider>
          <App />
          <Toaster position="top-right" />
        </ShopSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
