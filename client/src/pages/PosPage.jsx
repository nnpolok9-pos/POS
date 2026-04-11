import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import CartPanel from "../components/CartPanel";
import ProductCard from "../components/ProductCard";
import { useShopSettings } from "../context/ShopSettingsContext";
import { orderService } from "../services/orderService";
import { productService } from "../services/productService";
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
  cart.reduce((sum, item) => sum + item.quantity * (Number(item.price) + getItemAdjustmentTotal(item)), 0);

const buildCategoryOptions = (products) => [
  { key: "All", label: "All" },
  ...Array.from(
    new Map(
      products
        .filter((product) => product.category)
        .map((product) => [product.category, { key: product.category, label: product.category }])
    ).values()
  )
];

const PosPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings: shopSettings } = useShopSettings();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [latestOrder, setLatestOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [adjustmentMethod, setAdjustmentMethod] = useState("");
  const previousEditDifferenceRef = useRef(0);
  const allowItemCustomization = !editingOrder || ["queued", "food_serving", "quote_prepared"].includes(editingOrder.status);
  const editingDifference = useMemo(() => {
    if (!editingOrder || editingOrder.status === "queued") {
      return 0;
    }

    return Number((getCartTotal(cart) - Number(editingOrder.total || 0)).toFixed(2));
  }, [cart, editingOrder]);
  const requiresAdjustmentMethod = Boolean(editingOrder && editingOrder.status !== "queued" && editingDifference !== 0);

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
          setPaymentMethod("cash");
          setAdjustmentMethod("");
          return;
        }

        const order = await orderService.getOrderById(editOrderId);
        if (order.status === "void") {
          toast.error("Void sales cannot be edited");
          navigate("/orders", { replace: true });
          return;
        }

        setEditingOrder(order);
        setPaymentMethod(order.paymentMethod || "cash");
        setAdjustmentMethod("");
        const existingOrderMap = new Map(order.items.map((item) => [String(item.product), item.quantity]));
        setCart(
          order.items.map((item) => {
            const product = data.find((entry) => entry.id === item.product);
            const baseStock = product?.stock ?? 0;
            const selectedAlternatives = item.selectedAlternatives || [];
            const basePrice =
              Number(item.price) -
              selectedAlternatives.reduce((sum, selectedAlternative) => sum + Number(selectedAlternative.priceAdjustment || 0), 0);
            return {
              id: item.product,
              name: item.name,
              price: basePrice,
              regularPrice: product?.regularPrice ?? basePrice,
              promotionalPrice: product?.promotionalPrice ?? basePrice,
              stock: baseStock + item.quantity,
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
  }, [navigate, searchParams]);

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

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error("Cannot add more than available stock");
          return current;
        }

        return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          price: product.promotionalPrice ?? product.price,
          regularPrice: product.regularPrice ?? product.price,
          promotionalPrice: product.promotionalPrice ?? product.price,
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
    setCart((current) =>
      current
        .map((item) => (item.id === id ? updater(item) : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const increaseItem = (id) => {
    updateCartItem(id, (item) => {
      if (item.quantity >= item.stock) {
        toast.error("Cannot exceed stock");
        return item;
      }

      return { ...item, quantity: item.quantity + 1 };
    });
  };

  const updateItemAlternatives = (id, selectedAlternatives) => {
    setCart((current) =>
      current.map((item) => (item.id === id ? { ...item, selectedAlternatives } : item))
    );
  };

  const checkout = async () => {
    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
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
        })),
        paymentMethod,
        adjustmentMethod: editingOrder ? adjustmentMethod || null : null
      };

      if (editingOrder && editingOrder.status !== "queued") {
        if (editingDifference !== 0 && !adjustmentMethod) {
          toast.error(editingDifference > 0 ? "Select how the extra amount was collected" : "Select how the refund was made");
          return;
        }
      }

      const order = editingOrder
        ? await orderService.updateOrder(editingOrder.id, payload)
        : await orderService.createOrder(payload);

      toast.success(editingOrder ? `Order ${order.orderId} updated` : `Order ${order.orderId} sent to food serving`);
      setLatestOrder(order);
      setCart([]);
      setEditingOrder(null);
      setPaymentMethod("cash");
      setAdjustmentMethod("");

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

  const cancelEdit = () => {
    setEditingOrder(null);
    setCart([]);
    setPaymentMethod("cash");
    setAdjustmentMethod("");
    navigate("/orders", { replace: true });
  };

  const clearQueue = () => {
    setCart([]);
    setAdjustmentMethod("");
    toast.success("Order queue cleared");
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="glass-card flex flex-col p-4 md:p-5 xl:max-h-[calc(100vh-2rem)]">
          <div className="rounded-[30px] bg-gradient-to-r from-amber-100 via-white to-orange-50 p-3.5 shadow-soft">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">POS Terminal</h1>
                <p className="mt-1 text-[13px] text-slate-500">Quick add, easy review, and fewer mistakes while taking orders.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:w-auto">
                <div className="rounded-2xl bg-white/90 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Visible</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{visibleProductCount}</p>
                </div>
                <div className="rounded-2xl bg-white/90 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cart</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{totalCartItems}</p>
                </div>
                <div className="rounded-2xl bg-white/90 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Category</p>
                  <p className="mt-1 text-[13px] font-bold text-slate-900">{selectedCategory === "All" ? "All" : selectedCategory}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] xl:items-start">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products by name..."
                className="input"
              />
              <div className="rounded-[1.5rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,248,238,0.92))] p-3.5 shadow-[0_14px_30px_rgba(160,120,50,0.08)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Categories</p>
                    <p className="mt-1 text-[13px] text-slate-500">Choose a category to narrow the product grid quickly.</p>
                  </div>
                  <div className="rounded-full border border-[#eadcc4] bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                    {Math.max(categoryOptions.length - 1, 0)} Categories
                  </div>
                </div>
                <div className="max-h-[176px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-4">
                  {categoryOptions.map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setSelectedCategory(category.key)}
                      className={`group rounded-[1.15rem] border px-4 py-3 text-left text-[13px] font-semibold transition ${
                        selectedCategory === category.key
                          ? "border-slate-900 bg-slate-900 text-white shadow-[0_14px_24px_rgba(15,23,42,0.22)]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#f3c38d] hover:bg-[#fff3e2] hover:text-slate-900"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="block truncate">{category.label}</span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full transition ${
                            selectedCategory === category.key ? "bg-white" : "bg-slate-200 group-hover:bg-brand-300"
                          }`}
                        />
                      </span>
                    </button>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 min-h-[360px] flex-1 overflow-y-auto pr-1 xl:min-h-0">
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {loading ? (
                <div className="rounded-3xl bg-white p-6 text-slate-500">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500 sm:col-span-2 2xl:col-span-3">
                  No products match this search or category.
                </div>
              ) : (
                filteredProducts.map((product) => <ProductCard key={product.id} product={product} onSelect={addToCart} />)
              )}
            </div>
          </div>
        </section>

        <CartPanel
          cart={cart}
          paymentMethod={paymentMethod}
          onPaymentChange={setPaymentMethod}
          onIncrease={increaseItem}
          onDecrease={(id) => updateCartItem(id, (item) => ({ ...item, quantity: item.quantity - 1 }))}
          onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
          onCheckout={checkout}
          latestOrder={latestOrder}
          onPrintLatest={() => printReceipt(latestOrder, shopSettings)}
          title={editingOrder ? `Editing ${editingOrder.orderId}` : "Current Order"}
          description={
            editingOrder
              ? editingOrder.status === "queued"
                ? "This queue order came from customer self-order. Confirm payment and send it to the kitchen."
                : "This order was loaded from history. Update it here and save the changes."
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
          allowItemCustomization={allowItemCustomization}
          checkoutDisabled={requiresAdjustmentMethod && !adjustmentMethod}
        />
      </div>
    </>
  );
};

export default PosPage;
