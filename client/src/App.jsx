import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { useAuth } from "./context/AuthContext";
import { PosSidebarProvider } from "./context/PosSidebarContext";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import OrdersPage from "./pages/OrdersPage";
import PosPage from "./pages/PosPage";
import DeliveryPartnerPosPage from "./pages/DeliveryPartnerPosPage";
import ProductListPage from "./pages/ProductListPage";
import InventoryPage from "./pages/InventoryPage";
import StocksPage from "./pages/StocksPage";
import ReportsPage from "./pages/ReportsPage";
import SalesReportPage from "./pages/SalesReportPage";
import SalesTransactionPage from "./pages/SalesTransactionPage";
import ProductSalesReportPage from "./pages/ProductSalesReportPage";
import DeliveryPartnerSalesReportPage from "./pages/DeliveryPartnerSalesReportPage";
import UsersPage from "./pages/UsersPage";
import EditedListPage from "./pages/EditedListPage";
import PromosPage from "./pages/PromosPage";
import ShopProfilePage from "./pages/ShopProfilePage";
import CustomerOrderPage from "./pages/CustomerOrderPage";
import MenuCardPage from "./pages/MenuCardPage";
import ProfilePage from "./pages/ProfilePage";
import MenuCardPosterPage from "./pages/MenuCardPosterPage";
import MenuCardPosterKhPage from "./pages/MenuCardPosterKhPage";
import MenuCardA4Page from "./pages/MenuCardA4Page";
import MenuCardA4KhPage from "./pages/MenuCardA4KhPage";

const ProtectedRoute = ({ roles, children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to={user?.role === "checker" ? "/dashboard" : "/pos"} replace />;
  }

  return children;
};

function App() {
  const HomeRedirect = () => {
    const { user } = useAuth();
    return <Navigate to={user?.role === "checker" ? "/dashboard" : "/pos"} replace />;
  };

  return (
    <Routes>
      <Route path="/menu" element={<CustomerOrderPage />} />
      <Route path="/menu-card" element={<MenuCardPage />} />
      <Route path="/menu-card-poster" element={<MenuCardPosterPage />} />
      <Route path="/menu-card-poster-kh" element={<MenuCardPosterKhPage />} />
      <Route path="/menu-card-a4" element={<MenuCardA4Page />} />
      <Route path="/menu-card-a4-kh" element={<MenuCardA4KhPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute roles={["master_admin", "admin", "checker", "staff"]}>
            <PosSidebarProvider>
              <AppShell />
            </PosSidebarProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route
          path="profile"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "checker", "staff"]}>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pos"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "staff"]}>
              <PosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="partner-pos"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "staff"]}>
              <DeliveryPartnerPosPage />
            </ProtectedRoute>
          }
        />
        <Route path="pos-next" element={<Navigate to="/pos" replace />} />
        <Route
          path="orders"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "checker", "staff"]}>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stocks"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "checker", "staff"]}>
              <StocksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "checker", "staff"]}>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "checker"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="products"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "checker", "staff"]}>
              <ProductListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={["master_admin", "admin"]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="shop-profile"
          element={
            <ProtectedRoute roles={["master_admin"]}>
              <ShopProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="edited-list"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "checker"]}>
              <EditedListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="promos"
          element={
            <ProtectedRoute roles={["master_admin", "admin"]}>
              <PromosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={["master_admin", "admin", "checker"]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/reports/sales" replace />} />
          <Route path="sales" element={<SalesReportPage />} />
          <Route path="sales-transaction" element={<SalesTransactionPage />} />
          <Route path="product-sales" element={<ProductSalesReportPage />} />
          <Route path="delivery-partner-sales" element={<DeliveryPartnerSalesReportPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
