import { useEffect, useState } from "react";
import { CalendarRange, Download, FileSpreadsheet, QrCode, ReceiptText, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import ReportOrdersModal from "../components/ReportOrdersModal";
import { reportService } from "../services/reportService";
import { getLocalDateInputValue } from "../utils/date";
import { currency } from "../utils/format";
import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";

const todayString = () => getLocalDateInputValue();

const cashPositionColumns = [
  { header: "SL", key: "sl" },
  { header: "Date", key: "date" },
  { header: "Cash Amount", key: "cashAmount" },
  { header: "Card Amount", key: "cardAmount" },
  { header: "QR Amount", key: "qrAmount" },
  { header: "Total Amount", key: "totalAmount" }
];

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm";

const statCardClass = "rounded-[1.6rem] p-4 shadow-sm";

const CashPositionPage = () => {
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [report, setReport] = useState({ rows: [], totals: { cash: 0, card: 0, qr: 0, total: 0 } });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedOrders, setSelectedOrders] = useState([]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getCashPosition({ from, to });
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load cash position");
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
      cashAmount: Number(row.cashAmount || 0).toFixed(2),
      cardAmount: Number(row.cardAmount || 0).toFixed(2),
      qrAmount: Number(row.qrAmount || 0).toFixed(2),
      totalAmount: Number(row.totalAmount || 0).toFixed(2)
    })) || [];

  const exportExcel = () => {
    if (!exportRows.length) {
      toast.error("No cash position data to export");
      return;
    }

    exportReportToExcel({
      fileName: `cash-position-${from}-to-${to}`,
      sheetName: "Cash Position",
      columns: cashPositionColumns,
      rows: exportRows
    });
  };

  const exportPdf = () => {
    if (!exportRows.length) {
      toast.error("No cash position data to export");
      return;
    }

    exportReportToPdf({
      title: "Cash Position",
      fileName: `cash-position-${from}-to-${to}`,
      columns: cashPositionColumns,
      rows: exportRows,
      summaryLines: [
        `Date Range: ${from} to ${to}`,
        `Cash Total: ${currency(report.totals.cash)}`,
        `Card Total: ${currency(report.totals.card)}`,
        `QR Total: ${currency(report.totals.qr)}`,
        `Combined Total: ${currency(report.totals.total)}`
      ]
    });
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-6">
        <div className="rounded-[2rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-5 shadow-[0_20px_50px_rgba(160,120,50,0.12)] sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className={heroBadgeClass}>
                  <CalendarRange size={14} />
                  Cash Summary
                </div>
                <h1 className="mt-3 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">Cash Position</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">Review cash and card/QR totals within a selected date range.</p>
              </div>

              <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-5 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Date Range</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{from} to {to}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="rounded-[1.7rem] border border-[#efe2ca] bg-[#fff8ea] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
                  <ReportDatePicker label="From Date" value={from} onChange={setFrom} maxDate={to} />
                  <div className="pb-3 text-center text-sm font-semibold text-slate-400">to</div>
                  <ReportDatePicker label="To Date" value={to} onChange={setTo} minDate={from} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[auto_auto_auto] xl:justify-end">
                <button type="button" onClick={loadReport} className="btn-primary h-11 rounded-full px-6 shadow-sm">
                  {loading ? "Loading..." : "Generate"}
                </button>
                <button type="button" onClick={exportExcel} className="btn-secondary h-11 gap-2 rounded-full border border-[#d7cbb7] bg-white px-5">
                  <FileSpreadsheet size={18} />
                  Export Excel
                </button>
                <button type="button" onClick={exportPdf} className="btn-secondary h-11 gap-2 rounded-full border border-[#d7cbb7] bg-white px-5">
                  <Download size={18} />
                  Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${statCardClass} border border-[#dce7df] bg-[#eef4ef]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cash Total</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(report.totals.cash)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                <WalletCards size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#d8e6e7] bg-[#e7f0f2]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Card Total</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(report.totals.card)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-blue-600">
                <ReceiptText size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#eadff0] bg-[#f3edf7]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">QR Total</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(report.totals.qr)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-violet-600">
                <QrCode size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} bg-[#171d31] text-white`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Combined Total</p>
                <p className="mt-2 text-2xl font-bold">{currency(report.totals.total)}</p>
                <p className="mt-1 text-xs text-slate-300">{report.rows?.length || 0} report days</p>
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
            <h2 className="text-lg font-bold text-slate-900">Daily Cash Position</h2>
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
                <th className="pb-3 pr-4">Cash Amount</th>
                <th className="pb-3 pr-4">Card Amount</th>
                <th className="pb-3 pr-4">QR Amount</th>
                <th className="pb-3">Total Amount</th>
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
                  <td className="py-3 pr-4 text-slate-700">{currency(row.cashAmount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.cardAmount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.qrAmount)}</td>
                  <td className="py-3 font-bold text-brand-600">{currency(row.totalAmount)}</td>
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

export default CashPositionPage;
