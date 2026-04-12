import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import ReportDatePicker from "./ReportDatePicker";

const ProductStockModal = ({ open, product, onClose, onSubmit, submitting }) => {
  const [receivedQuantity, setReceivedQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState("");

  useEffect(() => {
    setReceivedQuantity(1);
    setExpiryDate("");
  }, [product]);

  if (!open || !product) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ receivedQuantity, expiryDate });
  };

  const bumpStock = (amount) => {
    setReceivedQuantity((current) => Math.max(1, current + amount));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="glass-card w-full max-w-lg p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Add Stock</h3>
            <p className="text-sm text-slate-500">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Current stock</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{product.stock}</p>
            <p className="mt-2 text-xs text-slate-500">This screen only adds stock. Stock cannot be reduced here.</p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Added quantity</span>
            <input
              type="number"
              min="1"
              value={receivedQuantity}
              onChange={(event) => setReceivedQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="input"
              required
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            {[1, 5, 10].map((amount) => (
              <button key={amount} type="button" onClick={() => bumpStock(amount)} className="btn-secondary gap-2">
                <Plus size={16} />
                {amount}
              </button>
            ))}
          </div>

          <ReportDatePicker label="Expiry Date" value={expiryDate} onChange={setExpiryDate} />
          <p className="-mt-2 text-xs text-slate-500">Optional. If selected, this will update the product expiry date for the newly added stock.</p>

          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            New stock after add: <span className="font-bold">{product.stock + receivedQuantity}</span>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Updating..." : "Add Stock"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProductStockModal;
