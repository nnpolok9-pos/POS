import { CalendarRange, FilePenLine } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import EditHistoryModal from "../components/EditHistoryModal";
import ReportDatePicker from "../components/ReportDatePicker";
import { orderService } from "../services/orderService";
import { getLocalDateInputValue } from "../utils/date";
import { currency, formatDate } from "../utils/format";

const todayString = () => getLocalDateInputValue();

const adjustmentTypeLabel = {
  add: "Added",
  refund: "Refunded",
  void: "Voided",
  none: "No Change"
};

const EditedListPage = () => {
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [appliedDateRange, setAppliedDateRange] = useState(null);

  const loadEditedOrders = async (params = {}) => {
    setLoading(true);
    try {
      const data = await orderService.getEditedOrders(params);
      setOrders(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load edited orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEditedOrders({});
  }, []);

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-6">
      <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
                  <FilePenLine size={14} />
                  Edited Orders
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Edited List</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">Track extra collection, refunds, and every recorded order edit.</p>
              </div>

              <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-4 py-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Date Range</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-800">
                  {appliedDateRange ? `${appliedDateRange.from} to ${appliedDateRange.to}` : "All dates"}
                </p>
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

              <button
                type="button"
                onClick={() => {
                  const nextRange = { from, to };
                  setAppliedDateRange(nextRange);
                  loadEditedOrders(nextRange);
                }}
                className="btn-primary h-11 rounded-full px-6 shadow-sm"
              >
                {loading ? "Loading..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edited Order Records</h2>
            <p className="text-xs text-slate-500">Review each edit entry with old/new totals and settlement method.</p>
          </div>
          <p className="text-xs font-medium text-slate-400">
            {orders.length} edited orders
            {appliedDateRange ? ` • ${appliedDateRange.from} to ${appliedDateRange.to}` : " • All dates"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">SL</th>
                <th className="pb-3 pr-4">Order No</th>
                <th className="pb-3 pr-4">Edited At</th>
                <th className="pb-3 pr-4">Actual Sale Amount</th>
                <th className="pb-3 pr-4">Old Sale Amount</th>
                <th className="pb-3 pr-4">Adjustment</th>
                <th className="pb-3 pr-4">Method</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-sm text-slate-500">
                    No edited orders found for the selected date range.
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const latestEdit = order.editHistory?.[order.editHistory.length - 1];

                  return (
                    <tr key={order.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-slate-700">{index + 1}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{order.orderId}</p>
                        <p className="text-xs text-slate-500">{latestEdit?.editedBy?.name || "-"}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{latestEdit ? formatDate(latestEdit.editedAt) : "-"}</td>
                      <td className="py-3 pr-4 font-bold text-brand-600">{currency(latestEdit?.newTotal ?? order.total)}</td>
                      <td className="py-3 pr-4 text-slate-600">{currency(latestEdit?.oldTotal ?? order.total)}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {adjustmentTypeLabel[latestEdit?.adjustmentType] || "No Change"} {currency(latestEdit?.adjustmentAmount || 0)}
                      </td>
                      <td className="py-3 pr-4 capitalize text-slate-600">{latestEdit?.adjustmentMethod || "-"}</td>
                      <td className="py-3">
                        <button type="button" onClick={() => setSelectedOrder(order)} className="btn-secondary h-10 gap-2 px-3 text-sm">
                          <CalendarRange size={16} />
                          View History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EditHistoryModal open={Boolean(selectedOrder)} order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
};

export default EditedListPage;
