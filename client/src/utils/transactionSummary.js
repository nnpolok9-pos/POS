import { formatServeTime } from "./format";

const posPaymentMethods = ["cash", "card", "qr"];
const partnerPaymentMethods = ["grab", "foodpanda", "e_gates", "wownow"];
const paymentMethods = [...posPaymentMethods, ...partnerPaymentMethods];
const isVoidHistoryEntry = (entry) => ["void", "void_edit"].includes(entry?.adjustmentType);

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
  const voidEntries = editHistory.filter(isVoidHistoryEntry);
  const latestVoidEntry = voidEntries.at(-1) || null;
  const baseVoidEntry = voidEntries.find((entry) => entry.adjustmentType === "void") || latestVoidEntry;

  editHistory.forEach((entry) => {
    if (order?.source === "customer" && entry.oldPaymentMethod == null && entry.newPaymentMethod) {
      return;
    }

    if (isVoidHistoryEntry(entry)) {
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

  if (order.status === "void") {
    const effectiveVoidAmount = Number(latestVoidEntry?.adjustmentAmount ?? baseVoidEntry?.adjustmentAmount ?? order.originalTotal ?? 0);
    const effectiveVoidMethod = latestVoidEntry?.adjustmentMethod ?? baseVoidEntry?.adjustmentMethod ?? null;
    pushFlow(flows, effectiveVoidMethod, "Out", effectiveVoidAmount);
  }

  const nonVoidEditCount = editHistory.filter((entry) => !isVoidHistoryEntry(entry)).length;

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
    deliveryIn: partnerPaymentMethods.reduce((sum, method) => sum + Number(flows[`${method}In`] || 0), 0),
    deliveryOut: partnerPaymentMethods.reduce((sum, method) => sum + Number(flows[`${method}Out`] || 0), 0),
    partnerFlows: partnerPaymentMethods.reduce((acc, method) => {
      acc[method] = {
        in: Number(flows[`${method}In`] || 0),
        out: Number(flows[`${method}Out`] || 0)
      };
      return acc;
    }, {}),
    editCount: nonVoidEditCount,
    status: getOrderStatusLabel(order),
    serveTime: getServeTimeLabel(order)
  };
};
