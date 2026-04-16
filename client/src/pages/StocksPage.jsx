import { Archive, Boxes, Clock3, PackagePlus, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ForceStockPinModal from "../components/ForceStockPinModal";
import ProductDeductModal from "../components/ProductDeductModal";
import ProductForceStockModal from "../components/ProductForceStockModal";
import ProductStockModal from "../components/ProductStockModal";
import ReportDatePicker from "../components/ReportDatePicker";
import { useAuth } from "../context/AuthContext";
import { inventoryService } from "../services/inventoryService";
import { productService } from "../services/productService";
import { getLocalDateInputValue } from "../utils/date";
import { formatDate, imageUrl } from "../utils/format";

const stockUnitLabel = (unit) =>
  ({
    pieces: "Piece",
    gram: "Gram",
    teaspoon: "Tea Spoon"
  })[unit] || "Piece";

const productTypeLabel = (type) =>
  ({
    raw: "A La Catre",
    raw_material: "Base",
    sauce: "Sauce",
    seasoning: "Seasoning"
  })[type] || "A La Catre";

const categoryLabel = (category) => (/^raw$/i.test(category || "") ? "Base" : category || "-");
const todayString = () => getLocalDateInputValue();
const tabButtonClass = "rounded-full border px-4 py-2 text-sm font-semibold transition";

const formatDateOnly = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "short",
        day: "2-digit"
      }).format(new Date(value))
    : "Not set";

const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const ProductCell = ({ image, name, sku }) => (
  <div className="flex items-center gap-3">
    <img src={imageUrl(image)} alt={name} className="h-14 w-14 rounded-2xl object-cover" />
    <div className="min-w-0">
      <p className="font-semibold text-slate-900">{name}</p>
      <p className="text-xs text-slate-500">{sku || "-"}</p>
    </div>
  </div>
);

