import { CheckCircle2, ListOrdered, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { currency, formatDate, formatOrderSourceLabel, formatPaymentMethodLabel, imageUrl } from "../utils/format";
import foodpandaLogo from "../assets/partners/foodpanda.png";
import grabLogo from "../assets/partners/grab.png";
import eGatesLogo from "../assets/partners/e-gates.jpg";
import wownowLogo from "../assets/partners/wownow.png";

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

const partnerLogos = {
  grab: grabLogo,
  foodpanda: foodpandaLogo,
  e_gates: eGatesLogo,
  wownow: wownowLogo
};

const getCurrentVoidRefundMethod = (order) =>
  [...(order?.editHistory || [])]
    .reverse()
    .find((entry) => ["void_edit", "void"].includes(entry?.adjustmentType))?.adjustmentMethod || null;

const OrderDetailModal = ({ open, order, onClose, onPrint, onEdit, onVoid, onEditVoid, onServe, onViewItems, canEdit, canVoid, canEditVoid, canServe }) => {
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
  const sourceLogo = partnerLogos[order.source];

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
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-2xl font-bold text-slate-900">{formatOrderSourceLabel(order.source)}</p>
                  {sourceLogo ? (
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-sm">
                      <img src={sourceLogo} alt={formatOrderSourceLabel(order.source)} className="h-full w-full rounded-[1rem] object-cover" />
                    </div>
                  ) : null}
                </div>
              </div>
              {order.bookingDetails?.partnerSalesId ? (
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Partner Sales ID</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{order.bookingDetails.partnerSalesId}</p>
                </div>
              ) : null}
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
                  <div key={`${order.id}-${index}`} className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={imageUrl(item.image)}
                        alt={item.name}
                        className="h-14 w-14 shrink-0 rounded-2xl border border-slate-100 bg-white object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-normal break-words text-sm font-semibold leading-5 text-slate-900 sm:text-base">{item.name}</p>
                        <p className="text-sm text-slate-500">
                          {currency(item.price)} x {item.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 self-end text-right font-bold text-slate-900 sm:self-auto">{currency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {(order.items || []).some((item) => item.selectedAlternatives?.length) ? (
              <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <p className="font-semibold text-slate-900">Selected Change Items</p>
                <div className="mt-3 space-y-3">
                  {order.items
                    .filter((item) => item.selectedAlternatives?.length)
                    .map((item, index) => (
                      <div key={`${order.id}-alternatives-${index}`} className="rounded-2xl bg-white px-4 py-3">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-500">
                          {item.selectedAlternatives.map((alternative, alternativeIndex) => (
                            <p key={`${order.id}-alternative-${index}-${alternativeIndex}`}>
                              {alternative.sourceName} to {alternative.selectedName}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

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
              {onViewItems ? (
                <button type="button" onClick={onViewItems} className="btn-secondary gap-2">
                  <ListOrdered size={16} />
                  Item List
                </button>
              ) : null}
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
