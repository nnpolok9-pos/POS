import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { productService } from "../services/productService";
import { shopSettingsService } from "../services/shopSettingsService";
import { currencyParts, imageUrl } from "../utils/format";

const POSTER_TITLE = "ASEN MENU SHOWCASE";
const HALAL_LOGO_PATH = "/halal-logo-final.png";

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

const findSectionIndex = (sections, matcher) => sections.findIndex((section) => matcher((section.category || "").toLowerCase()));
const normalizeCategoryName = (value) => (value || "").toLowerCase().trim();

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

const PosterImageCard = ({ product, compact = false }) => (
  <div className="relative h-full overflow-hidden rounded-[1vw] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(236,234,244,0.94))] shadow-[0_10px_24px_rgba(15,23,42,0.1)]">
    <img
      src={imageUrl(product.image)}
      alt={product.name}
      className={`h-full w-full ${compact ? "object-contain p-[0.2vw]" : "object-cover"}`}
    />
    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(20,20,20,0)_0%,rgba(20,20,20,0.72)_42%,rgba(20,20,20,0.96)_100%)] p-[0.42vw] text-white">
      <p className={`${compact ? "text-[0.84vw]" : "text-[1vw]"} line-clamp-2 font-black uppercase leading-[1.02]`}>
        {product.name}
      </p>
      <div className="mt-[0.14vw]">
        <div className={`${compact ? "text-[0.92vw]" : "text-[1.02vw]"} font-extrabold leading-none text-[#fde047]`}>
          {currencyParts(product.promotionalPrice ?? product.price ?? 0).khr}
        </div>
        <div className="text-[0.54vw] font-semibold text-white/80">
          {currencyParts(product.promotionalPrice ?? product.price ?? 0).usd}
        </div>
      </div>
    </div>
  </div>
);

const ComboImageCard = ({ product, soft = false, flat = false }) => (
  <div
    className={`grid h-full grid-rows-[63%_1fr] overflow-hidden rounded-[1vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,244,251,0.95)_100%)] ${
      flat ? "border border-white/90 shadow-none" : soft ? "shadow-[0_4px_10px_rgba(15,23,42,0.04)]" : "shadow-[0_10px_24px_rgba(15,23,42,0.1)]"
    }`}
  >
    <div className="overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(236,234,244,0.94))]">
      <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-contain p-[0.15vw]" />
    </div>
    <div className="flex flex-col justify-between p-[0.36vw]">
      <div>
        <p className="line-clamp-2 text-[0.84vw] font-black uppercase leading-[1.04] text-[#171717]">{product.name}</p>
        {product.description ? (
          <p className="mt-[0.12vw] line-clamp-3 text-[0.48vw] leading-[1.14] text-slate-500">{product.description}</p>
        ) : null}
      </div>
      <div className="mt-[0.18vw]">
        <ProductPrice product={product} />
      </div>
    </div>
  </div>
);

const SectionHeader = ({ title }) => (
  <div className="mb-[0.01vw] pt-[0.18vw]">
    <h2 className="font-display text-[1.28vw] font-black uppercase leading-none tracking-tight text-[#1d1d1d]">
      {title}
    </h2>
  </div>
);

const ProductTile = ({ product, showDescription = false, largeImage = false }) => (
  <div className={`h-full rounded-[0.9vw] bg-white/78 ${largeImage ? "p-[0.18vw]" : "p-[0.22vw]"} shadow-[0_8px_22px_rgba(15,23,42,0.08)]`}>
    <div className={`grid h-full items-start gap-[0.28vw] ${largeImage ? "grid-cols-[minmax(0,1fr)_7.2vw]" : "grid-cols-[minmax(0,1fr)_6vw]"}`}>
      <div className="min-w-0 self-start pt-[0.02vw]">
        <p className="line-clamp-2 text-[0.8vw] font-extrabold leading-[1.05] text-[#151515]">
          {product.name}
        </p>
        {showDescription && product.description ? (
          <p className="mt-[0.12vw] line-clamp-2 text-[0.46vw] leading-[1.12] text-slate-500">
            {product.description}
          </p>
        ) : null}
        <div className="mt-[0.28vw]">
          <ProductPrice product={product} />
        </div>
      </div>
      <div className={`${largeImage ? "h-[4.8vw] w-[7.2vw]" : "h-[6vw] w-[6vw]"} shrink-0 self-center overflow-hidden rounded-[0.8vw] bg-white`}>
        <img src={imageUrl(product.image)} alt={product.name} className={`h-full w-full object-contain ${largeImage ? "p-[0.02vw]" : "p-0"}`} />
      </div>
    </div>
  </div>
);