const StocksPage = () => {
  const { user } = useAuth();
  const canAddStock = ["master_admin", "admin", "staff"].includes(user?.role);
  const canDeductStock = ["master_admin", "admin"].includes(user?.role);
  const canForceUpdateStock = ["master_admin", "admin"].includes(user?.role);
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [appliedDateRange, setAppliedDateRange] = useState({ from: todayString(), to: todayString() });
  const [report, setReport] = useState({
    rawRows: [],
    rawSummary: {},
    movementHistory: []
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [deductModalOpen, setDeductModalOpen] = useState(false);
  const [forcePinModalOpen, setForcePinModalOpen] = useState(false);
  const [forceModalOpen, setForceModalOpen] = useState(false);
  const [forcePin, setForcePin] = useState("");
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [deductSubmitting, setDeductSubmitting] = useState(false);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [forceSubmitting, setForceSubmitting] = useState(false);

  const loadReport = async (params = {}) => {
    setLoading(true);
    try {
      const data = await inventoryService.getReport(params);
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(appliedDateRange);
  }, []);

  const stockRows = useMemo(
    () =>
      (report.rawRows || []).filter((row) =>
        ["raw", "raw_material", "sauce", "seasoning"].includes(row.productType)
      ),
    [report.rawRows]
  );

  const filteredStockRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stockRows.filter((row) => {
      const expiryText = row.expiryDate ? formatDateOnly(row.expiryDate).toLowerCase() : "";
      const productStatus = Number(row.currentStock || 0) <= 0 ? "out" : row.lowStock ? "low" : "healthy";
      const matchesType = typeFilter === "all" || row.productType === typeFilter;
      const matchesStatus = statusFilter === "all" || productStatus === statusFilter;
      const matchesSearch =
        !query ||
        row.productName.toLowerCase().includes(query) ||
        (row.sku || "").toLowerCase().includes(query) ||
        categoryLabel(row.category).toLowerCase().includes(query) ||
        productTypeLabel(row.productType).toLowerCase().includes(query) ||
        expiryText.includes(query);

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, stockRows, typeFilter]);

  const filteredHistoryRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sourceRows = report.movementHistory || [];

    if (!query) {
      return sourceRows;
    }

    return sourceRows.filter((row) => {
      return (
        row.productName.toLowerCase().includes(query) ||
        (row.sku || "").toLowerCase().includes(query) ||
        (row.reason || "").toLowerCase().includes(query) ||
        (row.performedBy?.name || "").toLowerCase().includes(query)
      );
    });
  }, [report.movementHistory, search]);

  const arrangeEarlyRows = useMemo(() => {
    return [...stockRows]
      .map((row) => {
        const daysUntilExpiry = getDaysUntilExpiry(row.expiryDate);
        const outOfStock = Number(row.currentStock || 0) <= 0;
        const expiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 2;
        const expired = daysUntilExpiry !== null && daysUntilExpiry < 0;
        const priorityScore =
          (outOfStock ? 1000 : 0) +
          (row.lowStock ? 400 : 0) +
          (expired ? 350 : expiringSoon ? 250 : 0) +
          Number(row.soldQuantity || 0) * 3 -
          Number(row.currentStock || 0);

        let suggestion = "Monitor this item";
        if (outOfStock) {
          suggestion = "Arrange immediately. This item is already out of stock.";
        } else if (expired) {
          suggestion = "Check this batch now. The saved expiry date has already passed.";
        } else if (row.lowStock && Number(row.soldQuantity || 0) > 0) {
          suggestion = "Arrange today. Sales are moving while stock is low.";
        } else if (expiringSoon) {
          suggestion = "Use existing stock first and plan the next refill carefully.";
        } else if (Number(row.receivedQuantity || 0) === 0 && Number(row.soldQuantity || 0) > 0) {
          suggestion = "No stock was added in this range while sales continued.";
        }

        return {
          ...row,
          daysUntilExpiry,
          priorityScore,
          suggestion
        };
      })
      .sort(
        (left, right) =>
          right.priorityScore - left.priorityScore ||
          Number(left.currentStock || 0) - Number(right.currentStock || 0) ||
          Number(right.soldQuantity || 0) - Number(left.soldQuantity || 0)
      );
  }, [stockRows]);

  const visibleSummary = useMemo(
    () => ({
      itemCount: stockRows.length,
      lowStockCount: stockRows.filter((row) => row.lowStock).length,
      totalReceived: stockRows.reduce((sum, row) => sum + Number(row.receivedQuantity || 0), 0),
      currentStock: stockRows.reduce((sum, row) => sum + Number(row.currentStock || 0), 0),
      historyCount: (report.movementHistory || []).length
    }),
    [report.movementHistory, stockRows]
  );

  const refreshReport = async () => {
    await loadReport(appliedDateRange);
  };

  const handleStockUpdate = async ({ receivedQuantity, expiryDate }) => {
    if (!selectedProduct) {
      return;
    }

    setStockSubmitting(true);
    try {
      await productService.updateStock(selectedProduct.productId, { receivedQuantity, expiryDate });
      toast.success("Stock updated");
      setStockModalOpen(false);
      setSelectedProduct(null);
      await refreshReport();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update stock");
    } finally {
      setStockSubmitting(false);
    }
  };

  const handleStockDeduction = async ({ deductionQuantity, reason }) => {
    if (!selectedProduct) {
      return;
    }

    setDeductSubmitting(true);
    try {
      await productService.deductStock(selectedProduct.productId, deductionQuantity, reason);
      toast.success("Stock deducted");
      setDeductModalOpen(false);
      setSelectedProduct(null);
      await refreshReport();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to deduct stock");
    } finally {
      setDeductSubmitting(false);
    }
  };

  const handleForceStockUpdate = async ({ stockQuantity, reason }) => {
    if (!selectedProduct) {
      return;
    }

    setForceSubmitting(true);
    try {
      await productService.forceUpdateStock(selectedProduct.productId, {
        stockQuantity,
        reason,
        pin: forcePin
      });
      toast.success("Stock force updated");
      setForceModalOpen(false);
      setSelectedProduct(null);
      setForcePin("");
      await refreshReport();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to force update stock");
    } finally {
      setForceSubmitting(false);
    }
  };

  const handleVerifyForcePin = async (pin) => {
    setPinSubmitting(true);
    try {
      await productService.verifyForceStockPin(pin);
      setForcePin(pin);
      setForcePinModalOpen(false);
      setForceModalOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid force update PIN");
    } finally {
      setPinSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-5">
        <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
                  <PackagePlus size={14} />
                  Stock Control
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Stocks</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Update only stock-managed items, review every stock action, and see which products need arranging early.
                </p>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {canAddStock
                    ? "Master Admin, Admin, and Staff can update stock here. Checker can review the data only."
                    : "This account can review stock data only."}
                </p>
              </div>

              <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-4 py-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Date Range</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-800">
                  {appliedDateRange ? `${appliedDateRange.from} to ${appliedDateRange.to}` : "All dates"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="rounded-[1.4rem] border border-[#efe2ca] bg-[#fff8ea] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
                  <ReportDatePicker label="From Date" value={from} onChange={setFrom} maxDate={to} />
                  <div className="pb-3 text-center text-sm font-semibold text-slate-400">to</div>
                  <ReportDatePicker label="To Date" value={to} onChange={setTo} minDate={from} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextRange = { from, to };
                  setAppliedDateRange(nextRange);
                  loadReport(nextRange);
                }}
                className="btn-primary h-11 rounded-full px-6 shadow-sm"
              >
                {loading ? "Loading..." : "Generate"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={`${tabButtonClass} ${
              activeTab === "items" ? "border-[#c8d8d0] bg-[#eef4ef] text-slate-900" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            Stock Items
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`${tabButtonClass} ${
              activeTab === "history" ? "border-[#d9e0eb] bg-[#e8eef7] text-slate-900" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            Stock History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("arrange")}
            className={`${tabButtonClass} ${
              activeTab === "arrange" ? "border-[#f0dede] bg-[#fdf1ef] text-slate-900" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            Arrange Early
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[1.35rem] border border-[#dce7df] bg-[#eef4ef] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stock Items</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{visibleSummary.itemCount}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                <Boxes size={18} />
              </div>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[#f6dfd2] bg-[#fff1ea] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Low Stock</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{visibleSummary.lowStockCount}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-orange-600">
                <TrendingDown size={18} />
              </div>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[#dce7df] bg-[#eef4ef] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Received Qty</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{visibleSummary.totalReceived}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                <TrendingUp size={18} />
              </div>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[#d9e0eb] bg-[#e8eef7] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current Stock</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{visibleSummary.currentStock}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <Archive size={18} />
              </div>
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-[#171d31] p-3 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">History Rows</p>
                <p className="mt-2 text-2xl font-bold">{visibleSummary.historyCount}</p>
                <p className="mt-1 text-xs text-slate-300">All add and deduct records in the selected range</p>
              </div>
              <div className="rounded-full bg-white/10 p-3 text-white">
                <Clock3 size={18} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {activeTab === "items" ? "Stock Items" : activeTab === "history" ? "Stock Editing History" : "Arrange Early"}
            </h2>
            <p className="text-xs text-slate-500">
              {activeTab === "items"
                ? "Only A La Catre, Base, Sauce, and Seasoning products are shown here."
                : activeTab === "history"
                  ? "Every received or deducted stock action is shown with the responsible user."
                  : "Use this list to arrange the next stock refill before operations slow down."}
            </p>
          </div>

          {activeTab === "items" ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_220px_220px_auto] lg:items-end">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Search</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search product, SKU, category, or expiry"
                  className="input"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Type</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="input">
                  <option value="all">All Types</option>
                  <option value="raw">A La Catre</option>
                  <option value="raw_material">Base</option>
                  <option value="sauce">Sauce</option>
                  <option value="seasoning">Seasoning</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input">
                  <option value="all">All Status</option>
                  <option value="healthy">Healthy</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
                className="btn-secondary h-11 rounded-full px-5"
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="sm:max-w-sm">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={activeTab === "history" ? "Search product, note, SKU, or user" : "Search product, type, category, or expiry"}
                className="input"
              />
            </div>
          )}
        </div>

        <div>
          {activeTab === "items" ? (
            <>
              <div className="space-y-3 lg:hidden">
                {filteredStockRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    No stock-managed products found for the selected filters.
                  </div>
                ) : (
                  filteredStockRows.map((row, index) => (
                    <div key={row.productId || index} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                      <ProductCell image={row.image} name={row.productName} sku={row.sku} />
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">SL</p>
                          <p className="mt-1 text-slate-700">{index + 1}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Type</p>
                          <p className="mt-1 text-slate-700">{productTypeLabel(row.productType)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Category</p>
                          <p className="mt-1 text-slate-700">{categoryLabel(row.category)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Unit</p>
                          <p className="mt-1 text-slate-700">{stockUnitLabel(row.stockUnit)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Current Stock</p>
                          <p className="mt-1 font-bold text-slate-900">{row.currentStock} {stockUnitLabel(row.stockUnit)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Received</p>
                          <p className="mt-1 font-semibold text-emerald-700">{row.receivedQuantity}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Sold</p>
                          <p className="mt-1 font-semibold text-rose-600">{row.soldQuantity}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Expiry</p>
                          <p className="mt-1 text-slate-700">{formatDateOnly(row.expiryDate)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Last Received</p>
                          <p className="mt-1 text-slate-700">{row.lastReceivedAt ? formatDate(row.lastReceivedAt) : "-"}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            Number(row.currentStock || 0) <= 0
                              ? "bg-rose-100 text-rose-700"
                              : row.lowStock
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {Number(row.currentStock || 0) <= 0 ? "Out of stock" : row.lowStock ? "Low stock" : "Healthy"}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {canAddStock ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(row);
                                setStockModalOpen(true);
                              }}
                              className="btn-secondary gap-2"
                            >
                              Add
                            </button>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">View only</span>
                          )}
                          {canDeductStock && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(row);
                                setDeductModalOpen(true);
                              }}
                              className="btn-secondary gap-2 text-rose-600"
                              disabled={Number(row.currentStock || 0) <= 0}
                            >
                              Deduct
                            </button>
                          )}
                          {canForceUpdateStock && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(row);
                                setForcePin("");
                                setForcePinModalOpen(true);
                              }}
                              className="btn-secondary gap-2 text-amber-700"
                            >
                              Force
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 pr-4">SL</th>
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Unit</th>
                  <th className="pb-3 pr-4">Current Stock</th>
                  <th className="pb-3 pr-4">Received</th>
                  <th className="pb-3 pr-4">Sold</th>
                  <th className="pb-3 pr-4">Expiry</th>
                  <th className="pb-3 pr-4">Last Received</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockRows.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="py-10 text-center text-sm text-slate-500">
                      No stock-managed products found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredStockRows.map((row, index) => (
                    <tr key={row.productId || index} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                      <td className="py-3 pr-4">
                        <ProductCell image={row.image} name={row.productName} sku={row.sku} />
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{productTypeLabel(row.productType)}</td>
                      <td className="py-3 pr-4 text-slate-600">{categoryLabel(row.category)}</td>
                      <td className="py-3 pr-4 text-slate-600">{stockUnitLabel(row.stockUnit)}</td>
                      <td className="py-3 pr-4 font-bold text-slate-900">
                        {row.currentStock} {stockUnitLabel(row.stockUnit)}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-emerald-700">{row.receivedQuantity}</td>
                      <td className="py-3 pr-4 font-semibold text-rose-600">{row.soldQuantity}</td>
                      <td className="py-3 pr-4 text-slate-600">{formatDateOnly(row.expiryDate)}</td>
                      <td className="py-3 pr-4 text-slate-600">{row.lastReceivedAt ? formatDate(row.lastReceivedAt) : "-"}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            Number(row.currentStock || 0) <= 0
                              ? "bg-rose-100 text-rose-700"
                              : row.lowStock
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {Number(row.currentStock || 0) <= 0 ? "Out of stock" : row.lowStock ? "Low stock" : "Healthy"}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {canAddStock ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(row);
                                setStockModalOpen(true);
                              }}
                              className="btn-secondary gap-2"
                            >
                              Add
                            </button>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                              View only
                            </span>
                          )}

                          {canDeductStock && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(row);
                                setDeductModalOpen(true);
                              }}
                              className="btn-secondary gap-2 text-rose-600"
                              disabled={Number(row.currentStock || 0) <= 0}
                            >
                              Deduct
                            </button>
                          )}

                          {canForceUpdateStock && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(row);
                                setForcePin("");
                                setForcePinModalOpen(true);
                              }}
                              className="btn-secondary gap-2 text-amber-700"
                            >
                              Force
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
            </>
          ) : activeTab === "history" ? (
            <>
              <div className="space-y-3 lg:hidden">
                {filteredHistoryRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    No stock history found for the selected filters.
                  </div>
                ) : (
                  filteredHistoryRows.map((row) => (
                    <div key={row.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                      <ProductCell image={row.image} name={row.productName} sku={row.sku} />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.movementType === "received" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {row.movementType === "received" ? "Added" : "Deducted"}
                        </span>
                        <p className="text-xs text-slate-500">{formatDate(row.createdAt)}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Unit</p>
                          <p className="mt-1 text-slate-700">{stockUnitLabel(row.stockUnit)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Qty</p>
                          <p className="mt-1 font-semibold text-slate-900">{row.quantity}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Previous</p>
                          <p className="mt-1 text-slate-700">{row.previousStock}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">New</p>
                          <p className="mt-1 text-slate-700">{row.newStock}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Note</p>
                          <p className="mt-1 text-slate-700">{row.reason || "-"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Created By</p>
                          <p className="mt-1 text-slate-700">{row.performedBy?.name || "-"}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Movement</th>
                  <th className="pb-3 pr-4">Unit</th>
                  <th className="pb-3 pr-4">Qty</th>
                  <th className="pb-3 pr-4">Previous</th>
                  <th className="pb-3 pr-4">New</th>
                  <th className="pb-3 pr-4">Note</th>
                  <th className="pb-3">Created By</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryRows.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-10 text-center text-sm text-slate-500">
                      No stock history found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredHistoryRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 text-slate-600">{formatDate(row.createdAt)}</td>
                      <td className="py-3 pr-4">
                        <ProductCell image={row.image} name={row.productName} sku={row.sku} />
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            row.movementType === "received" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {row.movementType === "received" ? "Added" : "Deducted"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{stockUnitLabel(row.stockUnit)}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{row.quantity}</td>
                      <td className="py-3 pr-4 text-slate-600">{row.previousStock}</td>
                      <td className="py-3 pr-4 text-slate-600">{row.newStock}</td>
                      <td className="py-3 pr-4 text-slate-600">{row.reason || "-"}</td>
                      <td className="py-3 text-slate-600">{row.performedBy?.name || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {arrangeEarlyRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    No stock arrangement data found.
                  </div>
                ) : (
                  arrangeEarlyRows.map((row, index) => (
                    <div key={row.productId || index} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                      <ProductCell image={row.image} name={row.productName} sku={row.sku} />
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">SL</p>
                          <p className="mt-1 text-slate-700">{index + 1}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Type</p>
                          <p className="mt-1 text-slate-700">{productTypeLabel(row.productType)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Current Stock</p>
                          <p className="mt-1 font-semibold text-slate-900">{row.currentStock} {stockUnitLabel(row.stockUnit)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Sold Qty</p>
                          <p className="mt-1 font-semibold text-rose-600">{row.soldQuantity}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Expiry</p>
                          <p className="mt-1 text-slate-700">
                            {row.expiryDate
                              ? `${formatDateOnly(row.expiryDate)}${
                                  row.daysUntilExpiry !== null
                                    ? ` (${Math.abs(row.daysUntilExpiry)} ${Math.abs(row.daysUntilExpiry) === 1 ? "day" : "days"}${row.daysUntilExpiry < 0 ? " ago" : ""})`
                                    : ""
                                }`
                              : "Not set"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            Number(row.currentStock || 0) <= 0
                              ? "bg-rose-100 text-rose-700"
                              : row.lowStock
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {Number(row.currentStock || 0) <= 0 ? "Arrange now" : row.lowStock ? "Arrange today" : "Monitor"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{row.suggestion}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 pr-4">SL</th>
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Current Stock</th>
                  <th className="pb-3 pr-4">Sold Qty</th>
                  <th className="pb-3 pr-4">Expiry</th>
                  <th className="pb-3 pr-4">Priority</th>
                  <th className="pb-3">Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {arrangeEarlyRows.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-sm text-slate-500">
                      No stock arrangement data found.
                    </td>
                  </tr>
                ) : (
                  arrangeEarlyRows.map((row, index) => (
                    <tr key={row.productId || index} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                      <td className="py-3 pr-4">
                        <ProductCell image={row.image} name={row.productName} sku={row.sku} />
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{productTypeLabel(row.productType)}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">
                        {row.currentStock} {stockUnitLabel(row.stockUnit)}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-rose-600">{row.soldQuantity}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {row.expiryDate
                          ? `${formatDateOnly(row.expiryDate)}${
                              row.daysUntilExpiry !== null
                                ? ` (${Math.abs(row.daysUntilExpiry)} ${Math.abs(row.daysUntilExpiry) === 1 ? "day" : "days"}${row.daysUntilExpiry < 0 ? " ago" : ""})`
                                : ""
                            }`
                          : "Not set"}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            Number(row.currentStock || 0) <= 0
                              ? "bg-rose-100 text-rose-700"
                              : row.lowStock
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {Number(row.currentStock || 0) <= 0 ? "Arrange now" : row.lowStock ? "Arrange today" : "Monitor"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{row.suggestion}</td>
                    </tr>
                  ))
                )}
              </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <ProductStockModal
        open={stockModalOpen}
        product={
          selectedProduct
            ? {
                id: selectedProduct.productId,
                name: selectedProduct.productName,
                stock: Number(selectedProduct.currentStock || 0)
              }
            : null
        }
        onClose={() => {
          setStockModalOpen(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleStockUpdate}
        submitting={stockSubmitting}
      />

      <ProductDeductModal
        open={deductModalOpen}
        product={
          selectedProduct
            ? {
                id: selectedProduct.productId,
                name: selectedProduct.productName,
                stock: Number(selectedProduct.currentStock || 0)
              }
            : null
        }
        onClose={() => {
          setDeductModalOpen(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleStockDeduction}
        submitting={deductSubmitting}
      />

      <ProductForceStockModal
        open={forceModalOpen}
        product={
          selectedProduct
            ? {
                id: selectedProduct.productId,
                name: selectedProduct.productName,
                stock: Number(selectedProduct.currentStock || 0)
              }
            : null
        }
        onClose={() => {
          setForceModalOpen(false);
          setSelectedProduct(null);
          setForcePin("");
        }}
        onSubmit={handleForceStockUpdate}
        submitting={forceSubmitting}
      />

      <ForceStockPinModal
        open={forcePinModalOpen}
        product={
          selectedProduct
            ? {
                id: selectedProduct.productId,
                name: selectedProduct.productName,
                stock: Number(selectedProduct.currentStock || 0)
              }
            : null
        }
        onClose={() => {
          setForcePinModalOpen(false);
          setSelectedProduct(null);
          setForcePin("");
        }}
        onSubmit={handleVerifyForcePin}
        submitting={pinSubmitting}
      />
    </div>
  );
};

export default StocksPage;
