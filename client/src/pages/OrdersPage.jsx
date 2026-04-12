import { CalendarRange, CheckCircle2, Download, Eye, FileSpreadsheet, Pencil, Printer, ReceiptText, Trash2, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import OrderDetailModal from "../components/OrderDetailModal";
import EditHistoryModal from "../components/EditHistoryModal";
import RefundMethodModal from "../components/RefundMethodModal";
import ReportDatePicker from "../components/ReportDatePicker";
import ServeOrderModal from "../components/ServeOrderModal";
import { useAuth } from "../context/AuthContext";
import { useShopSettings } from "../context/ShopSettingsContext";
import { orderService } from "../services/orderService";
import { productService } from "../services/productService";
import { getLocalDateInputValue } from "../utils/date";
import { currency, formatDate, formatServeTime } from "../utils/format";
import { printReceipt } from "../utils/printReceipt";
import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";

const todayString = () => getLocalDateInputValue();

const orderHistoryColumns = [
  { header: "S/N", key: "sl" },
  { header: "Order ID", key: "orderId" },
  { header: "Date", key: "date" },
  { header: "Serve Time", key: "serveTime" },
  { header: "Staff", key: "staff" },
  { header: "Payment Method", key: "paymentMethod" },
  { header: "Items", key: "items" },
  { header: "Sale Amount", key: "saleAmount" },
  { header: "Status", key: "status" }
];

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm";

const statCardClass = "rounded-[1.35rem] p-3 shadow-sm";
const statusFilterStyles = {
  all: "border-[#d8e6e7] bg-[#e7f0f2]",
  queued: "border-[#e7deff] bg-[#f3efff]",
  food_serving: "border-[#dce7df] bg-[#eef4ef]",
  completed: "border-[#dce7df] bg-[#eef4ef]",
  void: "border-[#f0dede] bg-[#f8eeee]"
};

const getServeTimeLabel = (order) => (["void", "queued"].includes(order.status) ? "N/A" : formatServeTime(order.createdAt, order.servedAt));
const isCustomerQueueOrder = (order) => order?.source === "customer" && order?.status === "queued";
const requiresVoidRefundMethod = (order) =>
  Number(order?.total || 0) > 0 && !isCustomerQueueOrder(order) && Boolean(order?.paymentMethod);

const OrdersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings: shopSettings } = useShopSettings();
  const canUseDateRange = ["master_admin", "admin", "checker"].includes(user?.role);
  const canMutateOrders = ["master_admin", "admin", "staff"].includes(user?.role);
  const canVoidCompleted = ["master_admin", "admin"].includes(user?.role);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [historyOrder, setHistoryOrder] = useState(null);
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [appliedDateRange, setAppliedDateRange] = useState(null);
  const [voidingOrder, setVoidingOrder] = useState(null);
  const [refundMethod, setRefundMethod] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [servingOrder, setServingOrder] = useState(null);
  const [serveSubmitting, setServeSubmitting] = useState(false);
  const [sauceProducts, setSauceProducts] = useState([]);

  const loadSauces = async () => {
    const products = await productService.getAdminProducts();
    setSauceProducts(products.filter((product) => product.productType === "sauce"));
  };

  const loadOrders = async (filters = {}) => {
    setLoading(true);
    try {
      const data = await orderService.getOrders(filters);
      setOrders(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const bootSauces = async () => {
      try {
        await loadSauces();
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to load sauce items");
      }
    };

    bootSauces();
  }, []);

  const handleGenerate = async () => {
    const filters = canUseDateRange ? { from, to } : {};
    setAppliedDateRange(canUseDateRange ? { from, to } : null);
    await loadOrders(filters);
  };

  const openVoidDialog = (order) => {
    setSelectedOrder(null);
    setVoidingOrder(order);
    setRefundMethod("");
  };

  const handleVoid = async () => {
    if (!voidingOrder) {
      return;
    }

    if (requiresVoidRefundMethod(voidingOrder) && !refundMethod) {
      toast.error("Select how the refund was made");
      return;
    }

    setVoidSubmitting(true);
    try {
      const updated = await orderService.voidOrder(voidingOrder.id, { refundMethod: refundMethod || null });
      toast.success(`Order ${updated.orderId} marked as void`);
      setSelectedOrder(null);
      setVoidingOrder(null);
      setRefundMethod("");
      setStatusFilter("all");
      await loadOrders(canUseDateRange && appliedDateRange ? appliedDateRange : {});
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to void sale");
    } finally {
      setVoidSubmitting(false);
    }
  };

  const handleServe = async (sauceItems = []) => {
    if (!servingOrder) {
      return;
    }

    setServeSubmitting(true);
    try {
      const updated = await orderService.serveOrder(servingOrder.id, { sauceItems });
      toast.success(`Order ${updated.orderId} marked as completed`);
      setSelectedOrder(null);
      setServingOrder(null);
      setStatusFilter("all");
      await loadOrders(canUseDateRange && appliedDateRange ? appliedDateRange : {});
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to serve order");
    } finally {
      setServeSubmitting(false);
    }
  };

  const openServeDialog = async (order) => {
    try {
      await loadSauces();
      setServingOrder(order);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load sauce items");
    }
  };

  const exportRows = orders.map((order, index) => ({
    sl: index + 1,
    orderId: order.orderId,
    date: formatDate(order.createdAt),
    serveTime: getServeTimeLabel(order),
    staff: order.staff?.name || "Staff",
    paymentMethod: order.paymentMethod?.toUpperCase() || "-",
    items: order.items.length,
    saleAmount: Number(order.total || 0).toFixed(2),
    status:
      order.status === "void"
        ? "Void"
        : order.status === "queued"
          ? "Queued"
          : order.status === "food_serving"
            ? "Food Serving"
            : "Completed"
  }));

  const exportExcel = () => {
    if (!exportRows.length) {
      toast.error("No order history data to export");
      return;
    }

    exportReportToExcel({
      fileName: `order-history-${canUseDateRange ? `${from}-to-${to}` : "current"}`,
      sheetName: "Order History",
      title: "Order History",
      columns: orderHistoryColumns,
      rows: exportRows,
      shopProfile: shopSettings,
      summaryLines: canUseDateRange ? [`Date Range: ${from} to ${to}`] : ["Current order history"]
    });
  };

  const exportPdf = async () => {
    if (!exportRows.length) {
      toast.error("No order history data to export");
      return;
    }

    const summaryLines =
      canUseDateRange
        ? [`Date Range: ${from} to ${to}`, `Total Orders: ${orders.length}`]
        : ["Current order history", `Total Orders: ${orders.length}`];

    await exportReportToPdf({
      title: "Order History",
      fileName: `order-history-${canUseDateRange ? `${from}-to-${to}` : "current"}`,
      columns: orderHistoryColumns,
      rows: exportRows,
      summaryLines,
      shopProfile: shopSettings
    });
  };

  const queuedCount = orders.filter((order) => order.status === "queued").length;
  const completedCount = orders.filter((order) => order.status === "completed").length;
  const foodServingCount = orders.filter((order) => order.status === "food_serving").length;
  const voidCount = orders.filter((order) => order.status === "void").length;
  const totalSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const filteredOrders = orders.filter((order) => (statusFilter === "all" ? true : order.status === statusFilter));

  const canEditOrder = (order) => {
    if (order.status === "void") {
      return false;
    }

    if (user?.role === "checker") {
      return false;
    }

    if (user?.role === "staff" && order.status === "completed") {
      return false;
    }

    return true;
  };

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-4 rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <div className={heroBadgeClass}>
                <CalendarRange size={14} />
                Order Overview
              </div>
              <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Order History</h1>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-500">Review each sales queue, reprint vouchers, edit orders, or void sales.</p>
            </div>

            <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-4 py-2.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Visible Date Range</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800">
                {canUseDateRange
                  ? appliedDateRange
                    ? `${appliedDateRange.from} to ${appliedDateRange.to}`
                    : "All dates"
                  : "Current history"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            {canUseDateRange ? (
              <div className="rounded-[1.4rem] border border-[#efe2ca] bg-[#fff8ea] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
                  <ReportDatePicker label="From Date" value={from} onChange={setFrom} maxDate={to} />
                  <div className="pb-3 text-center text-sm font-semibold text-slate-400">to</div>
                  <ReportDatePicker label="To Date" value={to} onChange={setTo} minDate={from} />
                </div>
              </div>
            ) : (
              <div />
            )}

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[auto_auto_auto] xl:justify-end">
              <button type="button" onClick={handleGenerate} className="btn-primary h-10 rounded-full px-5 shadow-sm">
                {loading ? "Loading..." : canUseDateRange ? "Generate" : "Refresh"}
              </button>
              <button type="button" onClick={exportExcel} className="btn-secondary h-10 gap-2 rounded-full border border-[#d7cbb7] bg-white px-4">
                <FileSpreadsheet size={18} />
                Export Excel
              </button>
              <button type="button" onClick={exportPdf} className="btn-secondary h-10 gap-2 rounded-full border border-[#d7cbb7] bg-white px-4">
                <Download size={18} />
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <button type="button" onClick={() => setStatusFilter("all")} className={`${statCardClass} border text-left transition hover:-translate-y-0.5 ${statusFilter === "all" ? "ring-2 ring-slate-300 " : ""}${statusFilterStyles.all}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Orders</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{orders.length}</p>
            </div>
            <div className="rounded-full bg-white/55 p-3 text-slate-500">
              <ReceiptText size={18} />
            </div>
          </div>
        </button>
        <button type="button" onClick={() => setStatusFilter("queued")} className={`${statCardClass} border text-left transition hover:-translate-y-0.5 ${statusFilter === "queued" ? "ring-2 ring-violet-200 " : ""}${statusFilterStyles.queued}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Queued</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{queuedCount}</p>
            </div>
            <div className="rounded-full bg-white/55 p-3 text-violet-600">
              <ReceiptText size={18} />
            </div>
          </div>
        </button>
        <button type="button" onClick={() => setStatusFilter("food_serving")} className={`${statCardClass} border text-left transition hover:-translate-y-0.5 ${statusFilter === "food_serving" ? "ring-2 ring-amber-200 " : ""}${statusFilterStyles.food_serving}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Food Serving</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{foodServingCount}</p>
            </div>
            <div className="rounded-full bg-white/55 p-3 text-emerald-600">
              <WalletCards size={18} />
            </div>
          </div>
        </button>
        <button type="button" onClick={() => setStatusFilter("completed")} className={`${statCardClass} border text-left transition hover:-translate-y-0.5 ${statusFilter === "completed" ? "ring-2 ring-emerald-200 " : ""}${statusFilterStyles.completed}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Completed</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{completedCount}</p>
            </div>
            <div className="rounded-full bg-white/55 p-3 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </button>
        <button type="button" onClick={() => setStatusFilter("void")} className={`${statCardClass} border text-left transition hover:-translate-y-0.5 ${statusFilter === "void" ? "ring-2 ring-rose-200 " : ""}${statusFilterStyles.void}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Void</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{voidCount}</p>
            </div>
            <div className="rounded-full bg-white/55 p-3 text-rose-600">
              <Trash2 size={18} />
            </div>
          </div>
        </button>
        <div className={`${statCardClass} min-w-0 bg-[#171d31] text-white`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Visible Sales</p>
              <p className="mt-2 text-2xl font-bold">{currency(totalSales)}</p>
              <p className="mt-1 text-xs text-slate-300">
                {canUseDateRange
                  ? appliedDateRange
                    ? `${appliedDateRange.from} to ${appliedDateRange.to}`
                    : "All dates"
                  : "Current history"}
              </p>
            </div>
            <div className="rounded-full bg-white/10 p-3 text-white">
              <WalletCards size={18} />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Showing: <span className="font-semibold text-slate-700">{statusFilter === "all" ? "All Orders" : statusFilter === "queued" ? "Queued" : statusFilter === "food_serving" ? "Food Serving" : statusFilter === "completed" ? "Completed" : "Void"}</span>
        </p>
        {statusFilter !== "all" && (
          <button type="button" onClick={() => setStatusFilter("all")} className="text-sm font-semibold text-brand-600 hover:underline">
            Clear Filter
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-slate-500">
              <th className="pb-3 pr-4">S/N</th>
              <th className="pb-3 pr-4">Order ID</th>
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Serve Time</th>
              <th className="pb-3 pr-4">Staff</th>
              <th className="pb-3 pr-4">Items</th>
              <th className="pb-3 pr-4">Sale Amount</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="9" className="py-10 text-center text-sm text-slate-500">
                  No orders found for the selected filters.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order, index) => (
                <tr key={order.id} className="border-b border-slate-100 align-middle">
                  <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-slate-900">{order.orderId}</p>
                    {order.source === "customer" && order.queueNumber ? <p className="text-xs font-semibold text-violet-700">Queue #{order.queueNumber}</p> : null}
                    <p className="text-xs capitalize text-slate-500">{order.paymentMethod || "unpaid queue"}</p>
                    {order.editHistory?.length > 0 && (
                      <button type="button" onClick={() => setHistoryOrder(order)} className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        Edited {order.editHistory.length} time{order.editHistory.length > 1 ? "s" : ""}
                      </button>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{formatDate(order.createdAt)}</td>
                  <td className="py-3 pr-4 text-slate-600">{getServeTimeLabel(order)}</td>
                  <td className="py-3 pr-4 text-slate-600">{order.staff?.name || "Staff"}</td>
                  <td className="py-3 pr-4 text-slate-600">{order.items.length}</td>
                  <td className="py-3 pr-4 font-bold text-brand-600">{currency(order.total)}</td>
                  <td className="py-3 pr-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      order.status === "void"
                        ? "bg-rose-100 text-rose-700"
                        : order.status === "queued"
                          ? "bg-violet-100 text-violet-700"
                        : order.status === "food_serving"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {order.status === "void" ? "Void" : order.status === "queued" ? "Queued" : order.status === "food_serving" ? "Food Serving" : "Completed"}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedOrder(order)} className="btn-secondary h-10 gap-2 px-3 text-sm">
                        <Eye size={16} />
                        View
                      </button>
                    {canEditOrder(order) && (
                      <button
                        type="button"
                        onClick={() => navigate(`/pos?editOrder=${order.id}`, { state: { returnTo: "/orders" } })}
                        className="btn-secondary h-10 gap-2 px-3 text-sm"
                        >
                          <Pencil size={16} />
                          {isCustomerQueueOrder(order) ? "Retrieve" : "Edit"}
                        </button>
                      )}
                    <button type="button" onClick={() => printReceipt(order, shopSettings)} className="btn-secondary h-10 gap-2 px-3 text-sm">
                      <Printer size={16} />
                      Print
                    </button>
                    {canMutateOrders && order.status === "food_serving" && (
                      <button type="button" onClick={() => openServeDialog(order)} className="btn-secondary h-10 gap-2 px-3 text-sm text-emerald-700">
                        <CheckCircle2 size={16} />
                        Served
                      </button>
                    )}
                    {canMutateOrders && (canVoidCompleted || ["food_serving", "queued"].includes(order.status)) && order.status !== "void" && (
                      <button type="button" onClick={() => openVoidDialog(order)} className="btn-secondary h-10 gap-2 px-3 text-sm text-rose-600">
                        <Trash2 size={16} />
                        Void Sale
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <OrderDetailModal
        open={Boolean(selectedOrder)}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onPrint={() => printReceipt(selectedOrder, shopSettings)}
        onEdit={() => navigate(`/pos?editOrder=${selectedOrder.id}`, { state: { returnTo: "/orders" } })}
        onServe={() => openServeDialog(selectedOrder)}
        onVoid={() => openVoidDialog(selectedOrder)}
        canEdit={selectedOrder ? canEditOrder(selectedOrder) : false}
        canServe={canMutateOrders && selectedOrder?.status === "food_serving"}
        canVoid={canMutateOrders && (canVoidCompleted || ["food_serving", "queued"].includes(selectedOrder?.status))}
      />
      <RefundMethodModal
        open={Boolean(voidingOrder)}
        order={voidingOrder}
        requiresRefundMethod={requiresVoidRefundMethod(voidingOrder)}
        refundMethod={refundMethod}
        onRefundMethodChange={setRefundMethod}
        onClose={() => {
          setVoidingOrder(null);
          setRefundMethod("");
        }}
        onConfirm={handleVoid}
        loading={voidSubmitting}
      />
      <EditHistoryModal open={Boolean(historyOrder)} order={historyOrder} onClose={() => setHistoryOrder(null)} />
      <ServeOrderModal
        open={Boolean(servingOrder)}
        order={servingOrder}
        sauces={sauceProducts}
        onClose={() => setServingOrder(null)}
        onConfirm={handleServe}
        loading={serveSubmitting}
      />
    </div>
  );
};

export default OrdersPage;
