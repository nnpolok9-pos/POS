import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const ForceStockPinModal = ({ open, product, onClose, onSubmit, submitting }) => {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (open) {
      setPin("");
    }
  }, [open, product]);

  if (!open || !product) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(pin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="glass-card w-full max-w-md p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Verify Admin PIN</h3>
            <p className="text-sm text-slate-500">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-3xl bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-white p-3 text-amber-600 shadow-sm">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Security check before direct inventory reset</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Force update changes the stock directly. Enter the admin PIN first, then the stock adjustment form will open.
                </p>
              </div>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Admin PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Enter PIN"
              className="input text-center text-lg tracking-[0.35em]"
              required
            />
          </label>

          <button type="submit" disabled={submitting || pin.length === 0} className="btn-primary w-full">
            {submitting ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForceStockPinModal;
