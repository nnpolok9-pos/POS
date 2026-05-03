import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const emptyCustomerInfo = {
  customerName: "",
  customerPhone: "",
  customerDateOfBirth: ""
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const CustomerInfoModal = ({ open, value, onClose, onSave }) => {
  const [form, setForm] = useState(emptyCustomerInfo);
  const selectedDateOfBirth = form.customerDateOfBirth ? new Date(`${form.customerDateOfBirth}T00:00:00`) : null;

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
            <DatePicker
              selected={selectedDateOfBirth}
              onChange={(date) => setForm((current) => ({ ...current, customerDateOfBirth: date ? formatLocalDate(date) : "" }))}
              dateFormat="dd MMM yyyy"
              placeholderText="Select date of birth"
              maxDate={new Date()}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              yearDropdownItemNumber={100}
              scrollableYearDropdown
              calendarClassName="!rounded-3xl !border !border-slate-200 !shadow-soft"
              popperClassName="z-[80]"
              popperPlacement="bottom-start"
              popperProps={{ strategy: "fixed" }}
              popperContainer={({ children }) => createPortal(children, document.body)}
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
