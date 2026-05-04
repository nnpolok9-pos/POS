import { useEffect, useMemo, useState } from "react";
import { Bike, CalendarRange, Download, FileSpreadsheet, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
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

const partnerSalesColumns = [
  { header: "SL", key: "sl" },
  { header: "Partner", key: "partnerLabel" },
  { header: "Orders", key: "orderCount" },
  { header: "Completed Orders", key: "completedOrders" },
  { header: "Gross Sales", key: "grossSales" },
  { header: "Refunds", key: "refunds" },
  { header: "Net Sales", key: "netSales" },
  { header: "Average Order", key: "averageOrderValue" }
];

const DeliveryPartnerSalesReportPage = () => {
  const { settings: shopSettings } = useShopSettings();
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [report, setReport] = useState({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState("all");

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getDeliveryPartnerSales({ from, to });
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load delivery partner report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const partnerOptions = useMemo(
    () => [
      { value: "all", label: "All Partners" },
      ...((report.rows || []).map((row) => ({
        value: row.partner,
        label: row.partnerLabel
      })))
    ],
    [report.rows]
  );

  const visibleRows = useMemo(
    () => (report.rows || []).filter((row) => selectedPartner === "all" || row.partner === selectedPartner),
    [report.rows, selectedPartner]
  );

  const visibleSummary = useMemo(
    () =>
      visibleRows.reduce(
        (acc, row) => {
          acc.totalOrders += Number(row.orderCount || 0);
          acc.totalCompletedOrders += Number(row.completedOrders || 0);
          acc.totalGrossSales += Number(row.grossSales || 0);
          acc.totalRefunds += Number(row.refunds || 0);
          acc.totalNetSales += Number(row.netSales || 0);
          return acc;
        },
        {
          totalOrders: 0,
          totalCompletedOrders: 0,
          totalGrossSales: 0,
          totalRefunds: 0,
          totalNetSales: 0
        }
      ),
    [visibleRows]
  );

  const selectedPartnerLabel = partnerOptions.find((option) => option.value === selectedPartner)?.label || "All Partners";
  const visibleTopPartner = selectedPartner === "all" ? report.summary?.topPartner || "-" : visibleRows[0]?.partnerLabel || "-";

  const exportRows =
    visibleRows?.map((row) => ({
      sl: row.sl,
      partnerLabel: row.partnerLabel,
      orderCount: row.orderCount,
      completedOrders: row.completedOrders,
      grossSales: Number(row.grossSales || 0).toFixed(2),
      refunds: Number(row.refunds || 0).toFixed(2),
      netSales: Number(row.netSales || 0).toFixed(2),
      averageOrderValue: Number(row.averageOrderValue || 0).toFixed(2)
    })) || [];

  const exportExcel = () => {
    if (!exportRows.length) {
      toast.error("No delivery partner data to export");
      return;
    }

    exportReportToExcel({
      fileName: `delivery-partner-sales-${from}-to-${to}`,
      sheetName: "Delivery Partners",
      title: "Delivery Partner Sales Report",
      columns: partnerSalesColumns,
      rows: exportRows,
      shopProfile: shopSettings,
      summaryLines: [`Date Range: ${from} to ${to}`, `Partner Filter: ${selectedPartnerLabel}`]
    });
  };

  const exportPdf = async () => {
    if (!exportRows.length) {
      toast.error("No delivery partner data to export");
      return;
    }

    await exportReportToPdf({
      title: "Delivery Partner Sales Report",
      fileName: `delivery-partner-sales-${from}-to-${to}`,
      columns: partnerSalesColumns,
      rows: exportRows,
      summaryLines: [`Date Range: ${from} to ${to}`, `Partner Filter: ${selectedPartnerLabel}`],
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
                  <Bike size={14} />
                  Delivery Partners
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Delivery Partner Sales Report</h1>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                  Review Grab, Foodpanda, E-Gates, and WOWNOW sales performance for any selected date range.
                </p>
              </div>

              <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-4 py-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Date Range</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-800">{from} to {to}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="rounded-[1.4rem] border border-[#efe2ca] bg-[#fff8ea] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(220px,0.7fr)] md:items-end">
                  <ReportDatePicker label="From Date" value={from} onChange={setFrom} maxDate={to} />
                  <div className="pb-3 text-center text-sm font-semibold text-slate-400">to</div>
                  <ReportDatePicker label="To Date" value={to} onChange={setTo} minDate={from} />
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Partner Filter</label>
                    <select value={selectedPartner} onChange={(event) => setSelectedPartner(event.target.value)} className="input">
                      {partnerOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Partner Orders</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{visibleSummary.totalOrders || 0}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <ReceiptText size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#d8e6e7] bg-[#e7f0f2]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Completed</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{visibleSummary.totalCompletedOrders || 0}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <CalendarRange size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#f0ddda] bg-[#fff0ed]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Refunds</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(visibleSummary.totalRefunds || 0)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-rose-500">
                <RotateCcw size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} bg-[#171d31] text-white`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Net Sales</p>
                <p className="mt-2 text-2xl font-bold">{currency(visibleSummary.totalNetSales || 0)}</p>
                <p className="mt-1 text-xs text-slate-300">Top Partner: {visibleTopPartner}</p>
              </div>
              <div className="rounded-full bg-white/10 p-3 text-white">
                <WalletCards size={18} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Partner-wise Summary</h2>
            <p className="text-xs text-slate-500">Each delivery app is summarized here with its gross sales, refunds, and net balance.</p>
          </div>
          <p className="text-xs font-medium text-slate-400">
            {selectedPartnerLabel} · {from} to {to}
          </p>
        </div>

        <div className="space-y-3 md:hidden">
          {visibleRows.map((row) => (
            <div key={row.partner} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{row.partnerLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.orderCount} orders · {row.completedOrders} completed</p>
                </div>
                <p className="text-sm font-bold text-brand-600">{currency(row.netSales)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Gross</p>
                  <p className="mt-1 text-slate-700">{currency(row.grossSales)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Refunds</p>
                  <p className="mt-1 text-slate-700">{currency(row.refunds)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Average Order</p>
                  <p className="mt-1 text-slate-700">{currency(row.averageOrderValue)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">SL</th>
                <th className="pb-3 pr-4">Partner</th>
                <th className="pb-3 pr-4">Orders</th>
                <th className="pb-3 pr-4">Completed Orders</th>
                <th className="pb-3 pr-4">Gross Sales</th>
                <th className="pb-3 pr-4">Refunds</th>
                <th className="pb-3 pr-4">Net Sales</th>
                <th className="pb-3">Average Order</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.partner} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-semibold text-slate-700">{row.sl}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{row.partnerLabel}</td>
                  <td className="py-3 pr-4 text-slate-700">{row.orderCount}</td>
                  <td className="py-3 pr-4 text-slate-700">{row.completedOrders}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.grossSales)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.refunds)}</td>
                  <td className="py-3 pr-4 font-bold text-brand-600">{currency(row.netSales)}</td>
                  <td className="py-3 text-slate-700">{currency(row.averageOrderValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DeliveryPartnerSalesReportPage;
