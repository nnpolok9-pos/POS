import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bike, Download, FileSpreadsheet, HandCoins, Store, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import ReportDatePicker from "../components/ReportDatePicker";
import eGatesLogo from "../assets/partners/e-gates.jpg";
import foodpandaLogo from "../assets/partners/foodpanda.png";
import grabLogo from "../assets/partners/grab.png";
import wownowLogo from "../assets/partners/wownow.png";
import { useShopSettings } from "../context/ShopSettingsContext";
import { reportService } from "../services/reportService";
import { getLocalDateInputValue } from "../utils/date";
import { currency } from "../utils/format";
import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";

const todayString = () => getLocalDateInputValue();

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm";

const partnerMeta = {
  grab: {
    label: "Grab",
    logo: grabLogo,
    color: "#1db954"
  },
  foodpanda: {
    label: "Foodpanda",
    logo: foodpandaLogo,
    color: "#ec4899"
  },
  e_gates: {
    label: "E-Gates",
    logo: eGatesLogo,
    color: "#f59e0b"
  },
  wownow: {
    label: "WOWNOW",
    logo: wownowLogo,
    color: "#ef4444"
  }
};

const summaryColumns = [
  { header: "Metric", key: "metric" },
  { header: "Amount", key: "amount" }
];

const partnerColumns = [
  { header: "Partner", key: "partnerLabel" },
  { header: "Gross", key: "grossSales" },
  { header: "Net Sales After Ad", key: "netSalesAfterAdvertising" },
  { header: "Tentative Profit", key: "tentativeProfit" }
];

const dailyColumns = [
  { header: "Date", key: "date" },
  { header: "Net Sales After Ad", key: "netSalesAfterAdvertising" },
  { header: "Tentative Profit", key: "tentativeProfit" }
];

const MobileMetricCard = ({ label, value, accent = "text-slate-900", icon: Icon }) => (
  <article className="rounded-[1.2rem] border border-slate-100 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className={`mt-2 text-xl font-bold ${accent}`}>{value}</p>
      </div>
      {Icon ? (
        <span className="rounded-full bg-slate-50 p-2 text-slate-500">
          <Icon size={16} />
        </span>
      ) : null}
    </div>
  </article>
);

