import { Camera, KeyRound, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { userService } from "../services/userService";
import { formatDate, imageUrl } from "../utils/format";

const ProfilePage = () => {
  const { user, setCurrentUser, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const avatarPreview = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile);
    }

    return imageUrl(profile?.avatar || user?.avatar || "");
  }, [avatarFile, profile?.avatar, user?.avatar]);

  useEffect(() => {
    return () => {
      if (avatarFile) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarFile, avatarPreview]);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await userService.getProfile();
        setProfile(data);
        setName(data.name || "");
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);

    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }

    if (currentPassword) {
      formData.append("currentPassword", currentPassword);
    }

    if (newPassword) {
      formData.append("newPassword", newPassword);
    }

    setSubmitting(true);
    try {
      const updated = await userService.updateProfile(formData);
      setProfile(updated);
      setCurrentUser(updated);
      await refreshUser();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setAvatarFile(null);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="glass-card p-6 text-sm text-slate-500">Loading profile...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-5">
        <div className="rounded-[1.6rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-4 shadow-[0_14px_34px_rgba(160,120,50,0.10)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">My Profile</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Update your account photo and change your password from here.
              </p>
            </div>
            <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-4 py-2.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Role</p>
              <p className="mt-1 text-[13px] font-semibold capitalize text-slate-800">{profile?.role?.replaceAll("_", " ")}</p>
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="glass-card p-5">
          <div className="rounded-[1.7rem] border border-[#eee3cf] bg-[linear-gradient(145deg,#ffffff,#fdf7ea)] p-5 shadow-[0_10px_24px_rgba(160,120,50,0.05)]">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-[2rem] border border-[#efe3d3] bg-white shadow-sm">
                {profile?.avatar || avatarFile ? (
                  <img src={avatarPreview} alt={profile?.name || user?.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-5xl font-bold text-slate-700">{(profile?.name || user?.name || "U").charAt(0).toUpperCase()}</span>
                )}
              </div>

              <p className="mt-4 text-lg font-bold text-slate-900">{profile?.name}</p>
              <p className="text-sm text-slate-500">{profile?.email}</p>

              <label className="btn-secondary mt-5 cursor-pointer gap-2">
                <Camera size={16} />
                Change Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                />
              </label>

              <p className="mt-3 text-xs text-slate-500">PNG, JPG, WEBP up to 5MB</p>
              <p className="mt-5 text-xs text-slate-400">Last updated: {profile?.updatedAt ? formatDate(profile.updatedAt) : "-"}</p>
            </div>
          </div>
        </section>

        <section className="glass-card p-5">
          <div className="grid gap-6">
            <div className="rounded-[1.6rem] border border-[#eee3cf] bg-white/80 p-5 shadow-[0_10px_24px_rgba(160,120,50,0.05)]">
              <h2 className="text-lg font-bold text-slate-900">Profile Details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">Full Name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} className="input" required />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">Email</span>
                  <input value={profile?.email || ""} className="input bg-slate-50 text-slate-500" disabled />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">Account Role</span>
                  <input
                    value={profile?.role ? profile.role.replaceAll("_", " ") : ""}
                    className="input bg-slate-50 capitalize text-slate-500"
                    disabled
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[#eee3cf] bg-white/80 p-5 shadow-[0_10px_24px_rgba(160,120,50,0.05)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Change Password</h2>
                  <p className="text-sm text-slate-500">Leave these fields empty if you only want to update your name or photo.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">Current Password</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="input"
                    placeholder="Enter current password"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">New Password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="input"
                    placeholder="Enter new password"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">Confirm Password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="input"
                    placeholder="Confirm new password"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={submitting} className="btn-primary gap-2 px-6">
                <Save size={18} />
                {submitting ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
};

export default ProfilePage;
