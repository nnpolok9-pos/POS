import { useEffect, useState } from "react";
import { Bike, CalendarRange, CreditCard, Download, Eye, FileSpreadsheet, QrCode, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import EditHistoryModal from "../components/EditHistoryModal";
import OrderDetailModal from "../components/OrderDetailModal";
import ReportDatePicker from "../components/ReportDatePicker";
import { useShopSettings } from "../context/ShopSettingsContext";
import { orderService } from "../services/orderService";
import { getLocalDateInputValue } from "../utils/date";
import { currency, formatDate } from "../utils/format";
import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";
import { getTransactionSummary } from "../utils/transactionSummary";

const todayString = () => getLocalDateInputValue();

const transactionColumns = [
  { header: "SL", key: "sl" },
  { header: "Date", key: "date" },
  { header: "Order Number", key: "orderNumber" },
  { header: "Final Order Value", key: "finalOrderValue" },
  { header: "Cash In", key: "cashIn" },
  { header: "Cash Out", key: "cashOut" },
  { header: "Card In", key: "cardIn" },
  { header: "Card Out", key: "cardOut" },
  { header: "QR In", key: "qrIn" },
  { header: "QR Out", key: "qrOut" },
  { header: "Delivery In", key: "deliveryIn" },
  { header: "Delivery Out", key: "deliveryOut" },
  { header: "Edit Count", key: "editCount" },
  { header: "Status", key: "status" },
  { header: "Serve Time", key: "serveTime" }
];

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm";

const statCardClass = "rounded-[1.6rem] p-4 shadow-sm";

const SalesTransactionPage = () => {
  const { settings: shopSettings } = useShopSettings();
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [historyOrder, setHistoryOrder] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await orderService.getOrders({ from, to });
      setOrders(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load sales transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const summaries = orders.map(getTransactionSummary);

  const exportRows = summaries.map((summary, index) => ({
    sl: index + 1,
    date: formatDate(summary.date),
    orderNumber: summary.orderNumber,
    finalOrderValue: Number(summary.finalOrderValue || 0).toFixed(2),
    cashIn: summary.cashIn ? Number(summary.cashIn).toFixed(2) : "",
    cashOut: summary.cashOut ? Number(summary.cashOut).toFixed(2) : "",
    cardIn: summary.cardIn ? Number(summary.cardIn).toFixed(2) : "",
    cardOut: summary.cardOut ? Number(summary.cardOut).toFixed(2) : "",
    qrIn: summary.qrIn ? Number(summary.qrIn).toFixed(2) : "",
    qrOut: summary.qrOut ? Number(summary.qrOut).toFixed(2) : "",
    deliveryIn: summary.deliveryIn ? Number(summary.deliveryIn).toFixed(2) : "",
    deliveryOut: summary.deliveryOut ? Number(summary.deliveryOut).toFixed(2) : "",
    editCount: summary.editCount || "",
    status: summary.status,
    serveTime: summary.serveTime
  }));

  const exportExcel = () => {
    if (!exportRows.length) {
      toast.error("No transaction data to export");
      return;
    }

    exportReportToExcel({
      fileName: `sales-transaction-${from}-to-${to}`,
      sheetName: "Sales Transactions",
      title: "Sales Transactions",
      columns: transactionColumns,
      rows: exportRows,
      shopProfile: shopSettings,
      summaryLines: [`Date Range: ${from} to ${to}`, `Transactions: ${orders.length}`]
    });
  };

  const exportPdf = async () => {
    if (!exportRows.length) {
      toast.error("No transaction data to export");
      return;
    }

    await exportReportToPdf({
      title: "Sales Transactions",
      fileName: `sales-transaction-${from}-to-${to}`,
      columns: transactionColumns,
      rows: exportRows,
      summaryLines: [`Date Range: ${from} to ${to}`, `Transactions: ${orders.length}`],
      shopProfile: shopSettings
    });
  };

  const cashInTotal = summaries.reduce((sum, order) => sum + Number(order.cashIn || 0), 0);
  const cashOutTotal = summaries.reduce((sum, order) => sum + Number(order.cashOut || 0), 0);
  const cardInTotal = summaries.reduce((sum, order) => sum + Number(order.cardIn || 0), 0);
  const cardOutTotal = summaries.reduce((sum, order) => sum + Number(order.cardOut || 0), 0);
  const qrInTotal = summaries.reduce((sum, order) => sum + Number(order.qrIn || 0), 0);
  const qrOutTotal = summaries.reduce((sum, order) => sum + Number(order.qrOut || 0), 0);
  const deliveryInTotal = summaries.reduce((sum, order) => sum + Number(order.deliveryIn || 0), 0);
  const deliveryOutTotal = summaries.reduce((sum, order) => sum + Number(order.deliveryOut || 0), 0);
  const balanceTotal = cashInTotal - cashOutTotal + cardInTotal - cardOutTotal + qrInTotal - qrOutTotal + deliveryInTotal - deliveryOutTotal;

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-5">
        <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
              <div className={heroBadgeClass}>
                <CalendarRange size={14} />
                Sales Transactions
              </div>
              <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Sales Transactions</h1>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-500">Review transaction-wise order history within a selected date range.</p>
            </div>

              <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-4 py-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Date Range</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-800">{from} to {to}</p>
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
                <button type="button" onClick={loadOrders} className="btn-primary h-11 rounded-full px-6 shadow-sm">
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

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className={`${statCardClass} border border-[#d9e0eb] bg-[#e8eef7]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cash Flow</p>
                <p className="mt-2 text-lg font-bold text-slate-900">Cash In {currency(cashInTotal)}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">Cash Out {currency(cashOutTotal)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <WalletCards size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#dce7df] bg-[#eef4ef]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Card Flow</p>
                <p className="mt-2 text-lg font-bold text-slate-900">Card In {currency(cardInTotal)}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">Card Out {currency(cardOutTotal)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                <CreditCard size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#eadff0] bg-[#f3edf7]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">QR Flow</p>
                <p className="mt-2 text-lg font-bold text-slate-900">QR In {currency(qrInTotal)}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">QR Out {currency(qrOutTotal)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-violet-600">
                <QrCode size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#f0e2d6] bg-[#fff4ec]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Delivery Flow</p>
                <p className="mt-2 text-lg font-bold text-slate-900">In {currency(deliveryInTotal)}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">Out {currency(deliveryOutTotal)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-orange-500">
                <Bike size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} bg-[#171d31] text-white`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Balance</p>
                <p className="mt-2 text-2xl font-bold">{currency(balanceTotal)}</p>
                <p className="mt-1 text-xs text-slate-300">{orders.length} transactions</p>
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
            <h2 className="text-lg font-bold text-slate-900">Transaction List</h2>
            <p className="text-xs text-slate-500">Every order within the selected date range is listed below in transaction format.</p>
          </div>
          <p className="text-xs font-medium text-slate-400">{from} to {to}</p>
        </div>

        <div className="space-y-3 md:hidden">
          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No transactions found for the selected date range.
            </div>
          ) : (
            orders.map((order, index) => {
              const summary = getTransactionSummary(order);
              return (
                <div key={order.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{summary.orderNumber}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(summary.date)}</p>
                    </div>
                    <p className="text-sm font-bold text-brand-600">{currency(summary.finalOrderValue)}</p>
                  </div>
                  {summary.editCount > 0 && (
                    <button type="button" onClick={() => setHistoryOrder(order)} className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Edited {summary.editCount} time{summary.editCount > 1 ? "s" : ""}
                    </button>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">SL</p>
                      <p className="mt-1 text-slate-700">{index + 1}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Serve Time</p>
                      <p className="mt-1 text-slate-700">{summary.serveTime}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Cash</p>
                      <p className="mt-1 text-slate-700">{summary.cashIn ? currency(summary.cashIn) : "-"} / {summary.cashOut ? currency(summary.cashOut) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Card</p>
                      <p className="mt-1 text-slate-700">{summary.cardIn ? currency(summary.cardIn) : "-"} / {summary.cardOut ? currency(summary.cardOut) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">QR</p>
                      <p className="mt-1 text-slate-700">{summary.qrIn ? currency(summary.qrIn) : "-"} / {summary.qrOut ? currency(summary.qrOut) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Delivery</p>
                      <p className="mt-1 text-slate-700">{summary.deliveryIn ? currency(summary.deliveryIn) : "-"} / {summary.deliveryOut ? currency(summary.deliveryOut) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Status</p>
                      <p className="mt-1 text-slate-700">{summary.status}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedOrder(order)} className="btn-secondary mt-4 w-full justify-center gap-2 text-sm">
                    <Eye size={16} />
                    View
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">SL</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Order Number</th>
                <th className="pb-3 pr-4">Final Order Value</th>
                <th className="pb-3 pr-4">Cash In</th>
                <th className="pb-3 pr-4">Cash Out</th>
                <th className="pb-3 pr-4">Card In</th>
                <th className="pb-3 pr-4">Card Out</th>
                <th className="pb-3 pr-4">QR In</th>
                <th className="pb-3 pr-4">QR Out</th>
                <th className="pb-3 pr-4">Delivery In</th>
                <th className="pb-3 pr-4">Delivery Out</th>
                <th className="pb-3 pr-4">Edit Count</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Serve Time</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="16" className="py-10 text-center text-sm text-slate-500">
                    No transactions found for the selected date range.
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const summary = getTransactionSummary(order);

                  return (
                    <tr key={order.id} className="border-b border-slate-100 align-middle">
                      <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                      <td className="py-3 pr-4 text-slate-600">{formatDate(summary.date)}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{summary.orderNumber}</p>
                        {summary.editCount > 0 && (
                          <button type="button" onClick={() => setHistoryOrder(order)} className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            Edited {summary.editCount} time{summary.editCount > 1 ? "s" : ""}
                          </button>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-bold text-brand-600">{currency(summary.finalOrderValue)}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.cashIn ? currency(summary.cashIn) : "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.cashOut ? currency(summary.cashOut) : "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.cardIn ? currency(summary.cardIn) : "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.cardOut ? currency(summary.cardOut) : "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.qrIn ? currency(summary.qrIn) : "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.qrOut ? currency(summary.qrOut) : "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.deliveryIn ? currency(summary.deliveryIn) : "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.deliveryOut ? currency(summary.deliveryOut) : "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.editCount || "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.status}</td>
                      <td className="py-3 pr-4 text-slate-700">{summary.serveTime}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setSelectedOrder(order)} className="btn-secondary h-10 gap-2 px-3 text-sm">
                          <Eye size={16} />
                          View
                        </button>
                      </div>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <OrderDetailModal
        open={Boolean(selectedOrder)}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        canEdit={false}
        canServe={false}
        canVoid={false}
      />
      <EditHistoryModal open={Boolean(historyOrder)} order={historyOrder} onClose={() => setHistoryOrder(null)} />
    </div>
  );
};

export default SalesTransactionPage;
