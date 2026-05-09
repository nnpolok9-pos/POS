import { CheckCircle2, Megaphone, Percent, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import eGatesLogo from "../assets/partners/e-gates.jpg";
import foodpandaLogo from "../assets/partners/foodpanda.png";
import grabLogo from "../assets/partners/grab.png";
import wownowLogo from "../assets/partners/wownow.png";
import { partnerService } from "../services/partnerService";
import { currency } from "../utils/format";

const PARTNER_META = {
  foodpanda: {
    label: "Foodpanda",
    logo: foodpandaLogo,
    accent: "from-[#ffd6dc] to-white"
  },
  grab: {
    label: "Grab",
    logo: grabLogo,
    accent: "from-[#d6f7e0] to-white"
  },
  e_gates: {
    label: "E-Gates",
    logo: eGatesLogo,
    accent: "from-[#dbeafe] to-white"
  },
  wownow: {
    label: "WOWNOW",
    logo: wownowLogo,
    accent: "from-[#fce7f3] to-white"
  }
};

const emptyPromo = () => ({
  id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  discountType: "percentage",
  discountValue: 0,
  minOrderAmount: 0,
  maxDiscountAmount: "",
  isActive: true,
  isDefault: false,
  notes: ""
});

const normalizePromoForForm = (promo) => ({
  id: promo.id,
  name: promo.name || "",
  discountType: promo.discountType || "percentage",
  discountValue: promo.discountValue ?? 0,
  minOrderAmount: promo.minOrderAmount ?? 0,
  maxDiscountAmount: promo.maxDiscountAmount ?? "",
  isActive: promo.isActive !== false,
  isDefault: Boolean(promo.isDefault),
  notes: promo.notes || ""
});

const ManagePartnersPage = () => {
  const navigate = useNavigate();
  const { partnerKey } = useParams();
  const partnerKeys = Object.keys(PARTNER_META);
  const activePartnerKey = partnerKeys.includes(partnerKey) ? partnerKey : partnerKeys[0];

  const [partners, setPartners] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const data = await partnerService.getPartners();
      setPartners(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load partner settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    if (!partnerKeys.includes(partnerKey || "")) {
      navigate(`/manage-partners/${activePartnerKey}`, { replace: true });
    }
  }, [activePartnerKey, navigate, partnerKey, partnerKeys]);

  useEffect(() => {
    const activePartner = partners.find((partner) => partner.partnerKey === activePartnerKey);
    if (!activePartner) {
      return;
    }

    setForm({
      partnerKey: activePartner.partnerKey,
      partnerName: activePartner.partnerName,
      commissionRate: activePartner.commissionRate ?? 0,
      advertisementRoiRate: activePartner.advertisementRoiRate ?? 0,
      isActive: activePartner.isActive !== false,
      promos: (activePartner.promos || []).map(normalizePromoForForm)
    });
  }, [activePartnerKey, partners]);

  const activePartner = useMemo(
    () => partners.find((partner) => partner.partnerKey === activePartnerKey) || null,
    [activePartnerKey, partners]
  );

  const summary = useMemo(() => {
    const promos = form?.promos || [];
    return {
      totalPromos: promos.length,
      activePromos: promos.filter((promo) => promo.isActive).length,
      defaultPromos: promos.filter((promo) => promo.isDefault && promo.isActive).length
    };
  }, [form]);

  const updatePromo = (promoId, updater) => {
    setForm((current) => ({
      ...current,
      promos: current.promos.map((promo) => (promo.id === promoId ? updater(promo) : promo))
    }));
  };

  const handleSave = async () => {
    if (!form) {
      return;
    }

    const invalidPromo = form.promos.find((promo) => !String(promo.name || "").trim());
    if (invalidPromo) {
      toast.error("Each partner promo needs a name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        partnerName: form.partnerName,
        commissionRate: Number(form.commissionRate || 0),
        advertisementRoiRate: Number(form.advertisementRoiRate || 0),
        isActive: form.isActive !== false,
        promos: form.promos.map((promo) => ({
          ...promo,
          name: String(promo.name || "").trim(),
          discountValue: Number(promo.discountValue || 0),
          minOrderAmount: Number(promo.minOrderAmount || 0),
          maxDiscountAmount: promo.maxDiscountAmount === "" ? null : Number(promo.maxDiscountAmount || 0)
        }))
      };

      const saved = await partnerService.updatePartner(activePartnerKey, payload);
      setPartners((current) => current.map((partner) => (partner.partnerKey === saved.partnerKey ? saved : partner)));
      setForm({
        partnerKey: saved.partnerKey,
        partnerName: saved.partnerName,
        commissionRate: saved.commissionRate ?? 0,
        advertisementRoiRate: saved.advertisementRoiRate ?? 0,
        isActive: saved.isActive !== false,
        promos: (saved.promos || []).map(normalizePromoForForm)
      });
      toast.success(`${saved.partnerName} settings updated`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save partner settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900">Manage Partners</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure commission, partner-only promos, and default delivery offers for Grab, Foodpanda, E-Gates, and WOWNOW.
            </p>
          </div>
          <button type="button" onClick={handleSave} disabled={!form || saving} className="btn-primary gap-2">
            <Save size={18} />
            {saving ? "Saving..." : "Save Partner Settings"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {partnerKeys.map((key) => {
            const meta = PARTNER_META[key];
            const partner = partners.find((entry) => entry.partnerKey === key);
            return (
              <NavLink
                key={key}
                to={`/manage-partners/${key}`}
                className={({ isActive }) =>
                  `rounded-[1.4rem] border p-4 shadow-sm transition ${
                    isActive
                      ? "border-brand-200 bg-white"
                      : "border-slate-100 bg-white/80 hover:border-brand-100 hover:bg-white"
                  }`
                }
              >
                <div className={`rounded-[1.2rem] bg-gradient-to-br ${meta.accent} p-3`}>
                  <img src={meta.logo} alt={meta.label} className="mx-auto h-14 w-14 rounded-2xl object-cover shadow-sm" />
                </div>
                <div className="mt-3">
                  <p className="font-semibold text-slate-900">{meta.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {partner?.isActive === false ? "Inactive" : "Active"} · {partner?.promos?.length || 0} promos
                  </p>
                </div>
              </NavLink>
            );
          })}
        </div>
      </section>

      <section className="glass-card p-4 sm:p-6">
        {loading || !form || !activePartner ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Loading partner settings...
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <img src={PARTNER_META[activePartnerKey].logo} alt={activePartner.partnerName} className="h-16 w-16 rounded-[1.4rem] object-cover shadow-sm" />
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{activePartner.partnerName}</h2>
                  <p className="mt-1 text-sm text-slate-500">These rules automatically power the Partner POS order flow and delivery report settlement math.</p>
                </div>
              </div>
              <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                />
                Partner Active
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-5">
              <div className="rounded-3xl bg-white p-5">
                <p className="text-sm text-slate-500">Commission Rate</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{Number(form.commissionRate || 0)}%</p>
              </div>
              <div className="rounded-3xl bg-white p-5">
                <p className="text-sm text-slate-500">Ad ROI Rate</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{Number(form.advertisementRoiRate || 0)}%</p>
              </div>
              <div className="rounded-3xl bg-white p-5">
                <p className="text-sm text-slate-500">Partner Promos</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{summary.totalPromos}</p>
              </div>
              <div className="rounded-3xl bg-emerald-50 p-5">
                <p className="text-sm text-emerald-700">Active Promos</p>
                <p className="mt-2 text-3xl font-bold text-emerald-900">{summary.activePromos}</p>
              </div>
              <div className="rounded-3xl bg-amber-50 p-5">
                <p className="text-sm text-amber-700">Default Promos</p>
                <p className="mt-2 text-3xl font-bold text-amber-900">{summary.defaultPromos}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
              <div className="rounded-[1.8rem] border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Partner-only Promos</h3>
                    <p className="text-sm text-slate-500">These promos appear as easy suggestions inside Partner POS. Default promos are preselected automatically.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, promos: [...current.promos, emptyPromo()] }))}
                    className="btn-secondary gap-2"
                  >
                    <Plus size={16} />
                    Add Promo
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {form.promos.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      No partner promo created yet.
                    </div>
                  ) : (
                    form.promos.map((promo, index) => (
                      <div key={promo.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Promo {index + 1}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {promo.isActive ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 size={14} />
                                  Active
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">Inactive</span>
                              )}
                              {promo.isDefault ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Default in Partner POS</span> : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, promos: current.promos.filter((entry) => entry.id !== promo.id) }))}
                            className="btn-secondary gap-2 text-rose-600"
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="xl:col-span-2">
                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Promo Name</label>
                            <input value={promo.name} onChange={(event) => updatePromo(promo.id, (current) => ({ ...current, name: event.target.value }))} className="input" />
                          </div>
                          <div>
                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Discount Type</label>
                            <select value={promo.discountType} onChange={(event) => updatePromo(promo.id, (current) => ({ ...current, discountType: event.target.value }))} className="input">
                              <option value="percentage">Percentage</option>
                              <option value="fixed">Fixed Amount</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Discount Value</label>
                            <input type="number" min="0" step="0.01" value={promo.discountValue} onChange={(event) => updatePromo(promo.id, (current) => ({ ...current, discountValue: event.target.value }))} className="input" />
                          </div>
                          <div>
                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Minimum Order</label>
                            <input type="number" min="0" step="0.01" value={promo.minOrderAmount} onChange={(event) => updatePromo(promo.id, (current) => ({ ...current, minOrderAmount: event.target.value }))} className="input" />
                          </div>
                          <div>
                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Max Discount Cap</label>
                            <input type="number" min="0" step="0.01" value={promo.maxDiscountAmount} onChange={(event) => updatePromo(promo.id, (current) => ({ ...current, maxDiscountAmount: event.target.value }))} className="input" placeholder="Optional" />
                          </div>
                          <div className="xl:col-span-2">
                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</label>
                            <input value={promo.notes} onChange={(event) => updatePromo(promo.id, (current) => ({ ...current, notes: event.target.value }))} className="input" placeholder="Optional staff note" />
                          </div>
                          <div className="flex items-center gap-3 rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3">
                            <input type="checkbox" checked={promo.isActive} onChange={(event) => updatePromo(promo.id, (current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
                            <span className="text-sm font-semibold text-slate-700">Promo Active</span>
                          </div>
                          <div className="flex items-center gap-3 rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3">
                            <input type="checkbox" checked={promo.isDefault} onChange={(event) => updatePromo(promo.id, (current) => ({ ...current, isDefault: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
                            <span className="text-sm font-semibold text-slate-700">Default Selection</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.8rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-brand-50 p-3 text-brand-600">
                      <Percent size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Commission</h3>
                      <p className="text-sm text-slate-500">This is deducted from the settled partner sales amount.</p>
                    </div>
                  </div>
                  <label className="mb-2 mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Commission Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.commissionRate}
                    onChange={(event) => setForm((current) => ({ ...current, commissionRate: event.target.value }))}
                    className="input"
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    Example: if the partner settles {currency(10000)} and commission is {Number(form.commissionRate || 0)}%, the deducted commission is{" "}
                    <span className="font-semibold text-slate-700">{currency((10000 * Number(form.commissionRate || 0)) / 100)}</span>.
                  </p>
                </div>

                <div className="rounded-[1.8rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
                      <Megaphone size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Advertisement ROI</h3>
                      <p className="text-sm text-slate-500">This marketing cost is deducted after promo and commission to show realistic partner profitability.</p>
                    </div>
                  </div>
                  <label className="mb-2 mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">ROI Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.advertisementRoiRate}
                    onChange={(event) => setForm((current) => ({ ...current, advertisementRoiRate: event.target.value }))}
                    className="input"
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    Example: if sales after promo are {currency(10000)} and ROI is {Number(form.advertisementRoiRate || 0)}%, the ad cost becomes{" "}
                    <span className="font-semibold text-slate-700">{currency((10000 * Number(form.advertisementRoiRate || 0)) / 100)}</span>.
                  </p>
                </div>

                <div className="rounded-[1.8rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900">Partner POS Behavior</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>• Default promos are preselected automatically when this partner is chosen.</li>
                    <li>• Staff can still change the selected promos during create or edit.</li>
                    <li>• Partner order ID remains required before placing the order.</li>
                    <li>• Commission is shown in delivery partner reporting for settlement tracking.</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default ManagePartnersPage;
