const StatusBadge = ({ stock, lowStock }) => {
  if (stock === 0) {
    return <span className="whitespace-nowrap rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Sold out</span>;
  }

  if (lowStock) {
    return <span className="whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Low stock</span>;
  }

  return <span className="whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">In stock</span>;
};

export default StatusBadge;
