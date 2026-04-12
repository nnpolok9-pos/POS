import { useEffect, useMemo, useState } from "react";
import { Boxes, CalendarRange, Download, FileSpreadsheet, PackageSearch, ReceiptText, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import { useShopSettings } from "../context/ShopSettingsContext";
import { reportService } from "../services/reportService";
import { getLocalDateInputValue } from "../utils/date";
import { currency } from "../utils/format";
import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";

const todayString = () => getLocalDateInputValue();

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm";

const statCardClass = "rounded-[1.35rem] p-3 shadow-sm";

const productSalesColumns = [
  { header: "SL", key: "sl" },
  { header: "Product Name", key: "productName" },
  { header: "Category", key: "category" },
  { header: "Product Type", key: "productType" },
  { header: "Sold Qty", key: "soldQty" },
  { header: "Sale Amount", key: "saleAmount" },
  { header: "Orders", key: "orderCount" }
];

const productTypeLabel = (type) =>
  ({
    raw: "A La Catre",
    raw_material: "Base",
    combo: "Combined",
    combo_type: "Combo",
    sauce: "Sauce",
    seasoning: "Seasoning"
  })[type] || "A La Catre";

const ProductSalesReportPage = () => {
  const { settings: shopSettings } = useShopSettings();
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [report, setReport] = useState({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getProductSales({ from, to });
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load product sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return report.rows || [];
    }

    return (report.rows || []).filter((row) => {
      return (
        row.productName.toLowerCase().includes(query) ||
        (row.category || "").toLowerCase().includes(query) ||
        productTypeLabel(row.productType).toLowerCase().includes(query)
      );
    });
  }, [report.rows, search]);

  const filteredSummary = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.totalProducts += 1;
          acc.totalQty += Number(row.soldQty || 0);
          acc.totalSales += Number(row.saleAmount || 0);
          acc.totalOrderTouches += Number(row.orderCount || 0);
          return acc;
        },
        { totalProducts: 0, totalQty: 0, totalSales: 0, totalOrderTouches: 0 }
      ),
    [filteredRows]
  );

  const exportRows = filteredRows.map((row) => ({
    sl: row.sl,
    productName: row.productName,
    category: row.category,
    productType: productTypeLabel(row.productType),
    soldQty: row.soldQty,
    saleAmount: Number(row.saleAmount || 0).toFixed(2),
    orderCount: row.orderCount
  }));

  const exportExcel = () => {
    if (!exportRows.length) {
      toast.error("No product sales data to export");
      return;
    }

    exportReportToExcel({
      fileName: `product-sales-report-${from}-to-${to}`,
      sheetName: "Product Sales",
      title: "Product Sales Report",
      columns: productSalesColumns,
      rows: exportRows,
      shopProfile: shopSettings,
      summaryLines: [`Date Range: ${from} to ${to}`]
    });
  };

  const exportPdf = async () => {
    if (!exportRows.length) {
      toast.error("No product sales data to export");
      return;
    }

    await exportReportToPdf({
      title: "Product Sales Report",
      fileName: `product-sales-report-${from}-to-${to}`,
      columns: productSalesColumns,
      rows: exportRows,
      summaryLines: [`Date Range: ${from} to ${to}`],
      shopProfile: shopSettings
    });
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-5">
        <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className={heroBadgeClass}>
                  <CalendarRange size={14} />
                  Product Sales
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Product Sales Report</h1>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                  View sales summary by product for any selected date range using saleable items only.
                </p>
              </div>

              <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-4 py-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Date Range</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-800">{from} to {to}</p>
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

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[auto_auto_auto] xl:justify-end">
                <button type="button" onClick={loadReport} className="btn-primary h-10 rounded-full px-5 shadow-sm">
                  {loading ? "Loading..." : "Generate"}
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

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${statCardClass} border border-[#d9e0eb] bg-[#e8eef7]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Products</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{filteredSummary.totalProducts}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <PackageSearch size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#d8e6e7] bg-[#e7f0f2]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sold Qty</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{filteredSummary.totalQty}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <Boxes size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#dce7df] bg-[#eef4ef]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Order Touches</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{filteredSummary.totalOrderTouches}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                <ReceiptText size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} bg-[#171d31] text-white`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Total Sales</p>
                <p className="mt-2 text-2xl font-bold">{currency(filteredSummary.totalSales)}</p>
                <p className="mt-1 text-xs text-slate-300">{report.summary?.categoryCount || 0} categories</p>
              </div>
              <div className="rounded-full bg-white/10 p-3 text-white">
                <WalletCards size={18} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Product-wise Sales Summary</h2>
            <p className="text-xs text-slate-500">See how much each saleable product sold during the selected period.</p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, category, or type"
            className="input max-w-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">SL</th>
                <th className="pb-3 pr-4">Product Name</th>
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Sold Qty</th>
                <th className="pb-3 pr-4">Sale Amount</th>
                <th className="pb-3">Orders</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-sm text-slate-500">
                    No product sales found for the selected date range.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={row.productId || `${row.productName}-${index}`} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900">{row.productName}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{row.category || "-"}</td>
                    <td className="py-3 pr-4 text-slate-700">{productTypeLabel(row.productType)}</td>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{row.soldQty}</td>
                    <td className="py-3 pr-4 font-bold text-brand-600">{currency(row.saleAmount)}</td>
                    <td className="py-3 text-slate-700">{row.orderCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ProductSalesReportPage;
