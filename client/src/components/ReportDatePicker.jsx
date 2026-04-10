import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
        className="input h-12 rounded-2xl border-[#d9ceb7] bg-[#fffaf0] text-sm font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
      />
    </label>
  );
};

export default ReportDatePicker;
