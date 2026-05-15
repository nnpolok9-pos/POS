import { Check, ChevronDown, ImagePlus, Package, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const stockUnitLabel = (unit) =>
  ({
    pieces: "Piece",
    gram: "Gram",
    teaspoon: "Tea Spoon"
  })[unit] || "Piece";
const productTypeLabel = (type) =>
  ({
    raw: "A La Catre",
    raw_material: "Base",
    sauce: "Sauce",
    seasoning: "Seasoning",
    raw_item: "Raw-Items",
    combo: "Combined",
    combo_type: "Combo"
  })[type] || "A La Catre";

const COMPOSITE_PRODUCT_TYPES = ["combo", "combo_type"];
const isCompositeType = (type) => COMPOSITE_PRODUCT_TYPES.includes(type);
const isBaseMaterialType = (type) => type === "raw_material";
const isRawItemType = (type) => type === "raw_item";
const canManualTentativeCost = (type) => ["raw", "combo"].includes(type);
const TENTATIVE_COST_FALLBACK_RATE = 0.4;

const initialState = {
  name: "",
  khmerName: "",
  regularPrice: "",
  promotionalPrice: "",
  category: "",
  khmerCategory: "",
  description: "",
  khmerDescription: "",
  stock: "",
  stockUnit: "pieces",
  seasoningPerOrderConsumption: "",
  sku: "",
  foodpandaSku: "",
  grabSku: "",
  eGatesSku: "",
  wownowSku: "",
  productType: "raw",
  forSale: "true",
  tentativeCost: "",
  comboItems: []
};

const normalizeAlternativeProducts = (alternativeProducts = []) =>
  (alternativeProducts || [])
    .map((alternativeProduct) => {
      if (!alternativeProduct) {
        return null;
      }

      if (typeof alternativeProduct === "string") {
        return {
          product: alternativeProduct,
          priceAdjustment: 0
        };
      }

      return {
        product: alternativeProduct.product || alternativeProduct.id || "",
        priceAdjustment: Number(alternativeProduct.priceAdjustment || 0)
      };
    })
    .filter((alternativeProduct) => alternativeProduct?.product);

const SearchableProductSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabledIds = []
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return options.filter((option) => {
      if (disabledIds.includes(option.id)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return `${option.name} ${productTypeLabel(option.productType)} ${stockUnitLabel(option.stockUnit)} ${option.sku || ""}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [disabledIds, options, query]);

  const selectedOption = options.find((option) => option.id === value);
  const handleSelect = (nextValue) => {
    onChange({ target: { value: nextValue } });
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      {label ? <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span> : null}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="input flex w-full items-center justify-between text-left"
        >
          <span className={selectedOption ? "text-slate-900" : "text-slate-400"}>
            {selectedOption
              ? `${selectedOption.name} - ${productTypeLabel(selectedOption.productType)} (${stockUnitLabel(selectedOption.stockUnit)})`
              : placeholder}
          </span>
          <ChevronDown size={16} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-3">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input"
                placeholder={`Search ${placeholder.toLowerCase()}`}
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => handleSelect("")}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-500 transition hover:bg-slate-50"
              >
                <span>{placeholder}</span>
                {!value ? <Check size={16} className="text-brand-500" /> : null}
              </button>
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">No matching products found.</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span>
                      {option.name} - {productTypeLabel(option.productType)} ({stockUnitLabel(option.stockUnit)})
                    </span>
                    {value === option.id ? <Check size={16} className="text-brand-500" /> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProductFormModal = ({ open, onClose, onSubmit, product, submitting, rawProducts = [], forcedProductType = "" }) => {
  const [form, setForm] = useState(initialState);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [replacementSelections, setReplacementSelections] = useState({});

  useEffect(() => {
    setForm(
      product
        ? {
            name: product.name,
            khmerName: product.khmerName || "",
            regularPrice: product.regularPrice ?? product.price,
            promotionalPrice: product.promotionalPrice ?? product.price,
            category: product.category,
            khmerCategory: product.khmerCategory || "",
            description: product.description || "",
            khmerDescription: product.khmerDescription || "",
            stock: isCompositeType(product.productType) ? 0 : product.stock,
            stockUnit: product.stockUnit || "pieces",
            seasoningPerOrderConsumption: product.seasoningPerOrderConsumption ?? "",
            sku: product.sku || "",
            foodpandaSku: product.foodpandaSku || "",
            grabSku: product.grabSku || "",
            eGatesSku: product.eGatesSku || "",
            wownowSku: product.wownowSku || "",
            productType: product.productType || "raw",
            forSale: String(product.forSale ?? true),
            tentativeCost: product.tentativeCost ?? "",
            comboItems: (product.comboItems || []).map((item) => ({
              ...item,
              changeable: item.changeable === true,
              alternativeProducts: normalizeAlternativeProducts(item.alternativeProducts)
            }))
          }
        : {
            ...initialState,
            ...(forcedProductType ? { productType: forcedProductType } : {})
          }
    );
    setFile(null);
    setReplacementSelections({});
  }, [product, open, forcedProductType]);

  const availableProducts = useMemo(
    () => rawProducts.filter((item) => item.id !== product?.id),
    [rawProducts, product?.id]
  );
  const comboCompositionOptions = useMemo(() => {
    if (form.productType !== "combo_type") {
      return availableProducts;
    }

    return availableProducts.filter((item) => ["raw", "combo"].includes(item.productType) && item.forSale !== false);
  }, [availableProducts, form.productType]);

  const comboTentativeCost = useMemo(() => {
    if (form.productType !== "combo_type") {
      return 0;
    }

    const productMap = new Map(availableProducts.map((item) => [item.id, item]));
    const computeItemCost = (productId, trail = new Set()) => {
      const linkedProduct = productMap.get(productId);
      if (!linkedProduct) {
        return 0;
      }

      if (linkedProduct.productType === "combo_type") {
        if (trail.has(productId)) {
          return 0;
        }

        const nextTrail = new Set(trail);
        nextTrail.add(productId);

        return (linkedProduct.comboItems || []).reduce((sum, comboItem) => {
          const nestedProductId = comboItem.product?.id || comboItem.product;
          return sum + computeItemCost(nestedProductId, nextTrail) * Number(comboItem.quantity || 0);
        }, 0);
      }

      const enteredCost = Number(linkedProduct.tentativeCost || 0);
      if (enteredCost > 0) {
        return enteredCost;
      }

      return linkedProduct.forSale === false
        ? 0
        : Number((Number(linkedProduct.promotionalPrice ?? linkedProduct.price ?? 0) * TENTATIVE_COST_FALLBACK_RATE).toFixed(2));
    };

    return form.comboItems.reduce((sum, item) => {
      if (!item.product) {
        return sum;
      }

      return sum + computeItemCost(item.product) * Number(item.quantity || 0);
    }, 0);
  }, [availableProducts, form.comboItems, form.productType]);

  const fallbackTentativeCost = useMemo(() => {
    if (form.forSale !== "true" || !canManualTentativeCost(form.productType)) {
      return 0;
    }

    const offerPrice = Number(form.promotionalPrice || 0);
    return Number((offerPrice * TENTATIVE_COST_FALLBACK_RATE).toFixed(2));
  }, [form.forSale, form.productType, form.promotionalPrice]);

  const minimalRawItemMode = isRawItemType(form.productType);

  if (!open) {
    return null;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "productType"
        ? {
            ...(!isCompositeType(value) ? { comboItems: [] } : {}),
            ...(isCompositeType(value) ? { stockUnit: "pieces" } : {}),
            ...(isRawItemType(value)
              ? {
                  regularPrice: "",
                  promotionalPrice: "",
                  description: "",
                  khmerDescription: "",
                  stock: "",
                  sku: "",
                  foodpandaSku: "",
                  grabSku: "",
                  eGatesSku: "",
                  wownowSku: "",
                  forSale: "false",
                  tentativeCost: ""
                }
              : {})
          }
        : {})
    }));
  };

  const updateComboItem = (index, nextValue) => {
    setForm((current) => ({
      ...current,
      comboItems: current.comboItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...nextValue } : item))
    }));
  };

  const addAlternativeProduct = (index) => {
    const selectedSelection = replacementSelections[index];
    const selectedProductId = selectedSelection?.product || "";
    const selectedPriceAdjustment = Number(selectedSelection?.priceAdjustment || 0);

    if (!selectedProductId) {
      return;
    }

    const currentAlternatives = form.comboItems[index]?.alternativeProducts || [];
    if (currentAlternatives.some((alternativeProduct) => alternativeProduct.product === selectedProductId)) {
      return;
    }

    updateComboItem(index, {
      alternativeProducts: [
        ...currentAlternatives,
        {
          product: selectedProductId,
          priceAdjustment: selectedPriceAdjustment
        }
      ]
    });

    setReplacementSelections((current) => ({
      ...current,
      [index]: { product: "", priceAdjustment: "" }
    }));
  };

  const removeAlternativeProduct = (index, productId) => {
    updateComboItem(index, {
      alternativeProducts: (form.comboItems[index]?.alternativeProducts || []).filter(
        (alternativeProduct) => alternativeProduct.product !== productId
      )
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData();
    const shouldHidePricing = isBaseMaterialType(form.productType) || isRawItemType(form.productType);
    const payload = {
      ...form,
      regularPrice: shouldHidePricing ? 0 : form.regularPrice,
      promotionalPrice: shouldHidePricing ? 0 : form.promotionalPrice,
      tentativeCost:
        form.forSale !== "true"
          ? 0
          : form.productType === "combo_type"
            ? Number(comboTentativeCost || 0).toFixed(2)
            : canManualTentativeCost(form.productType)
              ? form.tentativeCost
              : 0,
      stock: isCompositeType(form.productType) || isRawItemType(form.productType) ? 0 : form.stock,
      stockUnit: isCompositeType(form.productType) ? "pieces" : form.stockUnit,
      seasoningPerOrderConsumption: form.productType === "seasoning" ? form.seasoningPerOrderConsumption || 0 : 0,
      forSale: isRawItemType(form.productType) ? "false" : form.forSale,
      sku: isRawItemType(form.productType) ? "" : form.sku,
      foodpandaSku: isRawItemType(form.productType) ? "" : form.foodpandaSku,
      grabSku: isRawItemType(form.productType) ? "" : form.grabSku,
      eGatesSku: isRawItemType(form.productType) ? "" : form.eGatesSku,
      wownowSku: isRawItemType(form.productType) ? "" : form.wownowSku,
      comboItems: isCompositeType(form.productType)
        ? form.comboItems
            .filter((item) => item.product && Number(item.quantity) > 0)
            .map((item) => ({
              product: item.product,
              quantity: Number(item.quantity),
              changeable: item.changeable === true || item.changeable === "true",
              alternativeProducts:
                item.changeable === true || item.changeable === "true"
                  ? (item.alternativeProducts || []).filter(Boolean)
                      .map((alternativeProduct) => ({
                        product: alternativeProduct.product,
                        priceAdjustment: Number(alternativeProduct.priceAdjustment || 0)
                      }))
                  : []
            }))
        : []
    };

    Object.entries(payload).forEach(([key, value]) => {
      if (key === "comboItems") {
        formData.append(key, JSON.stringify(value));
        return;
      }
      formData.append(key, value);
    });

    if (file) {
      formData.append("image", file);
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:p-4">
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center">
        <div className="glass-card flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">{product ? "Edit Product" : "Add Product"}</h3>
            <p className="text-sm text-slate-500">
              {forcedProductType
                ? `Create a ${productTypeLabel(forcedProductType)} product with only the required fields.`
                : "Choose product type first, then complete only the fields needed for that type."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary shrink-0">
            Close
          </button>
          </div>

          <form className="grid flex-1 gap-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 md:grid-cols-2" onSubmit={handleSubmit}>
          {!forcedProductType ? (
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Product Type</span>
            <select name="productType" value={form.productType} onChange={handleChange} className="input" required>
              <option value="">Select product type</option>
              <option value="raw">A La Catre</option>
              <option value="raw_material">Base</option>
              <option value="raw_item">Raw-Items</option>
              <option value="sauce">Sauce</option>
              <option value="seasoning">Seasoning</option>
              <option value="combo">Combined</option>
              <option value="combo_type">Combo</option>
            </select>
          </label>
          ) : null}
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Product name</span>
            <input name="name" value={form.name} onChange={handleChange} className="input" required />
          </label>
          {!minimalRawItemMode && (
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Khmer Product Name</span>
            <input name="khmerName" value={form.khmerName} onChange={handleChange} className="input" placeholder="Optional Khmer name for customer menu" />
          </label>
          )}
          {!minimalRawItemMode && !isBaseMaterialType(form.productType) && (
            <>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Regular Price (KHR)</span>
                <input
                  name="regularPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.regularPrice}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Promotional Price (KHR)</span>
                <input
                  name="promotionalPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.promotionalPrice}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </label>
            </>
          )}
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-600">Category (English)</span>
            <input
              name="category"
              value={form.category}
              onChange={handleChange}
              className="input"
              placeholder="Enter English category"
              required
            />
          </label>
          {!minimalRawItemMode && (
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-600">Category (Khmer)</span>
            <input
              name="khmerCategory"
              value={form.khmerCategory}
              onChange={handleChange}
              className="input"
              placeholder="Enter Khmer category"
            />
          </label>
          )}
          {!minimalRawItemMode && isCompositeType(form.productType) && (
            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Combo Details</span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="input min-h-[96px] resize-y"
                placeholder="Describe what is included, change options, or other important combo details."
              />
            </label>
          )}
          {!minimalRawItemMode && (
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Khmer Description</span>
            <textarea
              name="khmerDescription"
              value={form.khmerDescription}
              onChange={handleChange}
              rows={3}
              className="input min-h-[96px] resize-y"
              placeholder="Optional Khmer description for customer menu."
            />
          </label>
          )}
          {!isCompositeType(form.productType) ? (
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">Parameter</span>
              <select name="stockUnit" value={form.stockUnit} onChange={handleChange} className="input">
                <option value="pieces">Piece</option>
                <option value="gram">Gram</option>
                <option value="teaspoon">Tea Spoon</option>
              </select>
            </label>
          ) : null}
          {!minimalRawItemMode && (
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-600">SKU (Optional)</span>
            <input name="sku" value={form.sku} onChange={handleChange} className="input" placeholder="Auto-generate if empty" />
          </label>
          )}
          {!minimalRawItemMode && (
          <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4">
              <p className="font-semibold text-slate-900">Partner SKUs (Optional)</p>
              <p className="text-sm text-slate-500">Leave these blank if you do not want to match incoming partner orders by SKU yet.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Foodpanda SKU (Optional)</span>
                <input
                  name="foodpandaSku"
                  value={form.foodpandaSku}
                  onChange={handleChange}
                  className="input"
                  placeholder="Foodpanda product SKU"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Grab SKU (Optional)</span>
                <input
                  name="grabSku"
                  value={form.grabSku}
                  onChange={handleChange}
                  className="input"
                  placeholder="Grab product SKU"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">E-Gates SKU (Optional)</span>
                <input
                  name="eGatesSku"
                  value={form.eGatesSku}
                  onChange={handleChange}
                  className="input"
                  placeholder="E-Gates product SKU"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">WOWNOW SKU (Optional)</span>
                <input
                  name="wownowSku"
                  value={form.wownowSku}
                  onChange={handleChange}
                  className="input"
                  placeholder="WOWNOW product SKU"
                />
              </label>
            </div>
          </div>
          )}
          {!minimalRawItemMode && (
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-600">For Sale</span>
            <select name="forSale" value={form.forSale} onChange={handleChange} className="input">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          )}
          {form.forSale === "true" && canManualTentativeCost(form.productType) && (
            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Tentative Cost Per Production (KHR)</span>
              <input
                name="tentativeCost"
                type="number"
                min="0"
                step="0.01"
                value={form.tentativeCost}
                onChange={handleChange}
                className="input"
                placeholder="Enter estimated production cost"
              />
              <span className="mt-2 block text-xs text-slate-500">
                This cost will be snapped into each order when the order is created or edited. If left empty, the system will use 40% of the offer price: {Number.isFinite(fallbackTentativeCost) ? fallbackTentativeCost.toFixed(2) : "0.00"} KHR.
              </span>
            </label>
          )}
          {form.forSale === "true" && form.productType === "combo_type" && (
            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Tentative Cost Per Production (Auto)</span>
              <input value={Number(comboTentativeCost || 0).toFixed(2)} readOnly className="input bg-slate-50 text-slate-700" />
              <span className="mt-2 block text-xs text-slate-500">
                Combo cost is calculated automatically from linked A La Catre and Combined item costs. If a linked item has no manual tentative cost, the system uses 40% of that linked item's offer price. It is not calculated from 40% of the combo selling price.
              </span>
            </label>
          )}

          {!minimalRawItemMode && !isCompositeType(form.productType) ? (
            <>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Stock</span>
                <input name="stock" type="number" min="0" value={form.stock} onChange={handleChange} className="input" required />
              </label>
              {form.productType === "seasoning" && (
                <label className="md:col-span-1">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">Per Order Consumption</span>
                  <input
                    name="seasoningPerOrderConsumption"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.seasoningPerOrderConsumption}
                    onChange={handleChange}
                    className="input"
                    placeholder={`Enter how many ${stockUnitLabel(form.stockUnit).toLowerCase()} are used per served order`}
                  />
                  <span className="mt-2 block text-xs text-slate-500">
                    This amount will be deducted automatically whenever an order is served.
                  </span>
                </label>
              )}
            </>
          ) : null}
          {!minimalRawItemMode && isCompositeType(form.productType) ? (
            <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{form.productType === "combo_type" ? "Combo Composition" : "Combined Composition"}</p>
                  <p className="text-sm text-slate-500">
                    {form.productType === "combo_type"
                      ? "Select the A La Catre and Combined items that will be included in this combo."
                      : "Select the Base, Combined, Combo, or A La Catre items that will be consumed when this product is sold."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      comboItems: [...current.comboItems, { product: "", quantity: 1, changeable: false, alternativeProducts: [] }]
                    }))
                  }
                  className="btn-secondary gap-2"
                >
                  <Plus size={16} />
                  Add Item
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {form.comboItems.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                    {form.productType === "combo_type"
                      ? "Add one or more A La Catre or Combined products for this combo."
                      : "Add one or more Base, Combined, Combo, or A La Catre products for this item."}
                  </p>
                ) : (
                  form.comboItems.map((item, index) => (
                    <div key={`${item.product || "new"}-${index}`} className="rounded-2xl bg-white p-4">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_120px_120px_auto]">
                        <SearchableProductSelect
                          label="Item"
                          value={item.product}
                          onChange={(event) => updateComboItem(index, { product: event.target.value })}
                          options={comboCompositionOptions}
                          placeholder="Select product"
                        />
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Qty</span>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity ?? ""}
                            onChange={(event) => {
                              const { value } = event.target;
                              updateComboItem(index, { quantity: value === "" ? "" : value });
                            }}
                            className="input"
                            required
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Changeable</span>
                          <select
                            value={item.changeable ? "true" : "false"}
                            onChange={(event) =>
                              updateComboItem(index, {
                                changeable: event.target.value === "true",
                                alternativeProducts: event.target.value === "true" ? item.alternativeProducts || [] : []
                              })
                            }
                            className="input"
                          >
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              comboItems: current.comboItems.filter((_, itemIndex) => itemIndex !== index)
                            }))
                          }
                          className="btn-secondary gap-2 self-end text-rose-600"
                        >
                          <Trash2 size={16} />
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          Type: {productTypeLabel(availableProducts.find((availableProduct) => availableProduct.id === item.product)?.productType)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          Unit: {stockUnitLabel(availableProducts.find((availableProduct) => availableProduct.id === item.product)?.stockUnit)}
                        </span>
                      </div>

                      {item.changeable && (
                        <div className="mt-4">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Replacement Products
                          </span>
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                            <SearchableProductSelect
                              value={replacementSelections[index]?.product || ""}
                              onChange={(event) =>
                                setReplacementSelections((current) => ({
                                  ...current,
                                  [index]: {
                                    product: event.target.value,
                                    priceAdjustment: current[index]?.priceAdjustment ?? ""
                                  }
                                }))
                              }
                              options={comboCompositionOptions}
                              placeholder="Select one product"
                              disabledIds={[
                                item.product,
                                ...((item.alternativeProducts || []).map((alternativeProduct) => alternativeProduct.product).filter(Boolean))
                              ]}
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={replacementSelections[index]?.priceAdjustment ?? ""}
                              onChange={(event) =>
                                setReplacementSelections((current) => ({
                                  ...current,
                                  [index]: {
                                    product: current[index]?.product || "",
                                    priceAdjustment: event.target.value
                                  }
                                }))
                              }
                              className="input"
                              placeholder="Price +/-"
                            />
                            <button type="button" onClick={() => addAlternativeProduct(index)} className="btn-secondary gap-2">
                              <Plus size={16} />
                              Add
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {(item.alternativeProducts || []).map((alternativeProduct) => {
                              const productId = alternativeProduct.product;
                              const alternativeProductInfo = availableProducts.find((availableProduct) => availableProduct.id === productId);
                              const priceAdjustment = Number(alternativeProduct.priceAdjustment || 0);

                              return (
                                <span
                                  key={productId}
                                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                                >
                                  <span>
                                    {alternativeProductInfo?.name || "Unknown product"}{" "}
                                    <span className={priceAdjustment >= 0 ? "text-emerald-600" : "text-amber-600"}>
                                      ({priceAdjustment >= 0 ? "+" : "-"}
                                      {Math.abs(priceAdjustment).toFixed(2)})
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeAlternativeProduct(index, productId)}
                                    className="rounded-full bg-white px-2 py-0.5 text-xs text-rose-600"
                                  >
                                    Remove
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Product image</span>
            <label
              className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition ${
                dragging ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-slate-50"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const nextFile = event.dataTransfer.files?.[0];
                if (nextFile) {
                  setFile(nextFile);
                }
              }}
            >
              {file ? <ImagePlus className="mb-3 text-brand-500" /> : <Package className="mb-3 text-slate-400" />}
              <span className="font-semibold text-slate-700">{file ? file.name : "Drag and drop an image or click to browse"}</span>
              <span className="mt-1 text-sm text-slate-500">PNG, JPG, WEBP up to 5MB</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary md:col-span-2">
            {submitting ? "Saving..." : product ? "Update Product" : "Create Product"}
          </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductFormModal;
