import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { currency } from "../utils/format";

const RefundMethodModal = ({ open, order, refundMethod, onRefundMethodChange, onClose, onConfirm, loading }) => {
  if (!open || !order) {
    return null;
  }

  const refundAmount = Number(order.total || 0);
  const collectionMethod = order.paymentMethod || "-";

  return createPortal(
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/55 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card w-full max-w-lg overflow-hidden shadow-2xl">
          <div className="border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
            <h3 className="font-display text-xl font-bold text-slate-900">Void Sale</h3>
                <p className="text-sm text-slate-500">{order.orderId}</p>
              </div>
              <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 rounded-2xl p-0" aria-label="Close refund method modal">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Refund Amount</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{currency(refundAmount)}</p>
              </div>
              <div className="rounded-3xl bg-amber-50 p-4">
                <p className="text-sm text-amber-700">Collected By</p>
                <p className="mt-1 text-2xl font-bold capitalize text-amber-950">{collectionMethod}</p>
                <p className="mt-1 text-xs text-amber-700">Original order payment method</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Refunded by</p>
              <div className="grid grid-cols-3 gap-2">
                {["cash", "card", "qr"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onRefundMethodChange(method)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold capitalize transition ${
                      refundMethod === method ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
              {refundAmount > 0 && !refundMethod ? (
                <p className="mt-2 text-xs font-semibold text-rose-600">Select the refund method before confirming the void sale.</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onConfirm} className="btn-primary" disabled={loading || (refundAmount > 0 && !refundMethod)}>
                {loading ? "Voiding..." : "Confirm Void"}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RefundMethodModal;
