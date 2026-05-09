import { CheckCircle2, ShoppingBag, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { imageUrl } from "../utils/format";

const VISIBLE_PRODUCT_TYPES = new Set(["raw", "combo"]);
const CONTAINER_TYPES = new Set(["combo_type"]);
const HIDDEN_TYPES = new Set(["raw_material", "sauce", "seasoning"]);
const PREPARATION_CATEGORIES = new Set(["meal", "combo"]);

const aggregatePreparationItems = (order, productCatalog = []) => {
  const itemMap = new Map();
  const productMap = new Map(productCatalog.map((product) => [String(product.id || product._id), product]));

  const pushItem = (entry) => {
    const quantity = Number(entry?.quantity || 0);
    const name = String(entry?.name || "").trim();

    if (!name || quantity <= 0) {
      return;
    }

    const key = String(entry?.product || name).toLowerCase();
    const existing = itemMap.get(key);

    if (existing) {
      existing.quantity += quantity;
      return;
    }

    itemMap.set(key, {
      key,
      name,
      quantity,
      image: entry?.image || ""
    });
  };

  const resolveReplacementProductId = (selectedAlternatives = [], sourceProductId) =>
    selectedAlternatives.find((alternative) => String(alternative.sourceProduct) === String(sourceProductId))?.selectedProduct || null;

  const walkProduct = (productId, quantity, selectedAlternatives = []) => {
    const product = productMap.get(String(productId));
    if (!product || quantity <= 0) {
      return;
    }

    const normalizedType = String(product.productType || "").toLowerCase();
    const normalizedCategory = String(product.category || "").trim().toLowerCase();

    if (HIDDEN_TYPES.has(normalizedType)) {
      return;
    }

    if (CONTAINER_TYPES.has(normalizedType) || PREPARATION_CATEGORIES.has(normalizedCategory)) {
      (product.comboItems || []).forEach((comboItem) => {
        const sourceProductId = String(comboItem.product?.id || comboItem.product?._id || comboItem.product || "");
        const replacementProductId = comboItem.changeable ? resolveReplacementProductId(selectedAlternatives, sourceProductId) : null;
        const nextProductId = replacementProductId || sourceProductId;
        const nextQuantity = Number(comboItem.quantity || 0) * quantity;

        walkProduct(nextProductId, nextQuantity, selectedAlternatives);
      });
      return;
    }

    if (VISIBLE_PRODUCT_TYPES.has(normalizedType)) {
      pushItem({
        product: product.id || product._id,
        name: product.name,
        quantity,
        image: product.image || ""
      });
    }
  };

  (order?.items || []).forEach((item) => {
    walkProduct(item.product, Number(item.quantity || 0), item.selectedAlternatives || []);
  });

  return [...itemMap.values()].sort((left, right) => left.name.localeCompare(right.name));
};
const OrderItemListModal = ({ open, order, productCatalog = [], onClose, onServe, canServe = false, serving = false }) => {
  if (!open || !order) {
    return null;
  }

  const preparationItems = useMemo(() => aggregatePreparationItems(order, productCatalog), [order, productCatalog]);
  const [baggedKeys, setBaggedKeys] = useState(new Set());

  useEffect(() => {
    if (!open) {
      return;
    }

    setBaggedKeys(new Set());
  }, [open, order?.id, order?.orderId]);

  const allPrepared = preparationItems.length > 0 && preparationItems.every((item) => baggedKeys.has(item.key));

  const togglePrepared = (itemKey) => {
    setBaggedKeys((current) => {
      const next = new Set(current);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] overflow-y-auto bg-slate-950/55 p-4 sm:p-6" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center" onClick={(event) => event.stopPropagation()}>
        <div className="glass-card w-full max-w-2xl overflow-hidden shadow-2xl">
          <div className="border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Item List</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Kitchen preparation list for {order.orderId}
                </p>
              </div>
              <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 rounded-2xl p-0" aria-label="Close item list">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-8rem)] space-y-5 overflow-y-auto p-4 sm:p-6">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Preparation Items</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Tap each prepared item to mark it as added to the bag. Final saleable items are shown here, not raw/base ingredients.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">{preparationItems.length} items</p>
                  <p className="text-xs font-medium text-slate-500">
                    {baggedKeys.size}/{preparationItems.length} bagged
                  </p>
                </div>
              </div>

              {preparationItems.length ? (
                <div className="space-y-3">
                  {preparationItems.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => togglePrepared(item.key)}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                        baggedKeys.has(item.key)
                          ? "border-emerald-200 bg-emerald-50 shadow-sm"
                          : "border-transparent bg-white hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-bold ${
                            baggedKeys.has(item.key) ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
                          }`}
                        >
                          {baggedKeys.has(item.key) ? <CheckCircle2 size={16} /> : index + 1}
                        </span>
                        <img
                          src={imageUrl(item.image)}
                          alt={item.name}
                          className="h-12 w-12 rounded-2xl border border-slate-100 bg-slate-50 object-cover"
                        />
                        <div>
                          <p className="text-base font-semibold text-slate-900">{item.name}</p>
                          <p className={`mt-1 text-xs font-medium ${baggedKeys.has(item.key) ? "text-emerald-700" : "text-slate-500"}`}>
                            {baggedKeys.has(item.key) ? "Added to bag" : "Tap when ready"}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600">x{item.quantity}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  No preparation items found for this order.
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Close
              </button>
              {canServe && allPrepared ? (
                <button type="button" onClick={onServe} disabled={serving} className="btn-primary gap-2">
                  <ShoppingBag size={16} />
                  {serving ? "Serving..." : "Serve Order"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OrderItemListModal;
