import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import { procurementService } from "../services/procurementService";
import { currency } from "../utils/format";

const todayInput = () => new Date().toISOString().slice(0, 10);

const VendorWisePurchaseReportPage = () => {
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [vendors, setVendors] = useState([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [search, setSearch] = useState("");
  const [report, setReport] = useState({ vendors: [], users: [], summary: {} });
  const [loading, setLoading] = useState(false);

  const filteredVendors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vendors.filter((vendor) => !query || vendor.name.toLowerCase().includes(query));
  }, [search, vendors]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await procurementService.getVendorWiseReport({
        from: fromDate,
        to: toDate,
        vendorIds: selectedVendorIds.join(",")
      });
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load vendor wise report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    procurementService.getVendors().then(setVendors).catch(() => {});
    loadReport();
  }, []);

  const toggleVendor = (vendorId) => {
    setSelectedVendorIds((current) =>
      current.includes(vendorId) ? current.filter((id) => id !== vendorId) : [...current, vendorId]
    );
  };

  const summary = report.summary || {};

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="rounded-full bg-stone-700 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">Procurement</span>
            <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">Vendor Wise Report</h1>
            <p className="mt-1 text-sm text-slate-500">Track supplier due, vendor payments, staff reimbursement, and staff advance balances.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <ReportDatePicker label="From Date" value={fromDate} onChange={setFromDate} />
            <ReportDatePicker label="To Date" value={toDate} onChange={setToDate} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3">
              <Search size={16} className="text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 w-full bg-transparent outline-none" placeholder="Search and select one or multiple vendors" />
            </div>
            <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
              <button type="button" onClick={() => setSelectedVendorIds([])} className={`rounded-full px-4 py-2 text-sm font-bold ${!selectedVendorIds.length ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>All Vendors</button>
              {filteredVendors.map((vendor) => (
                <button key={vendor.id} type="button" onClick={() => toggleVendor(vendor.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${selectedVendorIds.includes(vendor.id) ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {vendor.name}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={loadReport} className="btn-primary h-12">{loading ? "Loading..." : "Generate"}</button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="metric-card"><p className="metric-label">Purchases</p><p className="metric-value">{currency(summary.purchaseAmount)}</p></div>
        <div className="metric-card"><p className="metric-label">Due Purchases</p><p className="metric-value">{currency(summary.duePurchases)}</p></div>
        <div className="metric-card"><p className="metric-label">Vendor Paid</p><p className="metric-value">{currency(summary.vendorPayments)}</p></div>
        <div className="metric-card bg-slate-950 text-white"><p className="metric-label text-white/65">Vendor Due</p><p className="metric-value text-white">{currency(summary.vendorDue)}</p></div>
        <div className="metric-card"><p className="metric-label">Staff Balance</p><p className="metric-value">{currency(summary.userBalance)}</p><p className="text-xs text-slate-500">Purchases + costs - payments</p></div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="p-5">
          <h2 className="font-display text-xl font-bold text-slate-900">Vendor Ledger</h2>
          <p className="text-sm text-slate-500">Positive balance means payable to vendor. Negative balance means advance paid.</p>
        </div>
        <div className="space-y-3 p-4 pt-0 md:hidden">
          {report.vendors.map((vendor) => (
            <div key={vendor.id} className="rounded-3xl border border-slate-100 bg-white/85 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{vendor.name}</p>
                  <p className="text-xs text-slate-500">Purchase {currency(vendor.purchaseAmount)}</p>
                </div>
                <p className={`rounded-2xl px-3 py-2 text-right text-sm font-extrabold ${vendor.balanceDue > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {currency(vendor.balanceDue)}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Due Purchase</p>
                  <p className="mt-1 font-bold text-slate-900">{currency(vendor.duePurchases)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vendor Paid</p>
                  <p className="mt-1 font-bold text-slate-900">{currency(vendor.payments)}</p>
                </div>
              </div>
            </div>
          ))}
          {!report.vendors.length ? <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No vendor data found.</div> : null}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-4">Vendor</th>
                <th className="px-5 py-4">Purchase</th>
                <th className="px-5 py-4">Due Purchase</th>
                <th className="px-5 py-4">Paid Purchase</th>
                <th className="px-5 py-4">Vendor Payment</th>
                <th className="px-5 py-4">Balance</th>
              </tr>
            </thead>
            <tbody>
              {report.vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-4 font-bold text-slate-900">{vendor.name}</td>
                  <td className="px-5 py-4">{currency(vendor.purchaseAmount)}</td>
                  <td className="px-5 py-4">{currency(vendor.duePurchases)}</td>
                  <td className="px-5 py-4">{currency(vendor.paidPurchases)}</td>
                  <td className="px-5 py-4">{currency(vendor.payments)}</td>
                  <td className={`px-5 py-4 font-bold ${vendor.balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>{currency(vendor.balanceDue)}</td>
                </tr>
              ))}
              {!report.vendors.length ? <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-500">No vendor data found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="p-5">
          <h2 className="font-display text-xl font-bold text-slate-900">Staff Payment Balance</h2>
          <p className="text-sm text-slate-500">Positive balance means payable to staff. Negative balance means staff has advance.</p>
        </div>
        <div className="space-y-3 p-4 pt-0 md:hidden">
          {report.users.map((user) => (
            <div key={user.id} className="rounded-3xl border border-slate-100 bg-white/85 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">Paid purchases {currency(user.paidPurchases)}</p>
                  <p className="text-xs text-slate-500">Paid costs {currency(user.paidCosts)}</p>
                </div>
                <p className={`rounded-2xl px-3 py-2 text-right text-sm font-extrabold ${user.balance > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {currency(user.balance)}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Paid Cost</p>
                  <p className="mt-1 font-bold text-slate-900">{currency(user.paidCosts)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Staff Payment</p>
                  <p className="mt-1 font-bold text-slate-900">{currency(user.staffPayments)}</p>
                </div>
              </div>
            </div>
          ))}
          {!report.users.length ? <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No staff balance found.</div> : null}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Paid Purchases</th>
                <th className="px-5 py-4">Paid Costs</th>
                <th className="px-5 py-4">Staff Payment</th>
                <th className="px-5 py-4">Balance / Advance</th>
              </tr>
            </thead>
            <tbody>
              {report.users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-4 font-bold text-slate-900">{user.name}</td>
                  <td className="px-5 py-4">{currency(user.paidPurchases)}</td>
                  <td className="px-5 py-4">{currency(user.paidCosts)}</td>
                  <td className="px-5 py-4">{currency(user.staffPayments)}</td>
                  <td className={`px-5 py-4 font-bold ${user.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{currency(user.balance)}</td>
                </tr>
              ))}
              {!report.users.length ? <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-500">No staff balance found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default VendorWisePurchaseReportPage;
