import { useEffect, useState } from "react";

const initialState = {
  name: "",
  email: "",
  password: "",
  role: "staff",
  isActive: true
};

const UserFormModal = ({ open, user, onClose, onSubmit, submitting, allowedRoles = ["staff"] }) => {
  const [form, setForm] = useState(initialState);

  useEffect(() => {
    setForm(
      user
        ? {
            name: user.name,
            email: user.email,
            password: "",
            role: user.role,
            isActive: user.isActive
          }
        : initialState
    );
  }, [user, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="glass-card w-full max-w-xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-900">{user ? "Edit User" : "Create User"}</h3>
            <p className="text-sm text-slate-500">Manage user accounts based on your access level.</p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Name</span>
            <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Email</span>
            <input type="email" className="input" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">{user ? "New Password (Optional)" : "Password"}</span>
            <input type="password" className="input" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required={!user} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Role</span>
            <select className="input" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              {allowedRoles.map((role) => (
                <option key={role} value={role}>
                  {role.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            Active user
          </label>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Saving..." : user ? "Update User" : "Create User"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
