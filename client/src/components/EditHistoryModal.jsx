import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { currency, formatDate } from "../utils/format";

const adjustmentLabel = {
  add: "Additional Collection",
  refund: "Refund",
  void: "Void Refund",
  none: "No Amount Change"
};

const adjustmentTone = {
  add: "bg-emerald-50 text-emerald-700 border-emerald-100",
  refund: "bg-amber-50 text-amber-700 border-amber-100",
  void: "bg-rose-50 text-rose-700 border-rose-100",
  none: "bg-slate-100 text-slate-600 border-slate-200"
};

const EditHistoryModal = ({ open, order, onClose }) => {
  if (!open || !order) {
    return null;
  }

  const history = order.editHistory || [];

  return createPortal(
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/50 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card w-full max-w-4xl overflow-hidden shadow-2xl">
          <div className="border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Edit History</h3>
                <p className="text-sm text-slate-500">{order.orderId} has {history.length} edit record(s).</p>
              </div>
              <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 rounded-2xl p-0">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto p-4 sm:p-6">
            {history.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No edit history found for this order.
              </div>
            ) : (
              history
                .slice()
                .reverse()
                .map((entry, index) => (
                  <div key={entry._id || index} className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div>
                          <div className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                            Edit #{history.length - index}
                          </div>
                          <p className="mt-3 text-lg font-bold text-slate-900">{entry.editedBy?.name || "User"}</p>
                          <p className="text-sm text-slate-500">{formatDate(entry.editedAt)}</p>
                        </div>

                        <div className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${adjustmentTone[entry.adjustmentType] || adjustmentTone.none}`}>
                          {adjustmentLabel[entry.adjustmentType] || "No Amount Change"}
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-3 xl:min-w-[520px]">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Previous Total</p>
                          <p className="mt-2 text-xl font-bold text-slate-900">{currency(entry.oldTotal)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Updated Total</p>
                          <p className="mt-2 text-xl font-bold text-slate-900">{currency(entry.newTotal)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Difference</p>
                          <p className="mt-2 text-xl font-bold">
                            {entry.adjustmentType === "refund" || entry.adjustmentType === "void" ? "-" : "+"}
                            {currency(entry.adjustmentAmount || 0)}
                          </p>
                          <p className="mt-1 text-xs text-slate-300 capitalize">{entry.adjustmentMethod || "No method"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Adjustment Type</p>
                        <p className="mt-2 font-semibold text-slate-900">{adjustmentLabel[entry.adjustmentType] || "No Amount Change"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Amount</p>
                        <p className="mt-2 font-semibold text-slate-900">{currency(entry.adjustmentAmount || 0)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Method</p>
                        <p className="mt-2 font-semibold capitalize text-slate-900">{entry.adjustmentMethod || "-"}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Changes</p>
                        <p className="text-xs text-slate-400">{(entry.changes || []).length} change(s)</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(entry.changes || []).map((change, changeIndex) => (
                          <span
                            key={`${entry._id || index}-${changeIndex}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
                          >
                            {change}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditHistoryModal;
