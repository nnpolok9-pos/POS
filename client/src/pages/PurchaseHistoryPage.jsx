import { Eye, Pencil, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import { productService } from "../services/productService";
import { procurementService } from "../services/procurementService";
import { currency, formatDate } from "../utils/format";

const todayInput = () => new Date().toISOString().slice(0, 10);
const paymentLabel = (value) => ({ cash: "Cash", card: "Card", qr: "QR", due: "Due" }[value] || value);

const PurchaseHistoryPage = () => {
  const [activeTab, setActiveTab] = useState("purchase");
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [entries, setEntries] = useState([]);
  const [costEntries, setCostEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailEntry, setDetailEntry] = useState(null);
  const [costDetailEntry, setCostDetailEntry] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [editCostEntry, setEditCostEntry] = useState(null);

  const totalAmount = entries.reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0);
  const totalItems = entries.reduce((sum, entry) => sum + (entry.items || []).length, 0);
  const totalCostAmount = costEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const dueCostAmount = costEntries.filter((entry) => entry.paymentMethod === "due").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await procurementService.getPurchases({ from: fromDate, to: toDate, search, paymentMethod });
      setEntries(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load purchase history");
    } finally {
      setLoading(false);
    }
  };

  const loadCosts = async () => {
    setLoading(true);
    try {
      const data = await procurementService.getCosts({ from: fromDate, to: toDate, search, paymentMethod });
      setCostEntries(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load cost history");
    } finally {
      setLoading(false);
    }
  };

  const loadCurrent = () => (activeTab === "cost" ? loadCosts() : loadEntries());

  useEffect(() => {
    loadEntries();
    loadCosts();
    productService.getAdminProducts().then(setProducts).catch(() => {});
    procurementService.getPurchaseUsers().then(setUsers).catch(() => {});
  }, []);

  const openEdit = (entry) => {
    setEditEntry({
      ...entry,
      items: (entry.items || []).map((item) => ({ ...item }))
    });
  };

  const updateEditItem = (index, nextValue) => {
    setEditEntry((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...nextValue } : item))
    }));
  };

  const saveEdit = async () => {
    try {
      await procurementService.updatePurchase(editEntry.id, editEntry);
      toast.success("Purchase entry updated");
      setEditEntry(null);
      loadEntries();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update purchase entry");
    }
  };

  const saveCostEdit = async () => {
    try {
      await procurementService.updateCost(editCostEntry.id, editCostEntry);
      toast.success("Cost entry updated");
      setEditCostEntry(null);
      loadCosts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update cost entry");
    }
  };

  const deleteEntry = async (entry) => {
    const pin = window.prompt(`Enter delete PIN for ${entry.supplierName}`);
    if (pin === null) return;
    try {
      await procurementService.deletePurchase(entry.id, pin);
      toast.success("Purchase entry deleted");
      loadEntries();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete purchase entry");
    }
  };

  const deleteCostEntry = async (entry) => {
    const pin = window.prompt(`Enter delete PIN for ${entry.costName}`);
    if (pin === null) return;
    try {
      await procurementService.deleteCost(entry.id, pin);
      toast.success("Cost entry deleted");
      loadCosts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete cost entry");
    }
  };

  const productOptions = useMemo(() => products.map((product) => ({ id: product.id, name: product.name, sku: product.sku })), [products]);

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="rounded-full bg-stone-700 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">Procurement & Cost</span>
            <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">Purchase & Cost History</h1>
            <p className="mt-1 text-sm text-slate-500">Review, edit, or delete purchase and cost entries within a selected period.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <ReportDatePicker label="From Date" value={fromDate} onChange={setFromDate} />
            <ReportDatePicker label="To Date" value={toDate} onChange={setToDate} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full bg-transparent outline-none"
              placeholder={activeTab === "cost" ? "Search cost name, user, or remarks" : "Search supplier or purchase ID"}
            />
          </div>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="input">
            <option value="">All Payment</option>
            <option value="cash">Cash</option>
            <option value="qr">QR</option>
            <option value="card">Card</option>
            <option value="due">Due</option>
          </select>
          <button type="button" onClick={loadCurrent} className="btn-primary">Generate</button>
        </div>
      </section>

      <section className="glass-card p-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["purchase", "Purchase History"],
            ["cost", "Cost History"]
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

      <section className="grid gap-4 md:grid-cols-3">
        {activeTab === "cost" ? (
          <>
            <div className="metric-card"><p className="metric-label">Cost Entries</p><p className="metric-value">{costEntries.length}</p></div>
            <div className="metric-card"><p className="metric-label">Due Cost</p><p className="metric-value">{currency(dueCostAmount)}</p></div>
            <div className="metric-card bg-slate-950 text-white"><p className="metric-label text-white/65">Total Cost</p><p className="metric-value text-white">{currency(totalCostAmount)}</p></div>
          </>
        ) : (
          <>
            <div className="metric-card"><p className="metric-label">Purchases</p><p className="metric-value">{entries.length}</p></div>
            <div className="metric-card"><p className="metric-label">Purchase Lines</p><p className="metric-value">{totalItems}</p></div>
            <div className="metric-card bg-slate-950 text-white"><p className="metric-label text-white/65">Total Purchase</p><p className="metric-value text-white">{currency(totalAmount)}</p></div>
          </>
        )}
      </section>

      {activeTab === "cost" ? (
        <section className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-4">SL</th>
                  <th className="px-5 py-4">Cost Name</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Handled By</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {costEntries.map((entry, index) => (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{entry.costName}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(entry.createdAt)}</td>
                    <td className="px-5 py-4">{paymentLabel(entry.paymentMethod)}</td>
                    <td className="px-5 py-4">{entry.handledByUserName || "-"}</td>
                    <td className="px-5 py-4 font-bold text-orange-600">{currency(entry.amount)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setCostDetailEntry(entry)} className="btn-secondary gap-2"><Eye size={15} /> View</button>
                        <button type="button" onClick={() => setEditCostEntry(entry)} className="btn-secondary gap-2"><Pencil size={15} /> Edit</button>
                        <button type="button" onClick={() => deleteCostEntry(entry)} className="btn-secondary gap-2 text-rose-600"><Trash2 size={15} /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!costEntries.length ? (
                  <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-500">{loading ? "Loading..." : "No cost entry found."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-4">SL</th>
                  <th className="px-5 py-4">Supplier</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Handled By</th>
                  <th className="px-5 py-4">Items</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{entry.supplierName}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(entry.createdAt)}</td>
                    <td className="px-5 py-4">{paymentLabel(entry.paymentMethod)}</td>
                    <td className="px-5 py-4">{entry.handledByUserName || "-"}</td>
                    <td className="px-5 py-4">{entry.items?.length || 0}</td>
                    <td className="px-5 py-4 font-bold text-orange-600">{currency(entry.totalAmount)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setDetailEntry(entry)} className="btn-secondary gap-2"><Eye size={15} /> View</button>
                        <button type="button" onClick={() => openEdit(entry)} className="btn-secondary gap-2"><Pencil size={15} /> Edit</button>
                        <button type="button" onClick={() => deleteEntry(entry)} className="btn-secondary gap-2 text-rose-600"><Trash2 size={15} /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!entries.length ? (
                  <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-500">{loading ? "Loading..." : "No purchase entry found."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {detailEntry ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">{detailEntry.supplierName}</h2>
                <p className="text-sm text-slate-500">{formatDate(detailEntry.createdAt)} - {paymentLabel(detailEntry.paymentMethod)}</p>
              </div>
              <button type="button" onClick={() => setDetailEntry(null)} className="btn-secondary">Close</button>
            </div>
            <div className="mt-5 space-y-3">
              {detailEntry.items?.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{item.productName}</p>
                      <p className="text-sm text-slate-500">{item.quantity} {item.unitName} - Unit {currency(item.unitPrice)}</p>
                    </div>
                    <p className="font-bold text-orange-600">{currency(item.totalAmount)}</p>
                  </div>
                  {item.remarks ? <p className="mt-2 text-sm text-slate-500">{item.remarks}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {costDetailEntry ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">{costDetailEntry.costName}</h2>
                <p className="text-sm text-slate-500">{formatDate(costDetailEntry.createdAt)} - {paymentLabel(costDetailEntry.paymentMethod)}</p>
              </div>
              <button type="button" onClick={() => setCostDetailEntry(null)} className="btn-secondary">Close</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="metric-label">Amount</p><p className="metric-value">{currency(costDetailEntry.amount)}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="metric-label">Handled By</p><p className="metric-value text-lg">{costDetailEntry.handledByUserName || "-"}</p></div>
            </div>
            {costDetailEntry.remarks ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{costDetailEntry.remarks}</p> : null}
          </div>
        </div>
      ) : null}

      {editCostEntry ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-slate-900">Edit Cost</h2>
              <button type="button" onClick={() => setEditCostEntry(null)} className="btn-secondary">Close</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Cost Name</span>
                <input value={editCostEntry.costName} onChange={(event) => setEditCostEntry((current) => ({ ...current, costName: event.target.value }))} className="input" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Amount</span>
                <input type="number" min="0" value={editCostEntry.amount} onChange={(event) => setEditCostEntry((current) => ({ ...current, amount: event.target.value }))} className="input" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Payment Method</span>
                <select value={editCostEntry.paymentMethod} onChange={(event) => setEditCostEntry((current) => ({ ...current, paymentMethod: event.target.value }))} className="input">
                  <option value="cash">Cash</option>
                  <option value="qr">QR</option>
                  <option value="card">Card</option>
                  <option value="due">Due</option>
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">{editCostEntry.paymentMethod === "due" ? "Due Created By" : "Paid By"}</span>
                <select value={editCostEntry.handledByUserId || ""} onChange={(event) => {
                  const user = users.find((entry) => entry.id === event.target.value);
                  setEditCostEntry((current) => ({ ...current, handledByUserId: event.target.value, handledByUserName: user?.name || "" }));
                }} className="input">
                  <option value="">Select user</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-600">Remarks</span>
                <textarea value={editCostEntry.remarks || ""} onChange={(event) => setEditCostEntry((current) => ({ ...current, remarks: event.target.value }))} className="input min-h-[96px]" />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={saveCostEdit} className="btn-primary">Update Cost</button>
            </div>
          </div>
        </div>
      ) : null}

      {editEntry ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto max-w-4xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-slate-900">Edit Purchase</h2>
              <button type="button" onClick={() => setEditEntry(null)} className="btn-secondary">Close</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Supplier Name</span>
                <input value={editEntry.supplierName} onChange={(event) => setEditEntry((current) => ({ ...current, supplierName: event.target.value }))} className="input" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Payment Method</span>
                <select value={editEntry.paymentMethod} onChange={(event) => setEditEntry((current) => ({ ...current, paymentMethod: event.target.value }))} className="input">
                  <option value="cash">Cash</option>
                  <option value="qr">QR</option>
                  <option value="card">Card</option>
                  <option value="due">Due</option>
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">{editEntry.paymentMethod === "due" ? "Due Created By" : "Paid By"}</span>
                <select value={editEntry.handledByUserId || ""} onChange={(event) => {
                  const user = users.find((entry) => entry.id === event.target.value);
                  setEditEntry((current) => ({ ...current, handledByUserId: event.target.value, handledByUserName: user?.name || "" }));
                }} className="input">
                  <option value="">Select user</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5 space-y-3">
              {editEntry.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_120px_120px_160px]">
                  <select value={item.productId} onChange={(event) => {
                    const product = productOptions.find((entry) => entry.id === event.target.value);
                    updateEditItem(index, { productId: event.target.value, productName: product?.name || item.productName, sku: product?.sku || item.sku });
                  }} className="input">
                    {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                  <input type="number" min="0" step="0.001" value={item.quantity} onChange={(event) => updateEditItem(index, { quantity: event.target.value })} className="input" />
                  <input value={item.unitName} onChange={(event) => updateEditItem(index, { unitName: event.target.value })} className="input" />
                  <input type="number" min="0" step="0.01" value={item.totalAmount} onChange={(event) => updateEditItem(index, { totalAmount: event.target.value })} className="input" />
                  <textarea value={item.remarks || ""} onChange={(event) => updateEditItem(index, { remarks: event.target.value })} className="input md:col-span-4" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={saveEdit} className="btn-primary">Update Purchase</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PurchaseHistoryPage;
