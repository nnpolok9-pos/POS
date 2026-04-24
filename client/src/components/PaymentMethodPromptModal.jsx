import { createPortal } from "react-dom";
import { Bike, Clock3, CreditCard, QrCode, Wallet, X } from "lucide-react";
import { formatPaymentMethodLabel } from "../utils/format";

const methodMeta = {
  cash: {
    label: "Cash",
    icon: Wallet
  },
  card: {
    label: "Card",
    icon: CreditCard
  },
  qr: {
    label: "QR",
    icon: QrCode
  },
  grab: {
    label: "Grab",
    icon: Bike
  },
  foodpanda: {
    label: "Foodpanda",
    icon: Bike
  },
  due_on_serve: {
    label: "Due on Serve",
    icon: Clock3
  }
};

const PaymentMethodPromptModal = ({ open, onClose, onSelect, methods = ["cash", "card", "qr"] }) => {
  if (!open) {
    return null;
  }

  const gridClass =
    methods.length <= 2 ? "sm:grid-cols-2" : methods.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";

  return createPortal(
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/55 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card w-full max-w-md overflow-hidden shadow-2xl">
          <div className="border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">Select Payment Method</h3>
                <p className="mt-1 text-sm text-slate-500">
                  This order was not placed because no payment method was selected. Choose how payment will be handled, or mark it as due on serve.
                </p>
              </div>
              <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 rounded-2xl p-0" aria-label="Close payment method modal">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className={`grid grid-cols-1 gap-3 ${gridClass}`}>
              {methods.map((key) => {
                const meta = methodMeta[key];
                if (!meta) {
                  return null;
                }
                const Icon = meta.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelect(key)}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-5 text-center transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                      <Icon size={20} />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{formatPaymentMethodLabel(key)}</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-900">
              Select the collection method first so the order can be recorded under the correct payment or delivery partner account.
            </div>

            <div className="flex justify-end">
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

export default PaymentMethodPromptModal;
