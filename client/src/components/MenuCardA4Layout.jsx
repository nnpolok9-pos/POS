import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { productService } from "../services/productService";
import { shopSettingsService } from "../services/shopSettingsService";
import { currencyParts, imageUrl } from "../utils/format";

const PAGE_TITLE = {
  en: "ASEN FOOD MENU",
  km: "ម៉ឺនុយអាហារ ASEN"
};

const PAGE_SUBTITLE = {
  en: "A4 Print Menu",
  km: "ម៉ឺនុយសម្រាប់បោះពុម្ព A4"
};

const PAGE_NOTE = {
  en: "Prepared fresh for every order",
  km: "រៀបចំស្រស់សម្រាប់គ្រប់ការកម្មង់"
};

const UI = {
  en: {
    print: "Print Menu",
    switchLabel: "Language",
    english: "English",
    khmer: "Khmer",
    continued: "Continued",
    products: "Products",
    loading: "Loading A4 print menu...",
    noMenu: "No products available for printing.",
    fallbackError: "Failed to load menu. Showing cached data.",
    page: "Page"
  },
  km: {
    print: "បោះពុម្ពម៉ឺនុយ",
    switchLabel: "ភាសា",
    english: "English",
    khmer: "ខ្មែរ",
    continued: "បន្ត",
    products: "មុខម្ហូប",
    loading: "កំពុងផ្ទុកម៉ឺនុយបោះពុម្ព A4...",
    noMenu: "មិនមានមុខម្ហូបសម្រាប់បោះពុម្ពទេ។",
    fallbackError: "មិនអាចផ្ទុកម៉ឺនុយបានទេ។ កំពុងបង្ហាញទិន្នន័យដែលបានរក្សាទុក។",
    page: "ទំព័រ"
  }
};

const moveDrinksCategoryToEnd = (categories) => {
  const nonDrinks = [];
  const drinks = [];

  categories.forEach((category) => {
    if ((category.key || "").toLowerCase() === "drinks") {
      drinks.push(category);
      return;
    }

    nonDrinks.push(category);
  });

  return [...nonDrinks, ...drinks];
};

const getLocalizedName = (product, language) => (language === "km" ? product.khmerName || product.name : product.name);
const getLocalizedDescription = (product, language) =>
  language === "km" ? product.khmerDescription || product.description || "" : product.description || "";
const getLocalizedCategory = (product, language) =>
  language === "km" ? product.khmerCategory || product.category || "Menu" : product.category || "Menu";

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const buildSections = (products, language, labels) => {
  const categories = moveDrinksCategoryToEnd(
    Array.from(
      new Map(
        products.map((product) => [
          product.category || "Menu",
          {
            key: product.category || "Menu",
            title: getLocalizedCategory(product, language)
          }
        ])
      ).values()
    )
  );

  return categories.flatMap((category) => {
    const categoryProducts = products
      .filter((product) => (product.category || "Menu") === category.key)
      .sort((left, right) => (getLocalizedName(left, language) || "").localeCompare(getLocalizedName(right, language) || ""));

    return chunkArray(categoryProducts, 3).map((sectionProducts, index) => ({
      key: `${category.key}-${index}`,
      title: index === 0 ? category.title : `${category.title} • ${labels.continued}`,
      totalProducts: categoryProducts.length,
      products: sectionProducts
    }));
  });
};

const ProductPrice = ({ product }) => {
  const promo = currencyParts(product.promotionalPrice ?? product.price ?? 0);
  const regular = currencyParts(product.regularPrice ?? product.price ?? 0);
  const discounted = Number(product.promotionalPrice ?? product.price ?? 0) < Number(product.regularPrice ?? product.price ?? 0);

  return (
    <div className="text-right">
      <div className="text-[13px] font-extrabold leading-none text-[#f17923]">{promo.khr}</div>
      <div className="mt-1 flex items-center justify-end gap-2">
        {discounted ? <span className="text-[9px] font-medium text-slate-400 line-through">{regular.khr}</span> : null}
        <span className="text-[9px] font-semibold text-slate-500">{promo.usd}</span>
      </div>
    </div>
  );
};

const ProductCard = ({ product, language }) => {
  const description = getLocalizedDescription(product, language);

  return (
    <article className="grid grid-cols-[18mm_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[16px] border border-[#f0e2cc] bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-3">
      <div className="flex h-[18mm] w-[18mm] items-center justify-center overflow-hidden rounded-[12px] bg-white shadow-sm">
        <img src={imageUrl(product.image)} alt={getLocalizedName(product, language)} className="h-full w-full object-cover" />
      </div>

      <div className="min-w-0">
        <p className="overflow-hidden text-[12px] font-black leading-[1.08] text-slate-900" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {getLocalizedName(product, language)}
        </p>
        {description ? (
          <p className="mt-1 overflow-hidden text-[8px] leading-[1.2] text-slate-500" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {description}
          </p>
        ) : null}
      </div>

      <ProductPrice product={product} />
    </article>
  );
};

