import { useEffect, useState } from "react";

const emptyCustomerInfo = {
  customerName: "",
  customerPhone: "",
  customerDateOfBirth: ""
};

const CustomerInfoModal = ({ open, value, onClose, onSave }) => {
  const [form, setForm] = useState(emptyCustomerInfo);

  useEffect(() => {
    if (open) {
      setForm({
        customerName: value?.customerName || "",
        customerPhone: value?.customerPhone || "",
        customerDateOfBirth: value?.customerDateOfBirth || ""
      });
    }
  }, [open, value]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Customer Info</h3>
            <p className="text-sm text-slate-500">Optional details for future retargeting and customer records.</p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Name</span>
            <input
              value={form.customerName}
              onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
              className="input"
              placeholder="Optional customer name"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Phone Number</span>
            <input
              value={form.customerPhone}
              onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))}
              className="input"
              placeholder="Optional phone number"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Date of Birth</span>
            <input
              type="date"
              value={form.customerDateOfBirth}
              onChange={(event) => setForm((current) => ({ ...current, customerDateOfBirth: event.target.value }))}
              className="input"
            />
          </label>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">
              Save Customer Info
            </button>
            <button
              type="button"
              onClick={() => setForm(emptyCustomerInfo)}
              className="btn-secondary"
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerInfoModal;
