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

const getUnitPrice = (item) =>
  Number(item.price || 0) +
  (item.customPriced ? 0 : getSelectedAlternativeAdjustments(item).reduce((sum, entry) => sum + entry.priceAdjustment, 0));
const getDisplayRegularPrice = (item) => Number(item.regularPrice ?? item.promotionalPrice ?? item.price);

const CartPanelNext = ({
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
  allowPriceEdit = false,
  onUpdatePrice,
  mobileModal = false,
  showCustomerInfoSection = true
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
  const paymentMethodGridClass =
    paymentMethods.length <= 2 ? "grid-cols-2" : paymentMethods.length === 4 ? "grid-cols-4" : paymentMethods.length >= 5 ? "grid-cols-5" : "grid-cols-3";

  useEffect(() => {
    if (!hasAppliedPromo && !promoCode.trim()) {
      setPromoExpanded(false);
    }
  }, [hasAppliedPromo, promoCode]);

  return (
    <div
      className={`glass-card flex flex-col gap-3 overflow-hidden p-4 ${
        mobileModal ? "min-h-0" : "min-h-[calc(100vh-7rem)]"
      } xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:min-h-0 xl:overflow-y-auto`}
    >
      <div className="space-y-2 border-b border-slate-100 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[1.65rem] font-bold leading-tight text-slate-900">{title}</h2>
            <p className="mt-1 max-w-[28rem] text-[12px] leading-5 text-slate-500">{description}</p>
          </div>
          {cart.length > 0 ? (
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {cart.length} item{cart.length === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>

        {showCustomerInfoSection ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onOpenCustomerInfo} className="btn-secondary gap-2 px-3 py-2 text-[13px]">
              <UserRound size={16} />
              {text.customerInfo}
            </button>
            {hasCustomerInfo ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
                <CheckCircle2 size={14} />
                {customerInfo?.customerName || customerInfo?.customerPhone || "Info saved"}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-h-[240px] shrink-0 xl:min-h-[310px]">
        <div className="flex h-full min-h-[240px] flex-col rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f8fafc_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] xl:min-h-[310px]">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[220px] items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-white px-6 text-center text-sm text-slate-500">
                {text.emptyCart}
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const selectedAdjustments = getSelectedAlternativeAdjustments(item);
                  const unitPrice = getUnitPrice(item);
                  const lineAdjustment = selectedAdjustments.reduce((sum, entry) => sum + entry.priceAdjustment, 0);
                  const displayRegularPrice = getDisplayRegularPrice(item);
                  const unitPriceParts = currencyParts(unitPrice);
                  const regularPriceParts = currencyParts(displayRegularPrice);
                  const lineTotalParts = currencyParts(item.quantity * unitPrice);

                  return (
                    <div key={item.id} className="rounded-[1.7rem] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex items-start gap-3">
                        <img src={imageUrl(item.image)} alt={item.name} className="h-20 w-20 rounded-[1.3rem] object-cover shadow-sm" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[1.02rem] font-bold leading-tight text-slate-900">{item.name}</p>
                              <div className="mt-1 flex flex-col gap-0.5">
                                {!allowPriceEdit && displayRegularPrice > unitPrice ? (
                                  <span className="text-[12px] text-slate-400 line-through">
                                    {regularPriceParts.khr} <span className="text-[11px] text-slate-300">({regularPriceParts.usd})</span> each
                                  </span>
                                ) : null}
                                <span className="text-[14px] font-semibold text-slate-600">{unitPriceParts.khr} each</span>
                                <span className="text-[12px] text-slate-400">{unitPriceParts.usd}</span>
                              </div>
                              {allowPriceEdit ? (
                                <div className="mt-3 max-w-[230px]">
                                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Unit Price (KHR)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price}
                                    onFocus={(event) => event.target.select()}
                                    onChange={(event) => onUpdatePrice?.(item.id, event.target.value)}
                                    className="input h-11 rounded-2xl py-2 text-[14px] font-semibold"
                                  />
                                  <p className="mt-1 text-[11px] text-slate-400">{unitPriceParts.usd}</p>
                                </div>
                              ) : null}
                            </div>

                            <button type="button" onClick={() => onRemove(item.id)} className="rounded-2xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500">
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-1">
                              <button type="button" onClick={() => onDecrease(item.id)} className="btn-secondary h-11 w-11 rounded-[1rem] p-0">
                                <Minus size={17} />
                              </button>
                              <span className="min-w-[44px] text-center text-[1.05rem] font-bold text-slate-900">{item.quantity}</span>
                              <button type="button" onClick={() => onIncrease(item.id)} className="btn-secondary h-11 w-11 rounded-[1rem] p-0">
                                <Plus size={17} />
                              </button>
                            </div>

                            <div className="rounded-[1.2rem] bg-slate-900 px-4 py-3 text-right text-white shadow-[0_12px_20px_rgba(15,23,42,0.16)]">
                              <p className="text-[1.02rem] font-bold">{lineTotalParts.khr}</p>
                              <p className="text-[11px] text-slate-300">{lineTotalParts.usd}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedAdjustments.length > 0 ? (
                        <div className="mt-3 rounded-[1.3rem] border border-amber-200 bg-amber-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">{text.priceChangeInfo}</p>
                          <div className="mt-2 space-y-1.5 text-[13px] text-slate-700">
                            {selectedAdjustments.map((entry) => (
                              <div key={`${entry.sourceProductId}-${entry.selectedProductId}`} className="flex items-start justify-between gap-3">
                                <span className="min-w-0">
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
                      ) : null}

                      {["combo", "combo_type"].includes(item.productType) &&
                        allowItemCustomization &&
                        (item.comboItems || []).some((comboItem) => comboItem.changeable && (comboItem.alternativeProducts || []).length > 0) ? (
                          <div className="mt-3 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-3">
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
                                            !selectedAlternative ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600"
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
                                                : "border-slate-200 bg-white text-slate-600"
                                            }`}
                                          >
                                            {alternativeProduct.name} - {productTypeLabel(alternativeProduct.productType)}
                                            {Number(alternativeProduct.priceAdjustment || 0) !== 0 ? (
                                              <span className="ml-2">
                                                ({Number(alternativeProduct.priceAdjustment || 0) > 0 ? "+" : "-"}
                                                {currency(Math.abs(Number(alternativeProduct.priceAdjustment || 0)))})
                                              </span>
                                            ) : null}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2.5 border-t border-slate-100 bg-white pt-3">
        {showPromoSection ? (
          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-3">
            {hasAppliedPromo ? (
              <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{text.promoApplied}</p>
                  <p className="mt-1 truncate text-[15px] font-bold text-slate-900">
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
                  <div className="rounded-[1.2rem] border border-slate-200 bg-white px-3 py-3">
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
        ) : null}

        {showPaymentSection ? (
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-slate-600">{text.paymentMethod}</label>
            <div className={`grid ${paymentMethodGridClass} gap-2 rounded-[1.2rem] p-1 transition ${showPaymentMethodError ? "border border-rose-200 bg-rose-50" : ""}`}>
              {paymentMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onPaymentChange(method)}
                  className={`rounded-2xl px-2 py-2.5 text-[12px] font-semibold transition ${
                    paymentMethod === method ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {formatPaymentMethodLabel(method)}
                </button>
              ))}
            </div>
            {showPaymentMethodError ? <p className="mt-2 text-[12px] font-medium text-rose-500">Select a payment method below to place the order.</p> : null}
          </div>
        ) : null}

        <div className="rounded-[1.8rem] bg-slate-900 p-4 text-white shadow-[0_18px_34px_rgba(15,23,42,0.18)]">
          {isEditing ? (
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
          ) : null}

          <div className="flex items-center justify-between text-[13px] text-slate-300">
            <span>{text.subtotal}</span>
            <span>{currency(subtotal)}</span>
          </div>
          {promoDiscount > 0 ? (
            <div className="mt-2 flex items-center justify-between text-[13px] text-emerald-300">
              <span>{text.promoDiscount}</span>
              <span>-{currency(promoDiscount)}</span>
            </div>
          ) : null}
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-[1.15rem] font-bold">{text.total}</span>
            <span className="text-[1.9rem] font-bold leading-none">{currency(total)}</span>
          </div>
        </div>

        {showPaymentSection && needsAdjustment ? (
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-slate-600">{adjustmentLabel}</label>
            <div className="grid grid-cols-5 gap-2">
                {["cash", "card", "qr", "grab", "foodpanda", "e_gates", "wownow"].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onAdjustmentMethodChange?.(method)}
                  className={`rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition ${
                    adjustmentMethod === method ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {formatPaymentMethodLabel(method)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2 pt-1">
          <button type="button" onClick={onCheckout} disabled={cart.length === 0 || checkoutDisabled} className="btn-primary w-full py-3">
            {checkoutLabel}
          </button>
          {cart.length > 0 ? (
            <button type="button" onClick={onClearQueue} className="btn-secondary w-full py-2 text-[13px]">
              {text.clearQueue}
            </button>
          ) : null}
          {isEditing && onCancelEdit ? (
            <button type="button" onClick={onCancelEdit} className="btn-secondary w-full py-2 text-[13px]">
              {text.cancelEdit}
            </button>
          ) : null}
        </div>
      </div>

      {latestOrder ? (
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
            {showLatestPrint && !isQueuedLatestOrder ? (
              <button type="button" onClick={onPrintLatest} className="btn-secondary gap-2">
                <Printer size={16} />
                Print
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CartPanelNext;
