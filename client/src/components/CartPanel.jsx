import { CheckCircle2, Minus, Plus, Printer, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { currency, currencyParts, formatDate, formatPaymentMethodLabel, imageUrl } from "../utils/format";

const productTypeLabel = (type) =>
  ({
    raw: "A La Catre",
    raw_material: "Base",
    sauce: "Sauce",
    seasoning: "Seasoning",
    combo: "Combined",
    combo_type: "Combo"
  })[type] || "A La Catre";

const getSelectedAlternativeAdjustments = (item) =>
  (item.selectedAlternatives || [])
    .map((selectedAlternative) => {
      const sourceComboItem = (item.comboItems || []).find((comboItem) => comboItem.product === selectedAlternative.sourceProductId);
      const selectedProduct = (sourceComboItem?.alternativeProducts || []).find(
        (alternativeProduct) => alternativeProduct.id === selectedAlternative.selectedProductId
      );

      if (!sourceComboItem || !selectedProduct) {
        return null;
      }

      return {
        sourceProductId: sourceComboItem.product,
        sourceProductName: sourceComboItem.productName,
        selectedProductId: selectedProduct.id,
        selectedProductName: selectedProduct.name,
        priceAdjustment: Number(selectedProduct.priceAdjustment || selectedAlternative.priceAdjustment || 0)
      };
    })
    .filter(Boolean);

const getUnitPrice = (item) => item.price + getSelectedAlternativeAdjustments(item).reduce((sum, entry) => sum + entry.priceAdjustment, 0);
const getDisplayRegularPrice = (item) => Number(item.regularPrice ?? item.promotionalPrice ?? item.price);

const CartPanel = ({
  cart,
  paymentMethod,
  onPaymentChange,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
  latestOrder,
  onPrintLatest,
  title = "Current Order",
  description = "Fast selection with live stock validation",
  checkoutLabel = "Place Order",
  isEditing = false,
  onCancelEdit,
  onClearQueue,
  originalTotal = 0,
  adjustmentMethod,
  onAdjustmentMethodChange,
  onUpdateAlternatives,
  allowItemCustomization = true,
  showPaymentSection = true,
  latestOrderLabel = "Last Order",
  showLatestPrint = true,
  labels = {},
  checkoutDisabled = false,
  customerInfo,
  onOpenCustomerInfo,
  promoCode = "",
  onPromoCodeChange,
  onApplyPromo,
  onRemovePromo,
  appliedPromo,
  promoApplying = false,
  showPromoSection = true,
  showPaymentMethodError = false,
  promoLocked = false,
  promoLockedMessage = "",
  paymentMethods = ["cash", "card", "qr"],
  customerPhone = "",
  onCustomerPhoneChange,
  showPhoneNumberField = false,
  showCustomerPhoneError = false
}) => {
  const text = {
    emptyCart: "Add products from the grid to start an order.",
    priceChangeInfo: "Price Change Info",
    additionalPerCombo: "Additional per combo",
    deductionPerCombo: "Deduction per combo",
    allowedChangeItems: "Allowed Change Items",
    keepOriginal: "Keep original",
    paymentMethod: "Payment method",
    subtotal: "Subtotal",
    promoDiscount: "Promo Discount",
    total: "Total",
    clearQueue: "Clear Queue",
    cancelEdit: "Cancel Edit",
    showQueueNumber: "Show this queue number to the counter staff.",
    queueNumber: "Queue Number",
    orderSentToServing: "Order sent to food serving successfully.",
    orderStatus: "Order Status",
    promoCodeLabel: "Promo Code",
    promoCodePlaceholder: "Enter promo code",
    applyPromo: "Apply",
    removePromo: "Remove",
    promoApplied: "Promo applied",
    customerInfo: "Customer Info",
    customerPhone: "Phone Number",
    customerPhonePlaceholder: "Enter phone number",
    customerPhoneRequired: "Phone number is required before getting the queue number.",
    ...labels
  };

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * getUnitPrice(item), 0);
  const promoDiscount = Number(appliedPromo?.discount || 0);
  const total = Number((subtotal - promoDiscount).toFixed(2));
  const difference = Number((total - originalTotal).toFixed(2));
  const needsAdjustment = isEditing && difference !== 0;
  const adjustmentLabel = difference > 0 ? "Additional collection method" : "Refund method";
  const isQueuedLatestOrder = latestOrder?.status === "queued" || latestOrder?.source === "customer";
  const hasCustomerInfo = Boolean(customerInfo?.customerName || customerInfo?.customerPhone || customerInfo?.customerDateOfBirth);
  const hasAppliedPromo = Boolean(appliedPromo?.code);
  const [promoExpanded, setPromoExpanded] = useState(false);
  const paymentMethodGridClass = paymentMethods.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";

  useEffect(() => {
    if (!hasAppliedPromo && !promoCode.trim()) {
      setPromoExpanded(false);
    }
  }, [hasAppliedPromo, promoCode]);

  return (
    <div className="glass-card flex flex-col gap-3 p-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-[28px]">{title}</h2>
        <p className="text-[13px] text-slate-500">{description}</p>
        {showPaymentSection && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={onOpenCustomerInfo} className="btn-secondary gap-2 px-3 py-2 text-[13px]">
              <UserRound size={16} />
              Customer Info
            </button>
            {hasCustomerInfo && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
                <CheckCircle2 size={14} />
                {customerInfo?.customerName || customerInfo?.customerPhone || "Info saved"}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
        {cart.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{text.emptyCart}</div>
        ) : (
          cart.map((item, index) => {
            const selectedAdjustments = getSelectedAlternativeAdjustments(item);
            const unitPrice = getUnitPrice(item);
            const lineAdjustment = selectedAdjustments.reduce((sum, entry) => sum + entry.priceAdjustment, 0);
            const displayRegularPrice = getDisplayRegularPrice(item);
            const unitPriceParts = currencyParts(unitPrice);
            const regularPriceParts = currencyParts(displayRegularPrice);
            const lineTotalParts = currencyParts(item.quantity * unitPrice);

            return (
              <div
                key={item.id}
                className={`rounded-[1.7rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${
                  index !== cart.length - 1 ? "mb-1" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <img src={imageUrl(item.image)} alt={item.name} className="h-16 w-16 rounded-2xl object-cover" />
                    <div>
                      <p className="text-[15px] font-semibold text-slate-900">{item.name}</p>
                      <div className="mt-0.5 flex flex-col">
                        {displayRegularPrice > unitPrice && (
                          <span className="text-[11px] text-slate-400 line-through">
                            {regularPriceParts.khr} <span className="text-[10px] text-slate-300">({regularPriceParts.usd})</span> each
                          </span>
                        )}
                        <p className="text-[13px] font-medium text-slate-600">{unitPriceParts.khr} each</p>
                        <p className="text-[11px] text-slate-400">{unitPriceParts.usd}</p>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => onRemove(item.id)} className="text-slate-400 hover:text-rose-500">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onDecrease(item.id)} className="btn-secondary h-10 w-10 rounded-2xl p-0">
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-[15px] font-bold">{item.quantity}</span>
                    <button type="button" onClick={() => onIncrease(item.id)} disabled={item.quantity >= item.stock} className="btn-secondary h-10 w-10 rounded-2xl p-0">
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-slate-900">{lineTotalParts.khr}</p>
                    <p className="text-[11px] text-slate-400">{lineTotalParts.usd}</p>
                  </div>
                </div>

                {selectedAdjustments.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">{text.priceChangeInfo}</p>
                    <div className="mt-2 space-y-1 text-[13px] text-slate-700">
                      {selectedAdjustments.map((entry) => (
                        <div key={`${entry.sourceProductId}-${entry.selectedProductId}`} className="flex items-start justify-between gap-3">
                          <span>
                            {entry.sourceProductName} to {entry.selectedProductName}
                          </span>
                          <span className={entry.priceAdjustment >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                            {entry.priceAdjustment >= 0 ? "+" : "-"}
                            {currency(Math.abs(entry.priceAdjustment))}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[12px] font-semibold text-slate-600">
                      {lineAdjustment >= 0 ? text.additionalPerCombo : text.deductionPerCombo}: {lineAdjustment >= 0 ? "+" : "-"}
                      {currency(Math.abs(lineAdjustment))}
                    </p>
                  </div>
                )}

                {["combo", "combo_type"].includes(item.productType) &&
                  allowItemCustomization &&
                  (item.comboItems || []).some((comboItem) => comboItem.changeable && (comboItem.alternativeProducts || []).length > 0) && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{text.allowedChangeItems}</p>
                      <div className="mt-3 space-y-3">
                        {(item.comboItems || [])
                          .filter((comboItem) => comboItem.changeable && (comboItem.alternativeProducts || []).length > 0)
                          .map((comboItem) => {
                            const selectedAlternative = (item.selectedAlternatives || []).find(
                              (alternative) => alternative.sourceProductId === comboItem.product
                            );

                            return (
                              <div key={comboItem.product}>
                                <p className="text-[13px] font-semibold text-slate-800">
                                  {comboItem.productName} x {comboItem.quantity}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentAlternatives = (item.selectedAlternatives || []).filter(
                                        (alternative) => alternative.sourceProductId !== comboItem.product
                                      );
                                      onUpdateAlternatives?.(item.id, currentAlternatives);
                                    }}
                                    className={`rounded-2xl border px-3 py-2 text-[13px] font-semibold transition ${
                                      !selectedAlternative ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-slate-600"
                                    }`}
                                  >
                                    {text.keepOriginal}
                                  </button>
                                  {(comboItem.alternativeProducts || []).map((alternativeProduct) => (
                                    <button
                                      key={alternativeProduct.id}
                                      type="button"
                                      onClick={() => {
                                        const currentAlternatives = (item.selectedAlternatives || []).filter(
                                          (alternative) => alternative.sourceProductId !== comboItem.product
                                        );

                                        onUpdateAlternatives?.(item.id, [
                                          ...currentAlternatives,
                                          {
                                            sourceProductId: comboItem.product,
                                            selectedProductId: alternativeProduct.id,
                                            priceAdjustment: Number(alternativeProduct.priceAdjustment || 0)
                                          }
                                        ]);
                                      }}
                                      className={`rounded-2xl border px-3 py-2 text-[13px] font-semibold transition ${
                                        selectedAlternative?.selectedProductId === alternativeProduct.id
                                          ? "border-brand-300 bg-brand-50 text-brand-700"
                                          : "border-slate-200 bg-slate-50 text-slate-600"
                                      }`}
                                    >
                                      {alternativeProduct.name} - {productTypeLabel(alternativeProduct.productType)}
                                      {Number(alternativeProduct.priceAdjustment || 0) !== 0 && (
                                        <span className="ml-2">
                                          ({Number(alternativeProduct.priceAdjustment || 0) > 0 ? "+" : "-"}
                                          {currency(Math.abs(Number(alternativeProduct.priceAdjustment || 0)))})
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-4 border-t border-slate-100 bg-white pt-3 xl:mt-auto">
        {showPromoSection && (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
            {hasAppliedPromo ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{text.promoApplied}</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-900">
                    {appliedPromo.code} <span className="ml-2 font-semibold text-emerald-700">-{currency(appliedPromo.discount || 0)}</span>
                  </p>
                  {promoLocked && promoLockedMessage ? <p className="mt-1 text-[11px] font-medium text-emerald-800">{promoLockedMessage}</p> : null}
                </div>
                {promoLocked ? (
                  <div className="rounded-full border border-emerald-300 bg-white/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Locked
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onRemovePromo?.();
                      setPromoExpanded(true);
                    }}
                    className="btn-secondary gap-2 px-3 py-2 text-[12px] text-rose-600"
                  >
                    <X size={14} />
                    {text.removePromo}
                  </button>
                )}
              </div>
            ) : (
              <>
                {promoLocked ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[13px] font-semibold text-slate-700">{text.promoCodeLabel}</p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {promoLockedMessage || "Promo codes for customer queue orders can only be applied from the menu page."}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPromoExpanded((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="text-[13px] font-semibold text-slate-600">{text.promoCodeLabel}</span>
                    <span className="text-xs font-semibold text-slate-400">{promoExpanded ? "Hide" : "Show"}</span>
                  </button>
                )}

                {!promoLocked && promoExpanded ? (
              <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 uppercase"
                      value={promoCode}
                      onChange={(event) => onPromoCodeChange?.(event.target.value.toUpperCase())}
                      placeholder={text.promoCodePlaceholder}
                    />
                    <button
                      type="button"
                      onClick={onApplyPromo}
                      disabled={promoApplying || cart.length === 0 || !promoCode.trim()}
                      className="btn-secondary whitespace-nowrap px-4"
                    >
                      {promoApplying ? "Applying..." : text.applyPromo}
                    </button>
                  </div>
              </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {showPhoneNumberField && (
          <div className={`rounded-3xl border p-3 ${showCustomerPhoneError ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-slate-600">{text.customerPhone}</span>
              <input
                value={customerPhone}
                onChange={(event) => onCustomerPhoneChange?.(event.target.value)}
                className={`input ${showCustomerPhoneError ? "border-rose-200 bg-white focus:border-rose-300 focus:ring-rose-100" : ""}`}
                placeholder={text.customerPhonePlaceholder}
                inputMode="tel"
              />
            </label>
            {showCustomerPhoneError ? <p className="mt-2 text-[12px] font-medium text-rose-500">{text.customerPhoneRequired}</p> : null}
          </div>
        )}

        {showPaymentSection && (
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-slate-600">{text.paymentMethod}</label>
            <div className={`grid ${paymentMethodGridClass} gap-2 rounded-[1.2rem] p-1 transition ${showPaymentMethodError ? "border border-rose-200 bg-rose-50" : ""}`}>
              {paymentMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onPaymentChange(method)}
                  className={`rounded-2xl px-4 py-3 text-[13px] font-semibold capitalize transition ${
                    paymentMethod === method ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {formatPaymentMethodLabel(method)}
                </button>
              ))}
            </div>
            {showPaymentMethodError ? <p className="mt-2 text-[12px] font-medium text-rose-500">Select a payment method below to place the order.</p> : null}
          </div>
        )}

        <div className="rounded-3xl bg-slate-900 p-4 text-white">
          {isEditing && (
            <div className="mb-3 border-b border-white/10 pb-3 text-[13px] text-slate-300">
              <div className="flex items-center justify-between">
                <span>Previous Total</span>
                <span>{currency(originalTotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>{difference >= 0 ? "Difference" : "Refund Difference"}</span>
                <span className={difference === 0 ? "" : difference > 0 ? "text-emerald-300" : "text-amber-300"}>
                  {difference >= 0 ? "+" : "-"}
                  {currency(Math.abs(difference))}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-[13px] text-slate-300">
            <span>{text.subtotal}</span>
            <span>{currency(subtotal)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="mt-2 flex items-center justify-between text-[13px] text-emerald-300">
              <span>{text.promoDiscount}</span>
              <span>-{currency(promoDiscount)}</span>
            </div>
          )}
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-base font-bold sm:text-[18px]">{text.total}</span>
            <span className="text-xl font-bold sm:text-[22px]">{currency(total)}</span>
          </div>
        </div>

        {showPaymentSection && needsAdjustment && (
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-slate-600">{adjustmentLabel}</label>
            <div className="grid grid-cols-3 gap-2">
              {["cash", "card", "qr"].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onAdjustmentMethodChange?.(method)}
                  className={`rounded-2xl px-4 py-3 text-[13px] font-semibold capitalize transition ${
                    adjustmentMethod === method ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button type="button" onClick={onCheckout} disabled={cart.length === 0 || checkoutDisabled} className="btn-primary w-full">
            {checkoutLabel}
          </button>
          {cart.length > 0 && (
            <button type="button" onClick={onClearQueue} className="btn-secondary w-full py-2.5 text-[13px]">
              {text.clearQueue}
            </button>
          )}
          {isEditing && onCancelEdit && (
            <button type="button" onClick={onCancelEdit} className="btn-secondary w-full">
              {text.cancelEdit}
            </button>
          )}
        </div>
      </div>

      {latestOrder && (
        <div className="overflow-hidden rounded-[1.9rem] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] shadow-[0_16px_32px_rgba(16,185,129,0.15)]">
          <div className="border-b border-emerald-200/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{latestOrderLabel}</p>
            <p className="mt-1 text-[13px] text-emerald-800">{isQueuedLatestOrder ? text.showQueueNumber : text.orderSentToServing}</p>
          </div>
          <div className={`flex gap-3 p-4 ${isQueuedLatestOrder ? "flex-col items-center justify-center text-center" : "items-center justify-between"}`}>
            <div className={`min-w-0 ${isQueuedLatestOrder ? "w-full" : ""}`}>
              {isQueuedLatestOrder && latestOrder.queueNumber ? (
                <div className="mx-auto flex max-w-[260px] flex-col items-center rounded-[1.5rem] bg-white/80 px-6 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">{text.queueNumber}</p>
                  <p className="mt-2 text-[2.4rem] font-extrabold leading-none text-slate-950">#{latestOrder.queueNumber}</p>
                </div>
              ) : (
                <div className="rounded-[1.5rem] bg-white/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">{text.orderStatus}</p>
                  <p className="mt-1 text-[1.15rem] font-extrabold leading-none text-slate-950">
                    {latestOrder.status === "food_serving" ? "Food Serving" : latestOrder.status}
                  </p>
                </div>
              )}
              <div className={`mt-3 space-y-1 text-[13px] text-emerald-900 ${isQueuedLatestOrder ? "text-center" : ""}`}>
                <p className="font-semibold text-slate-900">{latestOrder.orderId}</p>
                <p>{formatDate(latestOrder.createdAt)}</p>
              </div>
            </div>
            {showLatestPrint && !isQueuedLatestOrder && (
              <button type="button" onClick={onPrintLatest} className="btn-secondary gap-2">
                <Printer size={16} />
                Print
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPanel;
