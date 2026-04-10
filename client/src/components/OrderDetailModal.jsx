import { CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { currency, formatDate } from "../utils/format";

const statusStyles = {
  queued: "bg-violet-100 text-violet-700",
  food_serving: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  void: "bg-rose-100 text-rose-700"
};

const statusLabels = {
  queued: "Queued",
  food_serving: "Food Serving",
  completed: "Completed",
  void: "Void Sale"
};

const OrderDetailModal = ({ open, order, onClose, onPrint, onEdit, onVoid, onServe, canEdit, canVoid, canServe }) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !order) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card w-full max-w-2xl overflow-hidden shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">{order.orderId}</h3>
                {order.queueNumber ? <p className="mt-1 text-sm font-semibold text-violet-700">Queue #{order.queueNumber}</p> : null}
                <p className="text-sm text-slate-500">
                  {formatDate(order.createdAt)} by {order.staff?.name || "Staff"}
                </p>
                <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[order.status] || statusStyles.completed}`}>
                  {statusLabels[order.status] || "Completed"}
                </p>
              </div>
              <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 rounded-2xl p-0" aria-label="Close order details">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Sale Amount</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{currency(order.total)}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Payment</p>
                <p className="mt-1 text-2xl font-bold capitalize text-slate-900">{order.paymentMethod || "Unpaid Queue"}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Items</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{order.items.length}</p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-100">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="font-semibold text-slate-900">Order Details</p>
              </div>
              <div className="space-y-3 p-5">
                {order.items.map((item, index) => (
                  <div key={`${order.id}-${index}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        {currency(item.price)} x {item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900">{currency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {order.status === "void" && (
              <div className="mt-4 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800">
                <p>Current void amount: {currency(order.total)}</p>
                <p>Original sale amount: {currency(order.originalTotal ?? 0)}</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={onPrint} className="btn-secondary">
                Print Order
              </button>
              {canEdit && (
                <button type="button" onClick={onEdit} className="btn-secondary">
                  Edit Order
                </button>
              )}
              {canServe && order.status === "food_serving" && (
                <button type="button" onClick={onServe} className="btn-secondary gap-2 text-emerald-700">
                  <CheckCircle2 size={16} />
                  Served Order
                </button>
              )}
              {canVoid && order.status !== "void" && (
                <button type="button" onClick={onVoid} className="btn-secondary text-rose-600">
                  Void Sale
                </button>
              )}
              <button type="button" onClick={onClose} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OrderDetailModal;
