import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { productService } from "../services/productService";
import { shopSettingsService } from "../services/shopSettingsService";
import { currencyParts, imageUrl } from "../utils/format";

const MENU_CARD_TITLE = "ASEN FOOD MENU";

const moveDrinksCategoryToEnd = (categories) => {
  const nonDrinks = [];
  const drinks = [];

  categories.forEach((category) => {
    if ((category || "").toLowerCase() === "drinks") {
      drinks.push(category);
      return;
    }

    nonDrinks.push(category);
  });

  return [...nonDrinks, ...drinks];
};

const groupProductsByCategory = (products) => {
  const categoryMap = new Map();

  products.forEach((product) => {
    const category = product.category || "Menu";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }

    categoryMap.get(category).push(product);
  });

  return moveDrinksCategoryToEnd([...categoryMap.keys()]).map((category) => ({
    category,
    products: (categoryMap.get(category) || []).sort((left, right) => left.name.localeCompare(right.name))
  }));
};

const MenuCardPage = () => {
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState({ shopName: "ASEN POS", logo: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = MENU_CARD_TITLE;
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const [menu, settings] = await Promise.all([productService.getPublicMenu(), shopSettingsService.getPublic()]);

        setProducts(menu || []);
        setShop({
          shopName: settings?.shopName || "ASEN POS",
          logo: settings?.logo || ""
        });
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to load menu card");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const groupedProducts = useMemo(() => groupProductsByCategory(products), [products]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_45%),linear-gradient(180deg,#fffdf8_0%,#fff7eb_50%,#fffdf9_100%)] px-6 py-6 text-slate-900 md:px-8 lg:px-10">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-6">
        <header className="rounded-[2rem] border border-white/80 bg-white/85 px-6 py-5 shadow-[0_18px_40px_rgba(160,120,50,0.12)] backdrop-blur">
          <div className="flex items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.6rem] border border-[#efe3d3] bg-white shadow-sm">
                {shop.logo ? <img src={imageUrl(shop.logo)} alt={shop.shopName} className="h-full w-full object-contain p-2" /> : null}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-brand-500">TV Menu Card</p>
                <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                  {MENU_CARD_TITLE}
                </h1>
                <p className="mt-1 text-sm text-slate-500">{shop.shopName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.4rem] bg-[#fff7ea] px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Categories</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{groupedProducts.length}</p>
              </div>
              <div className="rounded-[1.4rem] bg-slate-900 px-4 py-3 text-white shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Items</p>
                <p className="mt-1 text-2xl font-bold">{products.length}</p>
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-[2rem] border border-white/80 bg-white/85 px-8 py-16 text-center text-lg text-slate-500 shadow-[0_18px_40px_rgba(160,120,50,0.12)]">
            Loading menu card...
          </div>
        ) : groupedProducts.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 px-8 py-16 text-center text-lg text-slate-500 shadow-[0_18px_40px_rgba(160,120,50,0.12)]">
            No products available for display.
          </div>
        ) : (
          <div className="space-y-5">
            {groupedProducts.map((section) => (
              <section
                key={section.category}
                className="rounded-[2rem] border border-white/80 bg-white/88 px-5 py-5 shadow-[0_18px_40px_rgba(160,120,50,0.10)] backdrop-blur"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-slate-900">{section.category}</h2>
                    <p className="mt-1 text-sm text-slate-500">{section.products.length} items</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {section.products.map((product) => {
                    const regular = currencyParts(product.regularPrice ?? product.price ?? 0);
                    const promo = currencyParts(product.promotionalPrice ?? product.price ?? 0);
                    const showDiscount = Number(product.promotionalPrice ?? product.price ?? 0) < Number(product.regularPrice ?? product.price ?? 0);

                    return (
                      <article
                        key={product.id}
                        className="flex min-h-[170px] gap-4 rounded-[1.6rem] border border-[#f3eadb] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf1_100%)] p-4 shadow-[0_12px_26px_rgba(160,120,50,0.08)]"
                      >
                        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[1.35rem] bg-amber-100">
                          <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="line-clamp-2 text-xl font-bold text-slate-900">{product.khmerName || product.name}</h3>
                              {product.khmerName && product.khmerName !== product.name ? (
                                <p className="mt-1 text-sm font-medium text-slate-500">{product.name}</p>
                              ) : null}
                            </div>
                            {product.lowStock ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">Low</span>
                            ) : null}
                          </div>

                          {product.description || product.khmerDescription ? (
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                              {product.khmerDescription || product.description}
                            </p>
                          ) : (
                            <div className="mt-2 flex-1" />
                          )}

                          <div className="mt-3">
                            {showDiscount ? (
                              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                                <span className="text-2xl font-extrabold text-brand-600">{promo.khr}</span>
                                <span className="text-sm text-slate-400 line-through">{regular.khr}</span>
                              </div>
                            ) : (
                              <span className="text-2xl font-extrabold text-brand-600">{promo.khr}</span>
                            )}
                            <p className="mt-1 text-sm text-slate-400">{promo.usd}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuCardPage;
