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
      imageSize: "h-full min-h-[180px]",
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
      imageSize: "h-full min-h-[158px]",
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
      imageSize: "h-full min-h-[138px]",
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
      imageSize: "h-full min-h-[124px]",
      nameClass: "text-[0.9vw] leading-[1.08]",
      secondaryClass: "text-[0.65vw]",
      priceClass: "text-[0.92vw]",
      cardPadding: "p-[0.5vw]",
      gapClass: "gap-[0.5vw]"
    };
  }

  return {
    columns: 7,
    imageSize: "h-full min-h-[112px]",
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
  const displayConfig = useMemo(() => getDisplayConfig(displayProducts.length), [displayProducts.length]);

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_26%),linear-gradient(180deg,#0f172a_0%,#111827_45%,#020617_100%)] p-[1.15vw] text-white">
      <div className="mx-auto flex h-full max-w-[1920px] flex-col gap-[0.7vw]">
        <header className="flex shrink-0 items-center gap-[0.8vw] rounded-[1.45vw] border border-white/10 bg-white/5 px-[0.95vw] py-[0.48vw] shadow-[0_16px_34px_rgba(0,0,0,0.24)] backdrop-blur">
          <div className="flex h-[4.1vw] w-[4.1vw] min-h-[54px] min-w-[54px] items-center justify-center overflow-hidden rounded-[1vw] border border-white/10 bg-white shadow-sm">
            {shop.logo ? <img src={imageUrl(shop.logo)} alt={shop.shopName} className="h-full w-full object-contain p-[0.3vw]" /> : null}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[1.28vw] font-extrabold leading-none tracking-tight text-white">{MENU_CARD_TITLE}</h1>
            <p className="mt-[0.14vw] text-[0.64vw] font-medium text-white/65">
              Fresh fast food menu for easy customer viewing
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center rounded-[1.8vw] border border-white/10 bg-white/5 text-[1.15vw] text-white/65 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
            Loading menu card...
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[1.8vw] border border-dashed border-white/20 bg-white/5 text-[1.15vw] text-white/65 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
            No products available for display.
          </div>
        ) : (
          <section className="min-h-0 flex-1 overflow-hidden rounded-[1.8vw] border border-white/10 bg-white/5 p-[0.62vw] shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur">
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
                    className={`relative flex h-full min-h-0 overflow-hidden rounded-[1.2vw] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.04)_100%)] ${displayConfig.cardPadding} shadow-[0_14px_26px_rgba(0,0,0,0.24)]`}
                  >
                    <div className="pointer-events-none absolute left-[0.45vw] right-[0.45vw] top-[0.45vw] z-10 flex items-start justify-between gap-[0.45vw]">
                      <span className="max-w-[78%] truncate rounded-full bg-black/50 px-[0.5vw] py-[0.18vw] text-[0.56vw] font-semibold uppercase tracking-[0.08em] text-white shadow-sm">
                        {product.name}
                      </span>
                      {product.lowStock ? (
                        <span className="rounded-full bg-amber-300/90 px-[0.46vw] py-[0.18vw] text-[0.54vw] font-semibold text-slate-900 shadow-sm">
                          Low
                        </span>
                      ) : null}
                    </div>

                    <div className={`relative flex-1 overflow-hidden rounded-[1vw] bg-white ${displayConfig.imageSize}`}>
                      <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.34)_36%,rgba(2,6,23,0.96)_100%)] px-[0.5vw] pb-[0.4vw] pt-[1.6vw]">
                        <div className="mt-[0.26vw]">
                        {showDiscount ? (
                          <div className="flex flex-wrap items-end gap-x-[0.45vw] gap-y-[0.1vw]">
                            <span className={`${displayConfig.priceClass} font-extrabold text-[#fde047] drop-shadow-[0_2px_10px_rgba(250,204,21,0.32)]`}>{promo.khr}</span>
                            <span className={`${displayConfig.secondaryClass} text-white/65 line-through`}>{regular.khr}</span>
                          </div>
                        ) : (
                          <span className={`${displayConfig.priceClass} font-extrabold text-[#fde047] drop-shadow-[0_2px_10px_rgba(250,204,21,0.32)]`}>{promo.khr}</span>
                        )}
                        </div>
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
