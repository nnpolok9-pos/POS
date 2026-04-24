import { CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { currency, formatDate, formatOrderSourceLabel, formatPaymentMethodLabel } from "../utils/format";

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

const getCurrentVoidRefundMethod = (order) =>
  [...(order?.editHistory || [])]
    .reverse()
    .find((entry) => ["void_edit", "void"].includes(entry?.adjustmentType))?.adjustmentMethod || null;

const OrderDetailModal = ({ open, order, onClose, onPrint, onEdit, onVoid, onEditVoid, onServe, canEdit, canVoid, canEditVoid, canServe }) => {
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

  const isCustomerQueue = order.source === "customer" && order.status === "queued";
  const currentVoidRefundMethod = order.status === "void" ? getCurrentVoidRefundMethod(order) : null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card w-full max-w-2xl overflow-hidden shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">{order.orderId}</h3>
                {order.source === "customer" && order.queueNumber ? <p className="mt-1 text-sm font-semibold text-violet-700">Queue #{order.queueNumber}</p> : null}
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
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatPaymentMethodLabel(order.paymentMethod, "Unpaid Queue")}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Items</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{order.items.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Order From</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatOrderSourceLabel(order.source)}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-sm text-slate-500">Promo Used</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{order.promoCode || "No promo"}</p>
                {order.promoCode ? (
                  <p className="mt-1 text-sm font-medium text-emerald-700">
                    Discount {currency(order.promoDiscount || 0)}
                  </p>
                ) : null}
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

            {(order.bookingDetails?.customerName || order.bookingDetails?.customerPhone || order.bookingDetails?.customerDateOfBirth) && (
              <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <p className="font-semibold text-slate-900">Customer Info</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Name</p>
                    <p className="mt-1 text-sm text-slate-700">{order.bookingDetails?.customerName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Phone Number</p>
                    <p className="mt-1 text-sm text-slate-700">{order.bookingDetails?.customerPhone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Date of Birth</p>
                    <p className="mt-1 text-sm text-slate-700">{order.bookingDetails?.customerDateOfBirth || "-"}</p>
                  </div>
                </div>
              </div>
            )}

            {order.status === "void" && (
              <div className="mt-4 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800">
                <p>Current void amount: {currency(order.total)}</p>
                <p>Original sale amount: {currency(order.originalTotal ?? 0)}</p>
                <p>Refunded by: <span className="font-semibold">{formatPaymentMethodLabel(currentVoidRefundMethod, "not recorded")}</span></p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={onPrint} className="btn-secondary">
                Print Order
              </button>
              {canEdit && (
                <button type="button" onClick={onEdit} className="btn-secondary">
                  {isCustomerQueue ? "Retrieve Order" : "Edit Order"}
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
              {canEditVoid && order.status === "void" && (
                <button type="button" onClick={onEditVoid} className="btn-secondary text-fuchsia-700">
                  Edit Void
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
