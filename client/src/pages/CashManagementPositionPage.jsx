import { Banknote, History, UserRoundCheck, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import { cashManagementService } from "../services/cashManagementService";
import { currency, formatDate, formatUserDisplayName } from "../utils/format";

const todayInput = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const MetricCard = ({ label, value, helper, icon: Icon, dark = false }) => (
  <div className={`rounded-[1.5rem] border p-5 shadow-sm ${dark ? "border-slate-900 bg-slate-950 text-white" : "border-slate-100 bg-white/80 text-slate-900"}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${dark ? "text-white/60" : "text-slate-400"}`}>{label}</p>
        <p className="mt-3 text-2xl font-extrabold">{value}</p>
        {helper ? <p className={`mt-1 text-xs ${dark ? "text-white/60" : "text-slate-500"}`}>{helper}</p> : null}
      </div>
      {Icon ? (
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${dark ? "bg-white/10" : "bg-slate-100"}`}>
          <Icon size={18} />
        </span>
      ) : null}
    </div>
  </div>
);

const CashManagementPositionPage = () => {
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("userwise");
  const [report, setReport] = useState({ summary: {}, userwise: [], history: [] });
  const [loading, setLoading] = useState(false);

  const selectedUser = useMemo(() => users.find((user) => String(user.id) === String(userId)), [users, userId]);

  const loadUsers = async () => {
    try {
      setUsers(await cashManagementService.getUsers());
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load users");
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await cashManagementService.getPosition({
        from: fromDate,
        to: toDate,
        userId
      });
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load cash position");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadReport();
  }, []);

  const summary = report.summary || {};

  return (
    <div className="space-y-5">
      <section className="glass-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="rounded-full bg-stone-700 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
              Cash Management
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold text-slate-900 sm:text-3xl">Cash Position</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Track who collected cash, how much was handed over, and the current receivable balance by user.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[620px]">
            <ReportDatePicker label="From Date" value={fromDate} onChange={setFromDate} />
            <ReportDatePicker label="To Date" value={toDate} onChange={setToDate} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <select value={userId} onChange={(event) => setUserId(event.target.value)} className="input">
            <option value="">All Users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {formatUserDisplayName(user.name, user.email)} - {user.role}
              </option>
            ))}
          </select>
          <button type="button" onClick={loadReport} className="btn-primary">
            {loading ? "Loading..." : "Generate Report"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cash Collected" value={currency(summary.cashCollected)} helper={`${summary.orderCount || 0} cash orders`} icon={Banknote} />
        <MetricCard label="Handed Over" value={currency(summary.handedOver)} helper={`${summary.handoverCount || 0} handover entries`} icon={History} />
        <MetricCard label="Receivable" value={currency(summary.balance)} helper="Cash still in hand" icon={WalletCards} dark />
        <MetricCard label="Collectors" value={report.userwise?.length || 0} helper={selectedUser ? selectedUser.name : "Visible users"} icon={UserRoundCheck} />
      </section>

      <section className="glass-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Cash Position Detail</h2>
            <p className="text-sm text-slate-500">Switch between user-wise receivable and handover history.</p>
          </div>
          <div className="flex rounded-2xl bg-slate-100 p-1">
            {[
              ["userwise", "Userwise Cash"],
              ["history", "History"]
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === key ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-900"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "userwise" ? (
          <>
          <div className="space-y-3 p-4 md:hidden">
            {(report.userwise || []).map((row, index) => (
              <div key={row.userId} className="rounded-3xl border border-slate-100 bg-white/85 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Collector #{index + 1}</p>
                    <p className="mt-1 font-bold text-slate-900">{row.userName}</p>
                    <p className="text-xs capitalize text-slate-500">{row.role || "User"}</p>
                  </div>
                  <p className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">{row.orderCount} orders</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-orange-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500">Collected</p>
                    <p className="mt-1 font-bold text-orange-700">{currency(row.cashCollected)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Handed Over</p>
                    <p className="mt-1 font-bold text-slate-800">{currency(row.handedOver)}</p>
                  </div>
                  <div className="col-span-2 rounded-2xl bg-slate-950 p-3 text-white">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Receivable</p>
                    <p className="mt-1 text-xl font-extrabold">{currency(row.balance)}</p>
                  </div>
                </div>
              </div>
            ))}
            {!report.userwise?.length ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                {loading ? "Loading..." : "No cash position data found."}
              </div>
            ) : null}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-4">SL</th>
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Cash Orders</th>
                  <th className="px-5 py-4">Cash Collected</th>
                  <th className="px-5 py-4">Handed Over</th>
                  <th className="px-5 py-4">Receivable</th>
                </tr>
              </thead>
              <tbody>
                {(report.userwise || []).map((row, index) => (
                  <tr key={row.userId} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{row.userName}</p>
                      <p className="text-xs capitalize text-slate-500">{row.role || "User"}</p>
                    </td>
                    <td className="px-5 py-4">{row.orderCount}</td>
                    <td className="px-5 py-4 font-bold text-orange-600">{currency(row.cashCollected)}</td>
                    <td className="px-5 py-4">{currency(row.handedOver)}</td>
                    <td className="px-5 py-4 font-extrabold text-slate-950">{currency(row.balance)}</td>
                  </tr>
                ))}
                {!report.userwise?.length ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center text-slate-500">
                      {loading ? "Loading..." : "No cash position data found."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="grid gap-3 p-4">
            {(report.history || []).map((entry) => (
              <div key={entry.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{entry.userName}</p>
                    <p className="text-sm text-slate-500">{formatDate(entry.createdAt)}{entry.createdByName ? ` by ${entry.createdByName}` : ""}</p>
                    {entry.remarks ? <p className="mt-2 text-sm text-slate-500">{entry.remarks}</p> : null}
                  </div>
                  <p className="text-2xl font-extrabold text-orange-600">{currency(entry.amount)}</p>
                </div>
              </div>
            ))}
            {!report.history?.length ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
                {loading ? "Loading..." : "No handover history found."}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
};

export default CashManagementPositionPage;
