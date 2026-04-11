import { Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CartPanel from "../components/CartPanel";
import ProductCard from "../components/ProductCard";
import { orderService } from "../services/orderService";
import { productService } from "../services/productService";
import { shopSettingsService } from "../services/shopSettingsService";
import { currency, currencyParts, imageUrl } from "../utils/format";

const CATEGORY_TRANSLATIONS = {
  All: { km: "ទាំងអស់", en: "All" },
  Burger: { km: "បឺហ្គឺ", en: "Burger" },
  Combo: { km: "កុំបូ", en: "Combo" },
  Drinks: { km: "ភេសជ្ជៈ", en: "Drinks" },
  Base: { km: "មូលដ្ឋាន", en: "Base" },
  Sauce: { km: "សូស", en: "Sauce" },
  Seasoning: { km: "គ្រឿងទេស", en: "Seasoning" },
  "A La Catre": { km: "អាឡាកាត", en: "A La Catre" }
};

const UI_TEXT = {
  km: {
    orderOnline: "បញ្ជាទិញអនឡាញ",
    intro: "ជ្រើសរើសម្ហូប បង្កើតលេខជួរ ហើយបង្ហាញលេខនោះនៅបញ្ជរ។",
    search: "ស្វែងរក បឺហ្គឺ ភេសជ្ជៈ កុំបូ...",
    categories: "ប្រភេទមុខម្ហូប",
    items: "មុខម្ហូប",
    loading: "កំពុងផ្ទុកមីនុយ...",
    noItems: "មិនមានមុខម្ហូបត្រូវនឹងការស្វែងរកនេះទេ។",
    soldOut: "អស់ស្តុក",
    low: "ស្តុកតិច",
    ready: "មានស្រាប់",
    inventory: "ស្តុក",
    add: "បន្ថែម",
    yourCart: "កន្ត្រករបស់អ្នក",
    view: "មើល",
    latestQueue: "លេខជួរចុងក្រោយ",
    yourOrder: "ការកម្ម៉ង់របស់អ្នក",
    yourOrderDescription: "ពិនិត្យមុខម្ហូប និងបង្កើតលេខជួរ។",
    yourCartTitle: "កន្ត្រករបស់អ្នក",
    queueCreated: "បង្កើតលេខជួរ",
    creatingQueue: "កំពុងបង្កើតលេខជួរ...",
    getQueueNumber: "យកលេខជួរ",
    queueCreatedToast: "បានបង្កើតលេខជួរ",
    loadError: "មិនអាចផ្ទុកមីនុយបានទេ",
    queueError: "មិនអាចបង្កើតលេខជួរបានទេ",
    stockError: "មិនអាចបន្ថែមលើសស្តុកបានទេ",
    language: "ភាសា",
    khmer: "ខ្មែរ",
    english: "English",
    cartLabels: {
      emptyCart: "សូមជ្រើសរើសមុខម្ហូបដើម្បីចាប់ផ្តើមការកម្ម៉ង់។",
      priceChangeInfo: "ព័ត៌មានបម្លែងតម្លៃ",
      additionalPerCombo: "បន្ថែមសម្រាប់កុំបូមួយ",
      deductionPerCombo: "បញ្ចុះសម្រាប់កុំបូមួយ",
      allowedChangeItems: "អាចប្ដូរមុខម្ហូបបាន",
      keepOriginal: "រក្សាដើម",
      subtotal: "សរុបរង",
      total: "សរុប",
      clearQueue: "សម្អាតកន្ត្រក",
      showQueueNumber: "សូមបង្ហាញលេខជួរនេះទៅបុគ្គលិកនៅបញ្ជរ។",
      queueNumber: "លេខជួរ"
    }
  },
  en: {
    orderOnline: "Order Online",
    intro: "Pick your food, create a queue number, and show it at the counter.",
    search: "Search burger, drinks, combo...",
    categories: "Categories",
    items: "items",
    loading: "Loading menu...",
    noItems: "No items found for this search.",
    soldOut: "Sold Out",
    low: "Low",
    ready: "Ready",
    inventory: "Inventory",
    add: "Add",
    yourCart: "Your Cart",
    view: "View",
    latestQueue: "Latest Queue",
    yourOrder: "Your Order",
    yourOrderDescription: "Review items and generate your queue number.",
    yourCartTitle: "Your Cart",
    queueCreated: "Queue Created",
    creatingQueue: "Creating Queue...",
    getQueueNumber: "Get Queue Number",
    queueCreatedToast: "Queue created",
    loadError: "Failed to load menu",
    queueError: "Failed to create queue order",
    stockError: "Cannot add more than available stock",
    language: "Language",
    khmer: "ខ្មែរ",
    english: "English",
    cartLabels: {
      emptyCart: "Add products from the grid to start an order.",
      priceChangeInfo: "Price Change Info",
      additionalPerCombo: "Additional per combo",
      deductionPerCombo: "Deduction per combo",
      allowedChangeItems: "Allowed Change Items",
      keepOriginal: "Keep original",
      subtotal: "Subtotal",
      total: "Total",
      clearQueue: "Clear Queue",
      showQueueNumber: "Show this queue number to the counter staff.",
      queueNumber: "Queue Number"
    }
  }
};

const translateCategory = (category, language) => CATEGORY_TRANSLATIONS[category]?.[language] || category;
const buildCategoryOptions = (products) => [
  { key: "All", labelKm: "ទាំងអស់", labelEn: "All" },
  ...Array.from(
    new Map(
      products
        .filter((product) => product.category)
        .map((product) => [
          product.category,
          {
            key: product.category,
            labelKm: product.khmerCategory || translateCategory(product.category, "km"),
            labelEn: product.category
          }
        ])
    ).values()
  )
];
const getCategoryLabel = (categoryOption, language) =>
  language === "km" ? categoryOption.labelKm || categoryOption.labelEn : categoryOption.labelEn || categoryOption.labelKm;
const getLocalizedProductName = (product, language) => (language === "km" ? product.khmerName || product.name : product.name);
const getLocalizedProductDescription = (product, language) =>
  language === "km" ? product.khmerDescription || product.description || "" : product.description || "";
const getLocalizedCategory = (product, language) =>
  language === "km" ? product.khmerCategory || translateCategory(product.category, language) : product.category;

const getCartTotal = (cart) =>
  cart.reduce((sum, item) => {
    const adjustmentTotal = (item.selectedAlternatives || []).reduce((adjustmentSum, selectedAlternative) => {
      const sourceComboItem = (item.comboItems || []).find((comboItem) => comboItem.product === selectedAlternative.sourceProductId);
      const selectedProduct = (sourceComboItem?.alternativeProducts || []).find(
        (alternativeProduct) => alternativeProduct.id === selectedAlternative.selectedProductId
      );
      return adjustmentSum + Number(selectedProduct?.priceAdjustment || selectedAlternative.priceAdjustment || 0);
    }, 0);

    return sum + item.quantity * (Number(item.price) + adjustmentTotal);
  }, 0);

const CustomerOrderPage = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [queueOrder, setQueueOrder] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [shop, setShop] = useState({ shopName: "ASEN POS", address: "", logo: "" });
  const [language, setLanguage] = useState(() => localStorage.getItem("customer-language") || "km");

  useEffect(() => {
    localStorage.setItem("customer-language", language);
  }, [language]);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      try {
        const [menu, settings] = await Promise.all([productService.getPublicMenu(), shopSettingsService.getPublic()]);

        setProducts(menu);
        setShop({
          shopName: settings?.shopName || "ASEN POS",
          address: settings?.address || "",
          logo: settings?.logo || ""
        });
      } catch (error) {
        toast.error(error.response?.data?.message || UI_TEXT[language].loadError);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, []);

  const text = UI_TEXT[language];
  const categoryOptions = useMemo(() => buildCategoryOptions(products), [products]);
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const localizedName = getLocalizedProductName(product, language).toLowerCase();
        const localizedDescription = getLocalizedProductDescription(product, language).toLowerCase();
        const fallbackName = (product.name || "").toLowerCase();
        const fallbackKhmerName = (product.khmerName || "").toLowerCase();
        const query = search.toLowerCase();
        const matchesSearch =
          localizedName.includes(query) ||
          localizedDescription.includes(query) ||
          fallbackName.includes(query) ||
          fallbackKhmerName.includes(query);
        const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    [products, search, selectedCategory, language]
  );
  const localizedFilteredProducts = useMemo(
    () =>
      filteredProducts.map((product) => ({
        ...product,
        name: getLocalizedProductName(product, language),
        description: getLocalizedProductDescription(product, language),
        category: getLocalizedCategory(product, language)
      })),
    [filteredProducts, language]
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => getCartTotal(cart), [cart]);

  useEffect(() => {
    setCart((current) =>
      current.map((item) => {
        const product = products.find((entry) => entry.id === item.id);
        if (!product) {
          return item;
        }

        return {
          ...item,
          name: getLocalizedProductName(product, language)
        };
      })
    );
  }, [language, products]);

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(text.stockError);
          return current;
        }

        return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }

      return [
        ...current,
        {
          id: product.id,
          name: getLocalizedProductName(product, language),
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

  const updateItemAlternatives = (id, selectedAlternatives) => {
    setCart((current) => current.map((item) => (item.id === id ? { ...item, selectedAlternatives } : item)));
  };

  const submitQueue = async () => {
    if (!cart.length) {
      return;
    }

    setSubmitting(true);
    try {
      const order = await orderService.createPublicQueueOrder({
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          selectedAlternatives: item.selectedAlternatives || []
        }))
      });

      setQueueOrder(order);
      setCart([]);
      setCartOpen(true);
      toast.success(`${text.queueCreatedToast} #${order.queueNumber}`);
    } catch (error) {
      toast.error(error.response?.data?.message || text.queueError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,146,63,0.18),_transparent_28%),linear-gradient(180deg,#fff7ed_0%,#fffbeb_100%)] p-3 sm:p-4 md:p-5">
      <div className="mx-auto max-w-[1720px]">
        <div className="mb-3 flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-[1.3rem] border border-white/80 bg-white/90 px-3 py-2 shadow-sm">
            <span className="text-[12px] font-semibold text-slate-500">{text.language}</span>
            <button
              type="button"
              onClick={() => setLanguage("km")}
              className={`rounded-full px-3 py-2 text-[12px] font-semibold ${language === "km" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {text.khmer}
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-3 py-2 text-[12px] font-semibold ${language === "en" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {text.english}
            </button>
          </div>
        </div>

        <div className="hidden gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="glass-card flex flex-col p-4 md:p-5 xl:max-h-[calc(100vh-3rem)]">
            <div className="rounded-[1.8rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-[#efe3d3] bg-white">
                    {shop.logo ? <img src={imageUrl(shop.logo)} alt={shop.shopName} className="h-full w-full object-contain p-2" /> : null}
                  </div>
                  <div>
                    <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">{shop.shopName}</h1>
                    <p className="mt-1 text-[13px] text-slate-500">{text.intro}</p>
                  </div>
                </div>
                {queueOrder ? (
                  <div className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-right shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-500">{text.latestQueue}</p>
                    <p className="mt-1 text-[15px] font-bold text-violet-800">#{queueOrder.queueNumber}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={text.search}
                  className="input xl:max-w-[320px]"
                />
                <div className="rounded-[1.35rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,248,238,0.92))] p-3 shadow-[0_12px_24px_rgba(160,120,50,0.07)]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{text.categories}</p>
                    </div>
                    <div className="rounded-full border border-[#eadcc4] bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                      {Math.max(categoryOptions.length - 1, 0)} {language === "km" ? "ប្រភេទ" : "Categories"}
                    </div>
                  </div>
                  <div className="max-h-[148px] overflow-y-auto pr-1">
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
                          <span className="block min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">{getCategoryLabel(category, language)}</span>
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full transition ${
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
                  <div className="rounded-3xl bg-white p-6 text-slate-500">{text.loading}</div>
                ) : localizedFilteredProducts.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500 sm:col-span-2 2xl:col-span-3">
                    {text.noItems}
                  </div>
                ) : (
                  localizedFilteredProducts.map((product) => <ProductCard key={product.id} product={product} onSelect={addToCart} />)
                )}
              </div>
            </div>
          </section>

          <CartPanel
            cart={cart}
            paymentMethod="cash"
            onPaymentChange={() => {}}
            onIncrease={(id) => updateCartItem(id, (item) => ({ ...item, quantity: item.quantity + 1 }))}
            onDecrease={(id) => updateCartItem(id, (item) => ({ ...item, quantity: item.quantity - 1 }))}
            onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
            onCheckout={submitQueue}
            latestOrder={queueOrder}
            onPrintLatest={() => {}}
            title={text.yourOrder}
            description={text.yourOrderDescription}
            checkoutLabel={submitting ? text.creatingQueue : text.getQueueNumber}
            onClearQueue={() => setCart([])}
            onUpdateAlternatives={updateItemAlternatives}
            allowItemCustomization
            showPaymentSection={false}
            latestOrderLabel={text.queueCreated}
            showLatestPrint={false}
            labels={text.cartLabels}
          />
        </div>

        <section className="xl:hidden">
          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.98)_0%,rgba(255,245,230,0.96)_60%,rgba(255,237,213,0.94)_100%)] shadow-[0_18px_50px_rgba(160,120,50,0.14)]">
            <div className="relative px-4 pb-4 pt-5 sm:px-5">
              <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,_rgba(245,146,63,0.24),_transparent_58%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-500">{text.orderOnline}</p>
                  <p className="mt-2 max-w-[240px] text-[13px] leading-5 text-slate-600">
                    {text.intro}
                  </p>
                </div>
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[1.7rem] border border-white/80 bg-white shadow-[0_14px_24px_rgba(160,120,50,0.12)]">
                  {shop.logo ? <img src={imageUrl(shop.logo)} alt={shop.shopName} className="h-full w-full object-cover" /> : null}
                </div>
              </div>

              <div className="relative mt-5">
                <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={text.search}
                  className="w-full rounded-[1.35rem] border border-white/80 bg-white/95 px-11 py-3.5 text-[14px] text-slate-700 outline-none shadow-[0_12px_20px_rgba(160,120,50,0.08)] transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{text.categories}</p>
                <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                  {Math.max(categoryOptions.length - 1, 0)} {language === "km" ? "ប្រភេទ" : "Categories"}
                </div>
              </div>

              <div className="mt-3 max-h-[172px] overflow-y-auto rounded-[1.25rem] border border-white/70 bg-white/70 p-2 shadow-[0_10px_20px_rgba(160,120,50,0.08)]">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {categoryOptions.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setSelectedCategory(category.key)}
                    className={`rounded-[0.95rem] px-3 py-2 text-left text-[12px] font-semibold transition ${
                      selectedCategory === category.key
                        ? "bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.22)]"
                        : "border border-white/80 bg-white/95 text-slate-600 shadow-sm"
                    }`}
                  >
                    <span className="block whitespace-normal break-words text-left leading-snug">{getCategoryLabel(category, language)}</span>
                  </button>
                ))}
                </div>
              </div>
            </div>

            <div className="border-t border-white/70 bg-white/55 px-4 pb-24 pt-4 sm:px-5">
              <div className="space-y-3">
                {loading ? (
                  <div className="rounded-[1.6rem] bg-white p-6 text-center text-sm text-slate-500 shadow-sm">{text.loading}</div>
                ) : localizedFilteredProducts.length === 0 ? (
                  <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    {text.noItems}
                  </div>
                ) : (
                  localizedFilteredProducts.map((product) => (
                    (() => {
                      const promoParts = currencyParts(product.promotionalPrice ?? product.price);
                      const regularParts = currencyParts(product.regularPrice ?? product.price);

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={product.stock === 0}
                          className="flex w-full items-center gap-3 rounded-[1.6rem] border border-white/80 bg-white p-3 text-left shadow-[0_12px_24px_rgba(160,120,50,0.08)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.3rem] bg-amber-100">
                            <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[15px] font-bold text-slate-900">{product.name}</p>
                                <p className="mt-1 text-[12px] text-slate-500">{product.category}</p>
                                {product.description ? (
                                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{product.description}</p>
                                ) : null}
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                  product.stock === 0
                                    ? "bg-rose-100 text-rose-600"
                                    : product.lowStock
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {product.stock === 0 ? text.soldOut : product.lowStock ? text.low : text.ready}
                              </span>
                            </div>
                            <div className="mt-3 flex items-end justify-between gap-3">
                              <div>
                                {Number(product.regularPrice ?? product.price) > Number(product.promotionalPrice ?? product.price) && (
                                  <p className="text-[12px] text-slate-400 line-through">
                                    {regularParts.khr} <span className="text-[11px] text-slate-300">({regularParts.usd})</span>
                                  </p>
                                )}
                                <p className="text-[18px] font-bold text-brand-600">{promoParts.khr}</p>
                                <p className="mt-0.5 text-[11px] text-slate-400">{promoParts.usd}</p>
                                <p className="mt-1 text-[11px] text-slate-500">{text.inventory} {product.stock}</p>
                              </div>
                              <span className="rounded-full bg-brand-500 px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_10px_20px_rgba(245,146,63,0.26)]">
                                {text.add}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })()
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
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
              {cartCount}
            </span>
          </div>
          <div className="text-left">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">{text.yourCart}</p>
            <p className="text-sm font-bold">{currency(cartTotal)}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold">{text.view}</span>
      </button>

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-3 sm:p-4" onClick={() => setCartOpen(false)}>
          <div className="flex min-h-full items-center justify-end" onClick={(event) => event.stopPropagation()}>
            <div className="relative w-full max-w-[440px]">
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm"
              >
                <X size={18} />
              </button>
              <CartPanel
                cart={cart}
                paymentMethod="cash"
                onPaymentChange={() => {}}
                onIncrease={(id) => updateCartItem(id, (item) => ({ ...item, quantity: item.quantity + 1 }))}
                onDecrease={(id) => updateCartItem(id, (item) => ({ ...item, quantity: item.quantity - 1 }))}
                onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
                onCheckout={submitQueue}
                latestOrder={queueOrder}
                onPrintLatest={() => {}}
                title={text.yourCartTitle}
                description={text.yourOrderDescription}
                checkoutLabel={submitting ? text.creatingQueue : text.getQueueNumber}
                onClearQueue={() => setCart([])}
                onUpdateAlternatives={updateItemAlternatives}
                allowItemCustomization
                showPaymentSection={false}
                latestOrderLabel={text.queueCreated}
                showLatestPrint={false}
                labels={text.cartLabels}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerOrderPage;
