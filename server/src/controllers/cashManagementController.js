const {
  getCashHandovers,
  getOrders,
  getUsersByIds,
  getUsersByRoles,
  saveCashHandover
} = require("../lib/dataStore");
const { buildTimezoneDateRange } = require("../utils/reportDateRange");

const CASH_USER_ROLES = ["master_admin", "admin", "staff"];

const toSqlDateTime = (date) => date.toISOString().slice(0, 19).replace("T", " ");

const getRange = (queryParams) => {
  const range = buildTimezoneDateRange(queryParams.from, queryParams.to);
  if (!range) {
    const error = new Error("Invalid date range");
    error.statusCode = 400;
    throw error;
  }

  return {
    from: toSqlDateTime(range.start),
    to: toSqlDateTime(range.end)
  };
};

const compactUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});

const getCashUsers = async (req, res) => {
  const users = await getUsersByRoles(CASH_USER_ROLES);
  res.json(users.map(compactUser));
};

const createCashHandover = async (req, res) => {
  const userId = String(req.body.userId || "").trim();
  const amount = Number(req.body.amount || 0);

  if (!userId) {
    return res.status(400).json({ message: "Select the user who handed over cash" });
  }
  if (amount <= 0) {
    return res.status(400).json({ message: "Handover amount must be greater than 0" });
  }

  const users = await getUsersByRoles(CASH_USER_ROLES);
  const selectedUser = users.find((user) => String(user.id) === userId);
  if (!selectedUser) {
    return res.status(400).json({ message: "Selected user was not found" });
  }

  const handover = await saveCashHandover({
    userId: selectedUser.id,
    userName: selectedUser.name,
    amount,
    remarks: req.body.remarks || "",
    createdBy: req.user.id
  });

  res.status(201).json(handover);
};

const getCashPosition = async (req, res) => {
  const { from, to } = getRange(req.query);
  const selectedUserId = String(req.query.userId || "").trim();

  const [orders, handovers, users] = await Promise.all([
    getOrders({
      where: "WHERE payment_method = :paymentMethod AND status NOT IN ('queued', 'void') AND created_at >= :from AND created_at <= :to",
      params: { paymentMethod: "cash", from, to },
      orderBy: "created_at DESC"
    }),
    getCashHandovers({ from, to, userId: selectedUserId }),
    getUsersByRoles(CASH_USER_ROLES)
  ]);

  const filteredOrders = selectedUserId
    ? orders.filter((order) => String(order.staff || "") === selectedUserId)
    : orders;
  const userIds = [
    ...new Set([
      ...users.map((user) => String(user.id)),
      ...filteredOrders.map((order) => String(order.staff || "")).filter(Boolean),
      ...handovers.map((handover) => String(handover.userId || "")).filter(Boolean),
      ...handovers.map((handover) => String(handover.createdBy || "")).filter(Boolean)
    ])
  ];
  const hydratedUsers = await getUsersByIds(userIds);
  const userMap = new Map([...users, ...hydratedUsers].map((user) => [String(user.id), user]));
  const createdByMap = new Map(hydratedUsers.map((user) => [String(user.id), user]));
  const rows = new Map();

  const ensureRow = (userId, fallbackName = "Unknown User") => {
    const key = String(userId || "unknown");
    if (!rows.has(key)) {
      const user = userMap.get(key);
      rows.set(key, {
        userId: user?.id || key,
        userName: user?.name || fallbackName,
        role: user?.role || "",
        cashCollected: 0,
        handedOver: 0,
        balance: 0,
        orderCount: 0,
        handoverCount: 0
      });
    }
    return rows.get(key);
  };

  filteredOrders.forEach((order) => {
    const row = ensureRow(order.staff, "Unassigned User");
    row.cashCollected += Number(order.total || 0);
    row.orderCount += 1;
  });

  handovers.forEach((handover) => {
    const row = ensureRow(handover.userId, handover.userName);
    row.handedOver += Number(handover.amount || 0);
    row.handoverCount += 1;
  });

  const userwise = [...rows.values()]
    .map((row) => ({
      ...row,
      cashCollected: Math.round(row.cashCollected),
      handedOver: Math.round(row.handedOver),
      balance: Math.round(row.cashCollected - row.handedOver)
    }))
    .filter((row) => !selectedUserId || String(row.userId) === selectedUserId)
    .sort((a, b) => b.balance - a.balance || a.userName.localeCompare(b.userName));

  const history = handovers.map((handover) => ({
    ...handover,
    createdByName: createdByMap.get(String(handover.createdBy || ""))?.name || ""
  }));

  const summary = userwise.reduce(
    (acc, row) => ({
      cashCollected: acc.cashCollected + row.cashCollected,
      handedOver: acc.handedOver + row.handedOver,
      balance: acc.balance + row.balance,
      orderCount: acc.orderCount + row.orderCount,
      handoverCount: acc.handoverCount + row.handoverCount
    }),
    { cashCollected: 0, handedOver: 0, balance: 0, orderCount: 0, handoverCount: 0 }
  );

  res.json({
    summary,
    userwise,
    history,
    range: { from, to }
  });
};

module.exports = {
  createCashHandover,
  getCashPosition,
  getCashUsers
};
