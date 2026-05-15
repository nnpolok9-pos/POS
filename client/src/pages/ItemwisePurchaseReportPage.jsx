import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import { procurementService } from "../services/procurementService";
import { currency } from "../utils/format";

const todayInput = () => new Date().toISOString().slice(0, 10);

const ItemwisePurchaseReportPage = () => {
  const [activeTab, setActiveTab] = useState("purchase");
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [costRows, setCostRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const totals = rows.reduce(
    (acc, row) => ({
      quantity: acc.quantity + Number(row.totalQuantity || 0),
      amount: acc.amount + Number(row.totalAmount || 0),
      purchases: acc.purchases + Number(row.purchaseCount || 0)
    }),
    { quantity: 0, amount: 0, purchases: 0 }
  );

  const costTotals = costRows.reduce(
    (acc, row) => ({
      amount: acc.amount + Number(row.totalAmount || 0),
      paid: acc.paid + Number(row.paidAmount || 0),
      due: acc.due + Number(row.dueAmount || 0),
      entries: acc.entries + Number(row.entryCount || 0)
    }),
    { amount: 0, paid: 0, due: 0, entries: 0 }
  );

  const loadPurchaseReport = async () => {
    setLoading(true);
    try {
      const data = await procurementService.getItemwiseReport({ from: fromDate, to: toDate, search });
      setRows(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load itemwise purchase report");
    } finally {
      setLoading(false);
    }
  };

  const loadCostReport = async () => {
    setLoading(true);
    try {
      const data = await procurementService.getCostwiseReport({ from: fromDate, to: toDate, search });
      setCostRows(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load cost report");
    } finally {
      setLoading(false);
    }
  };

  const loadReport = () => (activeTab === "cost" ? loadCostReport() : loadPurchaseReport());

  useEffect(() => {
    loadPurchaseReport();
    loadCostReport();
  }, []);

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="rounded-full bg-stone-700 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">Procurement & Cost</span>
            <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">Itemwise & Cost Report</h1>
            <p className="mt-1 text-sm text-slate-500">Track purchased item quantities and cost names within a selected date range.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <ReportDatePicker label="From Date" value={fromDate} onChange={setFromDate} />
            <ReportDatePicker label="To Date" value={toDate} onChange={setToDate} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full bg-transparent outline-none"
              placeholder={activeTab === "cost" ? "Search cost name, user, or remarks" : "Search product name or SKU"}
            />
          </div>
          <button type="button" onClick={loadReport} className="btn-primary">Generate Report</button>
        </div>
      </section>

      <section className="glass-card p-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["purchase", "Purchase"],
            ["cost", "Cost"]
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

      <section className="grid gap-4 md:grid-cols-4">
        {activeTab === "cost" ? (
          <>
            <div className="metric-card"><p className="metric-label">Cost Names</p><p className="metric-value">{costRows.length}</p></div>
            <div className="metric-card"><p className="metric-label">Entries</p><p className="metric-value">{costTotals.entries}</p></div>
            <div className="metric-card"><p className="metric-label">Due Cost</p><p className="metric-value">{currency(costTotals.due)}</p></div>
            <div className="metric-card bg-slate-950 text-white"><p className="metric-label text-white/65">Total Cost</p><p className="metric-value text-white">{currency(costTotals.amount)}</p></div>
          </>
        ) : (
          <>
            <div className="metric-card"><p className="metric-label">Products</p><p className="metric-value">{rows.length}</p></div>
            <div className="metric-card"><p className="metric-label">Purchase Count</p><p className="metric-value">{totals.purchases}</p></div>
            <div className="metric-card"><p className="metric-label">Total Quantity</p><p className="metric-value">{totals.quantity.toLocaleString()}</p></div>
            <div className="metric-card bg-slate-950 text-white"><p className="metric-label text-white/65">Total Amount</p><p className="metric-value text-white">{currency(totals.amount)}</p></div>
          </>
        )}
      </section>

      <section className="glass-card overflow-hidden">
        <div className="space-y-3 p-4 md:hidden">
          {activeTab === "cost" ? (
            <>
              {costRows.map((row, index) => (
                <div key={row.costNameId || row.costName} className="rounded-3xl border border-slate-100 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cost #{index + 1}</p>
                      <p className="mt-1 font-bold text-slate-900">{row.costName}</p>
                      <p className="text-xs text-slate-500">{row.entryCount} entries</p>
                    </div>
                    <p className="rounded-2xl bg-orange-50 px-3 py-2 text-right text-sm font-extrabold text-orange-600">{currency(row.totalAmount)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Paid</p>
                      <p className="mt-1 font-bold text-slate-900">{currency(row.paidAmount)}</p>
                    </div>
                    <div className="rounded-2xl bg-rose-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-400">Due</p>
                      <p className="mt-1 font-bold text-rose-600">{currency(row.dueAmount)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!costRows.length ? (
                <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? "Loading..." : "No cost report data found."}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {rows.map((row, index) => (
                <div key={`${row.productId}-${row.unitName}`} className="rounded-3xl border border-slate-100 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Item #{index + 1}</p>
                      <p className="mt-1 font-bold text-slate-900">{row.productName}</p>
                      <p className="text-xs text-slate-500">{row.sku || "No SKU"} • {row.unitName}</p>
                    </div>
                    <p className="rounded-2xl bg-orange-50 px-3 py-2 text-right text-sm font-extrabold text-orange-600">{currency(row.totalAmount)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Qty</p>
                      <p className="mt-1 font-bold text-slate-900">{Number(row.totalQuantity || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Unit</p>
                      <p className="mt-1 font-bold text-slate-900">{currency(row.averageUnitPrice)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Entries</p>
                      <p className="mt-1 font-bold text-slate-900">{row.purchaseCount}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!rows.length ? (
                <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  {loading ? "Loading..." : "No itemwise purchase data found."}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          {activeTab === "cost" ? (
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-4">SL</th>
                  <th className="px-5 py-4">Cost Name</th>
                  <th className="px-5 py-4">Entries</th>
                  <th className="px-5 py-4">Paid Amount</th>
                  <th className="px-5 py-4">Due Amount</th>
                  <th className="px-5 py-4">Total Amount</th>
                  <th className="px-5 py-4">First Entry</th>
                  <th className="px-5 py-4">Last Entry</th>
                </tr>
              </thead>
              <tbody>
                {costRows.map((row, index) => (
                  <tr key={row.costNameId || row.costName} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{row.costName}</td>
                    <td className="px-5 py-4">{row.entryCount}</td>
                    <td className="px-5 py-4">{currency(row.paidAmount)}</td>
                    <td className="px-5 py-4">{currency(row.dueAmount)}</td>
                    <td className="px-5 py-4 font-bold text-orange-600">{currency(row.totalAmount)}</td>
                    <td className="px-5 py-4 text-slate-500">{row.firstCostAt ? new Date(row.firstCostAt).toLocaleDateString() : "N/A"}</td>
                    <td className="px-5 py-4 text-slate-500">{row.lastCostAt ? new Date(row.lastCostAt).toLocaleDateString() : "N/A"}</td>
                  </tr>
                ))}
                {!costRows.length ? (
                  <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-500">{loading ? "Loading..." : "No cost report data found."}</td></tr>
                ) : null}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-4">SL</th>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">SKU</th>
                  <th className="px-5 py-4">Unit</th>
                  <th className="px-5 py-4">Purchased Qty</th>
                  <th className="px-5 py-4">Total Amount</th>
                  <th className="px-5 py-4">Avg Unit Price</th>
                  <th className="px-5 py-4">Entries</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.productId}-${row.unitName}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{row.productName}</td>
                    <td className="px-5 py-4 text-slate-500">{row.sku || "N/A"}</td>
                    <td className="px-5 py-4">{row.unitName}</td>
                    <td className="px-5 py-4 font-bold">{Number(row.totalQuantity || 0).toLocaleString()}</td>
                    <td className="px-5 py-4 font-bold text-orange-600">{currency(row.totalAmount)}</td>
                    <td className="px-5 py-4">{currency(row.averageUnitPrice)}</td>
                    <td className="px-5 py-4">{row.purchaseCount}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-500">{loading ? "Loading..." : "No itemwise purchase data found."}</td></tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default ItemwisePurchaseReportPage;
