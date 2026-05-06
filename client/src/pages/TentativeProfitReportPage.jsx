import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChartColumnBig, CircleDollarSign, Download, FileSpreadsheet, HandCoins, Package2, Store, Truck, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import { useShopSettings } from "../context/ShopSettingsContext";
import { reportService } from "../services/reportService";
import { getLocalDateInputValue } from "../utils/date";
import { currency, formatPercent } from "../utils/format";
import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";

const todayString = () => getLocalDateInputValue();

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm";

const statCardClass = "rounded-[1.35rem] p-3 shadow-sm";

const channelOptions = [
  { value: "all", label: "All Sales" },
  { value: "counter", label: "Counter Sales" },
  { value: "partners", label: "Delivery Partners" }
];

const partnerOptions = [
  { value: "all", label: "All Partners" },
  { value: "grab", label: "Grab" },
  { value: "foodpanda", label: "Foodpanda" },
  { value: "e_gates", label: "E-Gates" },
  { value: "wownow", label: "WOWNOW" }
];

const dailyColumns = [
  { header: "SL", key: "sl" },
  { header: "Date", key: "date" },
  { header: "Orders", key: "totalOrders" },
  { header: "Items", key: "totalItems" },
  { header: "Gross Sales", key: "grossSales" },
  { header: "Total Promo", key: "totalPromoDiscount" },
  { header: "Counter Promo", key: "counterPromoDiscount" },
  { header: "Partner Promo", key: "partnerPromoDiscount" },
  { header: "After Promo", key: "salesAfterPartnerPromo" },
  { header: "Commission", key: "commissionAmount" },
  { header: "Net Sales", key: "netSales" },
  { header: "Cost of Goods", key: "costOfGoodsSold" },
  { header: "Tentative Profit", key: "tentativeProfit" },
  { header: "Profit Margin %", key: "profitMarginPercent" }
];

const partnerColumns = [
  { header: "SL", key: "sl" },
  { header: "Partner", key: "partnerLabel" },
  { header: "Orders", key: "orderCount" },
  { header: "Gross Sales", key: "grossSales" },
  { header: "Partner Promo", key: "partnerPromoDiscount" },
  { header: "After Promo", key: "salesAfterPartnerPromo" },
  { header: "Commission", key: "commissionAmount" },
  { header: "Net Sales", key: "netSales" },
  { header: "Cost of Goods", key: "costOfGoodsSold" },
  { header: "Tentative Profit", key: "tentativeProfit" },
  { header: "Profit Margin %", key: "profitMarginPercent" }
];

