import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { currency, formatDate } from "../utils/format";
import { getTransactionSummary } from "../utils/transactionSummary";

const ReportOrdersModal = ({ open, date, orders, onClose }) => {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card w-full max-w-[95vw] overflow-hidden shadow-2xl">
          <div className="border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Orders on {date}</h3>
                <p className="text-sm text-slate-500">{orders.length} orders found for this date.</p>
              </div>
              <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 rounded-2xl p-0">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-6">
            {orders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No orders were found for this date.
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                      <th className="pb-3 pr-4">Edit Count</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Serve Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, index) => {
                      const summary = getTransactionSummary(order);

                      return (
                        <tr key={order.id} className="border-b border-slate-100">
                          <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                          <td className="py-3 pr-4 text-slate-600">{formatDate(summary.date)}</td>
                          <td className="py-3 pr-4 font-semibold text-slate-900">{summary.orderNumber}</td>
                          <td className="py-3 pr-4 font-bold text-brand-600">{currency(summary.finalOrderValue)}</td>
                          <td className="py-3 pr-4 text-slate-700">{summary.cashIn ? currency(summary.cashIn) : "-"}</td>
                          <td className="py-3 pr-4 text-slate-700">{summary.cashOut ? currency(summary.cashOut) : "-"}</td>
                          <td className="py-3 pr-4 text-slate-700">{summary.cardIn ? currency(summary.cardIn) : "-"}</td>
                          <td className="py-3 pr-4 text-slate-700">{summary.cardOut ? currency(summary.cardOut) : "-"}</td>
                          <td className="py-3 pr-4 text-slate-700">{summary.qrIn ? currency(summary.qrIn) : "-"}</td>
                          <td className="py-3 pr-4 text-slate-700">{summary.qrOut ? currency(summary.qrOut) : "-"}</td>
                          <td className="py-3 pr-4 text-slate-700">{summary.editCount || "-"}</td>
                          <td className="py-3 pr-4 text-slate-700">{summary.status}</td>
                          <td className="py-3 text-slate-700">{summary.serveTime}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReportOrdersModal;
