import { Info, PackageSearch, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ProductFormModal from "../components/ProductFormModal";
import CombinedProductBreakdownModal from "../components/CombinedProductBreakdownModal";
import ProductDeductModal from "../components/ProductDeductModal";
import ProductStockModal from "../components/ProductStockModal";
import { useAuth } from "../context/AuthContext";
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

const buildCompositeRequirements = (product, productMap, multiplier = 1, trail = new Set()) => {
  if (!product) {
    return null;
  }

  if (!isCompositeType(product.productType)) {
    return new Map([[product.id, multiplier]]);
  }

  if (!Array.isArray(product.comboItems) || product.comboItems.length === 0 || trail.has(product.id)) {
    return null;
  }

  const nextTrail = new Set(trail);
  nextTrail.add(product.id);
  const requirements = new Map();

  for (const comboItem of product.comboItems) {
    const linkedProduct = productMap.get(comboItem.product);
    const nestedRequirements = buildCompositeRequirements(
      linkedProduct,
      productMap,
      multiplier * Number(comboItem.quantity || 0),
      nextTrail
    );

    if (!nestedRequirements) {
      return null;
    }

    nestedRequirements.forEach((quantity, key) => {
      requirements.set(key, (requirements.get(key) || 0) + quantity);
    });
  }

  return requirements;
};

const ProductListPage = () => {
  const { user } = useAuth();
  const canManageProducts = ["master_admin", "admin"].includes(user?.role);
  const canUpdateStock = ["master_admin", "admin", "staff"].includes(user?.role);
  const canDeductStock = ["master_admin", "admin"].includes(user?.role);
  const canViewSummary = ["master_admin", "admin", "checker"].includes(user?.role);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [deductModalOpen, setDeductModalOpen] = useState(false);
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [deductSubmitting, setDeductSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [productTypeFilter, setProductTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadData = async () => {
    try {
      const [productsData, summaryData] = await Promise.all([
        productService.getAdminProducts(),
        canViewSummary ? reportService.getDashboard() : Promise.resolve(null)
      ]);

      setProducts(productsData);
      setSummary(summaryData);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load product list");
    }
  };

  useEffect(() => {
    loadData();
  }, [canViewSummary]);

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => categoryLabel(product.category)).filter(Boolean))],
    [products]
  );

  const rawProducts = useMemo(() => products, [products]);
  const productTypes = useMemo(() => ["All", "raw", "raw_material", "sauce", "seasoning", "combo", "combo_type"], []);

  const combinedProductBreakdown = useMemo(() => {
    if (!selectedProduct || !isCompositeType(selectedProduct.productType)) {
      return [];
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    const requirements = buildCompositeRequirements(selectedProduct, productMap);

    return [...(requirements?.entries() || [])]
      .map(([productId, requiredQuantity]) => {
        const baseProduct = productMap.get(productId);
        const currentStock = Number(baseProduct?.stock || 0);
        const possibleUnits = requiredQuantity > 0 ? Math.floor(currentStock / requiredQuantity) : 0;
        const targetUnits = selectedProduct.stock + 1;
        const shortageForNextUnit = Math.max(targetUnits * requiredQuantity - currentStock, 0);

        return {
          id: productId,
          name: baseProduct?.name || "Unknown item",
          sku: baseProduct?.sku || "",
          productType: baseProduct?.productType || "raw",
          stockUnit: baseProduct?.stockUnit || "pieces",
          requiredQuantity,
          currentStock,
          possibleUnits,
          shortageForNextUnit
        };
      })
      .sort((left, right) => left.possibleUnits - right.possibleUnits || left.shortageForNextUnit - right.shortageForNextUnit)
      .map((item, _, list) => ({
        ...item,
        isLimiting: item.possibleUnits === (list[0]?.possibleUnits ?? item.possibleUnits)
      }));
  }, [products, selectedProduct]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          product.name.toLowerCase().includes(query) ||
          (product.sku || "").toLowerCase().includes(query);
        const matchesCategory = categoryFilter === "All" || categoryLabel(product.category) === categoryFilter;
        const matchesProductType = productTypeFilter === "All" || product.productType === productTypeFilter;
        const matchesStatus =
          statusFilter === "All" ||
          (statusFilter === "Active" && product.stock > 5) ||
          (statusFilter === "Low Stock" && product.stock > 0 && product.lowStock) ||
          (statusFilter === "Out of Stock" && product.stock === 0);

        return matchesSearch && matchesCategory && matchesProductType && matchesStatus;
      }),
    [products, search, categoryFilter, productTypeFilter, statusFilter]
  );

  const handleSubmit = async (formData) => {
    setSubmitting(true);

    try {
      if (!canManageProducts) {
        toast.error("Staff users can only update stock");
        return;
      }

      if (selectedProduct) {
        await productService.updateProduct(selectedProduct.id, formData);
        toast.success("Product updated");
      } else {
        await productService.createProduct(formData);
        toast.success("Product created");
      }

      setModalOpen(false);
      setSelectedProduct(null);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) {
      return;
    }

    try {
      if (!canManageProducts) {
        toast.error("Staff users cannot delete products");
        return;
      }

      await productService.deleteProduct(id);
      toast.success("Product deleted");
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete product");
    }
  };

  const handleStockUpdate = async (receivedQuantity) => {
    if (!selectedProduct) {
      return;
    }

    setStockSubmitting(true);

    try {
      await productService.updateStock(selectedProduct.id, receivedQuantity);
      toast.success("Stock received");
      setStockModalOpen(false);
      setSelectedProduct(null);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to receive stock");
    } finally {
      setStockSubmitting(false);
    }
  };

  const handleStockDeduction = async ({ deductionQuantity, reason }) => {
    if (!selectedProduct) {
      return;
    }

    setDeductSubmitting(true);

    try {
      await productService.deductStock(selectedProduct.id, deductionQuantity, reason);
      toast.success("Stock deducted");
      setDeductModalOpen(false);
      setSelectedProduct(null);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to deduct stock");
    } finally {
      setDeductSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900">Product List</h1>
            <p className="text-sm text-slate-500">
              {canManageProducts
                ? "See every product here and manage edit, delete, add stock, and deduct stock."
                : canUpdateStock
                  ? "Staff can see all products here and add stock only."
                  : "Checker can view all products here with no edit access."}
            </p>
          </div>
          {canManageProducts && (
            <button
              type="button"
              onClick={() => {
                setSelectedProduct(null);
                setModalOpen(true);
              }}
              className="btn-primary gap-2"
            >
              <Plus size={18} />
              Add Product
            </button>
          )}
        </div>

        <div className={`mt-6 grid gap-4 ${canViewSummary ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <div className="rounded-3xl bg-white p-5">
            <p className="text-sm text-slate-500">Total Products</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summary?.productCount || products.length}</p>
          </div>
          <div className="rounded-3xl bg-amber-100 p-5">
            <p className="text-sm text-amber-700">Low Stock</p>
            <p className="mt-2 text-3xl font-bold text-amber-950">{summary?.lowStockCount || 0}</p>
          </div>
          {canViewSummary && (
            <div className="rounded-3xl bg-slate-900 p-5 text-white">
              <p className="text-sm text-slate-300">Filtered Results</p>
              <p className="mt-2 text-3xl font-bold">{filteredProducts.length}</p>
            </div>
          )}
        </div>
      </section>

      <section className="glass-card overflow-hidden p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">All Products</h2>
            <p className="text-sm text-slate-500">
              {canManageProducts
                ? "Use the options on each row to edit, delete, add stock, or deduct stock."
                : canUpdateStock
                  ? "Use the options on each row to add stock only."
                  : "Checker can review product information here in read-only mode."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <PackageSearch size={16} />
            {filteredProducts.length} of {products.length} items
          </div>
        </div>

        <div className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto]">
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
          <select className="input" value={productTypeFilter} onChange={(event) => setProductTypeFilter(event.target.value)}>
            {productTypes.map((type) => (
              <option key={type} value={type}>
                {type === "All" ? "All Types" : productTypeLabel(type)}
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
              setProductTypeFilter("All");
              setStatusFilter("All");
            }}
            className="btn-secondary gap-2"
          >
            <RefreshCcw size={16} />
            Reset
          </button>
        </div>

        <div className="overflow-x-auto">
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
                <th className="pb-3">Options</th>
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
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      {canManageProducts && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(product);
                            setModalOpen(true);
                          }}
                          className="btn-secondary gap-2"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                      )}
                      {isCompositeType(product.productType) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(product);
                            setBreakdownModalOpen(true);
                          }}
                          className="btn-secondary gap-2"
                        >
                          <Info size={16} />
                          Materials
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(product);
                            setStockModalOpen(true);
                          }}
                          className="btn-secondary gap-2"
                          disabled={!canUpdateStock}
                        >
                          <RefreshCcw size={16} />
                          {canUpdateStock ? "Add" : "View"}
                        </button>
                      )}
                      {canDeductStock && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(product);
                            setDeductModalOpen(true);
                          }}
                          className="btn-secondary gap-2 text-rose-600"
                          disabled={isCompositeType(product.productType) || product.stock <= 0}
                        >
                          <Trash2 size={16} />
                          Deduct
                        </button>
                      )}
                      {canManageProducts && (
                        <button type="button" onClick={() => handleDelete(product.id)} className="btn-secondary gap-2 text-rose-600">
                          <Trash2 size={16} />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ProductFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleSubmit}
        product={selectedProduct}
        submitting={submitting}
        rawProducts={rawProducts}
      />
      <ProductStockModal
        open={stockModalOpen}
        product={selectedProduct}
        onClose={() => {
          setStockModalOpen(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleStockUpdate}
        submitting={stockSubmitting}
      />
      <ProductDeductModal
        open={deductModalOpen}
        product={selectedProduct}
        onClose={() => {
          setDeductModalOpen(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleStockDeduction}
        submitting={deductSubmitting}
      />
      <CombinedProductBreakdownModal
        open={breakdownModalOpen}
        product={selectedProduct}
        materials={combinedProductBreakdown}
        onClose={() => {
          setBreakdownModalOpen(false);
          setSelectedProduct(null);
        }}
      />
    </div>
  );
};

export default ProductListPage;
