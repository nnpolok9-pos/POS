import { AlertTriangle, Package2, Scale, X } from "lucide-react";

const productTypeLabel = (type) =>
  ({
    combo: "Combined",
    combo_type: "Combo",
    raw_material: "Base",
    sauce: "Sauce",
    seasoning: "Seasoning",
    raw: "A La Catre"
  })[type] || "A La Catre";
const stockUnitLabel = (unit) =>
  ({
    pieces: "Piece",
    gram: "Gram",
    teaspoon: "Tea Spoon"
  })[unit] || "Piece";

const CombinedProductBreakdownModal = ({ open, product, materials = [], onClose }) => {
  if (!open || !product) {
    return null;
  }

  const limitingValue = materials.length ? Math.min(...materials.map((item) => item.possibleUnits)) : 0;
  const limitingItems = materials.filter((item) => item.possibleUnits === limitingValue);
  const nextTarget = Number.isFinite(limitingValue) ? limitingValue + 1 : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                <Package2 size={14} />
                Combined Inventory Breakdown
              </div>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-900">{product.name}</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                This report explains why the inventory is showing <span className="font-semibold text-slate-700">{product.stock}</span>{" "}
                saleable combined units and which base item needs to be enriched first to increase the stock.
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 justify-center rounded-2xl p-0">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl bg-sky-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Current Combined Stock</p>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">{product.stock}</p>
              <p className="mt-2 text-sm text-slate-500">Calculated from the lowest available base item capacity.</p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Needs Enrichment</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {limitingItems.length ? limitingItems.map((item) => item.name).join(", ") : "No base item"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                These are the limiting items because they allow only {limitingValue} combined unit
                {limitingValue === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-900 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Next Combined Unit Target</p>
              <p className="mt-3 text-3xl font-extrabold">{nextTarget}</p>
              <p className="mt-2 text-sm text-slate-300">Increase the limiting materials until they can support {nextTarget} units.</p>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-amber-100 p-3 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">Why this stock is shown</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  A combined product can only be sold as many times as its weakest base item allows. The smallest
                  calculated number from the materials below becomes the displayed inventory.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-[28px] border border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Base Item</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Unit</th>
                  <th className="px-4 py-3 font-semibold">Needed Per Combined</th>
                  <th className="px-4 py-3 font-semibold">Current Stock</th>
                  <th className="px-4 py-3 font-semibold">Supports Combined Qty</th>
                  <th className="px-4 py-3 font-semibold">Need More For Next Unit</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 bg-white">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.sku || "No SKU"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{productTypeLabel(item.productType)}</td>
                    <td className="px-4 py-4 text-slate-600">{stockUnitLabel(item.stockUnit)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {item.requiredQuantity} {stockUnitLabel(item.stockUnit)}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {item.currentStock} {stockUnitLabel(item.stockUnit)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          item.isLimiting ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {item.possibleUnits} unit{item.possibleUnits === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">
                          {item.shortageForNextUnit > 0 ? `${item.shortageForNextUnit} ${stockUnitLabel(item.stockUnit)}` : "Already enough"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.shortageForNextUnit > 0
                            ? `Add this much to help reach ${nextTarget} combined units`
                            : `This item already supports ${nextTarget} units`}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <Scale size={18} />
                <h3 className="font-display text-xl font-bold">Enrichment Priority</h3>
              </div>
              <div className="mt-4 space-y-3">
                {materials
                  .slice()
                  .sort((left, right) => left.possibleUnits - right.possibleUnits || right.shortageForNextUnit - left.shortageForNextUnit)
                  .map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {index + 1}. {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Supports {item.possibleUnits} combined unit{item.possibleUnits === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        +{item.shortageForNextUnit} {stockUnitLabel(item.stockUnit)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5">
              <h3 className="font-display text-xl font-bold text-slate-900">Quick Explanation</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>
                  The displayed combined inventory is the smallest support value among all required base materials.
                </li>
                <li>The highlighted limiting material should be received first if you want to increase sellable combined units.</li>
                <li>After enriching a limiting material, the next weakest material may become the new limit.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedProductBreakdownModal;
