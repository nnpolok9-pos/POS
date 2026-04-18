import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const EMPTY_PROMO = {
  code: "",
  title: "",
  description: "",
  discountType: "fixed",
  discountValue: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  startsAt: "",
  expiresAt: "",
  maxUsesPerDay: "",
  maxTotalUses: "",
  appliesTo: "all",
  isActive: true,
  notes: ""
};

const toDateTimeLocal = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const fromDateTimeLocal = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTimeLocal = (date) => {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const PromoDateTimePicker = ({ label, value, onChange, minDate, maxDate }) => (
  <label className="block min-w-0">
    <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
    <DatePicker
      selected={fromDateTimeLocal(value)}
      onChange={(date) => onChange(date ? formatDateTimeLocal(date) : "")}
      showTimeSelect
      timeIntervals={5}
      timeCaption="Time"
      dateFormat="dd/MM/yyyy hh:mm aa"
      placeholderText="Select date and time"
      minDate={minDate ? fromDateTimeLocal(minDate) : undefined}
      maxDate={maxDate ? fromDateTimeLocal(maxDate) : undefined}
      calendarClassName="!rounded-3xl !border !border-slate-200 !shadow-soft"
      popperClassName="z-[70]"
      popperPlacement="bottom-start"
      popperProps={{ strategy: "fixed" }}
      popperContainer={({ children }) => createPortal(children, document.body)}
      className="input h-12 rounded-2xl border-[#d9ceb7] bg-[#fffaf0] text-sm font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
    />
  </label>
);

const PromoFormModal = ({ open, promo, onClose, onSubmit, submitting }) => {
  const [form, setForm] = useState(EMPTY_PROMO);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(
      promo
        ? {
            code: promo.code || "",
            title: promo.title || "",
            description: promo.description || "",
            discountType: promo.discountType || "fixed",
            discountValue: promo.discountValue ?? "",
            minOrderAmount: promo.minOrderAmount ?? "",
            maxDiscountAmount: promo.maxDiscountAmount ?? "",
            startsAt: toDateTimeLocal(promo.startsAt),
            expiresAt: toDateTimeLocal(promo.expiresAt),
            maxUsesPerDay: promo.maxUsesPerDay ?? "",
            maxTotalUses: promo.maxTotalUses ?? "",
            appliesTo: promo.appliesTo || "all",
            isActive: promo.isActive !== false,
            notes: promo.notes || ""
          }
        : EMPTY_PROMO
    );
  }, [open, promo]);

  if (!open) {
    return null;
  }

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();

    await onSubmit({
      ...form,
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim(),
      notes: form.notes.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 sm:p-4" onClick={onClose}>
      <div
        className="glass-card max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-5 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">{promo ? "Edit Promo" : "Add Promo"}</h2>
            <p className="text-sm text-slate-500">Create time-based discount codes with usage controls for POS and menu orders.</p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Promo Code</label>
              <input className="input uppercase" value={form.code} onChange={(event) => updateField("code", event.target.value.toUpperCase())} placeholder="ASEN10" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Promo Title</label>
              <input className="input" value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="Weekend Special" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
              <input className="input" value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Short note for staff about this promo" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Discount Type</label>
              <select className="input" value={form.discountType} onChange={(event) => updateField("discountType", event.target.value)}>
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Discount Value</label>
              <input className="input" type="number" min="0" step="0.01" value={form.discountValue} onChange={(event) => updateField("discountValue", event.target.value)} required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Min Order Amount</label>
              <input className="input" type="number" min="0" step="0.01" value={form.minOrderAmount} onChange={(event) => updateField("minOrderAmount", event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Max Discount Cap</label>
              <input className="input" type="number" min="0" step="0.01" value={form.maxDiscountAmount} onChange={(event) => updateField("maxDiscountAmount", event.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PromoDateTimePicker label="Starts At" value={form.startsAt} onChange={(value) => updateField("startsAt", value)} maxDate={form.expiresAt || undefined} />
            <PromoDateTimePicker label="Expires At" value={form.expiresAt} onChange={(value) => updateField("expiresAt", value)} minDate={form.startsAt || undefined} />
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Daily Max Uses</label>
              <input className="input" type="number" min="0" step="1" value={form.maxUsesPerDay} onChange={(event) => updateField("maxUsesPerDay", event.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Total Max Uses</label>
              <input className="input" type="number" min="0" step="1" value={form.maxTotalUses} onChange={(event) => updateField("maxTotalUses", event.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Allowed On</label>
              <select className="input" value={form.appliesTo} onChange={(event) => updateField("appliesTo", event.target.value)}>
                <option value="all">POS and Menu</option>
                <option value="pos">POS Only</option>
                <option value="menu">Menu Only</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
              <select className="input" value={form.isActive ? "active" : "inactive"} onChange={(event) => updateField("isActive", event.target.value === "active")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
              <textarea className="input min-h-[100px]" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Internal notes about campaign rules" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className="btn-primary min-w-[180px]">
              {submitting ? "Saving..." : promo ? "Update Promo" : "Create Promo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromoFormModal;