const TentativeProfitReportPage = () => {
  const { settings: shopSettings } = useShopSettings();
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [channel, setChannel] = useState("all");
  const [partner, setPartner] = useState("all");
  const [report, setReport] = useState({ summary: {}, rows: [], partnerRows: [] });
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getTentativeProfit({
        from,
        to,
        channel,
        partner: partner === "all" ? undefined : partner
      });
      setReport(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load tentative profit report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const selectedChannelLabel = useMemo(
    () => channelOptions.find((option) => option.value === channel)?.label || "All Sales",
    [channel]
  );
  const selectedPartnerLabel = useMemo(
    () => partnerOptions.find((option) => option.value === partner)?.label || "All Partners",
    [partner]
  );

  const summary = report.summary || {};

  const dailyExportRows =
    report.rows?.map((row) => ({
      sl: row.sl,
      date: row.date,
      totalOrders: row.totalOrders,
      totalItems: row.totalItems,
      grossSales: Number(row.grossSales || 0).toFixed(2),
      totalPromoDiscount: Number(row.totalPromoDiscount || 0).toFixed(2),
      counterPromoDiscount: Number(row.counterPromoDiscount || 0).toFixed(2),
      partnerPromoDiscount: Number(row.partnerPromoDiscount || 0).toFixed(2),
      salesAfterPartnerPromo: Number(row.salesAfterPartnerPromo || 0).toFixed(2),
      commissionAmount: Number(row.commissionAmount || 0).toFixed(2),
      netSales: Number(row.netSales || 0).toFixed(2),
      costOfGoodsSold: Number(row.costOfGoodsSold || 0).toFixed(2),
      tentativeProfit: Number(row.tentativeProfit || 0).toFixed(2),
      profitMarginPercent: Number(row.profitMarginPercent || 0).toFixed(2)
    })) || [];

  const partnerExportRows =
    report.partnerRows?.map((row) => ({
      sl: row.sl,
      partnerLabel: row.partnerLabel,
      orderCount: row.orderCount,
      grossSales: Number(row.grossSales || 0).toFixed(2),
      partnerPromoDiscount: Number(row.partnerPromoDiscount || 0).toFixed(2),
      salesAfterPartnerPromo: Number(row.salesAfterPartnerPromo || 0).toFixed(2),
      commissionAmount: Number(row.commissionAmount || 0).toFixed(2),
      netSales: Number(row.netSales || 0).toFixed(2),
      costOfGoodsSold: Number(row.costOfGoodsSold || 0).toFixed(2),
      tentativeProfit: Number(row.tentativeProfit || 0).toFixed(2),
      profitMarginPercent: Number(row.profitMarginPercent || 0).toFixed(2)
    })) || [];

  const exportExcel = () => {
    if (!dailyExportRows.length) {
      toast.error("No tentative profit data to export");
      return;
    }

    exportReportToExcel({
      fileName: `tentative-profit-${from}-to-${to}`,
      sheetName: "Tentative Profit",
      title: "Tentative Profit Report",
      columns: dailyColumns,
      rows: dailyExportRows,
      extraSheets: report.partnerRows?.length
        ? [
            {
              sheetName: "Partner Profit",
              columns: partnerColumns,
              rows: partnerExportRows
            }
          ]
        : [],
      shopProfile: shopSettings,
      summaryLines: [`Date Range: ${from} to ${to}`, `Channel: ${selectedChannelLabel}`, `Partner: ${selectedPartnerLabel}`]
    });
  };

  const exportPdf = async () => {
    if (!dailyExportRows.length) {
      toast.error("No tentative profit data to export");
      return;
    }

    await exportReportToPdf({
      title: "Tentative Profit Report",
      fileName: `tentative-profit-${from}-to-${to}`,
      columns: dailyColumns,
      rows: dailyExportRows,
      summaryLines: [`Date Range: ${from} to ${to}`, `Channel: ${selectedChannelLabel}`, `Partner: ${selectedPartnerLabel}`],
      shopProfile: shopSettings
    });
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-5">
        <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className={heroBadgeClass}>
                  <ChartColumnBig size={14} />
                  Tentative Profit
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Tentative Profit Report</h1>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                  Measure counter sales and delivery partner sales together using each order&apos;s saved cost snapshot, partner promo deduction, partner commission, and final net sales after settlement.
                </p>
              </div>

              <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-4 py-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Filters</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-800">{from} to {to}</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {selectedChannelLabel} • {selectedPartnerLabel}
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="rounded-[1.4rem] border border-[#efe2ca] bg-[#fff8ea] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(220px,0.7fr)_minmax(220px,0.7fr)] md:items-end">
                  <ReportDatePicker label="From Date" value={from} onChange={setFrom} maxDate={to} />
                  <div className="hidden pb-3 text-center text-sm font-semibold text-slate-400 xl:block">to</div>
                  <ReportDatePicker label="To Date" value={to} onChange={setTo} minDate={from} />
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sales Channel</label>
                    <select value={channel} onChange={(event) => setChannel(event.target.value)} className="input">
                      {channelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Partner Filter</label>
                    <select value={partner} onChange={(event) => setPartner(event.target.value)} className="input" disabled={channel === "counter"}>
                      {partnerOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[auto_auto_auto] xl:justify-end">
                <button type="button" onClick={loadReport} className="btn-primary h-10 rounded-full px-5 shadow-sm">
                  {loading ? "Loading..." : "Generate"}
                </button>
                <button type="button" onClick={exportExcel} className="btn-secondary h-10 gap-2 rounded-full border border-[#d7cbb7] bg-white px-4">
                  <FileSpreadsheet size={18} />
                  Export Excel
                </button>
                <button type="button" onClick={exportPdf} className="btn-secondary h-10 gap-2 rounded-full border border-[#d7cbb7] bg-white px-4">
                  <Download size={18} />
                  Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className={`${statCardClass} border border-[#d9e0eb] bg-[#e8eef7]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net Sales</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.netSales || 0)}</p>
                <p className="mt-1 text-xs text-slate-500">{summary.totalOrders || 0} orders</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <WalletCards size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#e8e1d1] bg-[#fff8ea]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cost of Goods</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.costOfGoodsSold || 0)}</p>
                <p className="mt-1 text-xs text-slate-500">{summary.totalItems || 0} items sold</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-amber-500">
                <Package2 size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#dcefe5] bg-[#ecf8f1]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tentative Profit</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.tentativeProfit || 0)}</p>
                <p className="mt-1 text-xs text-slate-500">Margin {formatPercent(summary.profitMarginPercent || 0, 2)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-500">
                <CircleDollarSign size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#f0ddda] bg-[#fff0ed]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Promo</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.totalPromoDiscount || 0)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Counter {currency(summary.counterPromoDiscount || 0)} • Partner {currency(summary.partnerPromoDiscount || 0)}
                </p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-rose-500">
                <Truck size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} border border-[#efe2ca] bg-[#fff8ea]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Commission</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.commissionAmount || 0)}</p>
                <p className="mt-1 text-xs text-slate-500">Avg order {currency(summary.averageOrderValue || 0)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-amber-500">
                <HandCoins size={18} />
              </div>
            </div>
          </div>
          <div className={`${statCardClass} bg-[#171d31] text-white`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Channel Mix</p>
                <p className="mt-2 text-base font-bold">Counter {currency(summary.counterNetSales || 0)}</p>
                <p className="mt-1 text-base font-bold">Partners {currency(summary.partnerNetSales || 0)}</p>
              </div>
              <div className="rounded-full bg-white/10 p-3 text-white">
                <Store size={18} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Counter Gross</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{currency(summary.counterGrossSales || 0)}</p>
            <p className="mt-1 text-xs text-slate-500">Net {currency(summary.counterNetSales || 0)}</p>
          </div>
          <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Counter Promo</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{currency(summary.counterPromoDiscount || 0)}</p>
            <p className="mt-1 text-xs text-slate-500">
              After promo {currency((summary.counterGrossSales || 0) - (summary.counterPromoDiscount || 0))}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Partner Gross</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{currency(summary.partnerGrossSales || 0)}</p>
            <p className="mt-1 text-xs text-slate-500">After promo {currency(summary.partnerSalesAfterPromo || 0)}</p>
          </div>
          <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Partner Promo</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{currency(summary.partnerPromoSalesDiscount || 0)}</p>
            <p className="mt-1 text-xs text-slate-500">Commission {currency(summary.partnerCommissionAmount || 0)}</p>
          </div>
          <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Partner Net</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{currency(summary.partnerNetSales || 0)}</p>
            <p className="mt-1 text-xs text-slate-500">Stored order cost based</p>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Daily Tentative Profit</h2>
            <p className="text-xs text-slate-500">Each day shows gross sales, partner promo impact, commission deduction, stored cost, and final tentative profit.</p>
          </div>
          <p className="text-xs font-medium text-slate-400">
            {selectedChannelLabel} • {selectedPartnerLabel}
          </p>
        </div>

        <div className="space-y-3 md:hidden">
          {(report.rows || []).map((row) => (
            <div key={row.date} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-600">{row.date}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.totalOrders} orders • {row.totalItems} items
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-600">{currency(row.tentativeProfit)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Gross</p>
                  <p className="mt-1 text-slate-700">{currency(row.grossSales)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Total Promo</p>
                  <p className="mt-1 text-slate-700">{currency(row.totalPromoDiscount)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Counter Promo</p>
                  <p className="mt-1 text-slate-700">{currency(row.counterPromoDiscount)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Partner Promo</p>
                  <p className="mt-1 text-slate-700">{currency(row.partnerPromoDiscount)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">After Promo</p>
                  <p className="mt-1 text-slate-700">{currency(row.salesAfterPartnerPromo)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Commission</p>
                  <p className="mt-1 text-slate-700">{currency(row.commissionAmount)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Net Sales</p>
                  <p className="mt-1 text-slate-700">{currency(row.netSales)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Cost</p>
                  <p className="mt-1 text-slate-700">{currency(row.costOfGoodsSold)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Counter Net</p>
                  <p className="mt-1 text-slate-700">{currency(row.counterNetSales)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Partner Net</p>
                  <p className="mt-1 text-slate-700">{currency(row.partnerNetSales)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Profit Margin</p>
                  <p className="mt-1 font-semibold text-emerald-600">{formatPercent(row.profitMarginPercent, 2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">SL</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Orders</th>
                <th className="pb-3 pr-4">Items</th>
                <th className="pb-3 pr-4">Gross</th>
                <th className="pb-3 pr-4">Total Promo</th>
                <th className="pb-3 pr-4">Counter Promo</th>
                <th className="pb-3 pr-4">Partner Promo</th>
                <th className="pb-3 pr-4">After Promo</th>
                <th className="pb-3 pr-4">Commission</th>
                <th className="pb-3 pr-4">Net Sales</th>
                <th className="pb-3 pr-4">Cost</th>
                <th className="pb-3 pr-4">Tentative Profit</th>
                <th className="pb-3">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {(report.rows || []).map((row) => (
                <tr key={row.date} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-semibold text-slate-700">{row.sl}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{row.date}</td>
                  <td className="py-3 pr-4 text-slate-700">{row.totalOrders}</td>
                  <td className="py-3 pr-4 text-slate-700">{row.totalItems}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.grossSales)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.totalPromoDiscount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.counterPromoDiscount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.partnerPromoDiscount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.salesAfterPartnerPromo)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.commissionAmount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.netSales)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.costOfGoodsSold)}</td>
                  <td className="py-3 pr-4 font-bold text-emerald-600">{currency(row.tentativeProfit)}</td>
                  <td className="py-3 text-slate-700">{formatPercent(row.profitMarginPercent, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Delivery Partner Profit Detail</h2>
            <p className="text-xs text-slate-500">Partner rows show each app&apos;s sales before promo, after promo, commission, stored cost, and tentative profit.</p>
          </div>
          <p className="text-xs font-medium text-slate-400">Partner filter: {selectedPartnerLabel}</p>
        </div>

        <div className="space-y-3 md:hidden">
          {(report.partnerRows || []).map((row) => (
            <div key={row.partner} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{row.partnerLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.orderCount} orders</p>
                </div>
                <p className="text-sm font-bold text-emerald-600">{currency(row.tentativeProfit)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Gross</p>
                  <p className="mt-1 text-slate-700">{currency(row.grossSales)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Partner Promo</p>
                  <p className="mt-1 text-slate-700">{currency(row.partnerPromoDiscount)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">After Promo</p>
                  <p className="mt-1 text-slate-700">{currency(row.salesAfterPartnerPromo)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Commission</p>
                  <p className="mt-1 text-slate-700">{currency(row.commissionAmount)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Net</p>
                  <p className="mt-1 text-slate-700">{currency(row.netSales)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Cost</p>
                  <p className="mt-1 text-slate-700">{currency(row.costOfGoodsSold)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Margin</p>
                  <p className="mt-1 font-semibold text-emerald-600">{formatPercent(row.profitMarginPercent, 2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">SL</th>
                <th className="pb-3 pr-4">Partner</th>
                <th className="pb-3 pr-4">Orders</th>
                <th className="pb-3 pr-4">Gross</th>
                <th className="pb-3 pr-4">Partner Promo</th>
                <th className="pb-3 pr-4">After Promo</th>
                <th className="pb-3 pr-4">Commission</th>
                <th className="pb-3 pr-4">Net Sales</th>
                <th className="pb-3 pr-4">Cost</th>
                <th className="pb-3 pr-4">Tentative Profit</th>
                <th className="pb-3">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {(report.partnerRows || []).map((row) => (
                <tr key={row.partner} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-semibold text-slate-700">{row.sl}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{row.partnerLabel}</td>
                  <td className="py-3 pr-4 text-slate-700">{row.orderCount}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.grossSales)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.partnerPromoDiscount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.salesAfterPartnerPromo)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.commissionAmount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.netSales)}</td>
                  <td className="py-3 pr-4 text-slate-700">{currency(row.costOfGoodsSold)}</td>
                  <td className="py-3 pr-4 font-bold text-emerald-600">{currency(row.tentativeProfit)}</td>
                  <td className="py-3 text-slate-700">{formatPercent(row.profitMarginPercent, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default TentativeProfitReportPage;
