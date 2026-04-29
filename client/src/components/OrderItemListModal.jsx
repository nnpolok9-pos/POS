import { X } from "lucide-react";
import { createPortal } from "react-dom";

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
      quantity
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
        quantity
      });
    }
  };

  (order?.items || []).forEach((item) => {
    walkProduct(item.product, Number(item.quantity || 0), item.selectedAlternatives || []);
  });

  return [...itemMap.values()].sort((left, right) => left.name.localeCompare(right.name));
};
const OrderItemListModal = ({ open, order, productCatalog = [], onClose }) => {
  if (!open || !order) {
    return null;
  }

  const preparationItems = aggregatePreparationItems(order, productCatalog);

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
                  <p className="mt-1 text-sm text-slate-500">Only meal and combo saleable items are listed here for faster kitchen preparation.</p>
                </div>
                <p className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">{preparationItems.length} items</p>
              </div>

              {preparationItems.length ? (
                <div className="space-y-3">
                  {preparationItems.map((item, index) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                          {index + 1}
                        </span>
                        <p className="text-base font-semibold text-slate-900">{item.name}</p>
                      </div>
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  No preparation items found for this order.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OrderItemListModal;
