import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Bike, Clock3, CreditCard, QrCode, Wallet, X } from "lucide-react";
import { formatPaymentMethodLabel } from "../utils/format";
import foodpandaLogo from "../assets/partners/foodpanda.png";
import grabLogo from "../assets/partners/grab.png";
import eGatesLogo from "../assets/partners/e-gates.jpg";
import wownowLogo from "../assets/partners/wownow.png";

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
  e_gates: {
    label: "E-Gates",
    icon: Bike
  },
  wownow: {
    label: "WOWNOW",
    icon: Bike
  },
  due_on_serve: {
    label: "Due on Serve",
    icon: Clock3
  }
};

const partnerBadgeStyles = {
  foodpanda: "bg-[#ffd6dc] text-[#d4195f]",
  grab: "bg-[#d6f7e0] text-[#00a64a]",
  e_gates: "bg-[#dbeafe] text-[#1d4ed8]",
  wownow: "bg-[#f3e8ff] text-[#7c3aed]"
};

const partnerLogos = {
  foodpanda: foodpandaLogo,
  grab: grabLogo,
  e_gates: eGatesLogo,
  wownow: wownowLogo
};

const PaymentMethodPromptModal = ({
  open,
  onClose,
  onSelect,
  methods = ["cash", "card", "qr"],
  title = "Select Payment Method",
  description = "This order was not placed because no payment method was selected. Choose how payment will be handled, or mark it as due on serve.",
  requireReferenceForMethods = [],
  referenceLabel = "Partner Sales ID",
  referencePlaceholder = "Enter partner sales ID",
  initialMethod = "",
  initialReference = "",
  confirmLabel = "Confirm Selection"
}) => {
  const [selectedMethod, setSelectedMethod] = useState("");
  const [referenceValue, setReferenceValue] = useState(initialReference || "");

  useEffect(() => {
    if (!open) {
      return;
    }

    const allowAutoSelectedMethod =
      initialMethod && !requireReferenceForMethods.includes(initialMethod);

    setSelectedMethod(allowAutoSelectedMethod ? initialMethod : "");
    setReferenceValue(initialReference || "");
  }, [initialMethod, initialReference, methods, open, requireReferenceForMethods]);

  if (!open) {
    return null;
  }

  const selectedMethodRequiresReference = Boolean(selectedMethod) && requireReferenceForMethods.includes(selectedMethod);
  const selectedMeta = selectedMethod ? methodMeta[selectedMethod] : null;

  const handleMethodClick = (method) => {
    if (requireReferenceForMethods.includes(method)) {
      setSelectedMethod(method);
      return;
    }

    onSelect(method);
  };

  const handleConfirm = () => {
    if (!selectedMethod) {
      return;
    }

    onSelect(selectedMethod, { referenceValue: referenceValue.trim() });
  };

  const gridClass =
    methods.length <= 2
      ? "sm:grid-cols-2"
      : methods.length === 4
        ? "sm:grid-cols-4"
        : methods.length >= 5
          ? "sm:grid-cols-5"
          : "sm:grid-cols-3";

  return createPortal(
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/55 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card w-full max-w-md overflow-hidden shadow-2xl">
          <div className="border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
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
                const isPartnerMethod = requireReferenceForMethods.includes(key);
                const partnerLogo = partnerLogos[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleMethodClick(key)}
                    className={`rounded-3xl border px-4 py-5 text-center transition ${
                      selectedMethod === key
                        ? "border-brand-300 bg-brand-50"
                        : "border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50"
                    }`}
                  >
                    {isPartnerMethod ? (
                      <div className={`mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl p-0.5 shadow-sm ${partnerBadgeStyles[key] || "bg-white text-slate-700"}`}>
                        <img src={partnerLogo} alt={meta.label} className="h-full w-full rounded-[1rem] object-cover" />
                      </div>
                    ) : (
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                        <Icon size={20} />
                      </div>
                    )}
                    {!isPartnerMethod ? <p className="mt-3 text-sm font-semibold text-slate-900">{formatPaymentMethodLabel(key)}</p> : null}
                  </button>
                );
              })}
            </div>

            {selectedMethodRequiresReference ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {selectedMeta?.label || referenceLabel} Order ID
                </label>
                <input
                  type="text"
                  value={referenceValue}
                  onChange={(event) => setReferenceValue(event.target.value)}
                  placeholder={`${selectedMeta?.label || "Partner"} Order ID`}
                  className="input"
                />
                <p className="mt-2 text-xs text-slate-500">
                  The order will be placed only after a partner sales ID is entered.
                </p>
              </div>
            ) : null}

            <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-900">
              Select the collection method first so the order can be recorded under the correct payment or delivery partner account.
            </div>

            <div className="flex justify-end">
              {selectedMethodRequiresReference ? (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!referenceValue.trim()}
                  className="btn-primary mr-2"
                >
                  {confirmLabel}
                </button>
              ) : null}
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
