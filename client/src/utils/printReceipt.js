const fallbackShopName = import.meta.env.VITE_SHOP_NAME || "Fast Bites POS";

const currency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

const statusLabels = {
  food_serving: "FOOD SERVING",
  completed: "COMPLETED",
  void: "VOID"
};

const getMonochromeLogo = async (imageUrl) => {
  if (!imageUrl) {
    return "";
  }

  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");

        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          const alpha = data[index + 3];
          const grayscale = red * 0.299 + green * 0.587 + blue * 0.114;
          const value = grayscale > 160 ? 255 : 0;

          data[index] = value;
          data[index + 1] = value;
          data[index + 2] = value;
          data[index + 3] = alpha;
        }

        context.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(imageUrl);
      }
    };

    image.onerror = () => resolve(imageUrl);
    image.src = imageUrl;
  });
};

export const printReceipt = async (order, shopProfile = {}) => {
  if (!order) {
    return;
  }

  const receiptWindow = window.open("", "_blank", "width=420,height=720");

  if (!receiptWindow) {
    return;
  }

  const shopName = shopProfile.shopName || fallbackShopName;
  const address = shopProfile.address || "";
  const colorLogo = shopProfile.logo
    ? `${import.meta.env.VITE_SERVER_URL || "http://localhost:5000"}${shopProfile.logo}`
    : "";
  const logo = await getMonochromeLogo(colorLogo);

  const itemsHtml = order.items
    .map(
      (item) => `
        <div class="line-item">
          <span>${item.name} x ${item.quantity}</span>
          <span>${currency(item.subtotal)}</span>
        </div>
      `
    )
    .join("");

  const statusLine =
    order.status === "void"
      ? `<p class="muted">Status: VOID</p><p class="muted">Original Total: ${currency(order.originalTotal ?? 0)}</p>`
      : `<p class="muted">Status: ${statusLabels[order.status] || "COMPLETED"}</p>`;
  const promoLine =
    Number(order.promoDiscount || 0) > 0
      ? `
          <div class="line-item">
            <span>Promo ${order.promoCode || ""}</span>
            <span>-${currency(order.promoDiscount)}</span>
          </div>
        `
      : "";

  receiptWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${order.orderId}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
          .receipt { max-width: 320px; margin: 0 auto; }
          .brand { text-align: center; margin-bottom: 8px; }
          .brand img { max-height: 54px; max-width: 120px; object-fit: contain; margin-bottom: 8px; }
          h1 { font-size: 20px; margin: 0 0 4px; text-align: center; }
          p { margin: 4px 0; font-size: 14px; }
          .divider { border-top: 1px dashed #111; margin: 16px 0; }
          .line-item, .total-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; margin: 8px 0; }
          .total-row { font-weight: 700; font-size: 16px; }
          .muted { color: #555; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="brand">
            ${logo ? `<img src="${logo}" alt="Logo" />` : ""}
            <h1>${shopName}</h1>
            ${address ? `<p class="muted" style="text-align:center; white-space:pre-line;">${address}</p>` : ""}
          </div>
          <p style="text-align:center;">Order Receipt</p>
          <div class="divider"></div>
          <p>Order ID: ${order.orderId}</p>
          <p>Date: ${formatDate(order.createdAt)}</p>
          <p>Payment: ${order.paymentMethod}</p>
          ${statusLine}
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          ${promoLine}
          <div class="total-row">
            <span>Total</span>
            <span>${currency(order.total)}</span>
          </div>
        </div>
        <script>
          window.onload = function () {
            window.print();
            window.onafterprint = function () { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  receiptWindow.document.close();
};
