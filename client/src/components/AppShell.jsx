import { Archive, BarChart3, FilePenLine, LayoutDashboard, LogOut, Menu, PackageSearch, ReceiptText, ShoppingCart, Store, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useShopSettings } from "../context/ShopSettingsContext";
import { imageUrl } from "../utils/format";

const navItems = [
  { to: "/pos", label: "POS", icon: ShoppingCart, roles: ["master_admin", "admin", "staff"] },
  { to: "/orders", label: "Orders", icon: ReceiptText, roles: ["master_admin", "admin", "checker", "staff"] },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["master_admin", "admin", "checker"] },
  { to: "/products", label: "Product List", icon: PackageSearch, roles: ["master_admin", "admin", "checker", "staff"] },
  { to: "/inventory", label: "Inventory", icon: Archive, roles: ["master_admin", "admin", "checker", "staff"] },
  { to: "/edited-list", label: "Edited List", icon: FilePenLine, roles: ["master_admin", "admin", "checker"] },
  { to: "/reports/sales", label: "Reports", icon: BarChart3, roles: ["master_admin", "admin", "checker"] },
  { to: "/users", label: "Users", icon: Users, roles: ["master_admin", "admin"] },
  { to: "/shop-profile", label: "Shop Profile", icon: Store, roles: ["master_admin"] }
];

const AppShell = () => {
  const { logout, user } = useAuth();
  const { settings } = useShopSettings();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const visibleNavItems = navItems.filter((item) => item.roles.includes(user?.role));
  const shopName = settings?.shopName || "ASEN POS";
  const hasLogo = Boolean(settings?.logo);
  const logoSrc = useMemo(() => {
    if (!hasLogo || logoFailed) {
      return "";
    }

    return imageUrl(settings.logo);
  }, [hasLogo, logoFailed, settings?.logo]);
  const shopInitials = useMemo(
    () =>
      shopName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "AP",
    [shopName]
  );

  useEffect(() => {
    setLogoFailed(false);
  }, [settings?.logo]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,146,63,0.35),_transparent_32%),linear-gradient(180deg,#fff7ed_0%,#fffbeb_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:p-5 xl:flex-row">
        <div className="glass-card flex items-center justify-between px-3.5 py-2.5 xl:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#efe3d3] bg-white shadow-sm">
              {logoSrc ? (
                <img src={logoSrc} alt={shopName} className="h-full w-full object-contain p-1.5" onError={() => setLogoFailed(true)} />
              ) : (
                <span className="text-sm font-bold tracking-[0.12em] text-slate-700">{shopInitials}</span>
              )}
            </div>
            <div>
              <p className="font-display text-lg font-bold text-slate-900">{shopName}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button type="button" onClick={() => setMobileNavOpen((current) => !current)} className="btn-secondary h-11 w-11 rounded-2xl p-0">
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <aside className={`${mobileNavOpen ? "flex" : "hidden"} glass-card flex w-full flex-col gap-3 p-3 xl:flex xl:w-[16.5rem] xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto`}>
          <div className="overflow-hidden rounded-[1.6rem] border border-[#eadcc4] bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(252,244,228,0.94))] shadow-[0_14px_30px_rgba(160,120,50,0.08)]">
            <div className="bg-[radial-gradient(circle_at_top_left,rgba(245,146,63,0.22),transparent_45%)] p-3">
              <div className="flex justify-center">
                <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-[1.6rem] border border-[#efe3d3] bg-white px-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                  {logoSrc ? (
                    <img src={logoSrc} alt={shopName} className="h-full w-full object-contain" onError={() => setLogoFailed(true)} />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-[linear-gradient(135deg,#fff7ed,#ffedd5)] text-2xl font-extrabold tracking-[0.14em] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                        {shopInitials}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-500">Logo unavailable</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.6rem] bg-[linear-gradient(145deg,#171d31,#111728)] p-0 text-white shadow-[0_16px_28px_rgba(15,23,42,0.18)]">
            <div className="border-b border-white/10 px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Account</p>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[15px] font-bold text-white">
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] uppercase tracking-[0.16em] text-slate-400">Signed In As</p>
                  <p className="mt-1.5 truncate text-[1.1rem] font-bold leading-tight text-white">{user?.name}</p>
                  <div className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ffd7a8]">
                    {(user?.role || "").replaceAll("_", " ")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <nav className="rounded-[1.6rem] border border-[#eee3cf] bg-white/70 p-2.5 shadow-[0_10px_24px_rgba(160,120,50,0.05)]">
            <div className="mb-1 px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Navigation
            </div>
            <div className="flex flex-col gap-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-[15px] font-semibold transition ${
                        isActive
                          ? "bg-gradient-to-r from-brand-500 to-[#f08a2a] text-white shadow-[0_10px_22px_rgba(240,138,42,0.28)]"
                          : "text-slate-600 hover:bg-[#fff4e4] hover:text-slate-900"
                      }`
                    }
                    >
                      <span
                      className={`flex h-8 w-8 items-center justify-center rounded-2xl transition ${
                        item.to ? "bg-black/0" : ""
                      } group-hover:bg-white/70`}
                    >
                      <Icon size={17} />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>

          <button
            type="button"
            onClick={logout}
            className="mt-auto flex items-center justify-center gap-2 rounded-[1.1rem] border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <LogOut size={18} />
            Logout
          </button>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