const VerticalBarChart = ({ title, subtitle, data, formatValue = currency }) => {
  const safeData = data.filter((item) => Number(item.value || 0) >= 0);
  const maxValue = Math.max(...safeData.map((item) => Number(item.value || 0)), 1);

  return (
    <section className="glass-card overflow-hidden p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-3 sm:hidden">
        {safeData.map((item) => (
          <div key={item.key} className="rounded-[1.2rem] border border-slate-100 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {item.logo ? (
                  <img src={item.logo} alt={item.label} className="h-8 w-8 rounded-xl object-cover shadow-sm" />
                ) : item.icon ? (
                  <span className="rounded-full bg-slate-100 p-2 text-slate-600">
                    <item.icon size={15} />
                  </span>
                ) : null}
                <span className="truncate text-sm font-semibold text-slate-800">{item.label}</span>
              </div>
              <span className="text-sm font-bold text-slate-900">{formatValue(item.value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max((Number(item.value || 0) / maxValue) * 100, 6)}%`,
                  backgroundColor: item.color
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${Math.max(safeData.length * 110, 720)} 320`} className="h-[320px] w-full min-w-[720px]">
            <line x1="56" y1="22" x2="56" y2="250" stroke="#e5e7eb" strokeWidth="1.5" />
            <line x1="56" y1="250" x2={Math.max(safeData.length * 110, 720) - 20} y2="250" stroke="#e5e7eb" strokeWidth="1.5" />
            {safeData.map((item, index) => {
              const groupWidth = 110;
              const barWidth = 54;
              const x = 80 + index * groupWidth;
              const barHeight = Math.max((Number(item.value || 0) / maxValue) * 180, 6);
              const y = 250 - barHeight;
              return (
                <g key={item.key}>
                  <rect x={x} y={y} width={barWidth} height={barHeight} rx="14" fill={item.color} />
                  <text x={x + barWidth / 2} y={y - 10} textAnchor="middle" className="fill-slate-700 text-[12px] font-semibold">
                    {formatValue(item.value)}
                  </text>
                  <foreignObject x={x - 18} y={258} width="90" height="56">
                    <div className="flex h-full flex-col items-center justify-start gap-1 text-center">
                      {item.logo ? (
                        <img src={item.logo} alt={item.label} className="h-7 w-7 rounded-lg object-cover shadow-sm" />
                      ) : item.icon ? (
                        <span className="rounded-full bg-slate-100 p-1.5 text-slate-600">
                          <item.icon size={14} />
                        </span>
                      ) : null}
                      <span className="line-clamp-2 text-[11px] font-semibold text-slate-600">{item.label}</span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
};

const GraphicalReportPage = () => {
  const { settings: shopSettings } = useShopSettings();
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [report, setReport] = useState({ summary: {}, rows: [], partnerRows: [] });
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getTentativeProfit({
        from,
        to,
        channel: "all",
        partner: undefined
      });
      setReport({
        summary: data.summary || {},
        rows: data.rows || [],
        partnerRows: data.partnerRows || []
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load graphical report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const summary = report.summary || {};

  const headlineMetrics = useMemo(
    () => [
      {
        key: "netAfterAd",
        label: "Net Sales After Ad",
        value: Number(summary.netSalesAfterAdvertising || 0),
        color: "#1d4ed8",
        icon: HandCoins
      },
      {
        key: "tentativeProfit",
        label: "Tentative Profit",
        value: Number(summary.tentativeProfit || 0),
        color: "#16a34a",
        icon: TrendingUp
      },
      {
        key: "counterProfit",
        label: "Counter Profit",
        value: Number(summary.counterTentativeProfit || 0),
        color: "#0f172a",
        icon: Store
      },
      ...["grab", "foodpanda", "e_gates", "wownow"].map((partnerKey) => {
        const row = (report.partnerRows || []).find((item) => item.partner === partnerKey);
        return {
          key: partnerKey,
          label: partnerMeta[partnerKey].label,
          value: Number(row?.tentativeProfit || 0),
          color: partnerMeta[partnerKey].color,
          logo: partnerMeta[partnerKey].logo
        };
      })
    ],
    [report.partnerRows, summary.counterTentativeProfit, summary.netSalesAfterAdvertising, summary.tentativeProfit]
  );

  const dailyComparisonData = useMemo(
    () =>
      (report.rows || []).map((row) => ({
        key: row.date,
        label: row.date,
        value: Number(row.tentativeProfit || 0),
        secondaryValue: Number(row.netSalesAfterAdvertising || 0)
      })),
    [report.rows]
  );

  const exportSummaryRows = useMemo(
    () => [
      { metric: "Net Sales After Ad", amount: currency(summary.netSalesAfterAdvertising) },
      { metric: "Tentative Profit", amount: currency(summary.tentativeProfit) },
      { metric: "Counter Tentative Profit", amount: currency(summary.counterTentativeProfit) },
      { metric: "Partner Tentative Profit", amount: currency(summary.partnerTentativeProfit) }
    ],
    [summary.counterTentativeProfit, summary.netSalesAfterAdvertising, summary.partnerTentativeProfit, summary.tentativeProfit]
  );

  const exportPartnerRows = useMemo(
    () =>
      (report.partnerRows || []).map((row) => ({
        partnerLabel: row.partnerLabel,
        grossSales: currency(row.grossSales),
        netSalesAfterAdvertising: currency(row.netSalesAfterAdvertising),
        tentativeProfit: currency(row.tentativeProfit)
      })),
    [report.partnerRows]
  );

  const exportDailyRows = useMemo(
    () =>
      (report.rows || []).map((row) => ({
        date: row.date,
        netSalesAfterAdvertising: currency(row.netSalesAfterAdvertising),
        tentativeProfit: currency(row.tentativeProfit)
      })),
    [report.rows]
  );

  const exportExcel = () => {
    if (!report.rows?.length && !report.partnerRows?.length) {
      toast.error("No graphical report data to export");
      return;
    }

    exportReportToExcel({
      fileName: `graphical-report-${from}-to-${to}`,
      sheetName: "Summary",
      title: "Graphical Report",
      columns: summaryColumns,
      rows: exportSummaryRows,
      extraSheets: [
        { sheetName: "Daily Trend", columns: dailyColumns, rows: exportDailyRows },
        { sheetName: "Partner Profit", columns: partnerColumns, rows: exportPartnerRows }
      ],
      shopProfile: shopSettings,
      summaryLines: [`Date Range: ${from} to ${to}`]
    });
  };

  const exportPdf = async () => {
    if (!report.rows?.length && !report.partnerRows?.length) {
      toast.error("No graphical report data to export");
      return;
    }

    await exportReportToPdf({
      title: "Graphical Report",
      fileName: `graphical-report-${from}-to-${to}`,
      columns: dailyColumns,
      rows: exportDailyRows,
      summaryLines: [
        `Date Range: ${from} to ${to}`,
        `Net Sales After Ad: ${currency(summary.netSalesAfterAdvertising)}`,
        `Tentative Profit: ${currency(summary.tentativeProfit)}`
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
                  Graphical Report
                </div>
                <h1 className="mt-2.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">Graphical Profit Report</h1>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                  Compare net sales after advertisement, tentative profit, counter profit, and partner profit for any selected period.
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-[#cbbba5] bg-[#fffaf0] px-4 py-3 shadow-sm sm:rounded-full sm:py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Filters</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-800">
                  {from} to {to}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">Graphical report overview</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="rounded-[1.4rem] border border-[#efe2ca] bg-[#fff8ea] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
                  <ReportDatePicker label="From Date" value={from} onChange={setFrom} maxDate={to} />
                  <div className="pb-3 text-center text-sm font-semibold text-slate-400">to</div>
                  <ReportDatePicker label="To Date" value={to} onChange={setTo} minDate={from} />
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
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MobileMetricCard label="Net Sales After Ad" value={currency(summary.netSalesAfterAdvertising)} icon={HandCoins} />
        <MobileMetricCard label="Tentative Profit" value={currency(summary.tentativeProfit)} icon={TrendingUp} accent="text-emerald-600" />
        <MobileMetricCard label="Counter Profit" value={currency(summary.counterTentativeProfit)} icon={Store} />
        <MobileMetricCard label="Partners Profit" value={currency(summary.partnerTentativeProfit)} icon={Bike} />
      </section>

      <VerticalBarChart
        title="Profit Overview"
        subtitle="This chart compares the core profitability metrics and each partner's contribution for the selected period."
        data={headlineMetrics}
      />

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Daily Trend</h2>
            <p className="text-xs text-slate-500">
              Each day compares net sales after advertisement with tentative profit to make channel performance easier to read.
            </p>
          </div>
        </div>

        <div className="space-y-3 sm:hidden">
          {(dailyComparisonData || []).length === 0 ? (
            <div className="rounded-[1.35rem] border border-slate-100 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No daily data found for the selected period.
            </div>
          ) : (
            dailyComparisonData.map((item) => (
              <article key={item.key} className="rounded-[1.2rem] border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-900">{item.label}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MobileMetricCard label="Net Sales After Ad" value={currency(item.secondaryValue)} icon={HandCoins} />
                  <MobileMetricCard label="Tentative Profit" value={currency(item.value)} icon={TrendingUp} accent="text-emerald-600" />
                </div>
              </article>
            ))
          )}
        </div>

        <div className="hidden sm:block">
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${Math.max((dailyComparisonData.length || 1) * 120, 720)} 340`} className="h-[340px] w-full min-w-[720px]">
              <line x1="60" y1="22" x2="60" y2="250" stroke="#e5e7eb" strokeWidth="1.5" />
              <line x1="60" y1="250" x2={Math.max((dailyComparisonData.length || 1) * 120, 720) - 20} y2="250" stroke="#e5e7eb" strokeWidth="1.5" />
              {(() => {
                const maxValue = Math.max(
                  ...dailyComparisonData.flatMap((item) => [Number(item.value || 0), Number(item.secondaryValue || 0)]),
                  1
                );
                return dailyComparisonData.map((item, index) => {
                  const groupWidth = 120;
                  const barWidth = 28;
                  const x = 84 + index * groupWidth;
                  const profitHeight = Math.max((Number(item.value || 0) / maxValue) * 170, Number(item.value || 0) > 0 ? 6 : 0);
                  const netHeight = Math.max((Number(item.secondaryValue || 0) / maxValue) * 170, Number(item.secondaryValue || 0) > 0 ? 6 : 0);
                  return (
                    <g key={item.key}>
                      <rect x={x} y={250 - netHeight} width={barWidth} height={netHeight} rx="10" fill="#2563eb" />
                      <rect x={x + 36} y={250 - profitHeight} width={barWidth} height={profitHeight} rx="10" fill="#16a34a" />
                      <text x={x + barWidth / 2} y={250 - netHeight - 10} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">
                        {currency(item.secondaryValue)}
                      </text>
                      <text x={x + 36 + barWidth / 2} y={250 - profitHeight - 10} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">
                        {currency(item.value)}
                      </text>
                      <text x={x + 32} y="288" textAnchor="middle" className="fill-slate-600 text-[11px] font-semibold">
                        {item.label}
                      </text>
                    </g>
                  );
                });
              })()}
              <g transform={`translate(${Math.max((dailyComparisonData.length || 1) * 120, 720) - 220}, 20)`}>
                <rect x="0" y="0" width="12" height="12" rx="4" fill="#2563eb" />
                <text x="18" y="10" className="fill-slate-600 text-[12px] font-semibold">
                  Net After Ad
                </text>
                <rect x="0" y="24" width="12" height="12" rx="4" fill="#16a34a" />
                <text x="18" y="34" className="fill-slate-600 text-[12px] font-semibold">
                  Tentative Profit
                </text>
              </g>
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GraphicalReportPage;
