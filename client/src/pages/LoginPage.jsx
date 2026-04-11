import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name}`);
      navigate(user.role === "admin" ? "/dashboard" : "/pos");
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(245,146,63,0.45),_transparent_35%),linear-gradient(135deg,#111827_0%,#1f2937_50%,#78350f_100%)] p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] bg-white shadow-soft lg:grid-cols-[1.15fr_0.85fr]">
        <div className="hidden bg-slate-950 p-10 text-white lg:block">
            <p className="font-display text-4xl font-extrabold">Fast food sales at counter speed.</p>
          <p className="mt-4 max-w-md text-slate-300">
            Manage inventory, upload product images, process orders, and print receipts from one tablet-friendly POS.
          </p>
          <div className="mt-10 grid gap-4">
            {[
              "Real-time stock control",
              "Admin dashboard and product uploads",
              "Staff-friendly large-button POS interface"
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 md:p-10">
          <p className="font-display text-3xl font-extrabold text-slate-900">Sign in</p>
          <p className="mt-2 text-sm text-slate-500">Sign in with your authorized business account to access the POS.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Email</span>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Password</span>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Signing in..." : "Login"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
