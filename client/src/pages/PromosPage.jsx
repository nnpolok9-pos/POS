import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import PromoFormModal from "../components/PromoFormModal";
import { promoService } from "../services/promoService";
import { currency, formatDate } from "../utils/format";

const promoScopeLabel = {
  all: "POS and Menu",
  pos: "POS Only",
  menu: "Menu Only"
};

const promoDiscountLabel = (promo) =>
  promo.discountType === "percentage" ? `${promo.discountValue}%` : currency(promo.discountValue);

const PromosPage = () => {
  const [promos, setPromos] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadPromos = async () => {
    try {
      const data = await promoService.getPromos();
      setPromos(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load promo codes");
    }
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const summary = useMemo(
    () =>
      promos.reduce(
        (acc, promo) => {
          acc.total += 1;
          if (promo.isActive) {
            acc.active += 1;
          }
          if (promo.status?.isExpired) {
            acc.expired += 1;
          }
          acc.totalUses += Number(promo.usage?.totalUses || 0);
          return acc;
        },
        { total: 0, active: 0, expired: 0, totalUses: 0 }
      ),
    [promos]
  );

  const handleSubmit = async (payload) => {
    setSubmitting(true);

    try {
      if (selectedPromo) {
        await promoService.updatePromo(selectedPromo.id, payload);
        toast.success("Promo updated");
      } else {
        await promoService.createPromo(payload);
        toast.success("Promo created");
      }

      setModalOpen(false);
      setSelectedPromo(null);
      await loadPromos();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save promo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (promo) => {
    if (!window.confirm(`Delete promo code ${promo.code}? Existing orders will keep their saved snapshot.`)) {
      return;
    }

    try {
      await promoService.deletePromo(promo.id);
      toast.success("Promo deleted");
      await loadPromos();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete promo");
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900">Promo Codes</h1>
            <p className="text-sm text-slate-500">
              Create discount campaigns with expiry, daily limits, total usage limits, minimum order rules, and source control.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedPromo(null);
              setModalOpen(true);
            }}
            className="btn-primary gap-2"
          >
            <Plus size={18} />
            Add Promo
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5">
            <p className="text-sm text-slate-500">Total Promos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-3xl bg-emerald-100 p-5">
            <p className="text-sm text-emerald-700">Active</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">{summary.active}</p>
          </div>
          <div className="rounded-3xl bg-amber-100 p-5">
            <p className="text-sm text-amber-700">Expired</p>
            <p className="mt-2 text-3xl font-bold text-amber-950">{summary.expired}</p>
          </div>
          <div className="rounded-3xl bg-slate-900 p-5 text-white">
            <p className="text-sm text-slate-300">Total Uses</p>
            <p className="mt-2 text-3xl font-bold">{summary.totalUses}</p>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-5">
          <h2 className="font-display text-2xl font-bold text-slate-900">All Promo Codes</h2>
          <p className="text-sm text-slate-500">Each promo saves its own usage progress, schedule, and where it can be applied.</p>
        </div>

        <div className="space-y-3 lg:hidden">
          {promos.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No promo codes created yet.
            </div>
          ) : (
            promos.map((promo) => (
              <div key={promo.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{promo.code}</p>
                    <p className="text-sm text-slate-500">{promo.title || promo.description || "No title"}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      promo.status?.isExpired ? "bg-rose-100 text-rose-700" : promo.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {promo.status?.isExpired ? "Expired" : promo.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Discount</p>
                    <p className="mt-1 text-slate-700">{promoDiscountLabel(promo)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Allowed On</p>
                    <p className="mt-1 text-slate-700">{promoScopeLabel[promo.appliesTo] || "POS and Menu"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Uses</p>
                    <p className="mt-1 text-slate-700">
                      {promo.usage?.totalUses || 0}
                      {promo.maxTotalUses !== null ? ` / ${promo.maxTotalUses}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Daily</p>
                    <p className="mt-1 text-slate-700">
                      {promo.usage?.todayUses || 0}
                      {promo.maxUsesPerDay !== null ? ` / ${promo.maxUsesPerDay}` : ""}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Expiry</p>
                    <p className="mt-1 text-slate-700">{promo.expiresAt ? formatDate(promo.expiresAt) : "No expiry"}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPromo(promo);
                      setModalOpen(true);
                    }}
                    className="btn-secondary gap-2"
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(promo)} className="btn-secondary gap-2 text-rose-600">
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">Code</th>
                <th className="pb-3 pr-4">Discount</th>
                <th className="pb-3 pr-4">Minimum Order</th>
                <th className="pb-3 pr-4">Allowed On</th>
                <th className="pb-3 pr-4">Usage</th>
                <th className="pb-3 pr-4">Expiry</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <tr key={promo.id} className="border-b border-slate-100 align-middle">
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-slate-900">{promo.code}</p>
                    <p className="text-xs text-slate-500">{promo.title || promo.description || "No title"}</p>
                  </td>
                  <td className="py-4 pr-4 text-slate-700">{promoDiscountLabel(promo)}</td>
                  <td className="py-4 pr-4 text-slate-700">{promo.minOrderAmount ? currency(promo.minOrderAmount) : "No minimum"}</td>
                  <td className="py-4 pr-4 text-slate-700">{promoScopeLabel[promo.appliesTo] || "POS and Menu"}</td>
                  <td className="py-4 pr-4 text-slate-700">
                    <div>{promo.usage?.totalUses || 0}{promo.maxTotalUses !== null ? ` / ${promo.maxTotalUses}` : ""}</div>
                    <div className="text-xs text-slate-500">Today {promo.usage?.todayUses || 0}{promo.maxUsesPerDay !== null ? ` / ${promo.maxUsesPerDay}` : ""}</div>
                  </td>
                  <td className="py-4 pr-4 text-slate-700">{promo.expiresAt ? formatDate(promo.expiresAt) : "No expiry"}</td>
                  <td className="py-4 pr-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        promo.status?.isExpired ? "bg-rose-100 text-rose-700" : promo.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {promo.status?.isExpired ? "Expired" : promo.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPromo(promo);
                          setModalOpen(true);
                        }}
                        className="btn-secondary gap-2"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(promo)} className="btn-secondary gap-2 text-rose-600">
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {promos.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-sm text-slate-500">
                    No promo codes created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PromoFormModal
        open={modalOpen}
        promo={selectedPromo}
        onClose={() => {
          setModalOpen(false);
          setSelectedPromo(null);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
};

export default PromosPage;
