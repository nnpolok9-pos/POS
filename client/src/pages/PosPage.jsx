import { ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import CartPanelNext from "../components/CartPanelNext";
import CustomerInfoModal from "../components/CustomerInfoModal";
import PaymentMethodPromptModal from "../components/PaymentMethodPromptModal";
import ProductCard from "../components/ProductCard";
import { usePosSidebar } from "../context/PosSidebarContext";
import { useShopSettings } from "../context/ShopSettingsContext";
import { orderService } from "../services/orderService";
import { productService } from "../services/productService";
import { promoService } from "../services/promoService";
import { currency } from "../utils/format";
import { printReceipt } from "../utils/printReceipt";

const getItemAdjustmentTotal = (item) =>
  (item.selectedAlternatives || []).reduce((sum, selectedAlternative) => {
    const sourceComboItem = (item.comboItems || []).find((comboItem) => comboItem.product === selectedAlternative.sourceProductId);
    const selectedProduct = (sourceComboItem?.alternativeProducts || []).find(
      (alternativeProduct) => alternativeProduct.id === selectedAlternative.selectedProductId
    );

    return sum + Number(selectedProduct?.priceAdjustment || selectedAlternative.priceAdjustment || 0);
  }, 0);

const getCartTotal = (cart) =>
  cart.reduce((sum, item) => sum + item.quantity * (Number(item.price) + (item.customPriced ? 0 : getItemAdjustmentTotal(item))), 0);

const moveDrinksCategoryToEnd = (categories) => {
  const nonDrinks = [];
  const drinks = [];

  categories.forEach((category) => {
    if ((category.key || "").toLowerCase() === "drinks") {
      drinks.push(category);
      return;
    }

    nonDrinks.push(category);
  });

  return [...nonDrinks, ...drinks];
};

const buildCategoryOptions = (products) => [
  { key: "All", label: "All" },
  ...moveDrinksCategoryToEnd(
    Array.from(
      new Map(
        products
          .filter((product) => product.category)
          .map((product) => [product.category, { key: product.category, label: product.category }])
      ).values()
    )
  )
];

const normalizePromoValue = (value) => String(value || "").trim().toUpperCase();

const PARTNER_METHODS = ["foodpanda", "grab", "e_gates", "wownow"];
const isPartnerMethod = (value) => PARTNER_METHODS.includes(value);
const isPartnerSource = (value) => PARTNER_METHODS.includes(value);
const getDefaultProductPrice = (product, partnerMode = false) =>
  Number(partnerMode ? product.regularPrice ?? product.price ?? 0 : product.promotionalPrice ?? product.price ?? 0);

const buildOrderRequestItems = (cart) =>
  cart.map((item) => ({
    productId: item.id,
    quantity: item.quantity,
    unitPrice: item.customPriced ? Number(item.price || 0) : undefined,
    selectedAlternatives: (item.selectedAlternatives || []).map((selectedAlternative) => {
      const sourceComboItem = (item.comboItems || []).find((comboItem) => comboItem.product === selectedAlternative.sourceProductId);
      const selectedProduct = (sourceComboItem?.alternativeProducts || []).find(
        (alternativeProduct) => alternativeProduct.id === selectedAlternative.selectedProductId
      );

      return {
        sourceProductId: selectedAlternative.sourceProductId,
        selectedProductId: selectedAlternative.selectedProductId,
        priceAdjustment: Number(selectedProduct?.priceAdjustment || selectedAlternative.priceAdjustment || 0)
      };
    })
  }));

const PosPage = ({ mode = "counter" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setConfig: setPosSidebarConfig } = usePosSidebar();
  const { settings: shopSettings } = useShopSettings();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [latestOrder, setLatestOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [adjustmentMethod, setAdjustmentMethod] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [paymentMethodError, setPaymentMethodError] = useState(false);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    customerName: "",
    customerPhone: "",
    customerDateOfBirth: ""
  });
  const [customerInfoOpen, setCustomerInfoOpen] = useState(false);
  const previousEditDifferenceRef = useRef(0);
  const promoRequestIdRef = useRef(0);
  const isPartnerMode = mode === "partner";
  const allowItemCustomization = !editingOrder || ["queued", "food_serving", "quote_prepared"].includes(editingOrder.status);
  const partnerEditingOrder = isPartnerSource(editingOrder?.source);
  const partnerOrderContext = isPartnerMode || partnerEditingOrder;
  const promoSource = editingOrder?.source === "customer" ? "menu" : "pos";
  const promoLocked = Boolean(editingOrder?.source === "customer");
  const promoLockedMessage = promoLocked
    ? "Customer queue promos must stay from the menu order. Editing items will still re-check the original promo."
    : "";

  const resetPromoState = () => {
    promoRequestIdRef.current += 1;
    setPromoCode("");
    setAppliedPromo(null);
  };

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    setPaymentMethodError(false);
  };

  const handlePromoCodeChange = (value) => {
    if (promoLocked) {
      return;
    }

    const normalizedValue = normalizePromoValue(value);
    setPromoCode(normalizedValue);

    if (normalizePromoValue(appliedPromo?.code) !== normalizedValue) {
      setAppliedPromo(null);
    }
  };

  const previewPromo = async ({ nextCart = cart, nextPromoCode = promoCode, silent = false } = {}) => {
    const normalizedPromoCode = normalizePromoValue(nextPromoCode);
    const requestId = ++promoRequestIdRef.current;

    if (!normalizedPromoCode) {
      setAppliedPromo(null);
      return null;
    }

    if (!nextCart.length) {
      setAppliedPromo(null);
      return null;
    }

    if (!silent) {
      setPromoApplying(true);
    }

    try {
      const preview = await promoService.previewPromo({
        promoCode: normalizedPromoCode,
        source: promoSource,
        orderId: editingOrder?.id || null,
        items: buildOrderRequestItems(nextCart)
      });

      const normalizedPreview = {
        code: preview.code,
        discount: Number(preview.discount || 0),
        subtotal: Number(preview.subtotal || 0),
        total: Number(preview.total || 0),
        promo: preview.promo || null
      };

      if (requestId !== promoRequestIdRef.current) {
        return null;
      }

      setPromoCode(normalizedPromoCode);
      setAppliedPromo(normalizedPreview);

      if (!silent) {
        toast.success(`Promo ${normalizedPromoCode} applied`);
      }

      return normalizedPreview;
    } catch (error) {
      if (requestId !== promoRequestIdRef.current) {
        return null;
      }

      if (promoLocked) {
        setPromoCode("");
      }
      setAppliedPromo(null);
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to apply promo");
      }
      return null;
    } finally {
      if (!silent) {
        setPromoApplying(false);
      }
    }
  };

  const editingDifference = useMemo(() => {
    if (!editingOrder || editingOrder.status === "queued") {
      return 0;
    }

    return Number(((getCartTotal(cart) - Number(appliedPromo?.discount || 0)) - Number(editingOrder.total || 0)).toFixed(2));
  }, [appliedPromo?.discount, cart, editingOrder]);

  const editingHasCollectedPayment = ["cash", "card", "qr", ...PARTNER_METHODS].includes(editingOrder?.paymentMethod || "");
  const requiresAdjustmentMethod = Boolean(editingOrder && editingOrder.status !== "queued" && editingHasCollectedPayment && editingDifference !== 0);
  const paymentMethodOptions = useMemo(() => {
    if (partnerOrderContext) {
      return PARTNER_METHODS;
    }

    if (editingOrder?.status === "completed") {
      return ["cash", "card", "qr"];
    }

    if (editingOrder && editingOrder.paymentMethod && editingOrder.paymentMethod !== "due_on_serve" && editingOrder.status !== "queued") {
      return ["cash", "card", "qr"];
    }

    return ["cash", "card", "qr", "due_on_serve"];
  }, [editingOrder, partnerOrderContext]);
  const cartTotal = useMemo(() => Number((getCartTotal(cart) - Number(appliedPromo?.discount || 0)).toFixed(2)), [appliedPromo?.discount, cart]);

  useEffect(() => {
    const shouldLockBody = cartOpen;
    const previousOverflow = document.body.style.overflow;

    if (shouldLockBody) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [cartOpen]);

  useEffect(() => {
    const initPage = async () => {
      setLoading(true);

      try {
        const data = await productService.getProducts();
        setProducts(data);

        const editOrderId = searchParams.get("editOrder");
        if (!editOrderId) {
          setEditingOrder(null);
          setCart([]);
          setPaymentMethod("");
          setPaymentMethodError(false);
          setAdjustmentMethod("");
          resetPromoState();
          setCustomerInfo({
            customerName: "",
            customerPhone: "",
            customerDateOfBirth: ""
          });
          return;
        }

        const order = await orderService.getOrderById(editOrderId);

        if (isPartnerSource(order.source) && !isPartnerMode) {
          navigate(`/partner-pos?editOrder=${order.id}`, { replace: true, state: location.state });
          return;
        }

        if (!isPartnerSource(order.source) && order.source !== "customer" && isPartnerMode) {
          navigate(`/pos?editOrder=${order.id}`, { replace: true, state: location.state });
          return;
        }

        if (order.status === "void") {
          toast.error("Void sales cannot be edited");
          navigate("/orders", { replace: true });
          return;
        }

        setEditingOrder(order);
        setPaymentMethod(order.paymentMethod || "");
        setPaymentMethodError(false);
        setAdjustmentMethod("");
        setPromoCode(order.promoCode || "");
        setAppliedPromo(
          order.promoCode
            ? {
                code: order.promoCode,
                discount: Number(order.promoDiscount || 0),
                subtotal: Number(order.subtotal || 0),
                total: Number(order.total || 0),
                promo: order.promoSnapshot || null
              }
            : null
        );
        setCustomerInfo({
          customerName: order.bookingDetails?.customerName || "",
          customerPhone: order.bookingDetails?.customerPhone || "",
          customerDateOfBirth: order.bookingDetails?.customerDateOfBirth || ""
        });
        const existingOrderMap = new Map(order.items.map((item) => [String(item.product), item.quantity]));
        setCart(
          order.items.map((item) => {
            const product = data.find((entry) => entry.id === item.product);
            const baseStock = product?.stock ?? 0;
            const selectedAlternatives = item.selectedAlternatives || [];
            const basePrice = isPartnerSource(order.source)
              ? Number(item.price || 0)
              : Number(item.price) -
                selectedAlternatives.reduce((sum, selectedAlternative) => sum + Number(selectedAlternative.priceAdjustment || 0), 0);
            return {
              id: item.product,
              name: item.name,
              price: basePrice,
              regularPrice: product?.regularPrice ?? basePrice,
              promotionalPrice: product?.promotionalPrice ?? basePrice,
              customPriced: isPartnerSource(order.source),
              stock: baseStock + (existingOrderMap.get(String(item.product)) || 0),
              quantity: item.quantity,
              image: product?.image || "",
              productType: product?.productType || item.productType,
              comboItems: product?.comboItems || [],
              selectedAlternatives
            };
          })
        );
        setLatestOrder(null);
      } catch (error) {
        const cached = productService.getCachedProducts();
        if (!searchParams.get("editOrder")) {
          setProducts(cached);
        }
        toast.error(error.response?.data?.message || "Failed to load POS data");
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [isPartnerMode, location.state, navigate, searchParams]);

  useEffect(() => {
    if (!editingOrder || editingOrder.status === "queued") {
      previousEditDifferenceRef.current = 0;
      return;
    }

    if (editingDifference !== previousEditDifferenceRef.current) {
      setAdjustmentMethod("");
      previousEditDifferenceRef.current = editingDifference;
    }
  }, [editingDifference, editingOrder]);

  useEffect(() => {
    if (!appliedPromo || !promoCode.trim()) {
      return;
    }

    if (!cart.length) {
      setAppliedPromo(null);
      return;
    }

    let active = true;

    const refreshPromo = async () => {
      const preview = await previewPromo({ nextCart: cart, nextPromoCode: promoCode, silent: true });

      if (!active) {
        return;
      }

      if (!preview && appliedPromo) {
        toast.error("Promo code was removed because this cart no longer qualifies");
      }
    };

    refreshPromo();

    return () => {
      active = false;
    };
  }, [appliedPromo, cart, editingOrder?.id, promoCode]);

  const productsForSale = useMemo(() => {
    if (!editingOrder) {
      return products;
    }

    const existingOrderMap = new Map(editingOrder.items.map((item) => [String(item.product), item.quantity]));
    return products.map((product) => {
      const restoredQuantity = existingOrderMap.get(product.id) || 0;
      return {
        ...product,
        stock: product.stock + restoredQuantity
      };
    });
  }, [products, editingOrder]);

  const categoryOptions = useMemo(() => buildCategoryOptions(productsForSale), [productsForSale]);
  const totalCartItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartQuantityMap = useMemo(() => new Map(cart.map((item) => [item.id, item.quantity])), [cart]);

  const filteredProducts = useMemo(
    () =>
      productsForSale.filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    [productsForSale, search, selectedCategory]
  );
  const visibleProductCount = filteredProducts.length;

  useEffect(() => {
    setPosSidebarConfig({
      parentRoute: isPartnerMode ? "/partner-pos" : "/pos",
      categories: categoryOptions,
      selectedCategory,
      onSelectCategory: setSelectedCategory
    });

    return () => setPosSidebarConfig(null);
  }, [categoryOptions, isPartnerMode, selectedCategory, setPosSidebarConfig]);

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          price: getDefaultProductPrice(product, partnerOrderContext),
          regularPrice: product.regularPrice ?? product.price,
          promotionalPrice: product.promotionalPrice ?? product.price,
          customPriced: partnerOrderContext,
          stock: product.stock,
          quantity: 1,
          image: product.image || "",
          productType: product.productType,
          comboItems: product.comboItems || [],
          selectedAlternatives: []
        }
      ];
    });
  };

  const updateCartItem = (id, updater) => {
    setCart((current) => current.map((item) => (item.id === id ? updater(item) : item)).filter((item) => item.quantity > 0));
  };

  const increaseItem = (id) => {
    updateCartItem(id, (item) => ({ ...item, quantity: item.quantity + 1 }));
  };

  const updateItemAlternatives = (id, selectedAlternatives) => {
    setCart((current) => current.map((item) => (item.id === id ? { ...item, selectedAlternatives } : item)));
  };

  const updateItemPrice = (id, nextValue) => {
    const trimmedValue = String(nextValue ?? "").trim();
    const numericValue = Number(trimmedValue);

    setCart((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              price: trimmedValue === "" ? item.price : Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : item.price,
              customPriced: true
            }
          : item
      )
    );
  };

  const submitCheckout = async (selectedPaymentMethod = paymentMethod) => {
    try {
      const normalizedPromoCode = partnerOrderContext ? "" : promoLocked ? normalizePromoValue(appliedPromo?.code) : normalizePromoValue(promoCode);

      if (normalizedPromoCode && (!appliedPromo || normalizePromoValue(appliedPromo.code) !== normalizedPromoCode)) {
        toast.error("Apply the promo code before completing the order");
        return;
      }

      const payload = {
        items: buildOrderRequestItems(cart),
        paymentMethod: selectedPaymentMethod,
        bookingDetails: customerInfo,
        adjustmentMethod: editingOrder ? adjustmentMethod || null : null,
        promoCode: normalizedPromoCode || null
      };

      if (!selectedPaymentMethod) {
        setPaymentMethodError(true);
        setPaymentPromptOpen(true);
        return;
      }

      if (requiresAdjustmentMethod && !adjustmentMethod) {
        toast.error(editingDifference > 0 ? "Select how the extra amount was collected" : "Select how the refund was made");
        return;
      }

      const order = editingOrder ? await orderService.updateOrder(editingOrder.id, payload) : await orderService.createOrder(payload);

      toast.success(editingOrder ? `Order ${order.orderId} updated` : `Order ${order.orderId} sent to food serving`);
      setLatestOrder(order);
      setCart([]);
      setEditingOrder(null);
      setPaymentMethod("");
      setPaymentMethodError(false);
      setPaymentPromptOpen(false);
      setAdjustmentMethod("");
      resetPromoState();
      setCustomerInfo({
        customerName: "",
        customerPhone: "",
        customerDateOfBirth: ""
      });

      const refreshedProducts = await productService.getProducts();
      setProducts(refreshedProducts);

      if (location.state?.returnTo) {
        navigate(location.state.returnTo, { replace: true });
      } else if (editingOrder) {
        navigate("/orders", { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Checkout failed");
    }
  };

  const checkout = async () => {
    await submitCheckout(paymentMethod);
  };

  const handlePaymentPromptSelect = async (method) => {
    setPaymentMethod(method);
    setPaymentMethodError(false);
    setPaymentPromptOpen(false);
    await submitCheckout(method);
  };

  const cancelEdit = () => {
    setEditingOrder(null);
    setCart([]);
    setPaymentMethod("");
    setPaymentMethodError(false);
    setPaymentPromptOpen(false);
    setAdjustmentMethod("");
    resetPromoState();
    setCustomerInfo({
      customerName: "",
      customerPhone: "",
      customerDateOfBirth: ""
    });
    navigate("/orders", { replace: true });
  };

  const clearQueue = () => {
    setCart([]);
    setPaymentMethodError(false);
    setPaymentPromptOpen(false);
    setAdjustmentMethod("");
    resetPromoState();
    setCustomerInfo({
      customerName: "",
      customerPhone: "",
      customerDateOfBirth: ""
    });
    toast.success("Order queue cleared");
  };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px] 2xl:grid-cols-[minmax(0,1fr)_470px]">
        <section className="glass-card flex flex-col p-3 md:p-4 xl:max-h-[calc(100vh-2rem)]">
          <div className="rounded-[30px] bg-gradient-to-r from-amber-100 via-white to-orange-50 p-2.5 shadow-soft">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-2 xl:min-w-0 xl:flex-1 xl:flex-row xl:items-center xl:gap-3">
                <h1 className="font-display text-lg font-bold text-slate-900 xl:shrink-0">POS Terminal</h1>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products by name..." className="input py-2.5 xl:max-w-[420px]" />
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:w-auto xl:hidden xl:shrink-0">
                <div className="rounded-2xl bg-white/90 px-3 py-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Visible</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">{visibleProductCount}</p>
                </div>
                <div className="rounded-2xl bg-white/90 px-3 py-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cart</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">{totalCartItems}</p>
                </div>
                <div className="rounded-2xl bg-white/90 px-3 py-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Category</p>
                  <p className="mt-0.5 text-[13px] font-bold text-slate-900">{selectedCategory === "All" ? "All" : selectedCategory}</p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 xl:hidden">
              <div className="rounded-[1.35rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,248,238,0.92))] p-2.5 shadow-[0_12px_24px_rgba(160,120,50,0.07)]">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Categories</p>
                  </div>
                  <div className="rounded-full border border-[#eadcc4] bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                    {Math.max(categoryOptions.length - 1, 0)} Categories
                  </div>
                </div>
                <div className="max-h-[132px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {categoryOptions.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setSelectedCategory(category.key)}
                        className={`group rounded-[0.95rem] border px-3 py-2.5 text-left text-[13px] font-semibold transition ${
                          selectedCategory === category.key
                            ? "border-slate-900 bg-slate-900 text-white shadow-[0_14px_24px_rgba(15,23,42,0.22)]"
                            : "border-slate-200 bg-white text-slate-600 hover:border-[#f3c38d] hover:bg-[#fff3e2] hover:text-slate-900"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="block min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">{category.label}</span>
                          <span className={`h-2 w-2 shrink-0 rounded-full transition ${selectedCategory === category.key ? "bg-white" : "bg-slate-200 group-hover:bg-brand-300"}`} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 min-h-[360px] flex-1 overflow-y-auto pr-1 xl:min-h-0">
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {loading ? (
                <div className="rounded-3xl bg-white p-6 text-slate-500">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500 sm:col-span-2 2xl:col-span-3">
                  No products match this search or category.
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={addToCart}
                    priceMode={partnerOrderContext ? "regular" : "offer"}
                    cartQuantity={cartQuantityMap.get(product.id) || 0}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <div className="hidden xl:block">
          <CartPanelNext
            cart={cart}
            paymentMethod={paymentMethod}
            onPaymentChange={handlePaymentMethodChange}
            onIncrease={increaseItem}
            onDecrease={(id) => updateCartItem(id, (item) => ({ ...item, quantity: item.quantity - 1 }))}
            onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
            onCheckout={checkout}
            latestOrder={latestOrder}
            onPrintLatest={() => printReceipt(latestOrder, shopSettings)}
            title={editingOrder ? `Editing ${editingOrder.orderId}` : partnerOrderContext ? "Delivery Partner Order" : "Current Order"}
            description={
              editingOrder
                ? editingOrder.status === "queued"
                  ? "This queue order came from customer self-order. Confirm payment and send it to the kitchen."
                  : partnerOrderContext
                    ? "This delivery partner order was loaded from history. Update partner source, prices, and items here."
                    : "This order was loaded from history. Update it here and save the changes."
                : partnerOrderContext
                  ? "Use regular prices for Grab, Foodpanda, E-Gates, and WOWNOW orders, then adjust any unit price before saving."
                  : "Fast selection with live stock validation"
            }
            checkoutLabel={editingOrder ? "Update Order" : "Place Order"}
            isEditing={Boolean(editingOrder)}
            onCancelEdit={cancelEdit}
            onClearQueue={clearQueue}
            originalTotal={editingOrder?.total || 0}
            adjustmentMethod={adjustmentMethod}
            onAdjustmentMethodChange={setAdjustmentMethod}
            onUpdateAlternatives={updateItemAlternatives}
            allowPriceEdit={partnerOrderContext}
            onUpdatePrice={updateItemPrice}
            allowItemCustomization={allowItemCustomization}
            checkoutDisabled={requiresAdjustmentMethod && !adjustmentMethod}
            showPaymentMethodError={paymentMethodError}
            customerInfo={customerInfo}
            onOpenCustomerInfo={() => setCustomerInfoOpen(true)}
            promoCode={promoCode}
            onPromoCodeChange={handlePromoCodeChange}
            onApplyPromo={() => {
              if (!promoLocked) {
                previewPromo({ silent: false });
              }
            }}
            onRemovePromo={() => {
              if (!promoLocked) {
                resetPromoState();
              }
            }}
            appliedPromo={appliedPromo}
            promoApplying={promoApplying}
            showPromoSection={!partnerOrderContext}
            promoLocked={promoLocked}
            promoLockedMessage={promoLockedMessage}
            paymentMethods={paymentMethodOptions}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-4 left-3 right-3 z-40 flex items-center justify-between rounded-[1.45rem] bg-slate-900 px-4 py-3 text-white shadow-[0_18px_40px_rgba(15,23,42,0.3)] transition hover:bg-slate-800 sm:left-auto sm:right-4 sm:w-auto sm:min-w-[250px] xl:hidden"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <ShoppingBag size={20} />
            <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-brand-500 px-1.5 py-0.5 text-[11px] font-bold">
              {totalCartItems}
            </span>
          </div>
          <div className="text-left">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Your Cart</p>
            <p className="text-sm font-bold">{currency(cartTotal)}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold">View</span>
      </button>
      {cartOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/45 p-3 sm:p-4 xl:hidden" onClick={() => setCartOpen(false)}>
          <div className="flex min-h-full items-end justify-center sm:items-center sm:justify-end" onClick={(event) => event.stopPropagation()}>
            <div className="relative w-full max-w-[460px] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[2rem] sm:max-h-[calc(100vh-2rem)]">
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm"
              >
                <X size={18} />
              </button>
              <div className="max-h-[calc(100vh-1.5rem)] overflow-y-auto overscroll-contain sm:max-h-[calc(100vh-2rem)]">
                <CartPanelNext
                  cart={cart}
                  paymentMethod={paymentMethod}
                  onPaymentChange={handlePaymentMethodChange}
                  onIncrease={increaseItem}
                  onDecrease={(id) => updateCartItem(id, (item) => ({ ...item, quantity: item.quantity - 1 }))}
                  onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
                  onCheckout={checkout}
                  latestOrder={latestOrder}
                  onPrintLatest={() => printReceipt(latestOrder, shopSettings)}
                  title={editingOrder ? `Editing ${editingOrder.orderId}` : partnerOrderContext ? "Delivery Partner Order" : "Current Order"}
                  description={
                    editingOrder
                      ? editingOrder.status === "queued"
                        ? "This queue order came from customer self-order. Confirm payment and send it to the kitchen."
                        : partnerOrderContext
                          ? "This delivery partner order was loaded from history. Update partner source, prices, and items here."
                          : "This order was loaded from history. Update it here and save the changes."
                      : partnerOrderContext
                        ? "Use regular prices for Grab, Foodpanda, E-Gates, and WOWNOW orders, then adjust any unit price before saving."
                        : "Fast selection with live stock validation"
                  }
                  checkoutLabel={editingOrder ? "Update Order" : "Place Order"}
                  isEditing={Boolean(editingOrder)}
                  onCancelEdit={cancelEdit}
                  onClearQueue={clearQueue}
                  originalTotal={editingOrder?.total || 0}
                  adjustmentMethod={adjustmentMethod}
                  onAdjustmentMethodChange={setAdjustmentMethod}
                  onUpdateAlternatives={updateItemAlternatives}
                  allowPriceEdit={partnerOrderContext}
                  onUpdatePrice={updateItemPrice}
                  allowItemCustomization={allowItemCustomization}
                  checkoutDisabled={requiresAdjustmentMethod && !adjustmentMethod}
                  showPaymentMethodError={paymentMethodError}
                  customerInfo={customerInfo}
                  onOpenCustomerInfo={() => setCustomerInfoOpen(true)}
                  promoCode={promoCode}
                  onPromoCodeChange={handlePromoCodeChange}
                  onApplyPromo={() => {
                    if (!promoLocked) {
                      previewPromo({ silent: false });
                    }
                  }}
                  onRemovePromo={() => {
                    if (!promoLocked) {
                      resetPromoState();
                    }
                  }}
                  appliedPromo={appliedPromo}
                  promoApplying={promoApplying}
                  showPromoSection={!partnerOrderContext}
                  promoLocked={promoLocked}
                  promoLockedMessage={promoLockedMessage}
                  paymentMethods={paymentMethodOptions}
                  mobileModal
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <CustomerInfoModal
        open={customerInfoOpen}
        value={customerInfo}
        onClose={() => setCustomerInfoOpen(false)}
        onSave={(nextValue) => {
          setCustomerInfo(nextValue);
          setCustomerInfoOpen(false);
          toast.success("Customer info saved");
        }}
      />
      <PaymentMethodPromptModal
        open={paymentPromptOpen}
        onClose={() => setPaymentPromptOpen(false)}
        onSelect={handlePaymentPromptSelect}
        methods={paymentMethodOptions}
      />
    </>
  );
};

export default PosPage;
