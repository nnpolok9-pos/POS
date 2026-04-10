import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { imageUrl } from "../utils/format";

const stockUnitLabel = (unit) =>
  ({
    pieces: "Piece",
    gram: "Gram",
    teaspoon: "Tea Spoon"
  })[unit] || "Piece";

const ServeOrderModal = ({ open, order, sauces = [], onClose, onConfirm, loading }) => {
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialQuantities = {};
    sauces.forEach((sauce) => {
      initialQuantities[sauce.id] = "";
    });
    setQuantities(initialQuantities);
  }, [open, sauces]);

  const sauceItems = useMemo(
    () =>
      sauces
        .map((sauce) => ({
          product: sauce.id,
          quantity: Number(quantities[sauce.id] || 0)
        }))
        .filter((item) => item.quantity > 0),
    [quantities, sauces]
  );

  const updateQuantity = (sauceId, value, max) => {
    const numericValue = Math.max(0, Math.min(max, Number(value) || 0));
    setQuantities((current) => ({
      ...current,
      [sauceId]: numericValue === 0 ? "" : String(numericValue)
    }));
  };

  const bumpQuantity = (sauceId, amount, max) => {
    const currentValue = Number(quantities[sauceId] || 0);
    const nextValue = Math.max(0, Math.min(max, currentValue + amount));
    setQuantities((current) => ({
      ...current,
      [sauceId]: nextValue === 0 ? "" : String(nextValue)
    }));
  };

  if (!open || !order) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] p-5 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Serve Order</h3>
            <p className="text-sm text-slate-500">
              {order.orderId} - Select how much sauce is being provided with this order.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>

        <div className="overflow-y-auto pr-1">
          {sauces.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No products found in the Sauce product type. You can still mark the order as served.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {sauces.map((sauce) => (
                <div key={sauce.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="grid gap-4 md:grid-cols-[96px_minmax(0,1fr)]">
                    <div className="relative overflow-hidden rounded-3xl bg-slate-100">
                      <img src={imageUrl(sauce.image)} alt={sauce.name} className="h-24 w-full object-cover md:h-full" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{sauce.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Stock: {sauce.stock} {stockUnitLabel(sauce.stockUnit)}
                          </p>
                        </div>
                        <div className="min-w-[120px] rounded-2xl bg-emerald-50 px-3 py-2 text-right text-xs text-emerald-800">
                          <p className="uppercase tracking-[0.16em] text-emerald-600">Remaining</p>
                          <p className="mt-1 font-bold">
                            {Math.max(sauce.stock - Number(quantities[sauce.id] || 0), 0)} {stockUnitLabel(sauce.stockUnit)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                        <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Provide</span>
                      <input
                        type="number"
                        min="0"
                        max={sauce.stock}
                        step="1"
                        value={quantities[sauce.id] ?? ""}
                        onChange={(event) => updateQuantity(sauce.id, event.target.value, sauce.stock)}
                        className="input"
                      />
                        </label>

                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            {[1, 5, 10].map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                onClick={() => bumpQuantity(sauce.id, amount, sauce.stock)}
                                className="btn-secondary gap-1 px-2"
                              >
                                <Plus size={14} />
                                {amount}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {[0, 1, 2, 3].map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                onClick={() => updateQuantity(sauce.id, amount, sauce.stock)}
                                className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                                  Number(quantities[sauce.id] || 0) === amount
                                    ? "border-brand-300 bg-brand-50 text-brand-700"
                                    : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {amount}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Sauce items selected: <span className="font-semibold text-slate-900">{sauceItems.length}</span>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(sauceItems)} disabled={loading} className="btn-primary">
            {loading ? "Serving..." : "Confirm Serve"}
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
};

export default ServeOrderModal;
