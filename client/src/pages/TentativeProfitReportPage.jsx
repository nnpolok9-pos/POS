import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bike,
  Download,
  FileSpreadsheet,
  HandCoins,
  Megaphone,
  PiggyBank,
  Store,
  WalletCards
} from "lucide-react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import eGatesLogo from "../assets/partners/e-gates.jpg";
import foodpandaLogo from "../assets/partners/foodpanda.png";
import grabLogo from "../assets/partners/grab.png";
import wownowLogo from "../assets/partners/wownow.png";
import { useShopSettings } from "../context/ShopSettingsContext";
import { reportService } from "../services/reportService";
import { getLocalDateInputValue } from "../utils/date";
import { currency, formatPercent } from "../utils/format";
import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";


const todayString = () => getLocalDateInputValue();

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm";

const statCardClass = "rounded-[1.35rem] p-3 shadow-sm";

const partnerMeta = {
  grab: {
    label: "Grab",
    logo: grabLogo
  },
  foodpanda: {
    label: "Foodpanda",
    logo: foodpandaLogo
  },
  e_gates: {
    label: "E-Gates",
    logo: eGatesLogo
  },
  wownow: {
    label: "WOWNOW",
    logo: wownowLogo
  }
};

const dailyColumns = [
  { header: "SL", key: "sl" },
  { header: "Date", key: "date" },
  { header: "Orders", key: "totalOrders" },
  { header: "Items", key: "totalItems" },
  { header: "Gross", key: "grossSales" },
  { header: "Total Promo", key: "totalPromoDiscount" },
  { header: "Counter Promo", key: "counterPromoDiscount" },
  { header: "Partner Promo", key: "partnerPromoDiscount" },
  { header: "After Promo", key: "salesAfterPartnerPromo" },
  { header: "Commission", key: "commissionAmount" },
  { header: "ROI Cost", key: "advertisingRoiCost" },
  { header: "Net Sales", key: "netSales" },
  { header: "Net After Ad", key: "netSalesAfterAdvertising" },
  { header: "Cost", key: "costOfGoodsSold" },
  { header: "Tentative Profit", key: "tentativeProfit" },
  { header: "Margin %", key: "profitMarginPercent" }
];

const channelColumns = [
  { header: "SL", key: "sl" },
  { header: "Channel", key: "partnerLabel" },
  { header: "Orders", key: "orderCount" },
  { header: "Gross", key: "grossSales" },
  { header: "Promo", key: "partnerPromoDiscount" },
  { header: "After Promo", key: "salesAfterPartnerPromo" },
  { header: "Commission", key: "commissionAmount" },
  { header: "ROI Cost", key: "advertisingRoiCost" },
  { header: "Net Sales", key: "netSales" },
  { header: "Net After Ad", key: "netSalesAfterAdvertising" },
  { header: "Cost", key: "costOfGoodsSold" },
  { header: "Tentative Profit", key: "tentativeProfit" },
  { header: "Margin %", key: "profitMarginPercent" }
];

const formatMoneyCell = (value) => currency(Number(value || 0));

const mobileMetricLabelClass = "text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400";
const mobileMetricValueClass = "mt-1 text-sm font-semibold text-slate-800";

const MobileMetric = ({ label, value, tone = "default" }) => {
  const toneClass =
    tone === "profit"
      ? "text-emerald-600"
      : tone === "strong"
        ? "text-slate-900"
        : "text-slate-800";

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
      <p className={mobileMetricLabelClass}>{label}</p>
      <p className={`${mobileMetricValueClass} ${toneClass}`}>{value}</p>
    </div>
  );
};

const DailyRowMobileCard = ({ row }) => (
  <article className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Day {row.sl}</p>
        <h3 className="mt-1 text-base font-bold text-slate-900">{row.date}</h3>
      </div>
      <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
        {row.totalOrders} orders · {row.totalItems} items
      </div>
    </div>

    <div className="mt-4 grid gap-3">
      <MobileMetric label="Gross" value={formatMoneyCell(row.grossSales)} />
      <div className="grid grid-cols-2 gap-3">
        <MobileMetric label="Total Promo" value={formatMoneyCell(row.totalPromoDiscount)} />
        <MobileMetric label="After Promo" value={formatMoneyCell(row.salesAfterPartnerPromo)} />
        <MobileMetric label="Counter Promo" value={formatMoneyCell(row.counterPromoDiscount)} />
        <MobileMetric label="Partner Promo" value={formatMoneyCell(row.partnerPromoDiscount)} />
        <MobileMetric label="Commission" value={formatMoneyCell(row.commissionAmount)} />
        <MobileMetric label="ROI Cost" value={formatMoneyCell(row.advertisingRoiCost)} />
        <MobileMetric label="Net Sales" value={formatMoneyCell(row.netSales)} tone="strong" />
        <MobileMetric label="Net After Ad" value={formatMoneyCell(row.netSalesAfterAdvertising)} tone="strong" />
        <MobileMetric label="Cost" value={formatMoneyCell(row.costOfGoodsSold)} />
        <MobileMetric label="Margin %" value={formatPercent(row.profitMarginPercent)} />
      </div>
      <MobileMetric label="Tentative Profit" value={formatMoneyCell(row.tentativeProfit)} tone="profit" />
    </div>
  </article>
);

