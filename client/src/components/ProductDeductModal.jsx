import { Minus } from "lucide-react";
import { useEffect, useState } from "react";

const ProductDeductModal = ({ open, product, onClose, onSubmit, submitting }) => {
  const [deductionQuantity, setDeductionQuantity] = useState("1");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setDeductionQuantity("1");
    setReason("");
  }, [product]);

  if (!open || !product) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ deductionQuantity: Number(deductionQuantity), reason });
  };

  const bumpQuantity = (amount) => {
    setDeductionQuantity((current) => String(Math.max(1, Number(current || 0) + amount)));
  };

  const previewQuantity = Math.max(0, Number(deductionQuantity) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="glass-card w-full max-w-lg p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Deduct Stock</h3>
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
            <p className="mt-2 text-xs text-slate-500">Only admin and master admin can deduct stock. A reason is required for every deduction.</p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Deduction quantity</span>
            <input
              type="number"
              min="1"
              value={deductionQuantity}
              onChange={(event) => {
                const { value } = event.target;
                if (value === "") {
                  setDeductionQuantity("");
                  return;
                }

                setDeductionQuantity(value);
              }}
              className="input"
              required
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            {[1, 5, 10].map((amount) => (
              <button key={amount} type="button" onClick={() => bumpQuantity(amount)} className="btn-secondary gap-2">
                <Minus size={16} />
                {amount}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Reason for deduction</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="Example: damaged stock, kitchen wastage, expired item"
              className="input min-h-[110px] resize-none"
              required
            />
          </label>

          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
            New stock after deduction: <span className="font-bold">{Number(product.stock || 0) - previewQuantity}</span>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Updating..." : "Deduct Stock"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProductDeductModal;
