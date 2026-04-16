import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(clientDir, "..");
const docsDir = path.join(rootDir, "docs");
const outputPath = path.join(docsDir, "ASEN-POS-Staff-Admin-Manual.pdf");

const COLORS = {
  page: "#fcf8ef",
  white: "#ffffff",
  ink: "#151b2d",
  slate: "#5b6476",
  muted: "#8a92a3",
  line: "#eadcc4",
  orange: "#f17923",
  orangeSoft: "#fff1e4",
  navy: "#171d31",
  navySoft: "#eef2ff",
  green: "#0f766e",
  greenSoft: "#eaf8f4",
  blue: "#2563eb",
  blueSoft: "#eaf2ff",
  rose: "#e11d48",
  roseSoft: "#fff1f5",
  amber: "#d97706",
  amberSoft: "#fff7e0",
  violet: "#7c3aed",
  violetSoft: "#f2ebff"
};

const manualDate = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit"
}).format(new Date());

const staffAccessRows = [
  ["POS", "Create orders, collect payment, use customer info, print receipt"],
  ["Orders", "View, retrieve customer queue, edit active orders, print, serve, void queued or food serving"],
  ["Product List", "View all products, add stock only"],
  ["Stocks", "Add stock and review history"],
  ["Inventory", "View reports only"],
  ["Profile", "Change photo, name, and password"]
];

const adminAccessRows = [
  ["All Staff Actions", "Admin includes every Staff operation"],
  ["Dashboard", "Review revenue, low stock, and top selling items"],
  ["Orders", "Edit completed orders, void completed orders, edit void refund method"],
  ["Product List", "Create, edit, delete products and manage product details"],
  ["Stocks", "Add stock, deduct stock with reason, force update stock with PIN"],
  ["Reports", "Sales Report, Sales Transactions, Product Sales, export Excel or PDF"],
  ["Users", "Create and edit Staff users"],
  ["Edited List", "Review add, refund, and void correction history"]
];

const openingChecklist = [
  "Log in using your assigned account. Never share passwords between staff.",
  "Confirm the POS product grid is loading and active items show available stock.",
  "Review queued orders in Orders if customer orders were created from the public menu.",
  "Check Stocks or Inventory for low items before the sales shift begins.",
  "Keep the counter printer ready so receipts and queue numbers can be issued fast."
];

const staffPosSteps = [
  "Use Search and Categories to find the item quickly. Drinks stay at the end of category lists.",
  "Tap any product card to add it to the cart. Quantity controls prevent selling above stock.",
  "For combo or combined items, review allowed change items before confirming with the customer.",
  "Open Customer Info if you want to save optional name, phone number, or date of birth.",
  "Choose Cash, Card, or QR, then place the order. Queue details appear after a successful save.",
  "For customer orders created from the public menu, use Orders and Retrieve to bring the queue into the POS and collect payment."
];

const orderStatusRules = [
  {
    title: "Queued",
    tone: "violet",
    body: "Created by the public menu. Staff or Admin can view, print, retrieve, or void. No stock is deducted yet."
  },
  {
    title: "Food Serving",
    tone: "amber",
    body: "Active kitchen stage. Staff or Admin can view, edit, print, mark Served, or void. Sauce usage is entered here."
  },
  {
    title: "Completed",
    tone: "green",
    body: "Stock is deducted only after Served changes the order to Completed. Staff can view and print; Admin can also edit or void."
  },
  {
    title: "Void",
    tone: "rose",
    body: "Canceled sale. Admin and Master Admin can use Edit Void to correct the refund method when cash, card, or QR was entered wrong."
  }
];

const stockRules = [
  "Add Stock increases quantity only and can also save an optional expiry date for that batch.",
  "Deduct Stock is Admin or Master Admin only and requires a reason such as damage, waste, or expired stock.",
  "Force Update Stock sets the quantity directly without adding or subtracting from the previous total.",
  "Force Update requires the admin PIN first. Default PIN in the current system is 4422.",
  "Stocks page records movement history with performer name, reason, and date for audit review."
];

