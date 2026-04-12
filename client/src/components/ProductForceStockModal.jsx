import { useEffect, useState } from "react";

const ProductForceStockModal = ({ open, product, onClose, onSubmit, submitting }) => {
  const [stockQuantity, setStockQuantity] = useState(0);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setStockQuantity(Number(product?.stock || 0));
    setReason("");
  }, [product]);

  if (!open || !product) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ stockQuantity, reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="glass-card w-full max-w-lg p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Force Update Stock</h3>
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
            <p className="mt-2 text-xs text-slate-500">
              This action sets the stock directly to the entered number. It does not add or deduct from the previous quantity.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">New inventory quantity</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={stockQuantity}
              onChange={(event) => setStockQuantity(Math.max(0, Number(event.target.value) || 0))}
              className="input"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Reason for force update</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="Example: opening stock correction, manual count adjustment, system reconciliation"
              className="input min-h-[110px] resize-none"
              required
            />
          </label>

          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            New stock after force update: <span className="font-bold">{stockQuantity}</span>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Updating..." : "Force Update Stock"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProductForceStockModal;
