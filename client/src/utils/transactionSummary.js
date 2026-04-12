import { formatServeTime } from "./format";

const paymentMethods = ["cash", "card", "qr"];

const pushFlow = (flows, method, direction, amount) => {
  if (!paymentMethods.includes(method)) {
    return;
  }

  const numericAmount = Number(amount || 0);
  if (numericAmount <= 0) {
    return;
  }

  flows[`${method}${direction}`] += numericAmount;
};

const getInitialTransaction = (order) => {
  const firstEdit = Array.isArray(order.editHistory) ? order.editHistory[0] : null;

  if (order?.source === "customer" && firstEdit?.oldPaymentMethod == null && firstEdit?.newPaymentMethod) {
    return {
      amount: Number(firstEdit?.oldTotal ?? order.originalTotal ?? order.total ?? 0),
      method: firstEdit.newPaymentMethod
    };
  }

  return {
    amount: Number(firstEdit?.oldTotal ?? order.originalTotal ?? order.total ?? 0),
    method: firstEdit?.oldPaymentMethod || order.paymentMethod || null
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
  pushFlow(flows, initialTransaction.method, "In", initialTransaction.amount);

  const editHistory = Array.isArray(order.editHistory) ? order.editHistory : [];

  editHistory.forEach((entry) => {
    if (order?.source === "customer" && entry.oldPaymentMethod == null && entry.newPaymentMethod) {
      return;
    }

    if (entry.adjustmentType === "void") {
      pushFlow(flows, entry.adjustmentMethod, "Out", entry.adjustmentAmount);
      return;
    }

    const oldMethod = entry.oldPaymentMethod || null;
    const newMethod = entry.newPaymentMethod || null;
    const oldTotal = Number(entry.oldTotal || 0);
    const newTotal = Number(entry.newTotal || 0);

    if (oldMethod && newMethod && oldMethod !== newMethod) {
      pushFlow(flows, oldMethod, "Out", oldTotal);
      pushFlow(flows, newMethod, "In", newTotal);
      return;
    }

    if (entry.adjustmentType === "add") {
      pushFlow(flows, entry.adjustmentMethod || newMethod || oldMethod, "In", entry.adjustmentAmount);
      return;
    }

    if (entry.adjustmentType === "refund") {
      pushFlow(flows, entry.adjustmentMethod || oldMethod || newMethod, "Out", entry.adjustmentAmount);
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
