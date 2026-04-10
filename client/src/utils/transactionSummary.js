import { formatServeTime } from "./format";

const paymentMethods = ["cash", "card", "qr"];

const getInitialTransaction = (order) => {
  const firstEdit = order.editHistory?.[0];

  return {
    amount: Number(firstEdit?.oldTotal ?? order.originalTotal ?? order.total ?? 0),
    method: firstEdit?.oldPaymentMethod || order.paymentMethod || "cash"
  };
};

export const getOrderStatusLabel = (order) => {
  if (order.status === "void") {
    return "Voided";
  }

  if (order.status === "food_serving") {
    return "Food Serving";
  }

  return "Completed";
};

export const getServeTimeLabel = (order) => (order.status === "void" ? "N/A" : formatServeTime(order.createdAt, order.servedAt));

export const getTransactionSummary = (order) => {
  const flows = paymentMethods.reduce((acc, method) => {
    acc[`${method}In`] = 0;
    acc[`${method}Out`] = 0;
    return acc;
  }, {});

  const initialTransaction = getInitialTransaction(order);
  if (paymentMethods.includes(initialTransaction.method)) {
    flows[`${initialTransaction.method}In`] += initialTransaction.amount;
  }

  const editHistory = Array.isArray(order.editHistory) ? order.editHistory : [];

  editHistory.forEach((entry) => {
    const method = entry.adjustmentMethod;
    if (!paymentMethods.includes(method)) {
      return;
    }

    if (entry.adjustmentType === "add") {
      flows[`${method}In`] += Number(entry.adjustmentAmount || 0);
    }

    if (entry.adjustmentType === "refund" || entry.adjustmentType === "void") {
      flows[`${method}Out`] += Number(entry.adjustmentAmount || 0);
    }
  });

  const nonVoidEditCount = editHistory.filter((entry) => entry.adjustmentType !== "void").length;

  return {
    date: order.createdAt,
    orderNumber: order.orderId,
    finalOrderValue: Number(order.status === "void" ? order.originalTotal ?? 0 : order.total ?? 0),
    cashIn: flows.cashIn,
    cashOut: flows.cashOut,
    cardIn: flows.cardIn,
    cardOut: flows.cardOut,
    qrIn: flows.qrIn,
    qrOut: flows.qrOut,
    editCount: nonVoidEditCount,
    status: getOrderStatusLabel(order),
    serveTime: getServeTimeLabel(order)
  };
};
