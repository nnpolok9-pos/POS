import { useEffect, useMemo, useState } from "react";
import { Archive, Boxes, Info, PackageSearch, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import CombinedProductBreakdownModal from "../components/CombinedProductBreakdownModal";
import ReportDatePicker from "../components/ReportDatePicker";
import { inventoryService } from "../services/inventoryService";
import { getLocalDateInputValue } from "../utils/date";
import { formatDate } from "../utils/format";

const stockUnitLabel = (unit) =>
  ({
    pieces: "Pieces",
    gram: "Gram",
    teaspoon: "Tea Spoon"
  })[unit] || "Pieces";

const productTypeLabel = (type) =>
  ({
    combo: "Combined",
    combo_type: "Combo",
    raw_material: "Base",
    sauce: "Sauce",
    seasoning: "Seasoning",
    raw: "A La Catre"
  })[type] || "A La Catre";
const categoryLabel = (category) => (/^raw$/i.test(category || "") ? "Base" : category);
const todayString = () => getLocalDateInputValue();

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm";

const statCardClass = "rounded-[1.35rem] p-3 shadow-sm";
const tabButtonClass = "rounded-full border px-4 py-2 text-sm font-semibold transition";
const isCompositeTab = (tab) => ["combined", "combo_type"].includes(tab);

const InventoryPage = () => {
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [report, setReport] = useState({
    rawSummary: {},
    rawRows: [],
    comboSummary: {},
    comboRows: [],
    expirySummary: {},
    expiryRows: []
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedDateRange, setAppliedDateRange] = useState(null);
  const [activeTab, setActiveTab] = useState("raw");
  const [selectedCombinedRow, setSelectedCombinedRow] = useState(null);

  const loadReport = async (params = {}) => {
    setLoading(true);
    try {
      const data = await inventoryService.getReport(params);
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load inventory report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport({});
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sourceRows =
      activeTab === "raw"
        ? report.rawRows || report.rows || []
        : activeTab === "combined"
          ? (report.comboRows || []).filter((row) => row.productType === "combo")
          : activeTab === "combo_type"
            ? (report.comboRows || []).filter((row) => row.productType === "combo_type")
            : report.expiryRows || [];

    if (!query) {
      return sourceRows;
    }

    return sourceRows.filter((row) => {
      const componentText = activeTab === "combo" ? (row.components || []).map((component) => component.productName).join(" ").toLowerCase() : "";

      return (
        row.productName.toLowerCase().includes(query) ||
        (row.sku || "").toLowerCase().includes(query) ||
        componentText.includes(query) ||
        (row.suggestion || "").toLowerCase().includes(query)
      );
    });
  }, [activeTab, report.comboRows, report.expiryRows, report.rawRows, report.rows, search]);

  const buildCompositeSummary = (rows) =>
    rows.reduce(
      (acc, row) => {
        acc.comboCount += 1;
        acc.totalAvailable += row.availableToSell || 0;
        acc.totalSold += row.soldQuantity || 0;
        if (row.lowAvailability) {
          acc.lowAvailabilityCount += 1;
        }
        if (row.isActive) {
          acc.activeComboCount += 1;
        }
        return acc;
      },
      {
        comboCount: 0,
        totalAvailable: 0,
        totalSold: 0,
        lowAvailabilityCount: 0,
        activeComboCount: 0
      }
    );

  const combinedSummary = useMemo(
    () => buildCompositeSummary((report.comboRows || []).filter((row) => row.productType === "combo")),
    [report.comboRows]
  );

  const comboTypeSummary = useMemo(
    () => buildCompositeSummary((report.comboRows || []).filter((row) => row.productType === "combo_type")),
    [report.comboRows]
  );

  const activeSummary =
    activeTab === "raw"
      ? report.rawSummary || report.summary || {}
      : activeTab === "combined"
        ? combinedSummary
        : activeTab === "combo_type"
          ? comboTypeSummary
          : report.expirySummary || {};

  const combinedBreakdownMaterials = useMemo(() => {
    if (!selectedCombinedRow) {
      return [];
    }

    const targetUnits = Number(selectedCombinedRow.availableToSell || 0) + 1;
    const components = selectedCombinedRow.components || [];
    const limitingValue = components.length ? Math.min(...components.map((component) => Number(component.possibleCombos || 0))) : 0;

    return components
      .map((component) => {
        const requiredQuantity = Number(component.requiredQuantity || 0);
        const currentStock = Number(component.rawStock || 0);
        const possibleUnits = Number(component.possibleCombos || 0);

        return {
          id: component.productId || `${component.productName}-${requiredQuantity}`,
          name: component.productName,
          sku: component.sku || "",
          productType: component.productType || "raw_material",
          stockUnit: component.stockUnit || "pieces",
          requiredQuantity,
          currentStock,
          possibleUnits,
          shortageForNextUnit: Math.max(targetUnits * requiredQuantity - currentStock, 0),
          isLimiting: possibleUnits === limitingValue
        };
      })
      .sort((left, right) => left.possibleUnits - right.possibleUnits || right.shortageForNextUnit - left.shortageForNextUnit);
  }, [selectedCombinedRow]);

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-5">
        <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className={heroBadgeClass}>
                  <Archive size={14} />
                  Inventory Report
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Inventory</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Track base stock movement, combined sellable inventory, and expiry risk from one report screen.
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
            onClick={() => setActiveTab("raw")}
            className={`${tabButtonClass} ${
              activeTab === "raw" ? "border-[#c8d8d0] bg-[#eef4ef] text-slate-900" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            Base Inventory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("combined")}
            className={`${tabButtonClass} ${
              activeTab === "combined" ? "border-[#d9e0eb] bg-[#e8eef7] text-slate-900" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            Combined Inventory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("combo_type")}
            className={`${tabButtonClass} ${
              activeTab === "combo_type" ? "border-[#d9e0eb] bg-[#e8eef7] text-slate-900" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            Combo Inventory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expiry")}
            className={`${tabButtonClass} ${
              activeTab === "expiry" ? "border-[#f0dede] bg-[#fdf1ef] text-slate-900" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            Expiry Report
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className={`${statCardClass} border border-[#dce7df] bg-[#eef4ef]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {activeTab === "raw" ? "Received Qty" : isCompositeTab(activeTab) ? "Available Combos" : "Tracked Items"}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {activeTab === "raw" ? activeSummary.totalReceived || 0 : isCompositeTab(activeTab) ? activeSummary.totalAvailable || 0 : activeSummary.trackedCount || 0}
                </p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                {activeTab === "raw" ? <TrendingUp size={18} /> : isCompositeTab(activeTab) ? <ShoppingBag size={18} /> : <Archive size={18} />}
              </div>
            </div>
          </div>

          <div className={`${statCardClass} border border-[#f0dede] bg-[#f8eeee]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {activeTab === "raw" ? "Deducted Qty" : isCompositeTab(activeTab) ? "Sold Qty" : "2-Day Alert"}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {activeTab === "raw" ? activeSummary.totalDeducted || 0 : isCompositeTab(activeTab) ? activeSummary.totalSold || 0 : activeSummary.expiringSoonCount || 0}
                </p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-rose-600">
                <TrendingDown size={18} />
              </div>
            </div>
          </div>

          {activeTab === "raw" ? (
            <div className={`${statCardClass} border border-[#f6dfd2] bg-[#fff1ea]`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sold Qty</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{activeSummary.totalSold || 0}</p>
                </div>
                <div className="rounded-full bg-white/55 p-3 text-orange-600">
                  <TrendingDown size={18} />
                </div>
              </div>
            </div>
          ) : activeTab === "expiry" ? (
            <div className={`${statCardClass} border border-[#f6dfd2] bg-[#fff1ea]`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expired</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{activeSummary.expiredCount || 0}</p>
                </div>
                <div className="rounded-full bg-white/55 p-3 text-orange-600">
                  <TrendingDown size={18} />
                </div>
              </div>
            </div>
          ) : (
            <div className={`${statCardClass} border border-[#f6dfd2] bg-[#fff1ea]`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Low Inventory</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{activeSummary.lowAvailabilityCount || 0}</p>
                </div>
                <div className="rounded-full bg-white/55 p-3 text-orange-600">
                  <TrendingDown size={18} />
                </div>
              </div>
            </div>
          )}

          <div className={`${statCardClass} border border-[#d9e0eb] bg-[#e8eef7]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {activeTab === "raw" ? "Current Stock" : isCompositeTab(activeTab) ? "Sellable Combos" : "Fresh"}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {activeTab === "raw" ? activeSummary.currentStock || 0 : isCompositeTab(activeTab) ? activeSummary.activeComboCount || 0 : activeSummary.freshCount || 0}
                </p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                {activeTab === "raw" ? <PackageSearch size={18} /> : isCompositeTab(activeTab) ? <Boxes size={18} /> : <PackageSearch size={18} />}
              </div>
            </div>
          </div>

          <div className={`${statCardClass} bg-[#171d31] text-white`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Summary</p>
                <p className="mt-2 text-2xl font-bold">
                  {activeTab === "raw"
                    ? `${activeSummary.productCount || 0} Items`
                    : isCompositeTab(activeTab)
                      ? `${activeSummary.comboCount || 0} Items`
                      : `${activeSummary.missingExpiryCount || 0} Missing`}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {activeTab === "raw"
                    ? `${activeSummary.lowStockCount || 0} low stock products`
                    : isCompositeTab(activeTab)
                      ? `${activeSummary.lowAvailabilityCount || 0} low inventory combos`
                      : "Products without expiry date set"}
                </p>
              </div>
              <div className="rounded-full bg-white/10 p-3 text-white">
                <Archive size={18} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
              {activeTab === "raw" ? "Base Inventory Summary" : activeTab === "combined" ? "Combined Inventory Summary" : activeTab === "combo_type" ? "Combo Inventory Summary" : "Expiry Tracking Summary"}
              </h2>
              <p className="text-xs text-slate-500">
                {activeTab === "raw"
                  ? "Received quantity comes from stock updates. Sold quantity comes from completed served sales."
                  : activeTab === "combined"
                    ? "Combined inventory is calculated from linked base stock and shown as current sellable combo count."
                    : activeTab === "combo_type"
                      ? "Combo inventory is calculated from linked Base, A La Catre, Combined, or Combo items."
                    : "Trace expiry dates, get alerts 2 days before expiry, and identify products that need action first."}
              </p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activeTab === "raw"
                  ? "Search product or SKU"
                  : isCompositeTab(activeTab)
                    ? "Search combined, A La Catre item, or Base item"
                    : "Search product, SKU, or expiry action"
              }
            className="input max-w-sm"
          />
        </div>

        <div className="overflow-x-auto">
          {activeTab === "raw" ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 pr-4">SL</th>
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Unit</th>
                  <th className="pb-3 pr-4">Expiry Date</th>
                  <th className="pb-3 pr-4">Received Qty</th>
                  <th className="pb-3 pr-4">Deducted Qty</th>
                  <th className="pb-3 pr-4">Sold Qty</th>
                  <th className="pb-3 pr-4">Current Stock</th>
                  <th className="pb-3">Last Received</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="py-10 text-center text-sm text-slate-500">
                      No base inventory records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={row.productId || index} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{row.productName}</p>
                        <p className="text-xs text-slate-500">{row.sku || "-"}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{productTypeLabel(row.productType)}</td>
                      <td className="py-3 pr-4 text-slate-600">{categoryLabel(row.category)}</td>
                      <td className="py-3 pr-4 text-slate-600">{stockUnitLabel(row.stockUnit)}</td>
                      <td className="py-3 pr-4 text-slate-600">{row.expiryDate ? formatDate(row.expiryDate) : "Not set"}</td>
                      <td className="py-3 pr-4 font-semibold text-emerald-700">{row.receivedQuantity}</td>
                      <td className="py-3 pr-4 font-semibold text-rose-600">{row.deductedQuantity}</td>
                      <td className="py-3 pr-4 font-semibold text-rose-600">{row.soldQuantity}</td>
                      <td className="py-3 pr-4 font-bold text-slate-900">{row.currentStock}</td>
                      <td className="py-3 text-slate-600">{row.lastReceivedAt ? formatDate(row.lastReceivedAt) : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : isCompositeTab(activeTab) ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 pr-4">SL</th>
                  <th className="pb-3 pr-4">Combo</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Unit</th>
                  <th className="pb-3 pr-4">Inventory</th>
                  <th className="pb-3 pr-4">Sold Qty</th>
                  <th className="pb-3 pr-4">Materials Report</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-10 text-center text-sm text-slate-500">
                      No {activeTab === "combo_type" ? "combo" : "combined"} inventory records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={row.productId || index} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{row.productName}</p>
                        <p className="text-xs text-slate-500">{row.sku || "-"}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{productTypeLabel(row.productType)}</td>
                      <td className="py-3 pr-4 text-slate-600">{categoryLabel(row.category)}</td>
                      <td className="py-3 pr-4 text-slate-600">{stockUnitLabel(row.stockUnit)}</td>
                      <td className="py-3 pr-4 font-bold text-slate-900">{row.availableToSell}</td>
                      <td className="py-3 pr-4 font-semibold text-rose-600">{row.soldQuantity}</td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => setSelectedCombinedRow(row)}
                          className="btn-secondary gap-2"
                        >
                          <Info size={16} />
                          View Materials
                        </button>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            row.availableToSell === 0
                              ? "bg-rose-100 text-rose-600"
                              : row.lowAvailability
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {row.availableToSell === 0 ? "Out of stock" : row.lowAvailability ? "Low inventory" : "In inventory"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 pr-4">SL</th>
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Unit</th>
                  <th className="pb-3 pr-4">Stock</th>
                  <th className="pb-3 pr-4">Expiry Date</th>
                  <th className="pb-3 pr-4">Days Left</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-10 text-center text-sm text-slate-500">
                      No expiry-tracked products found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={row.productId || index} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{row.productName}</p>
                        <p className="text-xs text-slate-500">{row.sku || "-"}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{productTypeLabel(row.productType)}</td>
                      <td className="py-3 pr-4 text-slate-600">{categoryLabel(row.category)}</td>
                      <td className="py-3 pr-4 text-slate-600">{stockUnitLabel(row.stockUnit)}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{row.currentStock}</td>
                      <td className="py-3 pr-4 text-slate-600">{row.expiryDate ? formatDate(row.expiryDate) : "Not set"}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">
                        {!row.hasExpiryDate ? "-" : row.daysUntilExpiry < 0 ? `${Math.abs(row.daysUntilExpiry)} day(s) ago` : `${row.daysUntilExpiry} day(s)`}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            !row.hasExpiryDate
                              ? "bg-slate-100 text-slate-600"
                              : row.isExpired
                                ? "bg-rose-100 text-rose-700"
                                : row.isExpiringSoon
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {!row.hasExpiryDate ? "Missing date" : row.isExpired ? "Expired" : row.isExpiringSoon ? "2-day alert" : "Fresh"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{row.suggestion}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {activeTab === "raw" && (
        <section className="glass-card overflow-hidden p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Inventory History</h2>
            <p className="text-xs text-slate-500">Received and deducted stock history with reasons and user records.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Unit</th>
                  <th className="pb-3 pr-4">Qty</th>
                  <th className="pb-3 pr-4">Previous</th>
                  <th className="pb-3 pr-4">New</th>
                  <th className="pb-3 pr-4">Reason</th>
                  <th className="pb-3">By</th>
                </tr>
              </thead>
              <tbody>
                {(report.movementHistory || []).length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-10 text-center text-sm text-slate-500">
                      No inventory history found for the selected date range.
                    </td>
                  </tr>
                ) : (
                  (report.movementHistory || []).map((movement) => (
                    <tr key={movement.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 text-slate-600">{formatDate(movement.createdAt)}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{movement.productName}</p>
                        <p className="text-xs text-slate-500">{movement.sku || "-"}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            movement.movementType === "received" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {movement.movementType === "received" ? "Received" : "Deducted"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{stockUnitLabel(movement.stockUnit)}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{movement.quantity}</td>
                      <td className="py-3 pr-4 text-slate-600">{movement.previousStock}</td>
                      <td className="py-3 pr-4 text-slate-600">{movement.newStock}</td>
                      <td className="py-3 pr-4 text-slate-600">{movement.reason || "-"}</td>
                      <td className="py-3 text-slate-600">{movement.performedBy?.name || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CombinedProductBreakdownModal
        open={Boolean(selectedCombinedRow)}
        product={
          selectedCombinedRow
            ? {
                name: selectedCombinedRow.productName,
                stock: selectedCombinedRow.availableToSell
              }
            : null
        }
        materials={combinedBreakdownMaterials}
        onClose={() => setSelectedCombinedRow(null)}
      />
    </div>
  );
};

export default InventoryPage;
