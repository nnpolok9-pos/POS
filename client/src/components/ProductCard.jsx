import StatusBadge from "./StatusBadge";
import { currencyParts, imageUrl } from "../utils/format";

const ProductCard = ({ product, onSelect, language = "en", showStatusBadge = true, showStockQuantity = true, priceMode = "offer" }) => {
  const isKhmer = language === "km";
  const promotionalPrice = Number(product.promotionalPrice ?? product.price ?? 0);
  const regularPrice = Number(product.regularPrice ?? product.price ?? promotionalPrice);
  const activePrice = priceMode === "regular" ? regularPrice : promotionalPrice;
  const activeParts = currencyParts(activePrice);
  const regularParts = currencyParts(product.regularPrice ?? product.price);

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      disabled={product.stock === 0}
      className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white text-left shadow-soft transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="aspect-[4/3] overflow-hidden bg-amber-100">
        <img
          src={imageUrl(product.image)}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[15px] font-semibold ${isKhmer ? "text-black" : "text-slate-900"}`}>{product.name}</p>
            <p className={`text-[13px] ${isKhmer ? "text-black" : "text-slate-500"}`}>{product.category}</p>
            {product.description ? (
              <p className={`mt-1 line-clamp-2 text-[12px] leading-5 ${isKhmer ? "text-black" : "text-slate-500"}`}>{product.description}</p>
            ) : null}
          </div>
          {showStatusBadge ? <StatusBadge stock={product.stock} lowStock={product.lowStock} /> : null}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="flex flex-col">
            {priceMode !== "regular" && regularPrice > promotionalPrice && (
              <span className={`text-[12px] line-through ${isKhmer ? "text-black" : "text-slate-400"}`}>
                {regularParts.khr} <span className={`text-[11px] ${isKhmer ? "text-black" : "text-slate-300"}`}>({regularParts.usd})</span>
              </span>
            )}
            <span className="text-[18px] font-bold text-brand-600">{activeParts.khr}</span>
            <span className={`text-[11px] ${isKhmer ? "text-black" : "text-slate-400"}`}>{activeParts.usd}</span>
          </div>
          {showStockQuantity ? <span className={`text-[13px] font-medium ${isKhmer ? "text-black" : "text-slate-500"}`}>Stock: {product.stock}</span> : null}
        </div>
      </div>
    </button>
  );
};

export default ProductCard;
