import { NavLink, Outlet } from "react-router-dom";

const ReportsPage = () => {
  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Reports</h1>
            <p className="mt-1 text-[13px] text-slate-500">Generate date-based sales and cash position reports.</p>
          </div>
          <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-100 bg-white/80 p-1.5">
            <NavLink
              to="/reports/sales"
              className={({ isActive }) =>
                `rounded-2xl px-3.5 py-2 text-[13px] font-semibold transition ${isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`
              }
            >
              Sales Report
            </NavLink>
            <NavLink
              to="/reports/sales-transaction"
              className={({ isActive }) =>
                `rounded-2xl px-3.5 py-2 text-[13px] font-semibold transition ${isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`
              }
            >
              Sales Transactions
            </NavLink>
          </div>
        </div>
      </section>

      <Outlet />
    </div>
  );
};

export default ReportsPage;
