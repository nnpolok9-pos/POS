import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import UserFormModal from "../components/UserFormModal";
import { useAuth } from "../context/AuthContext";
import { userService } from "../services/userService";
import { formatDate } from "../utils/format";

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const allowedRoles = currentUser?.role === "master_admin" ? ["admin", "checker", "staff"] : ["staff"];

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load users");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (payload) => {
    setSubmitting(true);

    try {
      if (selectedUser) {
        await userService.updateUser(selectedUser.id, payload);
        toast.success("User updated");
      } else {
        await userService.createUser(payload);
        toast.success("User created");
      }

      setModalOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900">Users</h1>
            <p className="text-sm text-slate-500">
              {currentUser?.role === "master_admin"
                ? "Master admin can create admin, checker, and staff users."
                : "Admin can create and manage staff users only."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedUser(null);
              setModalOpen(true);
            }}
            className="btn-primary gap-2"
          >
            <Plus size={18} />
            Add User
          </button>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Updated</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-4 pr-4 font-semibold text-slate-900">{user.name}</td>
                  <td className="py-4 pr-4 text-slate-600">{user.email}</td>
                  <td className="py-4 pr-4 capitalize text-slate-600">{user.role}</td>
                  <td className="py-4 pr-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-xs text-slate-500">{formatDate(user.updatedAt)}</td>
                  <td className="py-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setModalOpen(true);
                      }}
                      className="btn-secondary gap-2"
                    >
                      <Pencil size={16} />
                      Edit User
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <UserFormModal
        open={modalOpen}
        user={selectedUser}
        onClose={() => {
          setModalOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        allowedRoles={selectedUser && !allowedRoles.includes(selectedUser.role) ? [selectedUser.role] : allowedRoles}
      />
    </div>
  );
};

export default UsersPage;
