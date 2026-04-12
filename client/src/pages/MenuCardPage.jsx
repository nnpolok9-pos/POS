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

const buildMenuProducts = (products) => {
  const categoryOrder = moveDrinksCategoryToEnd(
    Array.from(new Set(products.map((product) => product.category || "Menu")))
  );

  return [...products].sort((left, right) => {
    const leftCategoryIndex = categoryOrder.indexOf(left.category || "Menu");
    const rightCategoryIndex = categoryOrder.indexOf(right.category || "Menu");

    if (leftCategoryIndex !== rightCategoryIndex) {
      return leftCategoryIndex - rightCategoryIndex;
    }

    return (left.khmerName || left.name || "").localeCompare(right.khmerName || right.name || "");
  });
};

const getDisplayConfig = (count) => {
  if (count <= 8) {
    return {
      columns: 4,
      imageSize: "h-[12vh] min-h-[88px]",
      nameClass: "text-[1.55vw] leading-[1.15]",
      secondaryClass: "text-[0.88vw]",
      priceClass: "text-[1.45vw]",
      cardPadding: "p-[0.85vw]",
      gapClass: "gap-[0.8vw]"
    };
  }

  if (count <= 12) {
    return {
      columns: 4,
      imageSize: "h-[10.4vh] min-h-[76px]",
      nameClass: "text-[1.28vw] leading-[1.12]",
      secondaryClass: "text-[0.8vw]",
      priceClass: "text-[1.2vw]",
      cardPadding: "p-[0.72vw]",
      gapClass: "gap-[0.7vw]"
    };
  }

  if (count <= 18) {
    return {
      columns: 5,
      imageSize: "h-[8.9vh] min-h-[64px]",
      nameClass: "text-[1.02vw] leading-[1.1]",
      secondaryClass: "text-[0.72vw]",
      priceClass: "text-[1vw]",
      cardPadding: "p-[0.6vw]",
      gapClass: "gap-[0.58vw]"
    };
  }

  if (count <= 24) {
    return {
      columns: 6,
      imageSize: "h-[7.7vh] min-h-[56px]",
      nameClass: "text-[0.9vw] leading-[1.08]",
      secondaryClass: "text-[0.65vw]",
      priceClass: "text-[0.92vw]",
      cardPadding: "p-[0.5vw]",
      gapClass: "gap-[0.5vw]"
    };
  }

  return {
    columns: 7,
    imageSize: "h-[6.9vh] min-h-[48px]",
    nameClass: "text-[0.8vw] leading-[1.05]",
    secondaryClass: "text-[0.58vw]",
    priceClass: "text-[0.84vw]",
    cardPadding: "p-[0.42vw]",
    gapClass: "gap-[0.42vw]"
  };
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
        const cachedMenu = productService.getCachedPublicMenu();
        const cachedAdminProducts = productService
          .getCachedProducts()
          .filter((product) => product.isActive !== false && product.forSale !== false);
        const fallbackMenu = cachedMenu.length > 0 ? cachedMenu : cachedAdminProducts;
        const cachedSettings = shopSettingsService.getCachedPublic();

        if (fallbackMenu.length > 0 || cachedSettings) {
          setProducts(fallbackMenu || []);
          setShop({
            shopName: cachedSettings?.shopName || "ASEN POS",
            logo: cachedSettings?.logo || ""
          });
          toast.error(error.response?.data?.message || "Failed to load menu card. Showing cached menu.");
        } else {
          toast.error(error.response?.data?.message || "Failed to load menu card");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const displayProducts = useMemo(() => buildMenuProducts(products), [products]);
  const categories = useMemo(
    () => moveDrinksCategoryToEnd(Array.from(new Set(displayProducts.map((product) => product.category || "Menu")))),
    [displayProducts]
  );
  const displayConfig = useMemo(() => getDisplayConfig(displayProducts.length), [displayProducts.length]);

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(180deg,#fffdf8_0%,#fff7eb_50%,#fffdf9_100%)] p-[1.15vw] text-slate-900">
      <div className="mx-auto flex h-full max-w-[1920px] flex-col gap-[0.9vw]">
        <header className="flex shrink-0 items-center justify-between gap-[1vw] rounded-[1.6vw] border border-white/80 bg-white/88 px-[1.1vw] py-[0.7vw] shadow-[0_16px_34px_rgba(160,120,50,0.10)] backdrop-blur">
          <div className="flex min-w-0 items-center gap-[0.9vw]">
            <div className="flex h-[5.2vw] w-[5.2vw] min-h-[68px] min-w-[68px] items-center justify-center overflow-hidden rounded-[1.25vw] border border-[#efe3d3] bg-white shadow-sm">
              {shop.logo ? <img src={imageUrl(shop.logo)} alt={shop.shopName} className="h-full w-full object-contain p-[0.35vw]" /> : null}
            </div>
            <div className="min-w-0">
              <p className="text-[0.68vw] font-semibold uppercase tracking-[0.28em] text-brand-500">Display Menu</p>
              <h1 className="mt-[0.2vw] font-display text-[2vw] font-extrabold leading-none tracking-tight text-slate-900">
                {MENU_CARD_TITLE}
              </h1>
              <p className="mt-[0.24vw] text-[0.82vw] font-medium text-slate-500">{shop.shopName}</p>
            </div>
          </div>

          <div className="flex items-center gap-[0.7vw]">
            <div className="rounded-[1.2vw] bg-[#fff7ea] px-[0.95vw] py-[0.75vw] shadow-sm">
              <p className="text-[0.58vw] font-semibold uppercase tracking-[0.2em] text-slate-400">Categories</p>
              <p className="mt-[0.16vw] text-[1.35vw] font-bold text-slate-900">{categories.length}</p>
            </div>
            <div className="rounded-[1.2vw] bg-slate-900 px-[0.95vw] py-[0.75vw] text-white shadow-sm">
              <p className="text-[0.58vw] font-semibold uppercase tracking-[0.2em] text-white/60">Items</p>
              <p className="mt-[0.16vw] text-[1.35vw] font-bold">{displayProducts.length}</p>
            </div>
          </div>
        </header>

        <div className="flex shrink-0 flex-wrap gap-[0.45vw]">
          {categories.map((category) => (
            <div
              key={category}
              className="rounded-full border border-[#eadcc4] bg-white/92 px-[0.75vw] py-[0.36vw] text-[0.68vw] font-semibold text-slate-700 shadow-sm"
            >
              {category}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center rounded-[1.8vw] border border-white/80 bg-white/88 text-[1.15vw] text-slate-500 shadow-[0_18px_40px_rgba(160,120,50,0.10)]">
            Loading menu card...
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[1.8vw] border border-dashed border-slate-300 bg-white/88 text-[1.15vw] text-slate-500 shadow-[0_18px_40px_rgba(160,120,50,0.10)]">
            No products available for display.
          </div>
        ) : (
          <section className="min-h-0 flex-1 overflow-hidden rounded-[1.8vw] border border-white/80 bg-white/90 p-[0.7vw] shadow-[0_18px_40px_rgba(160,120,50,0.10)] backdrop-blur">
            <div
              className={`grid h-full ${displayConfig.gapClass}`}
              style={{
                gridTemplateColumns: `repeat(${displayConfig.columns}, minmax(0, 1fr))`,
                gridAutoRows: "1fr"
              }}
            >
              {displayProducts.map((product) => {
                const regular = currencyParts(product.regularPrice ?? product.price ?? 0);
                const promo = currencyParts(product.promotionalPrice ?? product.price ?? 0);
                const showDiscount =
                  Number(product.promotionalPrice ?? product.price ?? 0) < Number(product.regularPrice ?? product.price ?? 0);

                return (
                  <article
                    key={product.id}
                    className={`flex h-full min-h-0 flex-col rounded-[1.2vw] border border-[#f3eadb] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf1_100%)] ${displayConfig.cardPadding} shadow-[0_10px_22px_rgba(160,120,50,0.07)]`}
                  >
                    <div className="mb-[0.4vw] flex items-start justify-between gap-[0.45vw]">
                      <span className="rounded-full bg-[#fff4e1] px-[0.5vw] py-[0.18vw] text-[0.56vw] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        {product.category || "Menu"}
                      </span>
                      {product.lowStock ? (
                        <span className="rounded-full bg-amber-100 px-[0.46vw] py-[0.18vw] text-[0.54vw] font-semibold text-amber-700">
                          Low
                        </span>
                      ) : null}
                    </div>

                    <div className={`overflow-hidden rounded-[1vw] bg-amber-100 ${displayConfig.imageSize}`}>
                      <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
                    </div>

                    <div className="mt-[0.5vw] flex min-h-0 flex-1 flex-col">
                      <h3 className={`${displayConfig.nameClass} line-clamp-2 font-bold text-slate-900`}>
                        {product.khmerName || product.name}
                      </h3>

                      {product.khmerName && product.khmerName !== product.name ? (
                        <p className={`mt-[0.22vw] ${displayConfig.secondaryClass} line-clamp-1 font-medium text-slate-500`}>
                          {product.name}
                        </p>
                      ) : null}

                      {product.description || product.khmerDescription ? (
                        <p className={`mt-[0.28vw] ${displayConfig.secondaryClass} line-clamp-2 leading-[1.35] text-slate-500`}>
                          {product.khmerDescription || product.description}
                        </p>
                      ) : (
                        <div className="flex-1" />
                      )}

                      <div className="mt-auto pt-[0.35vw]">
                        {showDiscount ? (
                          <div className="flex flex-wrap items-end gap-x-[0.45vw] gap-y-[0.1vw]">
                            <span className={`${displayConfig.priceClass} font-extrabold text-brand-600`}>{promo.khr}</span>
                            <span className={`${displayConfig.secondaryClass} text-slate-400 line-through`}>{regular.khr}</span>
                          </div>
                        ) : (
                          <span className={`${displayConfig.priceClass} font-extrabold text-brand-600`}>{promo.khr}</span>
                        )}
                        <p className={`mt-[0.14vw] ${displayConfig.secondaryClass} text-slate-400`}>{promo.usd}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default MenuCardPage;
