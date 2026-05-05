import { forwardRef } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const DateButtonInput = forwardRef(({ value, onClick, placeholder }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className="input flex h-12 w-full items-center justify-between rounded-2xl border-[#d9ceb7] bg-[#fffaf0] text-left text-sm font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
  >
    <span className={value ? "text-slate-700" : "text-slate-400"}>{value || placeholder}</span>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-slate-500"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  </button>
));

DateButtonInput.displayName = "DateButtonInput";

const ReportDatePicker = ({ label, value, onChange, maxDate, minDate }) => {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;

  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <DatePicker
        selected={selectedDate}
        onChange={(date) => onChange(date ? formatLocalDate(date) : "")}
        dateFormat="dd MMM yyyy"
        maxDate={maxDate ? new Date(`${maxDate}T00:00:00`) : undefined}
        minDate={minDate ? new Date(`${minDate}T00:00:00`) : undefined}
        placeholderText="Select date"
        calendarClassName="!rounded-3xl !border !border-slate-200 !shadow-soft"
        popperClassName="z-[70]"
        popperPlacement="bottom-start"
        popperProps={{ strategy: "fixed" }}
        popperContainer={({ children }) => createPortal(children, document.body)}
        customInput={<DateButtonInput placeholder="Select date" />}
        shouldCloseOnSelect
      />
    </label>
  );
};

export default ReportDatePicker;
