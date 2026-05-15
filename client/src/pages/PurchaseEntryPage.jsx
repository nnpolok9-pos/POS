import { Check, ChevronDown, Plus, Search, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ProductFormModal from "../components/ProductFormModal";
import { productService } from "../services/productService";
import { procurementService } from "../services/procurementService";
import { currency, imageUrl } from "../utils/format";

const unitLabel = (value) => {
  const labels = { pieces: "Piece", gram: "Gram", teaspoon: "Tea Spoon" };
  return labels[value] || value || "Piece";
};

const productTypeLabel = (type) =>
  ({
    combo: "Combined",
    combo_type: "Combo",
    raw_material: "Base",
    sauce: "Sauce",
    seasoning: "Seasoning",
    raw_item: "Raw-Items",
    raw: "A La Catre"
  })[type] || "A La Catre";

const emptyItem = {
  productId: "",
  quantity: "",
  unitName: "",
  totalAmount: "",
  remarks: ""
};

const emptyCostForm = {
  costName: "",
  amount: "",
  paymentMethod: "",
  handledByUserId: "",
  remarks: ""
};

const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

const paymentLabel = (value) => ({ cash: "Cash", qr: "QR", card: "Card", due: "Due" }[value] || value);

const BalancePreview = ({ balance }) => {
  if (!balance) {
    return null;
  }

  const amount = Number(balance.amount || 0);
  if (!amount) {
    return (
      <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500">
        Balance: {currency(0)}
      </p>
    );
  }

  const isPayable = amount > 0;
  return (
    <p className={`mt-2 rounded-2xl px-3 py-2 text-sm font-extrabold ${isPayable ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
      {isPayable ? `Payable (${currency(amount)})` : `Receivable ${currency(Math.abs(amount))}`}
    </p>
  );
};

const SearchableProductField = ({ products, value, onSelect, onCreateProduct }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selected = products.find((product) => product.id === value);
  const filtered = products
    .filter((product) => {
      const term = [
        product.name,
        product.khmerName,
        product.sku,
        product.category,
        product.categoryKhmer,
        product.productType,
        productTypeLabel(product.productType),
        unitLabel(product.stockUnit)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return term.includes(search.toLowerCase());
    })
    .slice(0, 30);

  return (
    <div className="relative">
      <label>
        <span className="mb-2 block text-sm font-semibold text-slate-600">Select Product</span>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="input flex items-center justify-between text-left"
        >
          <span className={selected ? "text-slate-900" : "text-slate-400"}>
            {selected ? `${selected.name} (${unitLabel(selected.stockUnit)})` : "Search and select product"}
          </span>
          <ChevronDown size={16} />
        </button>
      </label>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search product name, SKU, category, or type"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateProduct?.();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-50 px-4 py-2 text-sm font-bold text-orange-600 transition hover:bg-orange-100"
            >
              <Plus size={15} />
              New Raw-Item
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  onSelect(product);
                  setSearch("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-orange-50"
              >
                <img src={imageUrl(product.image)} alt={product.name} className="h-10 w-10 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{product.name}</span>
                  <span className="block text-xs text-slate-500">{product.sku || "No SKU"} • {unitLabel(product.stockUnit)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const PurchaseEntryPage = () => {
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [costNames, setCostNames] = useState([]);
  const [users, setUsers] = useState([]);
  const [paymentBalances, setPaymentBalances] = useState({ vendors: [], users: [] });
  const [activeTab, setActiveTab] = useState("purchase");
  const [item, setItem] = useState(emptyItem);
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [supplierName, setSupplierName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [handledByUserId, setHandledByUserId] = useState("");
  const [costForm, setCostForm] = useState(emptyCostForm);
  const [paymentForm, setPaymentForm] = useState({ paymentType: "vendor", vendorId: "", userId: "", amount: "", paymentMethod: "", remarks: "" });
  const [rawItemModalOpen, setRawItemModalOpen] = useState(false);
  const [rawItemSubmitting, setRawItemSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProducts = () =>
    productService.getAdminProducts().then(setProducts).catch(() => toast.error("Failed to load products"));

  const loadPaymentBalances = () =>
    procurementService
      .getVendorWiseReport()
      .then((data) => setPaymentBalances({ vendors: data.vendors || [], users: data.users || [] }))
      .catch(() => {});

  useEffect(() => {
    loadProducts();
    procurementService.getVendors().then(setVendors).catch(() => {});
    procurementService.getCostNames().then(setCostNames).catch(() => {});
    procurementService.getPurchaseUsers().then(setUsers).catch(() => {});
    loadPaymentBalances();
  }, []);

  const unitPrice = useMemo(() => {
    const quantity = Number(item.quantity || 0);
    const totalAmount = Number(item.totalAmount || 0);
    return quantity > 0 ? totalAmount / quantity : 0;
  }, [item.quantity, item.totalAmount]);

  const totalPurchaseAmount = items.reduce((sum, purchaseItem) => sum + Number(purchaseItem.totalAmount || 0), 0);
  const supplierSuggestions = useMemo(() => {
    const query = supplierName.trim().toLowerCase();
    if (!query) return vendors.slice(0, 8);
    return vendors.filter((vendor) => vendor.name.toLowerCase().includes(query)).slice(0, 8);
  }, [supplierName, vendors]);
  const costSuggestions = useMemo(() => {
    const query = normalizeText(costForm.costName);
    if (!query) return costNames.slice(0, 8);
    return costNames.filter((entry) => normalizeText(entry.name).includes(query)).slice(0, 8);
  }, [costForm.costName, costNames]);
  const selectedPaymentBalance = useMemo(() => {
    if (paymentForm.paymentType === "vendor") {
      const vendor = paymentBalances.vendors.find((entry) => String(entry.id) === String(paymentForm.vendorId));
      return vendor ? { amount: vendor.balanceDue } : null;
    }
    const user = paymentBalances.users.find((entry) => String(entry.id) === String(paymentForm.userId));
    return user ? { amount: user.balance } : null;
  }, [paymentBalances, paymentForm.paymentType, paymentForm.userId, paymentForm.vendorId]);

  const addItem = () => {
    const product = products.find((entry) => entry.id === item.productId);
    const quantity = Number(item.quantity || 0);
    const totalAmount = Number(item.totalAmount || 0);

    if (!product) {
      toast.error("Please select a product");
      return;
    }

    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    if (totalAmount < 0) {
      toast.error("Total purchase amount cannot be negative");
      return;
    }

    setItems((current) => [
      ...current,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku || "",
        quantity,
        unitName: item.unitName || unitLabel(product.stockUnit),
        totalAmount,
        unitPrice: quantity > 0 ? totalAmount / quantity : 0,
        remarks: item.remarks || ""
      }
    ]);
    setItem(emptyItem);
  };

  const createRawItemProduct = async (formData) => {
    setRawItemSubmitting(true);
    try {
      const createdProduct = await productService.createProduct(formData);
      const refreshedProducts = await productService.getAdminProducts();
      setProducts(refreshedProducts);
      setRawItemModalOpen(false);
      setItem((current) => ({
        ...current,
        productId: createdProduct.id,
        unitName: unitLabel(createdProduct.stockUnit)
      }));
      toast.success("Raw-Item created and selected");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create Raw-Item");
    } finally {
      setRawItemSubmitting(false);
    }
  };

  const savePurchase = async () => {
    if (!items.length) {
      toast.error("Add at least one purchase item");
      return;
    }

    if (!supplierName.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    if (!paymentMethod) {
      toast.error("Select Cash, QR, Card, or Due");
      return;
    }
    if (!handledByUserId) {
      toast.error("Select who paid or created the due purchase");
      return;
    }

    setSaving(true);
    try {
      await procurementService.createPurchase({
        supplierName,
        paymentMethod,
        handledByUserId,
        items
      });
      toast.success("Purchase entry saved");
      procurementService.getVendors().then(setVendors).catch(() => {});
      setItems([]);
      setSupplierName("");
      setPaymentMethod("");
      setHandledByUserId("");
      setExpanded(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save purchase");
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    if (!paymentForm.paymentMethod) {
      toast.error("Select payment method");
      return;
    }
    if (Number(paymentForm.amount || 0) <= 0) {
      toast.error("Enter payment amount");
      return;
    }
    if (paymentForm.paymentType === "vendor" && !paymentForm.vendorId) {
      toast.error("Select vendor");
      return;
    }
    if (paymentForm.paymentType === "staff" && !paymentForm.userId) {
      toast.error("Select staff/admin user");
      return;
    }

    setSaving(true);
    try {
      await procurementService.createPayment(paymentForm);
      toast.success("Payment recorded");
      setPaymentForm({ paymentType: "vendor", vendorId: "", userId: "", amount: "", paymentMethod: "", remarks: "" });
      loadPaymentBalances();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  const saveCost = async () => {
    if (!costForm.costName.trim()) {
      toast.error("Cost name is required");
      return;
    }
    if (Number(costForm.amount || 0) <= 0) {
      toast.error("Enter cost amount");
      return;
    }
    if (!costForm.paymentMethod) {
      toast.error("Select Cash, QR, Card, or Due");
      return;
    }
    if (!costForm.handledByUserId) {
      toast.error("Select who paid or created the due cost");
      return;
    }

    setSaving(true);
    try {
      await procurementService.createCost(costForm);
      toast.success("Cost entry saved");
      setCostForm(emptyCostForm);
      procurementService.getCostNames().then(setCostNames).catch(() => {});
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save cost");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="rounded-full bg-stone-700 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">Procurement & Cost</span>
            <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">Purchase and Cost Entry</h1>
            <p className="mt-1 text-sm text-slate-500">Record product purchases, operating costs, and supplier or staff payments from one place.</p>
          </div>
          <div className="rounded-3xl bg-slate-950 px-5 py-3 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Current Draft</p>
            <p className="font-display text-2xl font-bold">{items.length} items</p>
            <p className="text-sm text-white/75">{currency(totalPurchaseAmount)}</p>
          </div>
        </div>
      </section>

      <section className="glass-card p-2">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["purchase", "Purchase"],
            ["cost", "Cost"],
            ["payment", "Vendor / Staff Payment"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                activeTab === key ? "bg-slate-950 text-white shadow-lg" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "payment" ? (
        <section className="glass-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-2xl bg-orange-50 p-3 text-orange-600"><WalletCards size={20} /></span>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Record Vendor or Staff Payment</h2>
              <p className="text-sm text-slate-500">Vendor payment reduces supplier due. Staff payment reduces staff reimbursement balance.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">Payment To</span>
              <select value={paymentForm.paymentType} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentType: event.target.value, vendorId: "", userId: "" }))} className="input">
                <option value="vendor">Vendor</option>
                <option value="staff">Staff/Admin</option>
              </select>
            </label>
            {paymentForm.paymentType === "vendor" ? (
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Vendor</span>
                <select value={paymentForm.vendorId} onChange={(event) => setPaymentForm((current) => ({ ...current, vendorId: event.target.value }))} className="input">
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
                <BalancePreview balance={selectedPaymentBalance} />
              </label>
            ) : (
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Staff/Admin User</span>
                <select value={paymentForm.userId} onChange={(event) => setPaymentForm((current) => ({ ...current, userId: event.target.value }))} className="input">
                  <option value="">Select user</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
                </select>
                <BalancePreview balance={selectedPaymentBalance} />
              </label>
            )}
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">Payment Method</span>
              <select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="input">
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="qr">QR</option>
                <option value="card">Card</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">Amount</span>
              <input type="number" min="0" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} className="input" placeholder="0" />
            </label>
            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Remarks</span>
              <input value={paymentForm.remarks} onChange={(event) => setPaymentForm((current) => ({ ...current, remarks: event.target.value }))} className="input" placeholder="Optional note" />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={saving} onClick={savePayment} className="btn-primary">Save Payment</button>
          </div>
        </section>
      ) : null}

      {activeTab === "cost" ? (
        <section className="glass-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-2xl bg-rose-50 p-3 text-rose-600"><WalletCards size={20} /></span>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Record Cost Entry</h2>
              <p className="text-sm text-slate-500">Use reusable cost names for rent, utilities, packaging, maintenance, and other operating costs.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="relative md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Cost Name</span>
              <input
                value={costForm.costName}
                onChange={(event) => setCostForm((current) => ({ ...current, costName: event.target.value }))}
                className="input"
                placeholder="Example: Electricity bill, packaging, transport"
              />
              {costSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
                  {costSuggestions.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setCostForm((current) => ({ ...current, costName: entry.name }))}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-orange-50"
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">Amount (KHR)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costForm.amount}
                onChange={(event) => setCostForm((current) => ({ ...current, amount: event.target.value }))}
                className="input"
                placeholder="0"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">Payment Method</span>
              <select value={costForm.paymentMethod} onChange={(event) => setCostForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="input">
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="qr">QR</option>
                <option value="card">Card</option>
                <option value="due">Due</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">{costForm.paymentMethod === "due" ? "Due Created By" : "Paid By"}</span>
              <select value={costForm.handledByUserId} onChange={(event) => setCostForm((current) => ({ ...current, handledByUserId: event.target.value }))} className="input">
                <option value="">Select user</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
              </select>
            </label>
            <label className="md:col-span-2 xl:col-span-3">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Remarks</span>
              <textarea
                value={costForm.remarks}
                onChange={(event) => setCostForm((current) => ({ ...current, remarks: event.target.value }))}
                className="input min-h-[96px]"
                placeholder="Optional note for this cost"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={saving} onClick={saveCost} className="btn-primary">
              {saving ? "Saving..." : "Save Cost Entry"}
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === "purchase" ? (
      <>
      <section className="glass-card p-5">
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.55fr_0.55fr]">
          <SearchableProductField
            products={products}
            value={item.productId}
            onCreateProduct={() => setRawItemModalOpen(true)}
            onSelect={(product) =>
              setItem((current) => ({
                ...current,
                productId: product.id,
                unitName: unitLabel(product.stockUnit)
              }))
            }
          />
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-600">Quantity</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={item.quantity}
              onChange={(event) => setItem((current) => ({ ...current, quantity: event.target.value }))}
              className="input"
              placeholder="0"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-600">Unit Name</span>
            <input
              value={item.unitName}
              onChange={(event) => setItem((current) => ({ ...current, unitName: event.target.value }))}
              className="input"
              placeholder="Piece, Gram, Tea Spoon"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-600">Total Purchase Amount (KHR)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.totalAmount}
              onChange={(event) => setItem((current) => ({ ...current, totalAmount: event.target.value }))}
              className="input"
              placeholder="0"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-600">Unit Price (Auto)</span>
            <input value={Number(unitPrice || 0).toFixed(2)} readOnly className="input bg-slate-50" />
          </label>
          <label className="lg:col-span-3">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Remarks</span>
            <textarea
              value={item.remarks}
              onChange={(event) => setItem((current) => ({ ...current, remarks: event.target.value }))}
              className="input min-h-[86px]"
              placeholder="Optional note for this item"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={addItem} className="btn-primary gap-2">
            <Plus size={16} />
            Add New Purchase Info
          </button>
        </div>
      </section>

      <section className="glass-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Draft Purchase Lines</h2>
            <p className="text-sm text-slate-500">Open details if you need to review remarks or unit pricing before saving.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">{items.length} lines</span>
        </div>

        <div className="mt-4 space-y-3">
          {items.length ? (
            items.map((purchaseItem, index) => (
              <div key={`${purchaseItem.productId}-${index}`} className="rounded-3xl border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{purchaseItem.productName}</p>
                    <p className="text-sm text-slate-500">
                      {purchaseItem.quantity} {purchaseItem.unitName} • {currency(purchaseItem.totalAmount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setExpanded(expanded === index ? null : index)} className="btn-secondary">
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="btn-secondary text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {expanded === index ? (
                  <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-3">
                    <p><span className="font-semibold text-slate-900">SKU:</span> {purchaseItem.sku || "N/A"}</p>
                    <p><span className="font-semibold text-slate-900">Unit Price:</span> {currency(purchaseItem.unitPrice)}</p>
                    <p><span className="font-semibold text-slate-900">Remarks:</span> {purchaseItem.remarks || "No remarks"}</p>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 px-5 py-8 text-center text-slate-500">No purchase line added yet.</p>
          )}
        </div>
      </section>

      {items.length ? (
        <section className="glass-card p-5">
          <h2 className="font-display text-xl font-bold text-slate-900">Finish Purchase Entry</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_220px_260px_auto] xl:items-end">
            <label className="relative">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Supplier Name</span>
              <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className="input" placeholder="Enter supplier name" />
              {supplierSuggestions.length ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
                  {supplierSuggestions.map((vendor) => (
                    <button key={vendor.id} type="button" onClick={() => setSupplierName(vendor.name)} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-orange-50">
                      {vendor.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">Payment Method</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="input">
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="qr">QR</option>
                <option value="card">Card</option>
                <option value="due">Due</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-600">
                {paymentMethod === "due" ? "Due Created By" : "Paid By"}
              </span>
              <select value={handledByUserId} onChange={(event) => setHandledByUserId(event.target.value)} className="input">
                <option value="">Select user</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
              </select>
            </label>
            <button type="button" disabled={saving} onClick={savePurchase} className="btn-primary gap-2">
              <Check size={16} />
              {saving ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </section>
      ) : null}
      </>
      ) : null}
      <ProductFormModal
        open={rawItemModalOpen}
        onClose={() => setRawItemModalOpen(false)}
        onSubmit={createRawItemProduct}
        submitting={rawItemSubmitting}
        rawProducts={products}
        forcedProductType="raw_item"
      />
    </div>
  );
};

export default PurchaseEntryPage;
