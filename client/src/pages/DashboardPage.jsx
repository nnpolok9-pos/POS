import { PackageSearch, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import StatusBadge from "../components/StatusBadge";
import { productService } from "../services/productService";
import { reportService } from "../services/reportService";
import { currency, formatDate, imageUrl } from "../utils/format";

const productTypeLabel = (type) =>
  ({
    combo: "Combined",
    combo_type: "Combo",
    raw_material: "Base",
    sauce: "Sauce",
    seasoning: "Seasoning",
    raw: "A La Catre"
  })[type] || "A La Catre";
const stockUnitLabel = (unit) =>
  ({
    pieces: "Piece",
    gram: "Gram",
    teaspoon: "Tea Spoon"
  })[unit] || "Piece";
const categoryLabel = (category) => (/^raw$/i.test(category || "") ? "Base" : category);
const isCompositeType = (type) => ["combo", "combo_type"].includes(type);

const DashboardPage = () => {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadData = async () => {
    try {
      const [productsData, salesData, lowStockData, summaryData] = await Promise.all([
        productService.getAdminProducts(),
        reportService.getSales(),
        reportService.getLowStock(),
        reportService.getDashboard()
      ]);

      setProducts(productsData);
      setSales(salesData);
      setLowStock(lowStockData);
      setSummary(summaryData);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load dashboard");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => categoryLabel(product.category)).filter(Boolean))],
    [products]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          product.name.toLowerCase().includes(query) ||
          (product.sku || "").toLowerCase().includes(query);
        const matchesCategory = categoryFilter === "All" || categoryLabel(product.category) === categoryFilter;
        const matchesStatus =
          statusFilter === "All" ||
          (statusFilter === "Active" && product.stock > 5) ||
          (statusFilter === "Low Stock" && product.stock > 0 && product.lowStock) ||
          (statusFilter === "Out of Stock" && product.stock === 0);

        return matchesSearch && matchesCategory && matchesStatus;
      }),
    [products, search, categoryFilter, statusFilter]
  );

  return (
    <div className="space-y-6">
      <section className="glass-card p-4 sm:p-6">
        <div>
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">Manage products, monitor sales, and respond to low stock quickly.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-slate-900 p-5 text-white">
            <p className="text-sm text-slate-300">Total Revenue</p>
            <p className="mt-2 text-3xl font-bold">{currency(summary?.totalRevenue)}</p>
          </div>
          <div className="rounded-3xl bg-white p-5">
            <p className="text-sm text-slate-500">Total Orders</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summary?.totalOrders || 0}</p>
          </div>
          <div className="rounded-3xl bg-white p-5">
            <p className="text-sm text-slate-500">Products</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summary?.productCount || 0}</p>
          </div>
          <div className="rounded-3xl bg-amber-100 p-5">
            <p className="text-sm text-amber-700">Low Stock Alerts</p>
            <p className="mt-2 text-3xl font-bold text-amber-950">{summary?.lowStockCount || 0}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card overflow-hidden p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Product List</h2>
              <p className="text-sm text-slate-500">Edit product details, adjust stock, remove listings, and review status fast.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <PackageSearch size={16} />
              {filteredProducts.length} of {products.length} items
            </div>
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_180px_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name or SKU"
              className="input"
            />
            <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {["All", "Active", "Low Stock", "Out of Stock"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategoryFilter("All");
                setStatusFilter("All");
              }}
              className="btn-secondary gap-2"
            >
              <RefreshCcw size={16} />
              Reset
            </button>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredProducts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                No products match this search or filter.
              </div>
            ) : (
              filteredProducts.map((product) => (
              <div key={product.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <img src={imageUrl(product.image)} alt={product.name} className="h-14 w-14 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.sku}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Category</p>
                        <p className="mt-1 font-medium text-slate-700">{categoryLabel(product.category)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Type</p>
                        <p className="mt-1 font-medium text-slate-700">{productTypeLabel(product.productType)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Unit</p>
                        <p className="mt-1 font-medium text-slate-700">{stockUnitLabel(product.stockUnit)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">For Sale</p>
                        <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${product.forSale !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {product.forSale !== false ? "Yes" : "No"}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Price</p>
                        <div className="mt-1 flex flex-col">
                          {Number(product.regularPrice ?? product.price) > Number(product.promotionalPrice ?? product.price) && (
                            <span className="text-xs text-slate-400 line-through">{currency(product.regularPrice)}</span>
                          )}
                          <span className="font-semibold text-slate-900">{currency(product.promotionalPrice ?? product.price)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Inventory</p>
                        <p className="mt-1 font-semibold text-slate-900">{product.stock}</p>
                        <p className="text-xs text-slate-500">{isCompositeType(product.productType) ? "Calculated" : "Base stock"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <StatusBadge stock={product.stock} lowStock={product.lowStock} />
                      <p className="text-xs text-slate-500">{formatDate(product.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Unit</th>
                  <th className="pb-3 pr-4">For Sale</th>
                  <th className="pb-3 pr-4">Price</th>
                  <th className="pb-3 pr-4">Inventory</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100 align-middle">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <img src={imageUrl(product.image)} alt={product.name} className="h-14 w-14 rounded-2xl object-cover" />
                        <div>
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">{categoryLabel(product.category)}</td>
                    <td className="py-4 pr-4">{productTypeLabel(product.productType)}</td>
                    <td className="py-4 pr-4 text-slate-600">{stockUnitLabel(product.stockUnit)}</td>
                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          product.forSale !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {product.forSale !== false ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex flex-col">
                        {Number(product.regularPrice ?? product.price) > Number(product.promotionalPrice ?? product.price) && (
                          <span className="text-xs text-slate-400 line-through">{currency(product.regularPrice)}</span>
                        )}
                        <span className="font-semibold text-slate-900">{currency(product.promotionalPrice ?? product.price)}</span>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-slate-900">{product.stock}</p>
                      <p className="text-xs text-slate-500">
                        {isCompositeType(product.productType) ? "Calculated from linked items" : "Base stock"}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge stock={product.stock} lowStock={product.lowStock} />
                    </td>
                    <td className="py-4 pr-4 text-xs text-slate-500">{formatDate(product.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-4 sm:p-6">
            <h2 className="font-display text-2xl font-bold text-slate-900">Sales Snapshot</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Today</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{currency(sales?.daily?.totalSales)}</p>
                <p className="text-sm text-slate-500">{sales?.daily?.orderCount || 0} orders</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">This Month</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{currency(sales?.monthly?.totalSales)}</p>
                <p className="text-sm text-slate-500">{sales?.monthly?.orderCount || 0} orders</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-6">
            <h2 className="font-display text-2xl font-bold text-slate-900">Low Stock Products</h2>
            <div className="mt-4 space-y-3">
              {lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-3xl bg-amber-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{categoryLabel(item.category)}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-amber-700">{item.stock} left</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-4 sm:p-6">
            <h2 className="font-display text-2xl font-bold text-slate-900">Top Selling</h2>
            <div className="mt-4 space-y-3">
              {sales?.topSelling?.map((item) => (
                <div key={item._id} className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.quantitySold} units sold</p>
                  </div>
                  <span className="font-bold text-brand-600">{currency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default DashboardPage;
