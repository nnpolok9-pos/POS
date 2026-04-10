const USD_TO_KHR = 4000;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const khrFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export const currencyParts = (value) => {
  const numericValue = Number(value || 0);
  const sign = numericValue < 0 ? "-" : "";
  const absoluteKhr = Math.abs(numericValue);
  const usdValue = absoluteKhr / USD_TO_KHR;

  return {
    khr: `${sign}\u17db${khrFormatter.format(absoluteKhr)}`,
    usd: `${sign}${usdFormatter.format(usdValue)}`
  };
};

export const currency = (value) => {
  const parts = currencyParts(value);

  return `${parts.khr} (${parts.usd})`;
};

export const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export const formatServeTime = (createdAt, servedAt) => {
  if (!createdAt || !servedAt) {
    return "Pending";
  }

  const start = new Date(createdAt).getTime();
  const end = new Date(servedAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "-";
  }

  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${totalMinutes}m`;
};

export const imageUrl = (path) => {
  if (!path) {
    return "https://placehold.co/300x220/f59e0b/ffffff?text=No+Image";
  }

  return `${import.meta.env.VITE_SERVER_URL || "http://localhost:5000"}${path}`;
};
