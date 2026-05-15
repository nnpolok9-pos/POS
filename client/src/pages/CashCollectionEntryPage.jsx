import { Banknote, HandCoins } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { cashManagementService } from "../services/cashManagementService";
import { currency, formatUserDisplayName } from "../utils/format";

const CashCollectionEntryPage = () => {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedUser = useMemo(() => users.find((user) => String(user.id) === String(userId)), [users, userId]);

  const loadUsers = async () => {
    try {
      const data = await cashManagementService.getUsers();
      setUsers(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load users");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await cashManagementService.createHandover({
        userId,
        amount: Number(amount || 0),
        remarks
      });
      toast.success("Cash handover recorded");
      setUserId("");
      setAmount("");
      setRemarks("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to record cash handover");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="glass-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="rounded-full bg-stone-700 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
              Cash Management
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold text-slate-900 sm:text-3xl">Entry Collection</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Record cash handed over by staff or admins after they collect cash from POS customers.
            </p>
          </div>
          <div className="rounded-[1.6rem] bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Selected User</p>
            <p className="mt-2 text-xl font-bold">{selectedUser ? formatUserDisplayName(selectedUser.name, selectedUser.email) : "Not selected"}</p>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-[linear-gradient(145deg,#fff7ed,#fff)] p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-orange-100 text-orange-600">
              <HandCoins size={26} />
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold text-slate-900">Owner Collection Record</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This does not change sales. It only records that collected cash was handed over to the owner, so the user-wise cash position becomes clear.
            </p>
            <div className="mt-6 rounded-3xl border border-orange-100 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Amount Preview</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{currency(Number(amount || 0))}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Cash Collected From</span>
              <select value={userId} onChange={(event) => setUserId(event.target.value)} className="input" required>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {formatUserDisplayName(user.name, user.email)} - {user.role}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Handed Over Amount</span>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4">
                <Banknote size={18} className="text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-12 w-full bg-transparent outline-none"
                  placeholder="Enter amount in KHR"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Remarks</span>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="input min-h-[120px] resize-y py-3"
                placeholder="Optional note, shift details, or collection reference"
              />
            </label>

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? "Saving..." : "Save Collection Entry"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default CashCollectionEntryPage;