const SectionCard = ({ section, language, labels }) => (
  <section className="rounded-[22px] border border-[#eadcc4] bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#f3e7d4] pb-3">
      <div>
        <h2 className="font-display text-[18px] font-extrabold uppercase tracking-tight text-slate-900">{section.title}</h2>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {section.totalProducts} {labels.products}
        </p>
      </div>
      <div className="rounded-full bg-[#fff1e4] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#f17923]">
        A4
      </div>
    </div>

    <div className="grid gap-2.5">
      {section.products.map((product) => (
        <ProductCard key={product.id} product={product} language={language} />
      ))}
    </div>
  </section>
);

const MenuCardA4Layout = ({ language = "en" }) => {
  const labels = UI[language];
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState({ shopName: "ASEN POS", address: "", logo: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `${PAGE_TITLE[language]} | A4`;
  }, [language]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [menu, settings] = await Promise.all([productService.getPublicMenu(), shopSettingsService.getPublic()]);
        setProducts(menu || []);
        setShop({
          shopName: settings?.shopName || "ASEN POS",
          address: settings?.address || "",
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
            address: cachedSettings?.address || "",
            logo: cachedSettings?.logo || ""
          });
          toast.error(error.response?.data?.message || labels.fallbackError);
        } else {
          toast.error(error.response?.data?.message || labels.noMenu);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [labels.fallbackError, labels.noMenu]);

  const sections = useMemo(() => buildSections(products, language, labels), [products, language, labels]);
  const pages = useMemo(() => chunkArray(sections, 6), [sections]);

  return (
    <div className="min-h-screen bg-[#e9e5dc] py-6">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        @media print {
          body {
            background: white !important;
          }
          .a4-menu-toolbar {
            display: none !important;
          }
          .a4-menu-page {
            box-shadow: none !important;
            margin: 0 auto !important;
            break-after: page;
            page-break-after: always;
          }
          .a4-menu-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="a4-menu-toolbar mx-auto mb-5 flex max-w-[297mm] items-center justify-between gap-3 rounded-[22px] border border-[#eadcc4] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{labels.switchLabel}</p>
          <div className="mt-1 flex items-center gap-2">
            <Link
              to="/menu-card-a4"
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${language === "en" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {UI.en.english}
            </Link>
            <Link
              to="/menu-card-a4-kh"
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${language === "km" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {UI.km.khmer}
            </Link>
          </div>
        </div>

        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-[#f17923] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(241,121,35,0.24)]">
          <Printer size={16} />
          {labels.print}
        </button>
      </div>

      <div className="mx-auto flex max-w-[297mm] flex-col gap-6">
        {loading ? (
          <div className="a4-menu-page flex min-h-[210mm] items-center justify-center rounded-[28px] bg-white text-lg font-semibold text-slate-500 shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
            {labels.loading}
          </div>
        ) : pages.length === 0 ? (
          <div className="a4-menu-page flex min-h-[210mm] items-center justify-center rounded-[28px] bg-white text-lg font-semibold text-slate-500 shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
            {labels.noMenu}
          </div>
        ) : (
          pages.map((pageSections, pageIndex) => (
            <section
              key={`page-${pageIndex + 1}`}
              className="a4-menu-page rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(252,246,235,0.98))] px-[12mm] py-[11mm] text-slate-900 shadow-[0_20px_45px_rgba(15,23,42,0.12)]"
              style={{ width: "297mm", minHeight: "210mm" }}
            >
              <header className="flex items-start justify-between gap-6 border-b border-[#eedfc8] pb-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-[26mm] w-[26mm] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#eadcc4] bg-white p-2 shadow-sm">
                    {shop.logo ? <img src={imageUrl(shop.logo)} alt={shop.shopName} className="h-full w-full object-contain" /> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f17923]">{PAGE_SUBTITLE[language]}</p>
                    <h1 className="mt-1 font-display text-[30px] font-extrabold leading-none text-slate-900">{PAGE_TITLE[language]}</h1>
                    <p className="mt-1.5 text-[11px] font-medium text-slate-500">{shop.shopName || "ASEN POS"}</p>
                    {shop.address ? <p className="mt-1 text-[9px] text-slate-400">{shop.address}</p> : null}
                  </div>
                </div>

                <div className="text-right">
                  <div className="rounded-[18px] border border-[#eadcc4] bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{labels.page}</p>
                    <p className="mt-1 text-[18px] font-extrabold text-slate-900">
                      {pageIndex + 1} / {pages.length}
                    </p>
                  </div>
                  <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">{PAGE_NOTE[language]}</p>
                </div>
              </header>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {pageSections.map((section) => (
                  <SectionCard key={section.key} section={section} language={language} labels={labels} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default MenuCardA4Layout;