const ChannelRowMobileCard = ({ row }) => (
  <article className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3">
      {row.partner === "counter" ? (
        <span className="rounded-full bg-slate-100 p-2 text-slate-600">
          <Store size={16} />
        </span>
      ) : partnerMeta[row.partner]?.logo ? (
        <img
          src={partnerMeta[row.partner].logo}
          alt={row.partnerLabel}
          className="h-10 w-10 rounded-2xl object-cover shadow-sm"
        />
      ) : (
        <span className="rounded-full bg-slate-100 p-2 text-slate-600">
          <Bike size={16} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-slate-900">{row.partnerLabel}</h3>
        <p className="text-xs text-slate-500">{row.orderCount} orders</p>
      </div>
    </div>

    <div className="mt-4 grid gap-3">
      <MobileMetric label="Gross" value={formatMoneyCell(row.grossSales)} />
      <div className="grid grid-cols-2 gap-3">
        <MobileMetric label="Promo" value={formatMoneyCell(row.partnerPromoDiscount)} />
        <MobileMetric label="After Promo" value={formatMoneyCell(row.salesAfterPartnerPromo)} />
        <MobileMetric label="Commission" value={formatMoneyCell(row.commissionAmount)} />
        <MobileMetric label="ROI Cost" value={formatMoneyCell(row.advertisingRoiCost)} />
        <MobileMetric label="Net Sales" value={formatMoneyCell(row.netSales)} tone="strong" />
        <MobileMetric label="Net After Ad" value={formatMoneyCell(row.netSalesAfterAdvertising)} tone="strong" />
        <MobileMetric label="Cost" value={formatMoneyCell(row.costOfGoodsSold)} />
        <MobileMetric label="Margin %" value={formatPercent(row.profitMarginPercent)} />
      </div>
      <MobileMetric label="Tentative Profit" value={formatMoneyCell(row.tentativeProfit)} tone="profit" />
    </div>
  </article>
);

const TentativeProfitReportPage = () => {
  const { settings: shopSettings } = useShopSettings();
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [channel, setChannel] = useState("all");
  const [selectedPartner, setSelectedPartner] = useState("all");
  const [report, setReport] = useState({ summary: {}, rows: [], partnerRows: [] });
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getTentativeProfit({
        from,
        to,
        channel,
        partner: selectedPartner === "all" ? undefined : selectedPartner
      });
      setReport({
        summary: data.summary || {},
        rows: data.rows || [],
        partnerRows: data.partnerRows || []
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load tentative profit report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const summary = report.summary || {};

  const salesChannelRows = useMemo(() => {
    const rows = [];

    if (channel !== "partners" && selectedPartner === "all") {
      rows.push({
        sl: 1,
        partner: "counter",
        partnerLabel: "Counter POS",
        orderCount:
          Number(summary.totalOrders || 0) -
          Number(
            report.partnerRows?.reduce((sum, row) => sum + Number(row.orderCount || 0), 0) || 0
          ),
        grossSales: Number(summary.counterGrossSales || 0),
        partnerPromoDiscount: Number(summary.counterPromoDiscount || 0),
        salesAfterPartnerPromo:
          Number(summary.counterGrossSales || 0) - Number(summary.counterPromoDiscount || 0),
        commissionAmount: 0,
        advertisingRoiCost: Number(summary.counterAdvertisingRoiCost || 0),
        netSales: Number(summary.counterNetSales || 0),
        netSalesAfterAdvertising: Number(summary.counterNetSalesAfterAdvertising || 0),
        costOfGoodsSold: Number(summary.counterCostOfGoodsSold || 0),
        tentativeProfit: Number(summary.counterTentativeProfit || 0),
        profitMarginPercent:
          Number(summary.counterNetSales || 0) > 0
            ? Number(
                (
                  (Number(summary.counterTentativeProfit || 0) /
                    Number(summary.counterNetSales || 0)) *
                  100
                ).toFixed(2)
              )
            : 0
      });
    }

    const partnerRows = (report.partnerRows || []).map((row, index) => ({
      ...row,
      sl: rows.length + index + 1
    }));

    return [...rows, ...partnerRows];
  }, [channel, report.partnerRows, selectedPartner, summary]);

  const partnerOptions = useMemo(
    () => [
      { value: "all", label: "All Partners" },
      ...Object.entries(partnerMeta).map(([value, meta]) => ({
        value,
        label: meta.label
      }))
    ],
    []
  );

  const exportDailyRows = (report.rows || []).map((row) => ({
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
    advertisingRoiCost: Number(row.advertisingRoiCost || 0).toFixed(2),
    netSales: Number(row.netSales || 0).toFixed(2),
    netSalesAfterAdvertising: Number(row.netSalesAfterAdvertising || 0).toFixed(2),
    costOfGoodsSold: Number(row.costOfGoodsSold || 0).toFixed(2),
    tentativeProfit: Number(row.tentativeProfit || 0).toFixed(2),
    profitMarginPercent: `${Number(row.profitMarginPercent || 0).toFixed(2)}%`
  }));

  const exportChannelRows = salesChannelRows.map((row) => ({
    sl: row.sl,
    partnerLabel: row.partnerLabel,
    orderCount: row.orderCount,
    grossSales: Number(row.grossSales || 0).toFixed(2),
    partnerPromoDiscount: Number(row.partnerPromoDiscount || 0).toFixed(2),
    salesAfterPartnerPromo: Number(row.salesAfterPartnerPromo || 0).toFixed(2),
    commissionAmount: Number(row.commissionAmount || 0).toFixed(2),
    advertisingRoiCost: Number(row.advertisingRoiCost || 0).toFixed(2),
    netSales: Number(row.netSales || 0).toFixed(2),
    netSalesAfterAdvertising: Number(row.netSalesAfterAdvertising || 0).toFixed(2),
    costOfGoodsSold: Number(row.costOfGoodsSold || 0).toFixed(2),
    tentativeProfit: Number(row.tentativeProfit || 0).toFixed(2),
    profitMarginPercent: `${Number(row.profitMarginPercent || 0).toFixed(2)}%`
  }));

  const exportExcel = () => {
    if (!exportDailyRows.length) {
      toast.error("No tentative profit data to export");
      return;
    }

    exportReportToExcel({
      fileName: `tentative-profit-${from}-to-${to}`,
      sheetName: "Daily Profit",
      title: "Tentative Profit Report",
      columns: dailyColumns,
      rows: exportDailyRows,
      extraSheets: [
        {
          sheetName: "Channel Profit",
          columns: channelColumns,
          rows: exportChannelRows
        }
      ],
      shopProfile: shopSettings,
      summaryLines: [
        `Date Range: ${from} to ${to}`,
        `Sales Channel: ${
          channel === "all" ? "All Sales" : channel === "counter" ? "Counter Sales" : "Delivery Partners"
        }`,
        `Partner Filter: ${partnerOptions.find((option) => option.value === selectedPartner)?.label || "All Partners"}`
      ]
    });
  };

  const exportPdf = async () => {
    if (!exportDailyRows.length) {
      toast.error("No tentative profit data to export");
      return;
    }

    await exportReportToPdf({
      title: "Tentative Profit Report",
      fileName: `tentative-profit-${from}-to-${to}`,
      columns: dailyColumns,
      rows: exportDailyRows,
      summaryLines: [
        `Date Range: ${from} to ${to}`,
        `Sales Channel: ${
          channel === "all" ? "All Sales" : channel === "counter" ? "Counter Sales" : "Delivery Partners"
        }`,
        `Partner Filter: ${partnerOptions.find((option) => option.value === selectedPartner)?.label || "All Partners"}`
      ],
      shopProfile: shopSettings
    });
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-3 sm:p-5">
        <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)] sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className={heroBadgeClass}>
                  <BarChart3 size={14} />
                  Tentative Profit
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Tentative Profit Report</h1>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                  Measure counter and delivery sales together using saved order cost snapshots, promo deduction, commission, ROI cost,
                  and final net sales after advertisement.
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-[#cbbba5] bg-[#fffaf0] px-4 py-3 shadow-sm sm:rounded-full sm:py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Filters</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-800">
                  {from} to {to}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {channel === "all" ? "All Sales" : channel === "counter" ? "Counter Sales" : "Delivery Partners"} ·{" "}
                  {partnerOptions.find((option) => option.value === selectedPartner)?.label || "All Partners"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="rounded-[1.4rem] border border-[#efe2ca] bg-[#fff8ea] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(220px,0.9fr)_minmax(220px,0.9fr)] md:items-end">
                  <ReportDatePicker label="From Date" value={from} onChange={setFrom} maxDate={to} />
                  <div className="pb-3 text-center text-sm font-semibold text-slate-400">to</div>
                  <ReportDatePicker label="To Date" value={to} onChange={setTo} minDate={from} />
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sales Channel</label>
                    <select value={channel} onChange={(event) => setChannel(event.target.value)} className="input">
                      <option value="all">All Sales</option>
                      <option value="counter">Counter Sales</option>
                      <option value="partners">Delivery Partners</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Partner Filter</label>
                    <select value={selectedPartner} onChange={(event) => setSelectedPartner(event.target.value)} className="input">
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
                <button type="button" onClick={loadReport} className="btn-primary h-11 rounded-full px-5 text-sm shadow-sm">
                  {loading ? "Loading..." : "Generate"}
                </button>
                <button type="button" onClick={exportExcel} className="btn-secondary h-11 gap-2 rounded-full border border-[#d7cbb7] bg-white px-4 text-sm">
                  <FileSpreadsheet size={18} />
                  Export Excel
                </button>
                <button type="button" onClick={exportPdf} className="btn-secondary h-11 gap-2 rounded-full border border-[#d7cbb7] bg-white px-4 text-sm">
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
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.netSales)}</p>
                <p className="mt-1 text-xs text-slate-500">{summary.totalOrders || 0} orders</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-slate-500">
                <WalletCards size={18} />
              </div>
            </div>
          </div>

          <div className={`${statCardClass} border border-[#efe2ca] bg-[#fff8ea]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cost of Goods</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.costOfGoodsSold)}</p>
                <p className="mt-1 text-xs text-slate-500">{summary.totalItems || 0} items sold</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-amber-500">
                <PiggyBank size={18} />
              </div>
            </div>
          </div>

          <div className={`${statCardClass} border border-[#d8eedd] bg-[#eef8f1]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net After Ad</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.netSalesAfterAdvertising)}</p>
                <p className="mt-1 text-xs text-slate-500">ROI cost deducted</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                <HandCoins size={18} />
              </div>
            </div>
          </div>

          <div className={`${statCardClass} border border-[#dce7df] bg-[#eef4ef]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tentative Profit</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.tentativeProfit)}</p>
                <p className="mt-1 text-xs text-slate-500">Margin {formatPercent(summary.profitMarginPercent)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-emerald-600">
                <WalletCards size={18} />
              </div>
            </div>
          </div>

          <div className={`${statCardClass} border border-[#f0e2d6] bg-[#fff4ec]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Promo</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.totalPromoDiscount)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Counter {currency(summary.counterPromoDiscount)} · Partner {currency(summary.partnerPromoDiscount)}
                </p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-rose-500">
                <Megaphone size={18} />
              </div>
            </div>
          </div>

          <div className={`${statCardClass} border border-[#efe2ca] bg-[#fff8ea]`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Commission & ROI</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.commissionAmount)}</p>
                <p className="mt-1 text-xs text-slate-500">ROI {currency(summary.advertisingRoiCost)}</p>
              </div>
              <div className="rounded-full bg-white/55 p-3 text-orange-500">
                <Bike size={18} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Counter Gross</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.counterGrossSales)}</p>
            <p className="mt-1 text-xs text-slate-400">Net {currency(summary.counterNetSales)}</p>
          </div>
          <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Counter Promo</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.counterPromoDiscount)}</p>
            <p className="mt-1 text-xs text-slate-400">
              After promo {currency(Number(summary.counterGrossSales || 0) - Number(summary.counterPromoDiscount || 0))}
            </p>
          </div>
          <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Partner Gross</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.partnerGrossSales)}</p>
            <p className="mt-1 text-xs text-slate-400">After promo {currency(summary.partnerSalesAfterPromo)}</p>
          </div>
          <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Partner Promo</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{currency(summary.partnerPromoDiscount)}</p>
            <p className="mt-1 text-xs text-slate-400">Commission {currency(summary.partnerCommissionAmount)}</p>
          </div>
          <div className="rounded-[1.35rem] bg-[#171d31] p-4 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Channel Mix</p>
            <div className="mt-3 space-y-2 text-[15px] font-semibold">
              <p>Counter {currency(summary.counterNetSalesAfterAdvertising)}</p>
              <p>Partners {currency(summary.partnerNetSalesAfterAdvertising)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Daily Tentative Profit</h2>
            <p className="text-xs text-slate-500">
              Each day shows gross sales, promo impact, commission, ROI cost, stored cost, and final tentative profit.
            </p>
          </div>
          <p className="text-xs font-medium text-slate-400">
            {channel === "all" ? "All Sales" : channel === "counter" ? "Counter Sales" : "Delivery Partners"} ·{" "}
            {partnerOptions.find((option) => option.value === selectedPartner)?.label || "All Partners"}
          </p>
        </div>

        <div className="space-y-3 sm:hidden">
          {(report.rows || []).length === 0 ? (
            <div className="rounded-[1.35rem] border border-slate-100 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No tentative profit data found for the selected filters.
            </div>
          ) : (
            (report.rows || []).map((row) => <DailyRowMobileCard key={`${row.date}-${row.sl}`} row={row} />)
          )}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-white/70">
              <tr>
                {dailyColumns.map((column) => (
                  <th key={column.key} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(report.rows || []).length === 0 ? (
                <tr>
                  <td colSpan={dailyColumns.length} className="px-4 py-8 text-center text-sm text-slate-500">
                    No tentative profit data found for the selected filters.
                  </td>
                </tr>
              ) : (
                (report.rows || []).map((row) => (
                  <tr key={`${row.date}-${row.sl}`} className="align-top">
                    <td className="px-3 py-3 text-slate-700">{row.sl}</td>
                    <td className="px-3 py-3 text-slate-700">{row.date}</td>
                    <td className="px-3 py-3 text-slate-700">{row.totalOrders}</td>
                    <td className="px-3 py-3 text-slate-700">{row.totalItems}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.grossSales)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.totalPromoDiscount)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.counterPromoDiscount)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.partnerPromoDiscount)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.salesAfterPartnerPromo)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.commissionAmount)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.advertisingRoiCost)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.netSales)}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{formatMoneyCell(row.netSalesAfterAdvertising)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.costOfGoodsSold)}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-600">{formatMoneyCell(row.tentativeProfit)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatPercent(row.profitMarginPercent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sales Channel Profit Detail</h2>
            <p className="text-xs text-slate-500">
              Counter and partner rows show each channel&apos;s sales before promo, after promo, commission, ROI cost, stored cost, and final tentative profit.
            </p>
          </div>
          <p className="text-xs font-medium text-slate-400">
            Partner filter: {partnerOptions.find((option) => option.value === selectedPartner)?.label || "All Partners"}
          </p>
        </div>

        <div className="space-y-3 sm:hidden">
          {salesChannelRows.length === 0 ? (
            <div className="rounded-[1.35rem] border border-slate-100 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No sales channel detail found for the selected filters.
            </div>
          ) : (
            salesChannelRows.map((row) => <ChannelRowMobileCard key={`${row.partner}-${row.sl}`} row={row} />)
          )}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-white/70">
              <tr>
                {channelColumns.map((column) => (
                  <th key={column.key} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {salesChannelRows.length === 0 ? (
                <tr>
                  <td colSpan={channelColumns.length} className="px-4 py-8 text-center text-sm text-slate-500">
                    No sales channel detail found for the selected filters.
                  </td>
                </tr>
              ) : (
                salesChannelRows.map((row) => (
                  <tr key={`${row.partner}-${row.sl}`} className="align-top">
                    <td className="px-3 py-3 text-slate-700">{row.sl}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {row.partner === "counter" ? (
                          <span className="rounded-full bg-slate-100 p-2 text-slate-600">
                            <Store size={14} />
                          </span>
                        ) : partnerMeta[row.partner]?.logo ? (
                          <img
                            src={partnerMeta[row.partner].logo}
                            alt={row.partnerLabel}
                            className="h-8 w-8 rounded-xl object-cover shadow-sm"
                          />
                        ) : (
                          <span className="rounded-full bg-slate-100 p-2 text-slate-600">
                            <Bike size={14} />
                          </span>
                        )}
                        <span className="font-medium text-slate-800">{row.partnerLabel}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.orderCount}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.grossSales)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.partnerPromoDiscount)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.salesAfterPartnerPromo)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.commissionAmount)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.advertisingRoiCost)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.netSales)}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{formatMoneyCell(row.netSalesAfterAdvertising)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMoneyCell(row.costOfGoodsSold)}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-600">{formatMoneyCell(row.tentativeProfit)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatPercent(row.profitMarginPercent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default TentativeProfitReportPage;
