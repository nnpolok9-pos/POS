import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { productService } from "../services/productService";
import { shopSettingsService } from "../services/shopSettingsService";
import { currencyParts, imageUrl } from "../utils/format";

const POSTER_TITLE = "ASEN MENU SHOWCASE";

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
  const categories = moveDrinksCategoryToEnd(
    Array.from(new Set(products.map((product) => product.category || "Menu")))
  );

  return categories.map((category) => ({
    category,
    products: products
      .filter((product) => (product.category || "Menu") === category)
      .sort((left, right) => Number(right.promotionalPrice ?? right.price ?? 0) - Number(left.promotionalPrice ?? left.price ?? 0))
  }));
};

const ProductPrice = ({ product, big = false }) => {
  const promo = currencyParts(product.promotionalPrice ?? product.price ?? 0);
  const regular = currencyParts(product.regularPrice ?? product.price ?? 0);
  const hasDiscount = Number(product.promotionalPrice ?? product.price ?? 0) < Number(product.regularPrice ?? product.price ?? 0);

  return (
    <div className="space-y-0.5">
      <div className={`${big ? "text-[1.15vw]" : "text-[0.82vw]"} font-extrabold leading-none text-[#161616]`}>
        {promo.khr}
      </div>
      <div className="flex items-center gap-2">
        {hasDiscount ? <span className={`${big ? "text-[0.62vw]" : "text-[0.55vw]"} font-semibold text-slate-400 line-through`}>{regular.khr}</span> : null}
        <span className={`${big ? "text-[0.64vw]" : "text-[0.56vw]"} font-semibold text-slate-500`}>{promo.usd}</span>
      </div>
    </div>
  );
};

const SectionHeader = ({ title }) => (
  <div className="mb-[0.5vw]">
    <h2 className="font-display text-[1.5vw] font-black uppercase leading-none tracking-tight text-[#1d1d1d]">
      {title}
    </h2>
  </div>
);

const ProductTile = ({ product, indexLabel }) => (
  <div className="rounded-[1vw] bg-white/65 p-[0.52vw] shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
    <div className="flex items-start justify-between gap-[0.5vw]">
      <div className="min-w-0">
        <p className="text-[0.58vw] font-bold uppercase tracking-[0.08em] text-slate-500">{indexLabel}</p>
        <p className="mt-[0.12vw] line-clamp-2 text-[0.74vw] font-extrabold leading-[1.05] text-[#151515]">
          {product.name}
        </p>
      </div>
      <div className="h-[4vw] w-[4vw] shrink-0 overflow-hidden rounded-[0.9vw] bg-white">
        <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
      </div>
    </div>
    <div className="mt-[0.4vw]">
      <ProductPrice product={product} />
    </div>
  </div>
);

const GridSection = ({ title, products }) => (
  <section className="h-full overflow-hidden rounded-[1.5vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,245,252,0.9)_100%)] p-[0.82vw] shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
    <SectionHeader title={title} />
    <div className="grid grid-cols-2 gap-[0.65vw]">
      {products.slice(0, 4).map((product, index) => (
        <ProductTile key={product.id} product={product} indexLabel={String.fromCharCode(65 + index)} />
      ))}
    </div>
  </section>
);

