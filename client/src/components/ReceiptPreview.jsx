import { currency, formatDate } from "../utils/format";

const shopName = import.meta.env.VITE_SHOP_NAME || "Fast Bites POS";

const ReceiptPreview = ({ order }) => {
  if (!order) {
    return null;
  }

  return (
    <div className="hidden print:block">
      <div className="mx-auto max-w-sm p-6 text-black">
        <h1 className="text-center text-xl font-bold">{shopName}</h1>
        <p className="text-center text-sm">Order Receipt</p>
        <div className="my-4 border-t border-dashed border-black" />
        <p>Order ID: {order.orderId}</p>
        <p>Date: {formatDate(order.createdAt)}</p>
        <p>Payment: {order.paymentMethod}</p>
        <div className="my-4 border-t border-dashed border-black" />
        {order.items.map((item) => (
          <div key={item.product} className="mb-2 flex justify-between gap-2 text-sm">
            <span>
              {item.name} x {item.quantity}
            </span>
            <span>{currency(item.subtotal)}</span>
          </div>
        ))}
        <div className="my-4 border-t border-dashed border-black" />
        <p className="flex justify-between font-bold">
          <span>Total</span>
          <span>{currency(order.total)}</span>
        </p>
      </div>
    </div>
  );
};

export default ReceiptPreview;
