import StatusBadge from "./StatusBadge";
import { currencyParts, imageUrl } from "../utils/format";

const ProductCard = ({ product, onSelect }) => {
  const promoParts = currencyParts(product.promotionalPrice ?? product.price);
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
            <p className="text-[15px] font-semibold text-slate-900">{product.name}</p>
            <p className="text-[13px] text-slate-500">{product.category}</p>
            {product.description ? <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">{product.description}</p> : null}
          </div>
          <StatusBadge stock={product.stock} lowStock={product.lowStock} />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="flex flex-col">
            {Number(product.regularPrice ?? product.price) > Number(product.promotionalPrice ?? product.price) && (
              <span className="text-[12px] text-slate-400 line-through">
                {regularParts.khr} <span className="text-[11px] text-slate-300">({regularParts.usd})</span>
              </span>
            )}
            <span className="text-[18px] font-bold text-brand-600">{promoParts.khr}</span>
            <span className="text-[11px] text-slate-400">{promoParts.usd}</span>
          </div>
          <span className="text-[13px] font-medium text-slate-500">Stock: {product.stock}</span>
        </div>
      </div>
    </button>
  );
};

export default ProductCard;