const reportCards = [
  ["Sales Report", "Daily merged totals by date range, with cash, card, QR, and export options."],
  ["Sales Transactions", "Transaction-wise order history with cash in or out, card in or out, QR in or out, status, and serve time."],
  ["Product Sales", "Saleable product summary by quantity sold, order touches, amount, category, and product type."]
];

const troubleshootingRows = [
  ["Customer queue has no payment yet", "Open Orders, retrieve the queue into POS, then collect payment and continue to Food Serving."],
  ["Wrong refund method on a void sale", "Open the void order in Orders and use Edit Void. Admin or Master Admin can correct the method."],
  ["Stock count is wrong", "Use Add Stock for receipts, Deduct Stock for controlled reductions, or Force Update for direct reconciliation."],
  ["Product cannot be sold", "Check whether stock is zero, low, inactive, or whether a Combined or Combo item lacks required materials."],
  ["Reports do not match expected totals", "Check date range, payment method, void corrections, and whether the order is Completed or still Food Serving."]
];

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function setFill(doc, hex) {
  doc.setFillColor(...hexToRgb(hex));
}

function setDraw(doc, hex) {
  doc.setDrawColor(...hexToRgb(hex));
}

function setText(doc, hex) {
  doc.setTextColor(...hexToRgb(hex));
}

async function fileToImage(filePath) {
  const data = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  const format = mime === "image/jpeg" ? "JPEG" : "PNG";
  return {
    dataUrl: `data:${mime};base64,${data.toString("base64")}`,
    format
  };
}

async function resolveLogo() {
  const settingsDir = path.join(rootDir, "server", "src", "uploads", "settings");
  try {
    const entries = await fs.readdir(settingsDir);
    const image = entries.find((entry) => /\.(png|jpg|jpeg|webp)$/i.test(entry));
    if (image) {
      return fileToImage(path.join(settingsDir, image));
    }
  } catch {
    // Fall back to favicon if settings logo is unavailable.
  }

  return fileToImage(path.join(clientDir, "public", "favicon.png"));
}

async function resolveProductImages(limit = 6) {
  const productsDir = path.join(rootDir, "server", "src", "uploads", "products");
  try {
    const entries = (await fs.readdir(productsDir))
      .filter((entry) => /\.(png|jpg|jpeg|webp)$/i.test(entry))
      .slice(0, limit);
    return Promise.all(entries.map((entry) => fileToImage(path.join(productsDir, entry))));
  } catch {
    return [];
  }
}

function drawPageBackground(doc, pageNo) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  setFill(doc, COLORS.page);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  setFill(doc, "#fffaf2");
  doc.roundedRect(22, 20, pageWidth - 44, pageHeight - 54, 24, 24, "F");

  setDraw(doc, COLORS.line);
  doc.setLineWidth(1);
  doc.line(38, pageHeight - 30, pageWidth - 38, pageHeight - 30);
  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`ASEN POS manual  |  Generated ${manualDate}`, 42, pageHeight - 16);
  doc.text(`Page ${pageNo}`, pageWidth - 42, pageHeight - 16, { align: "right" });
}

function drawPill(doc, x, y, label, fill = COLORS.orangeSoft, textColor = COLORS.orange) {
  const width = Math.max(52, label.length * 4.9 + 22);
  setFill(doc, fill);
  doc.roundedRect(x, y - 10, width, 18, 9, 9, "F");
  setText(doc, textColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label.toUpperCase(), x + 10, y + 2);
  return width;
}