const GridSection = ({ title, products, showDescription = false, largeImage = false }) => (
  <section className="flex h-full flex-col overflow-hidden rounded-[1.32vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,245,252,0.92)_100%)] px-[0.52vw] pb-[0.52vw] pt-[0.02vw] shadow-[0_14px_28px_rgba(15,23,42,0.10)]">
    <SectionHeader title={title} />
    <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-[0.42vw]">
      {products.slice(0, 4).map((product) => (
        <ProductTile key={product.id} product={product} showDescription={showDescription} largeImage={largeImage} />
      ))}
    </div>
  </section>
);

const FeatureSection = ({ title, products, brandLogo }) => {
  const featured = products[0];
  const list = products.slice(1, 5);

  if (!featured) {
    return null;
  }

  if (products.length <= 3) {
    return (
      <section className="flex h-full flex-col overflow-hidden rounded-[1.32vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(246,244,251,0.96)_100%)] px-[0.34vw] pb-[0.16vw] pt-[0.02vw] shadow-[0_14px_28px_rgba(15,23,42,0.10)]">
        <div className="pl-[0.42vw]">
          <SectionHeader title={title} />
        </div>
        <div className="grid flex-1 gap-[0.18vw] px-[0.24vw]" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr)) minmax(4.6vw, 0.36fr)" }}>
          {products.map((product, index) => (
            <ComboImageCard key={product.id} product={product} soft flat={index === 0} />
          ))}
          <div className="flex h-full flex-col items-center justify-start gap-[0.28vw] rounded-[0.96vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(243,241,248,0.98)_100%)] px-[0.14vw] py-[0.18vw]">
            <div className="flex justify-center">
              {brandLogo ? (
                <div className="flex h-[5vw] w-[5vw] items-center justify-center overflow-hidden rounded-[0.9vw] bg-white p-[0.2vw] shadow-[0_8px_16px_rgba(15,23,42,0.06)]">
                  <img src={imageUrl(brandLogo)} alt="ASEN logo" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div />
              )}
            </div>
            <div className="flex justify-center">
              <div className="flex h-[4.3vw] w-[4.3vw] items-center justify-center overflow-hidden rounded-[0.95vw] bg-white p-[0.08vw] shadow-[0_8px_16px_rgba(15,23,42,0.05)]">
                <img src={HALAL_LOGO_PATH} alt="Halal logo" className="h-full w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[1.32vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(246,244,251,0.94)_100%)] px-[0.52vw] pb-[0.52vw] pt-[0.02vw] shadow-[0_14px_28px_rgba(15,23,42,0.10)]">
      <SectionHeader title={title} />
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_44%] gap-[0.42vw]">
        <div className="grid grid-rows-4 gap-[0.32vw] overflow-hidden">
          {list.length > 0 ? (
            list.map((product, index) => (
              <div key={product.id} className="rounded-[0.92vw] bg-white/82 p-[0.32vw] shadow-[0_8px_20px_rgba(15,23,42,0.07)]">
                <div className="flex h-full items-stretch justify-between gap-[0.34vw]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.48vw] font-bold uppercase tracking-[0.08em] text-slate-500">{`Set ${index + 1}`}</p>
                    <p className="mt-[0.08vw] line-clamp-2 text-[0.8vw] font-black leading-[1.05] text-[#171717]">{product.name}</p>
                    {product.description ? (
                      <p className="mt-[0.1vw] line-clamp-2 text-[0.46vw] leading-[1.14] text-slate-500">{product.description}</p>
                    ) : null}
                    <div className="mt-[0.12vw]">
                      <ProductPrice product={product} />
                    </div>
                  </div>
                  <div className="h-full min-h-[4.2vw] w-[4.2vw] shrink-0 overflow-hidden rounded-[0.72vw] bg-white">
                    <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1vw] bg-white/72 p-[0.8vw] text-[0.7vw] text-slate-500 shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
              Add more products to this category to build a fuller feature panel.
            </div>
          )}
        </div>

        <div className="relative h-full overflow-hidden rounded-[1.08vw] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(232,230,239,0.95))]">
          <img src={imageUrl(featured.image)} alt={featured.name} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(20,20,20,0.72)_46%,rgba(20,20,20,0.94)_100%)] p-[0.58vw] text-white">
            <p className="text-[0.98vw] font-black uppercase leading-none">{featured.name}</p>
            <p className="mt-[0.18vw] max-w-[88%] text-[0.54vw] text-white/80">
              {featured.description || "Featured category item for display menu highlight"}
            </p>
            <div className="mt-[0.28vw]">
              <div className="space-y-0.5">
                <div className="text-[1.16vw] font-extrabold leading-none text-[#fde047]">{currencyParts(featured.promotionalPrice ?? featured.price ?? 0).khr}</div>
                <div className="text-[0.58vw] font-semibold text-white/80">{currencyParts(featured.promotionalPrice ?? featured.price ?? 0).usd}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const CompactSection = ({ title, products, dense = false }) => (
  <section className="flex h-full flex-col overflow-hidden rounded-[1.32vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(246,244,251,0.94)_100%)] px-[0.52vw] pb-[0.52vw] pt-[0.02vw] shadow-[0_14px_28px_rgba(15,23,42,0.10)]">
    <SectionHeader title={title} />
    <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-[0.42vw]">
      {products.slice(0, 4).map((product) => (
        <div
          key={product.id}
          className={`grid h-full items-center ${dense ? "grid-cols-[33%_1fr]" : "grid-cols-[36%_1fr]"} gap-[0.22vw] rounded-[0.86vw] bg-white/82 ${dense ? "p-[0.22vw]" : "p-[0.26vw]"} shadow-[0_8px_18px_rgba(15,23,42,0.06)]`}
        >
          <div className={`flex items-center justify-center overflow-hidden rounded-[0.72vw] bg-white ${dense ? "h-[4.2vw]" : "h-full min-h-[4.6vw]"}`}>
            <img src={imageUrl(product.image)} alt={product.name} className={`h-full w-full ${dense ? "object-contain p-[0.08vw]" : "object-cover"}`} />
          </div>
          <div className="min-w-0 self-center">
            <p className={`line-clamp-2 ${dense ? "text-[0.7vw]" : "text-[0.76vw]"} font-extrabold leading-[1.03] text-[#171717]`}>{product.name}</p>
            <div className={dense ? "mt-[0.08vw]" : "mt-[0.12vw]"}>
              <ProductPrice product={product} />
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const DrinksStrip = ({ products }) => (
  <section className="flex h-full flex-col overflow-hidden rounded-[1.32vw] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(245,243,250,0.94)_100%)] px-[0.52vw] pb-[0.52vw] pt-[0.02vw] shadow-[0_14px_28px_rgba(15,23,42,0.10)]">
    <SectionHeader title="Drinks" />
    <div className="grid flex-1 grid-cols-4 grid-rows-2 gap-[0.24vw]">
      {products.slice(0, 8).map((product) => (
        <div key={product.id} className="grid min-w-0 grid-cols-[26%_1fr] items-center gap-[0.2vw] rounded-[0.8vw] bg-white/82 p-[0.18vw] shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
          <div className="h-full min-h-[3.2vw] overflow-hidden rounded-[0.62vw] bg-white">
            <img src={imageUrl(product.image)} alt={product.name} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[0.68vw] font-extrabold leading-[1.03] text-[#171717]">{product.name}</p>
            <div className="mt-[0.04vw]">
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
  const [shop, setShop] = useState({ logo: "" });
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
          logo: settings?.logo || ""
        });
      } catch (error) {
        const cachedMenu = productService.getCachedPublicMenu();
        const cachedAdminProducts = productService
          .getCachedProducts()
          .filter((product) => product.isActive !== false && product.forSale !== false);
        const fallbackMenu = cachedMenu.length > 0 ? cachedMenu : cachedAdminProducts;
        const cachedSettings = shopSettingsService.getCachedPublic();

        if (fallbackMenu.length > 0) {
          setProducts(fallbackMenu || []);
          setShop({
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
  const mainSections = useMemo(
    () => groupedCategories.filter((entry) => normalizeCategoryName(entry.category) !== "drinks"),
    [groupedCategories]
  );

  const arrangedSections = useMemo(() => {
    const sections = [...mainSections];
    const takeByMatcher = (matcher) => {
      const index = sections.findIndex((section) => matcher(normalizeCategoryName(section.category)));
      if (index === -1) {
        return null;
      }

      return sections.splice(index, 1)[0];
    };

    const burger = takeByMatcher((category) => category === "burger");
    const combo = takeByMatcher((category) => category === "combo");
    const meal = takeByMatcher((category) => category === "meal");
    const friedChicken = takeByMatcher((category) => category === "fried chicken");
    const snacks = takeByMatcher((category) => category === "snacks");
    const wrapAndBowl = takeByMatcher((category) => category === "wrap & bowl");

    const takeFallback = () => sections.shift() || null;

    return {
      leftTop: burger || takeFallback(),
      feature: combo || takeFallback(),
      leftBottom: meal || takeFallback(),
      rightBottom: friedChicken || takeFallback(),
      extraOne: snacks || takeFallback(),
      extraTwo: wrapAndBowl || takeFallback()
    };
  }, [mainSections]);

  const { leftTop, feature, leftBottom, rightBottom, extraOne, extraTwo } = arrangedSections;

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(232,230,242,0.98))] p-[0.45vw] text-slate-900">
      <div className="mx-auto flex h-full max-w-[1920px] flex-col gap-[0.42vw]">
        {loading ? (
          <div className="flex flex-1 items-center justify-center rounded-[1.6vw] bg-white/75 text-[1.2vw] font-semibold text-slate-500 shadow-[0_18px_36px_rgba(15,23,42,0.1)]">
            Loading poster menu...
          </div>
        ) : (
          <>
            <main className="grid min-h-0 flex-1 grid-cols-12 gap-[0.42vw]">
              <div className="col-span-4 grid min-h-0 grid-rows-[0.84fr_1.16fr] gap-[0.42vw]">
                {leftTop ? <GridSection title={leftTop.category} products={leftTop.products} /> : <div className="rounded-[1.5vw] bg-white/75" />}
                {leftBottom ? <GridSection title={leftBottom.category} products={leftBottom.products} showDescription largeImage /> : <div className="rounded-[1.5vw] bg-white/75" />}
              </div>

              <div className="col-span-8 grid min-h-0 grid-rows-[1.03fr_0.77fr] gap-[0.42vw]">
                {feature ? <FeatureSection title={feature.category} products={feature.products} brandLogo={shop.logo} /> : <div className="rounded-[1.5vw] bg-white/75" />}

                <div className="grid min-h-0 grid-cols-2 gap-[0.42vw]">
                  {rightBottom ? <CompactSection title={rightBottom.category} products={rightBottom.products} dense /> : <div className="rounded-[1.5vw] bg-white/75" />}
                  {extraOne ? (
                    <CompactSection title={extraOne.category} products={extraOne.products} dense />
                  ) : leftTop ? (
                    <CompactSection title={`${leftTop.category} Specials`} products={leftTop.products.slice(0, 4)} dense />
                  ) : (
                    <div className="rounded-[1.5vw] bg-white/75" />
                  )}
                </div>
              </div>
            </main>

            <div className="grid shrink-0 grid-cols-[1.18fr_0.82fr] gap-[0.42vw]">
              {drinksSection ? (
                <DrinksStrip products={drinksSection.products} />
              ) : extraTwo ? (
                <CompactSection title={extraTwo.category} products={extraTwo.products} dense />
              ) : (
                <div className="rounded-[1.5vw] bg-white/75" />
              )}
              {extraTwo ? (
                <CompactSection title={extraTwo.category} products={extraTwo.products} dense />
              ) : feature ? (
                <CompactSection title={`${feature.category} Picks`} products={feature.products.slice(0, 4)} dense />
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
