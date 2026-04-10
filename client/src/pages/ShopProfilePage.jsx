import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ImagePlus, MapPin, Save, ShieldCheck, Store } from "lucide-react";
import { useShopSettings } from "../context/ShopSettingsContext";
import { shopSettingsService } from "../services/shopSettingsService";
import { imageUrl } from "../utils/format";

const heroBadgeClass =
  "inline-flex items-center gap-2 rounded-full border border-[#bba995] bg-[#7d6d61] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm";

const ShopProfilePage = () => {
  const { settings, refreshSettings, setSettings } = useShopSettings();
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const previewLogo = useMemo(() => {
    if (logoFile) {
      return URL.createObjectURL(logoFile);
    }

    return settings?.logo ? imageUrl(settings.logo) : "";
  }, [logoFile, settings?.logo]);

  useEffect(() => {
    setShopName(settings?.shopName || "");
    setAddress(settings?.address || "");
  }, [settings]);

  useEffect(() => {
    return () => {
      if (logoFile && previewLogo?.startsWith("blob:")) {
        URL.revokeObjectURL(previewLogo);
      }
    };
  }, [logoFile, previewLogo]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("shopName", shopName);
      formData.append("address", address);
      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const updated = await shopSettingsService.update(formData);
      setSettings(updated);
      toast.success("Shop profile updated");
      setLogoFile(null);
      await refreshSettings();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update shop profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-6">
        <div className="rounded-[2rem] border border-[#f2ead8] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(252,246,235,0.96))] p-5 shadow-[0_20px_50px_rgba(160,120,50,0.12)] sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className={heroBadgeClass}>
                  <ShieldCheck size={14} />
                  Master Admin Settings
                </div>
                <h1 className="mt-3 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">Shop Profile</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Update the shop identity used across the full system, including invoice printing and report exports.
                </p>
              </div>

              <div className="rounded-full border border-[#cbbba5] bg-[#fffaf0] px-5 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Live Brand Name</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{shopName || "Skyline Journeys POS"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="rounded-[2rem] border border-[#f2ead8] bg-white/90 p-5 shadow-[0_16px_35px_rgba(148,118,70,0.08)] sm:p-6">
            <div className="grid gap-5">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Shop Name</span>
                <input
                  className="input h-12 rounded-2xl"
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  placeholder="Enter shop name"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Address</span>
                <textarea
                  className="input min-h-[180px] resize-none rounded-2xl py-3"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Enter full shop address for invoice and report header"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className="btn-primary gap-2 rounded-full px-6">
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Shop Profile"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#f2ead8] bg-[linear-gradient(180deg,rgba(255,250,240,0.95),rgba(255,255,255,0.95))] p-5 shadow-[0_16px_35px_rgba(148,118,70,0.08)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Brand Preview</p>

            <div className="mt-4 rounded-[1.75rem] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-slate-50">
                  {previewLogo ? (
                    <img src={previewLogo} alt="Shop logo preview" className="h-full w-full object-contain p-2" />
                  ) : (
                    <Store size={28} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-2xl font-extrabold leading-tight text-slate-900">
                  {shopName || "Skyline Journeys POS"}
                  </p>
                  <div className="mt-2 flex items-start gap-2 text-sm text-slate-500">
                    <MapPin size={15} className="mt-0.5 shrink-0" />
                    <p className="whitespace-pre-line">{address || "No address added yet"}</p>
                  </div>
                </div>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-dashed border-[#d7c8b2] bg-white px-4 py-8 text-center transition hover:bg-[#fffaf1]">
              <div className="rounded-full bg-[#fff1df] p-3 text-brand-500">
                <ImagePlus size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{logoFile ? logoFile.name : "Upload Shop Logo"}</p>
                <p className="mt-1 text-xs text-slate-500">PNG, JPG, or WEBP up to 5MB</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} />
            </label>
          </div>
        </form>
      </section>
    </div>
  );
};

export default ShopProfilePage;
