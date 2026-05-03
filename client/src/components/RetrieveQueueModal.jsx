import { CreditCard, Pencil, Phone, ShoppingBag, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { currency, formatDate, imageUrl } from "../utils/format";

const RetrieveQueueModal = ({ open, order, onClose, onPlaceOrder, onEditOrder, placingOrder = false }) => {
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
                <p className="text-sm text-slate-500">{formatDate(order.createdAt)}</p>
              </div>
              <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 rounded-2xl p-0" aria-label="Close retrieve preview">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Customer Phone</p>
                <div className="mt-2 flex items-center gap-2">
                  <Phone size={18} className="text-brand-500" />
                  <p className="text-xl font-bold text-slate-900">{order.bookingDetails?.customerPhone || "-"}</p>
                </div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Items</p>
                <div className="mt-2 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-brand-500" />
                  <p className="text-xl font-bold text-slate-900">{order.items.length}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-100">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="font-semibold text-slate-900">Queue Item List</p>
                <p className="mt-1 text-sm text-slate-500">Review the customer phone number and ordered items before retrieving this queue.</p>
              </div>
              <div className="space-y-3 p-5">
                {order.items.map((item, index) => (
                  <div
                    key={`${order.id}-retrieve-${index}`}
                    className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={imageUrl(item.image)}
                        alt={item.name}
                        className="h-16 w-16 shrink-0 rounded-2xl border border-slate-100 bg-white object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-normal break-words text-sm font-semibold leading-5 text-slate-900 sm:text-base">{item.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {currency(item.price)} x {item.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 self-end text-right font-bold text-slate-900 sm:self-auto">{currency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={onPlaceOrder} disabled={placingOrder} className="btn-primary gap-2">
                <CreditCard size={16} />
                {placingOrder ? "Placing..." : "Place Order"}
              </button>
              <button type="button" onClick={onEditOrder} className="btn-secondary gap-2">
                <Pencil size={16} />
                Edit Order
              </button>
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

export default RetrieveQueueModal;
