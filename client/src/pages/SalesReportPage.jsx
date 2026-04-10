import { useEffect, useState } from "react";
import { CalendarRange, Download, FileSpreadsheet, HandCoins, ReceiptText, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import ReportOrdersModal from "../components/ReportOrdersModal";
import { useShopSettings } from "../context/ShopSettingsContext";
import { reportService } from "../services/reportService";
import { getLocalDateInputValue } from "../utils/date";
import { currency } from "../utils/format";
import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";

const todayString = () => getLocalDateInputValue();

const salesColumns = [
  { header: "SL", key: "sl" },
  { header: "Date", key: "date" },
  { header: "Total Sale Amount", key: "totalSaleAmount" },
  { header: "Number of Order", key: "numberOfOrder" },
  { header: "Payment By Cash", key: "paymentByCash" },
  { header: "Payment By Card", key: "paymentByCard" },
  { header: "Payment By QR", key: "paymentByQr" }
];

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm";

const statCardClass = "rounded-[1.35rem] p-3 shadow-sm";

const SalesReportPage = () => {
  const { settings: shopSettings } = useShopSettings();
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [report, setReport] = useState({ rows: [] });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedOrders, setSelectedOrders] = useState([]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getSalesRange({ from, to });
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const openOrdersForDate = async (date) => {
    try {
      const data = await reportService.getOrdersByDate(date);
      setSelectedDate(date);
      setSelectedOrders(data.orders || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load orders for selected date");
    }
  };

  const exportRows =
    report.rows?.map((row) => ({
      sl: row.sl,
      date: row.date,
      totalSaleAmount: Number(row.totalSaleAmount || 0).toFixed(2),
      numberOfOrder: row.numberOfOrder,
      paymentByCash: Number(row.paymentBy?.cash || 0).toFixed(2),
      paymentByCard: Number(row.paymentBy?.card || 0).toFixed(2),
      paymentByQr: Number(row.paymentBy?.qr || 0).toFixed(2)
    })) || [];

  const exportExcel = () => {
    if (!exportRows.length) {
      toast.error("No sales report data to export");
      return;
    }

    exportReportToExcel({
      fileName: `sales-report-${from}-to-${to}`,
      sheetName: "Sales Report",
      title: "Sales Report",
      columns: salesColumns,
      rows: exportRows,
      shopProfile: shopSettings,
      summaryLines: [`Date Range: ${from} to ${to}`]
    });
  };

  const exportPdf = async () => {
    if (!exportRows.length) {
      toast.error("No sales report data to export");
      return;
    }

    await exportReportToPdf({
      title: "Sales Report",
      fileName: `sales-report-${from}-to-${to}`,
      columns: salesColumns,
      rows: exportRows,
      summaryLines: [`Date Range: ${from} to ${to}`],
      shopProfile: shopSettings
    });
  };

  const totalSales = report.rows?.reduce((sum, row) => sum + Number(row.totalSaleAmount || 0), 0) || 0;
  const totalOrders = report.rows?.reduce((sum, row) => sum + Number(row.numberOfOrder || 0), 0) || 0;
  const totalCash = report.rows?.reduce((sum, row) => sum + Number(row.paymentBy?.cash || 0), 0) || 0;
  const totalDigital =
    report.rows?.reduce((sum, row) => sum + Number(row.paymentBy?.card || 0) + Number(row.paymentBy?.qr || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-5">
        <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className={heroBadgeClass}>
                  <CalendarRange size={14} />
                  Sales Overview
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Sales Report</h1>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">Generate daily merged sales information between any two dates.</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Report Days</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{report.rows?.length || 0}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <CalendarRange size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#d8e6e7] bg-[#e7f0f2]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Orders</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{totalOrders}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <ReceiptText size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#dce7df] bg-[#eef4ef]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cash Sales</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(totalCash)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                <HandCoins size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} bg-[#171d31] text-white`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Total Sales</p>
                <p className="mt-2 text-2xl font-bold">{currency(totalSales)}</p>
                <p className="mt-1 text-xs text-slate-300">Digital: {currency(totalDigital)}</p>
              </div>
              <div className="rounded-full bg-white/10 p-3 text-white">
                <WalletCards size={18} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Daily Sales Table</h2>
            <p className="text-xs text-slate-500">Click any date to view that day&apos;s order list.</p>
          </div>
          <p className="text-xs font-medium text-slate-400">{from} to {to}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">SL</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Total Sale Amount</th>
                <th className="pb-3 pr-4">Number of Order</th>
                <th className="pb-3 pr-4">Payment By Cash</th>
                <th className="pb-3 pr-4">Payment By Card</th>
                <th className="pb-3">Payment By QR</th>
              </tr>
            </thead>
            <tbody>
              {report.rows?.map((row) => (
                <tr key={row.date} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-semibold text-slate-700">{row.sl}</td>
                  <td className="py-3 pr-4">
                    <button type="button" onClick={() => openOrdersForDate(row.date)} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                      {row.date}
                    </button>
                  </td>
                  <td className="py-3 pr-4 font-bold text-brand-600">{currency(row.totalSaleAmount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{row.numberOfOrder}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.paymentBy.cash)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.paymentBy.card)}</td>
                  <td className="py-3 text-slate-700">{currency(row.paymentBy.qr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReportOrdersModal
        open={Boolean(selectedDate)}
        date={selectedDate}
        orders={selectedOrders}
        onClose={() => {
          setSelectedDate("");
          setSelectedOrders([]);
        }}
      />
    </div>
  );
};

export default SalesReportPage;