function drawImageCard(doc, image, x, y, w, h, fit = "contain") {
  setFill(doc, COLORS.white);
  setDraw(doc, COLORS.line);
  doc.roundedRect(x, y, w, h, 18, 18, "FD");
  if (!image) {
    return;
  }

  const props = doc.getImageProperties(image.dataUrl);
  const usableW = w - 12;
  const usableH = h - 12;
  const ratio = fit === "cover" ? Math.max(usableW / props.width, usableH / props.height) : Math.min(usableW / props.width, usableH / props.height);
  const drawW = props.width * ratio;
  const drawH = props.height * ratio;
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;
  doc.addImage(image.dataUrl, image.format, drawX, drawY, drawW, drawH);
}

function writeParagraph(doc, text, x, y, width, options = {}) {
  const {
    size = 11,
    color = COLORS.slate,
    lineHeight = 15,
    font = "normal",
    maxLines = null
  } = options;
  setText(doc, color);
  doc.setFont("helvetica", font);
  doc.setFontSize(size);
  let lines = doc.splitTextToSize(text, width);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${lines[lastIndex].replace(/\s+$/, "")}...`;
  }
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawBulletList(doc, items, x, y, width, options = {}) {
  let cursorY = y;
  items.forEach((item) => {
    setFill(doc, options.bulletColor || COLORS.orange);
    doc.circle(x + 4, cursorY - 4, 2.4, "F");
    cursorY = writeParagraph(doc, item, x + 14, cursorY, width - 14, {
      size: options.size || 10.5,
      lineHeight: options.lineHeight || 14,
      color: options.color || COLORS.slate
    });
    cursorY += 6;
  });
  return cursorY;
}

function drawSectionTitle(doc, title, x, y, color = COLORS.ink) {
  setFill(doc, COLORS.orange);
  doc.roundedRect(x, y - 2, 34, 8, 4, 4, "F");
  setText(doc, color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, x + 42, y + 4);
  return y + 22;
}

function drawMiniCard(doc, { x, y, w, h, title, body, fill, titleColor, bodyColor = COLORS.slate }) {
  setFill(doc, fill);
  setDraw(doc, COLORS.line);
  doc.roundedRect(x, y, w, h, 18, 18, "FD");
  setText(doc, titleColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, x + 14, y + 22);
  writeParagraph(doc, body, x + 14, y + 38, w - 28, { size: 9.8, lineHeight: 13, color: bodyColor });
}

function drawFlowStep(doc, { x, y, w, h, index, title, body, fill, pillFill, pillText }) {
  setFill(doc, fill);
  setDraw(doc, COLORS.line);
  doc.roundedRect(x, y, w, h, 20, 20, "FD");
  drawPill(doc, x + 14, y + 18, index, pillFill, pillText);
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, x + 14, y + 42);
  writeParagraph(doc, body, x + 14, y + 56, w - 28, { size: 9.5, lineHeight: 12.5 });
}

function drawArrow(doc, x1, y, x2, color = COLORS.orange) {
  setDraw(doc, color);
  doc.setLineWidth(2);
  doc.line(x1, y, x2, y);
  doc.line(x2 - 8, y - 5, x2, y);
  doc.line(x2 - 8, y + 5, x2, y);
}

function drawStatusCard(doc, status, x, y, w, h) {
  const theme = {
    violet: [COLORS.violetSoft, COLORS.violet],
    amber: [COLORS.amberSoft, COLORS.amber],
    green: [COLORS.greenSoft, COLORS.green],
    rose: [COLORS.roseSoft, COLORS.rose]
  };
  const [fill, text] = theme[status.tone];
  setFill(doc, fill);
  setDraw(doc, COLORS.line);
  doc.roundedRect(x, y, w, h, 18, 18, "FD");
  drawPill(doc, x + 12, y + 18, status.title, fill, text);
  writeParagraph(doc, status.body, x + 12, y + 40, w - 24, { size: 9.5, lineHeight: 13 });
}

function drawComparisonRows(doc, rows, x, y, width, leftTitle, rightTitle, leftFill, rightFill) {
  const colGap = 10;
  const leftW = 125;
  const rightW = width - leftW - colGap;

  setFill(doc, leftFill);
  doc.roundedRect(x, y, leftW, 24, 12, 12, "F");
  setFill(doc, rightFill);
  doc.roundedRect(x + leftW + colGap, y, rightW, 24, 12, 12, "F");
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(leftTitle, x + 12, y + 16);
  doc.text(rightTitle, x + leftW + colGap + 12, y + 16);

  let cursorY = y + 34;
  rows.forEach(([label, value], index) => {
    const fill = index % 2 === 0 ? "#fffaf4" : "#ffffff";
    setFill(doc, fill);
    setDraw(doc, COLORS.line);
    doc.roundedRect(x, cursorY, leftW, 38, 10, 10, "FD");
    doc.roundedRect(x + leftW + colGap, cursorY, rightW, 38, 10, 10, "FD");
    setText(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, x + 10, cursorY + 16);
    writeParagraph(doc, value, x + leftW + colGap + 10, cursorY + 14, rightW - 20, { size: 9.4, lineHeight: 11.5 });
    cursorY += 46;
  });

  return cursorY;
}

function drawPosScreenMap(doc, x, y, w, h) {
  setFill(doc, COLORS.white);
  setDraw(doc, COLORS.line);
  doc.roundedRect(x, y, w, h, 24, 24, "FD");

  const leftW = w * 0.38;
  const rightW = w * 0.24;
  const centerW = w - leftW - rightW - 24;

  setFill(doc, COLORS.orangeSoft);
  doc.roundedRect(x + 12, y + 14, leftW - 8, 42, 14, 14, "F");
  setFill(doc, COLORS.blueSoft);
  doc.roundedRect(x + leftW + 8, y + 14, centerW, h - 28, 16, 16, "F");
  setFill(doc, COLORS.navySoft);
  doc.roundedRect(x + leftW + centerW + 20, y + 14, rightW - 12, h - 28, 16, 16, "F");

  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Search + Categories", x + 24, y + 40);
  doc.text("Product Grid", x + leftW + 24, y + 40);
  doc.text("Current Order Cart", x + leftW + centerW + 32, y + 40);

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const cardX = x + leftW + 24 + col * ((centerW - 24) / 2);
      const cardY = y + 60 + row * 58;
      setFill(doc, COLORS.white);
      doc.roundedRect(cardX, cardY, (centerW - 40) / 2, 44, 12, 12, "F");
    }
  }

  setFill(doc, COLORS.white);
  doc.roundedRect(x + leftW + centerW + 30, y + 56, rightW - 32, 122, 12, 12, "F");
  doc.roundedRect(x + leftW + centerW + 30, y + 186, rightW - 32, 32, 12, 12, "F");
  doc.roundedRect(x + leftW + centerW + 30, y + 226, rightW - 32, 44, 14, 14, "F");
}

function drawOrderBoard(doc, x, y, w, h) {
  setFill(doc, COLORS.white);
  setDraw(doc, COLORS.line);
  doc.roundedRect(x, y, w, h, 24, 24, "FD");

  const cardW = (w - 34) / 4;
  const tones = [
    [COLORS.violetSoft, "Queued"],
    [COLORS.amberSoft, "Food Serving"],
    [COLORS.greenSoft, "Completed"],
    [COLORS.roseSoft, "Void"]
  ];

  tones.forEach(([fill, label], index) => {
    setFill(doc, fill);
    doc.roundedRect(x + 12 + index * (cardW + 6), y + 14, cardW, 42, 12, 12, "F");
    setText(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, x + 24 + index * (cardW + 6), y + 39);
  });

  const tableY = y + 70;
  setDraw(doc, COLORS.line);
  doc.line(x + 14, tableY, x + w - 14, tableY);
  const headers = ["Order ID", "Status", "Actions"];
  const headerXs = [x + 18, x + 190, x + 300];
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  headers.forEach((header, index) => doc.text(header, headerXs[index], tableY + 14));

  for (let row = 0; row < 3; row += 1) {
    const rowY = tableY + 26 + row * 34;
    setDraw(doc, "#efe7d8");
    doc.line(x + 14, rowY + 18, x + w - 14, rowY + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, COLORS.slate);
    doc.text(`ORD-2026041${row + 1}`, x + 18, rowY + 8);
    doc.text(row === 0 ? "Queued" : row === 1 ? "Food Serving" : "Completed", x + 190, rowY + 8);
    drawPill(doc, x + 300, rowY + 4, row === 0 ? "Retrieve" : row === 1 ? "Served" : "Print", row === 2 ? COLORS.blueSoft : COLORS.orangeSoft, row === 2 ? COLORS.blue : COLORS.orange);
  }
}

function drawStockScreenMap(doc, x, y, w, h) {
  setFill(doc, COLORS.white);
  setDraw(doc, COLORS.line);
  doc.roundedRect(x, y, w, h, 24, 24, "FD");
  setFill(doc, COLORS.orangeSoft);
  doc.roundedRect(x + 14, y + 14, w - 28, 40, 12, 12, "F");
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Filters: search, type, status, date range", x + 26, y + 39);

  for (let row = 0; row < 4; row += 1) {
    const rowY = y + 66 + row * 44;
    setFill(doc, row % 2 === 0 ? "#fffaf4" : COLORS.white);
    setDraw(doc, COLORS.line);
    doc.roundedRect(x + 14, rowY, w - 28, 34, 10, 10, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setText(doc, COLORS.ink);
    doc.text("Product", x + 24, rowY + 21);
    doc.setFont("helvetica", "normal");
    setText(doc, COLORS.slate);
    doc.text("Add Stock", x + w - 200, rowY + 21);
    doc.text("Deduct", x + w - 130, rowY + 21);
    doc.text("Force", x + w - 74, rowY + 21);
  }
}

function drawLogoColumn(doc, logo, x, y, w, h) {
  setFill(doc, COLORS.white);
  setDraw(doc, COLORS.line);
  doc.roundedRect(x, y, w, h, 20, 20, "FD");
  drawImageCard(doc, logo, x + 16, y + 16, w - 32, 72, "contain");
  setFill(doc, COLORS.greenSoft);
  doc.roundedRect(x + 16, y + h - 104, w - 32, 72, 16, 16, "F");
  setText(doc, COLORS.green);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ADMIN NOTES", x + w / 2, y + h - 72, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize("Edit Void is available for Admin and Master Admin when the refund method was entered incorrectly.", w - 42);
  doc.text(lines, x + w / 2, y + h - 56, { align: "center" });
}

async function buildManual() {
  const [logo, productImages] = await Promise.all([resolveLogo(), resolveProductImages(6)]);
  await fs.mkdir(docsDir, { recursive: true });

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let pageNo = 1;

  const addStandardPage = (section, title, subtitle) => {
    doc.addPage();
    pageNo += 1;
    drawPageBackground(doc, pageNo);
    drawPill(doc, 44, 52, section, COLORS.orangeSoft, COLORS.orange);
    setText(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text(title, 44, 84);
    if (subtitle) {
      writeParagraph(doc, subtitle, 44, 102, pageWidth - 170, { size: 10.5, color: COLORS.slate, lineHeight: 14 });
    }
    drawImageCard(doc, logo, pageWidth - 110, 34, 56, 56, "contain");
  };

  drawPageBackground(doc, pageNo);
  setFill(doc, "#fffdf8");
  doc.roundedRect(34, 32, pageWidth - 68, 706, 28, 28, "F");
  drawImageCard(doc, logo, 44, 42, 94, 94, "contain");
  drawPill(doc, 154, 58, "Internal Guide", COLORS.orangeSoft, COLORS.orange);
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("ASEN POS User Manual", 154, 96);
  writeParagraph(doc, "Graphical operating guide for daily Staff and Admin work: selling, retrieving customer queues, serving, stock handling, reporting, and user control.", 154, 118, 320, { size: 12, lineHeight: 17 });

  drawMiniCard(doc, { x: 44, y: 164, w: 238, h: 150, title: "Staff Scope", body: "Use POS, handle active orders, retrieve menu queues, mark items served, add stock, review inventory, and update your own profile.", fill: COLORS.blueSoft, titleColor: COLORS.blue });
  drawMiniCard(doc, { x: 304, y: 164, w: 248, h: 150, title: "Admin Scope", body: "Includes all Staff actions plus dashboard, reports, user management for staff accounts, product control, completed-order edits, voids, and void corrections.", fill: COLORS.greenSoft, titleColor: COLORS.green });

  drawSectionTitle(doc, "Core Flow", 44, 350);
  [
    ["1", "Login", "Open your assigned account securely."],
    ["2", "Sell", "Use POS or retrieve a menu queue."],
    ["3", "Serve", "Confirm sauce usage and mark Served."],
    ["4", "Control", "Check stock, inventory, and reports."]
  ].forEach(([index, title, body], idx) => {
    const boxX = 44 + idx * 127;
    drawFlowStep(doc, { x: boxX, y: 368, w: 116, h: 92, index, title, body, fill: idx % 2 === 0 ? COLORS.orangeSoft : COLORS.blueSoft, pillFill: COLORS.white, pillText: COLORS.orange });
    if (idx < 3) {
      drawArrow(doc, boxX + 116, 414, boxX + 127);
    }
  });

  drawSectionTitle(doc, "What This Manual Covers", 44, 500);
  drawBulletList(doc, ["Login, navigation, and permissions for Staff and Admin", "POS selling flow including queue number handling and customer info", "Orders page actions by status, including retrieve, serve, void, and Edit Void", "Product control, stock update rules, inventory interpretation, and report exports", "Profile updates, user management, and daily troubleshooting"], 54, 522, 500);

  if (productImages.length > 0) {
    productImages.slice(0, 4).forEach((image, index) => drawImageCard(doc, image, 44 + index * 127, 670, 112, 92, "contain"));
  }

  addStandardPage("Navigation", "Role Access and Navigation", "Use this page to understand which menus belong to Staff and which controls are added for Admin.");
  drawComparisonRows(doc, staffAccessRows, 44, 126, 246, "Staff Menu", "What Staff Can Do", COLORS.blueSoft, COLORS.white);
  drawComparisonRows(doc, adminAccessRows, 304, 126, 248, "Admin Menu", "What Admin Adds", COLORS.greenSoft, COLORS.white);
  drawSectionTitle(doc, "Order Status Map", 44, 500);
  orderStatusRules.forEach((status, index) => drawStatusCard(doc, status, 44 + (index % 2) * 254, 522 + Math.floor(index / 2) * 102, 240, 88));
  drawArrow(doc, 164, 717, 248, COLORS.violet);
  drawArrow(doc, 298, 717, 382, COLORS.orange);
  drawArrow(doc, 432, 717, 516, COLORS.green);
  writeParagraph(doc, "Customer menu orders start as Queued. Staff-created POS orders start as Food Serving. Inventory is deducted only after the order is marked Served and becomes Completed.", 44, 742, 508, { size: 10, lineHeight: 13.5 });

  addStandardPage("Staff", "Staff Daily Workflow", "This is the fastest safe routine for a normal sales shift.");
  drawSectionTitle(doc, "Opening Checklist", 44, 132);
  drawBulletList(doc, openingChecklist, 54, 154, 500, { size: 10.2 });
  drawSectionTitle(doc, "Staff Sales Flow", 44, 282);
  [["1", "Find Item", "Use search and categories to locate products."], ["2", "Build Cart", "Add quantity, review alternatives, and confirm the cart."], ["3", "Add Customer Info", "Optional details help future follow-up marketing."], ["4", "Take Payment", "Choose Cash, Card, or QR, then place the order."], ["5", "Serve", "Open Orders, confirm sauce usage, and mark Served."], ["6", "Complete", "The order moves to Completed and stock is deducted."]].forEach(([index, title, body], idx) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    drawFlowStep(doc, { x: 44 + col * 170, y: 304 + row * 118, w: 156, h: 102, index, title, body, fill: row === 0 ? COLORS.orangeSoft : COLORS.blueSoft, pillFill: COLORS.white, pillText: row === 0 ? COLORS.orange : COLORS.blue });
  });
  drawSectionTitle(doc, "Important Staff Notes", 44, 560);
  drawBulletList(doc, ["Customer queue orders are unpaid until they are retrieved into POS and saved with a payment method.", "Staff can void queued and food-serving orders, but Staff cannot void completed orders.", "Staff can add stock, but Staff cannot deduct stock, force update stock, manage users, or open reports.", "If a customer asks for a receipt again, use Orders and Print Order."], 54, 582, 500, { size: 10.1 });

  addStandardPage("Staff", "POS and Orders Screen Guide", "These graphics show how the main Staff screens are organized and what to check before saving.");
  drawSectionTitle(doc, "POS Terminal Map", 44, 132);
  drawPosScreenMap(doc, 44, 150, 508, 290);
  drawBulletList(doc, staffPosSteps, 54, 460, 500, { size: 10 });
  drawSectionTitle(doc, "Orders Board Map", 44, 612);
  drawOrderBoard(doc, 44, 630, 508, 146);

  addStandardPage("Admin", "Admin Control Workflow", "Admin keeps daily operations accurate by controlling completed orders, reporting, products, and staff accounts.");
  drawSectionTitle(doc, "Admin Daily Checklist", 44, 132);
  drawBulletList(doc, ["Review Dashboard for total revenue, order count, low stock, and top-selling items.", "Open Orders for customer queues, completed order corrections, and any void requests from the counter.", "Use Reports to verify cash, card, and QR totals before closing the day.", "Use Edited List to review add, refund, and void-correction audit history.", "Maintain Staff users from Users and update products, prices, descriptions, and images from Product List."], 54, 154, 500, { size: 10.2 });
  drawSectionTitle(doc, "Admin Order Permissions", 44, 312);
  drawMiniCard(doc, { x: 44, y: 330, w: 162, h: 124, title: "Completed Edit", body: "Admin can edit completed orders. If the amount changes, collection or refund method must be selected.", fill: COLORS.blueSoft, titleColor: COLORS.blue });
  drawMiniCard(doc, { x: 218, y: 330, w: 162, h: 124, title: "Completed Void", body: "Admin can void completed orders and the payment flow is pushed to Cash, Card, or QR Out correctly.", fill: COLORS.roseSoft, titleColor: COLORS.rose });
  drawMiniCard(doc, { x: 392, y: 330, w: 160, h: 124, title: "Edit Void", body: "If the wrong refund method was chosen yesterday, Admin can reopen the void and correct the method.", fill: COLORS.violetSoft, titleColor: COLORS.violet });
  drawSectionTitle(doc, "Reporting and Close Review", 44, 494);
  reportCards.forEach(([title, body], index) => drawMiniCard(doc, { x: 44 + index * 170, y: 512, w: 160, h: 116, title, body, fill: index === 0 ? COLORS.greenSoft : index === 1 ? COLORS.blueSoft : COLORS.orangeSoft, titleColor: index === 0 ? COLORS.green : index === 1 ? COLORS.blue : COLORS.orange }));
  writeParagraph(doc, "Reports are available to Admin, Master Admin, and Checker. Staff does not have access to Dashboard, Reports, Users, or Edited List.", 44, 670, 508, { size: 10.2, lineHeight: 14 });

  addStandardPage("Control", "Product, Stocks, and Inventory", "Admin manages the product master data while Staff and Admin both work from stock-related screens.");
  drawSectionTitle(doc, "Product and Stock Tools", 44, 132);
  drawStockScreenMap(doc, 44, 150, 352, 260);
  drawLogoColumn(doc, logo, 412, 150, 140, 260);
  drawSectionTitle(doc, "Stock Rules", 44, 448);
  drawBulletList(doc, stockRules, 54, 470, 500, { size: 10.1 });
  if (productImages.length > 0) {
    drawSectionTitle(doc, "Visual Product Reference", 44, 628);
    productImages.slice(0, 4).forEach((image, index) => drawImageCard(doc, image, 44 + index * 127, 646, 112, 110, "contain"));
  }

  addStandardPage("Reports", "Users, Audit Trail, and Profile", "This page covers the controls that keep operations secure and reviewable.");
  drawSectionTitle(doc, "Users and Audit", 44, 132);
  drawMiniCard(doc, { x: 44, y: 150, w: 160, h: 122, title: "Users", body: "Admin can create and edit Staff users only. Master Admin can create Admin, Checker, and Staff users.", fill: COLORS.blueSoft, titleColor: COLORS.blue });
  drawMiniCard(doc, { x: 218, y: 150, w: 160, h: 122, title: "Edited List", body: "Shows order-level adjustment history including add amount, refund amount, and void refund corrections.", fill: COLORS.violetSoft, titleColor: COLORS.violet });
  drawMiniCard(doc, { x: 392, y: 150, w: 160, h: 122, title: "Profile", body: "Every role can open the user card, update name or photo, and change password safely from My Profile.", fill: COLORS.greenSoft, titleColor: COLORS.green });
  drawSectionTitle(doc, "Report Summary Reference", 44, 314);
  drawComparisonRows(doc, [["Sales Report", "Merged totals by date, click a date to open that day's orders."], ["Sales Transactions", "Per-order cash, card, and QR in or out with serve time and edit count."], ["Product Sales", "Product-wise sold quantity and amount for saleable items only."], ["Export", "Sales and transaction screens can export Excel and PDF from the date-range tools."]], 44, 332, 508, "Report Item", "What It Shows", COLORS.orangeSoft, COLORS.white);
  setFill(doc, COLORS.orangeSoft);
  doc.roundedRect(44, 564, 508, 168, 22, 22, "F");
  drawSectionTitle(doc, "Master Admin Note", 58, 580);
  drawBulletList(doc, ["Shop Profile is Master Admin only and controls the shop name, address, and logo used across invoices and report exports.", "Delete Order is Master Admin only and is protected by the admin PIN flow.", "This manual focuses on Staff and Admin operations because those are the daily counter workflows."], 68, 602, 472, { size: 10.2 });

  addStandardPage("Support", "Best Practices and Troubleshooting", "Use these quick answers during live operation so issues can be corrected without confusion.");
  drawSectionTitle(doc, "Quick Answers", 44, 132);
  drawComparisonRows(doc, troubleshootingRows, 44, 150, 508, "Situation", "What To Do", COLORS.roseSoft, COLORS.white);
  drawSectionTitle(doc, "Daily Good Practice", 44, 520);
  drawBulletList(doc, ["Serve orders as soon as food is handed over so inventory stays correct.", "If a completed order changes price, always choose the real collection or refund method before saving the edit.", "Use Add Stock for deliveries, Deduct Stock for controlled loss, and Force Update only for count reconciliation.", "Check Sales Report and Sales Transactions together before closing cash for the day.", "Use your own account only, then update your password and profile photo from My Profile when needed."], 54, 542, 500, { size: 10.2 });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  await fs.writeFile(outputPath, pdfBuffer);
  return outputPath;
}

buildManual()
  .then((filePath) => {
    console.log(`User manual PDF generated: ${filePath}`);
  })
  .catch((error) => {
    console.error("Failed to generate user manual PDF");
    console.error(error);
    process.exitCode = 1;
  });
