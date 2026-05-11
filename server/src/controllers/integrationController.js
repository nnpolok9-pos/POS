const { savePartnerWebhookLog, getPartnerWebhookLogs } = require("../lib/dataStore");
const { PARTNER_KEYS } = require("../utils/partnerSettings");

const normalizePartnerKey = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  if (normalized === "egates") {
    return "e_gates";
  }

  return normalized;
};

const getPayloadValue = (payload = {}, keys = []) => {
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
      return payload[key];
    }
  }

  return "";
};

const getWebhookLogs = async (req, res) => {
  const partnerKey = req.query.partner ? normalizePartnerKey(req.query.partner) : null;
  const logs = await getPartnerWebhookLogs({
    partnerKey: partnerKey && PARTNER_KEYS.includes(partnerKey) ? partnerKey : null,
    limit: req.query.limit || 50
  });
  res.json(logs);
};

const receivePartnerWebhook = async (req, res) => {
  const partnerKey = normalizePartnerKey(req.params.partner);

  if (!PARTNER_KEYS.includes(partnerKey)) {
    return res.status(400).json({ message: "Unsupported partner webhook" });
  }

  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const headerEvent =
    req.headers["x-event-type"] ||
    req.headers["x-webhook-event"] ||
    req.headers["x-foodpanda-event"] ||
    req.headers["x-grab-event"] ||
    "";

  const eventType = String(
    getPayloadValue(payload, ["eventType", "event_type", "type", "action"]) || headerEvent || "unknown"
  ).trim();
  const externalOrderId = String(
    getPayloadValue(payload, ["orderId", "order_id", "externalOrderId", "external_order_id", "id", "reference"])
  ).trim();
  const orderStatus = String(getPayloadValue(payload, ["status", "orderStatus", "order_status", "state"])).trim();

  const savedLog = await savePartnerWebhookLog({
    partnerKey,
    eventType,
    externalOrderId,
    orderStatus,
    headers: req.headers,
    payload
  });

  res.json({
    success: true,
    message: "Webhook received",
    partnerKey,
    logId: savedLog?.id || null
  });
};

module.exports = {
  getWebhookLogs,
  receivePartnerWebhook
};