const FeatureSection = ({ title, products }) => {
  const featured = products[0];
  const list = products.slice(1, 5);

  if (!featured) {
    return null;
  }

  return (
    <section className="h-full overflow-hidden rounded-[1.5vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(246,244,251,0.92)_100%)] p-[0.85vw] shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
      <SectionHeader title={title} />
      <div className="grid h-full grid-cols-[minmax(0,1fr)_40%] gap-[0.65vw]">
        <div className="space-y-[0.45vw] overflow-hidden">
          {list.length > 0 ? (
            list.map((product, index) => (
              <div key={product.id} className="rounded-[1vw] bg-white/72 p-[0.5vw] shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-[0.6vw]">
                  <div className="min-w-0">
                    <p className="text-[0.58vw] font-bold uppercase tracking-[0.08em] text-slate-500">{`Set ${index + 1}`}</p>
                    <p className="mt-[0.12vw] line-clamp-2 text-[0.76vw] font-black leading-[1.05] text-[#171717]">{product.name}</p>
                    {product.description ? (
                      <p className="mt-[0.16vw] line-clamp-2 text-[0.54vw] leading-[1.2] text-slate-500">{product.description}</p>
                    ) : null}
                  </div>
                  <ProductPrice product={product} />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1vw] bg-white/72 p-[0.8vw] text-[0.7vw] text-slate-500 shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
              Add more products to this category to build a fuller feature panel.
            </div>
          )}
        </div>

        <div className="relative h-full overflow-hidden rounded-[1.25vw] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(232,230,239,0.95))]">
          <img src={imageUrl(featured.image)} alt={featured.name} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(20,20,20,0.72)_46%,rgba(20,20,20,0.94)_100%)] p-[0.75vw] text-white">
            <p className="text-[1.08vw] font-black uppercase leading-none">{featured.name}</p>
            <p className="mt-[0.25vw] max-w-[88%] text-[0.62vw] text-white/80">
              {featured.description || "Featured category item for display menu highlight"}
            </p>
            <div className="mt-[0.4vw]">
              <div className="space-y-0.5">
                <div className="text-[1.35vw] font-extrabold leading-none text-[#fde047]">{currencyParts(featured.promotionalPrice ?? featured.price ?? 0).khr}</div>
                <div className="text-[0.66vw] font-semibold text-white/80">{currencyParts(featured.promotionalPrice ?? featured.price ?? 0).usd}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const CompactSection = ({ title, products }) => (
  <section className="h-full overflow-hidden rounded-[1.5vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(246,244,251,0.92)_100%)] p-[0.8vw] shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
    <SectionHeader title={title} />
    <div className="grid grid-cols-2 gap-[0.55vw]">
      {products.slice(0, 4).map((product) => (
        <div key={product.id} className="flex items-center gap-[0.5vw] rounded-[0.95vw] bg-white/72 p-[0.45vw] shadow-[0_8px_18px_rgba(15,23,42,0.07)]">
          <div className="h-[3.4vw] w-[3.4vw] shrink-0 overflow-hidden rounded-[0.75vw] bg-white">
            <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[0.68vw] font-extrabold leading-[1.05] text-[#171717]">{product.name}</p>
            <div className="mt-[0.2vw]">
              <ProductPrice product={product} />
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const DrinksStrip = ({ products }) => (
  <section className="h-full overflow-hidden rounded-[1.5vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(245,243,250,0.94)_100%)] p-[0.8vw] shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
    <SectionHeader title="Drinks" />
    <div className="grid h-full grid-cols-5 gap-[0.55vw]">
      {products.slice(0, 5).map((product) => (
        <div key={product.id} className="flex min-w-0 items-center gap-[0.45vw] rounded-[0.95vw] bg-white/72 p-[0.5vw] shadow-[0_8px_18px_rgba(15,23,42,0.07)]">
          <div className="h-[4vw] w-[4vw] shrink-0 overflow-hidden rounded-[0.75vw] bg-white">
            <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[0.72vw] font-extrabold leading-[1.05] text-[#171717]">{product.name}</p>
            <div className="mt-[0.16vw]">
              <ProductPrice product={product} />
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const MenuCardPosterPage = () => {
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState({ shopName: "ASEN POS", logo: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = POSTER_TITLE;
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
          toast.error(error.response?.data?.message || "Failed to load menu poster. Showing cached menu.");
        } else {
          toast.error(error.response?.data?.message || "Failed to load menu poster");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const groupedCategories = useMemo(() => groupProductsByCategory(products), [products]);
  const drinksSection = groupedCategories.find((entry) => (entry.category || "").toLowerCase() === "drinks");
  const mainSections = groupedCategories.filter((entry) => (entry.category || "").toLowerCase() !== "drinks");
  const leftTop = mainSections[0];
  const feature = mainSections[1] || mainSections[0];
  const leftBottom = mainSections[2];
  const rightBottom = mainSections[3];
  const extraSections = mainSections.slice(4, 6);

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(232,230,242,0.98))] p-[0.7vw] text-slate-900">
      <div className="mx-auto flex h-full max-w-[1920px] flex-col gap-[0.6vw]">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-[0.85vw] rounded-[1.5vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,242,250,0.95)_100%)] px-[1vw] py-[0.75vw] shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
          <div className="flex h-[5vw] w-[5vw] min-h-[64px] min-w-[64px] items-center justify-center overflow-hidden rounded-[1.1vw] bg-white shadow-sm">
            {shop.logo ? <img src={imageUrl(shop.logo)} alt={shop.shopName} className="h-full w-full object-contain p-[0.4vw]" /> : null}
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-[2.45vw] font-black uppercase leading-none tracking-tight text-[#161616]">
              {shop.shopName}
            </h1>
            <p className="mt-[0.18vw] text-[0.76vw] font-medium text-slate-500">
              Premium food menu board for customer viewing
            </p>
          </div>

          <div className="grid grid-cols-2 gap-[0.55vw]">
            <div className="rounded-[1vw] bg-white px-[0.9vw] py-[0.6vw] shadow-sm">
              <p className="text-[0.54vw] font-black uppercase tracking-[0.18em] text-slate-400">Categories</p>
              <p className="mt-[0.12vw] text-[1.2vw] font-black text-[#171717]">{groupedCategories.length}</p>
            </div>
            <div className="rounded-[1vw] bg-[#171d31] px-[0.9vw] py-[0.6vw] text-white shadow-sm">
              <p className="text-[0.54vw] font-black uppercase tracking-[0.18em] text-slate-300">Items</p>
              <p className="mt-[0.12vw] text-[1.2vw] font-black">{products.length}</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center rounded-[1.6vw] bg-white/75 text-[1.2vw] font-semibold text-slate-500 shadow-[0_18px_36px_rgba(15,23,42,0.1)]">
            Loading poster menu...
          </div>
        ) : (
          <>
            <main className="grid min-h-0 flex-1 grid-cols-12 gap-[0.6vw]">
              <div className="col-span-4 grid min-h-0 grid-rows-2 gap-[0.7vw]">
                {leftTop ? <GridSection title={leftTop.category} products={leftTop.products} /> : <div className="rounded-[1.5vw] bg-white/75" />}
                {leftBottom ? <GridSection title={leftBottom.category} products={leftBottom.products} /> : <div className="rounded-[1.5vw] bg-white/75" />}
              </div>

              <div className="col-span-8 grid min-h-0 grid-rows-[1.05fr_0.72fr] gap-[0.6vw]">
                {feature ? <FeatureSection title={feature.category} products={feature.products} /> : <div className="rounded-[1.5vw] bg-white/75" />}

                <div className="grid min-h-0 grid-cols-2 gap-[0.6vw]">
                  {rightBottom ? <CompactSection title={rightBottom.category} products={rightBottom.products} /> : <div className="rounded-[1.5vw] bg-white/75" />}
                  {extraSections[0] ? (
                    <CompactSection title={extraSections[0].category} products={extraSections[0].products} />
                  ) : leftTop ? (
                    <CompactSection title={`${leftTop.category} Specials`} products={leftTop.products.slice(0, 4)} />
                  ) : (
                    <div className="rounded-[1.5vw] bg-white/75" />
                  )}
                </div>
              </div>
            </main>

            <div className="grid shrink-0 grid-cols-2 gap-[0.6vw]">
              {drinksSection ? (
                <DrinksStrip products={drinksSection.products} />
              ) : extraSections[1] ? (
                <CompactSection title={extraSections[1].category} products={extraSections[1].products} />
              ) : (
                <div className="rounded-[1.5vw] bg-white/75" />
              )}
              {extraSections[1] ? (
                <CompactSection title={extraSections[1].category} products={extraSections[1].products} />
              ) : feature ? (
                <CompactSection title={`${feature.category} Picks`} products={feature.products.slice(0, 4)} />
              ) : (
                <div className="rounded-[1.5vw] bg-white/75" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MenuCardPosterPage;
