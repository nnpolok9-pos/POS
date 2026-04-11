require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { connectDB, disconnectDB } = require("../src/config/db");
const { getAllProducts } = require("../src/lib/dataStore");
const { inferProductType, isCompositeProductType, buildCompositeRequirements } = require("../src/lib/productLogic");

const PRODUCT_TYPE_LABELS = {
  raw: "A La Catre",
  raw_material: "Base",
  sauce: "Sauce",
  seasoning: "Seasoning",
  combo: "Combined",
  combo_type: "Combo"
};

const STOCK_UNIT_LABELS = {
  pieces: "Piece",
  gram: "Gram",
  teaspoon: "Tea Spoon"
};

const formatType = (type) => PRODUCT_TYPE_LABELS[type] || type || "Unknown";
const formatUnit = (unit) => STOCK_UNIT_LABELS[unit] || unit || "Piece";

const normalize = (value) => String(value || "").trim().toLowerCase();

const resolveProductId = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }

  return String(value);
};

const findTargetProduct = (products, selector) => {
  const normalizedSelector = normalize(selector);

  return (
    products.find((product) => normalize(product.id) === normalizedSelector) ||
    products.find((product) => normalize(product.sku) === normalizedSelector) ||
    products.find((product) => normalize(product.name) === normalizedSelector) ||
    products.find((product) => normalize(product.name).includes(normalizedSelector))
  );
};

const buildExpansionTree = (product, productMap, multiplier = 1, trail = []) => {
  const productId = String(product?.id || product?._id || "");
  const productType = inferProductType(product);
  const node = {
    id: productId,
    name: product?.name || "Unknown product",
    sku: product?.sku || "",
    productType,
    stockUnit: product?.stockUnit || "pieces",
    multiplier,
    children: []
  };

  if (!isCompositeProductType(productType)) {
    return node;
  }

  if (!product?.comboItems?.length) {
    node.note = "No composition found";
    return node;
  }

  if (trail.includes(productId)) {
    node.note = "Circular reference detected";
    return node;
  }

  const nextTrail = [...trail, productId];
  node.children = product.comboItems.map((comboItem) => {
    const childId = resolveProductId(comboItem.product);
    const child = productMap.get(childId);
    const lineQuantity = Number(comboItem.quantity || 0);

    if (!child) {
      return {
        id: childId,
        name: "Missing linked product",
        sku: "",
        productType: "missing",
        stockUnit: "pieces",
        multiplier: multiplier * lineQuantity,
        lineQuantity,
        note: "Product not found"
      };
    }

    const childNode = buildExpansionTree(child, productMap, multiplier * lineQuantity, nextTrail);
    childNode.lineQuantity = lineQuantity;
    childNode.sourceProductName = product.name;
    return childNode;
  });

  return node;
};

const printTree = (node, indent = "") => {
  const linePrefix = indent ? `${indent}- ` : "";
  const quantityText = node.lineQuantity !== undefined ? `line qty ${node.lineQuantity}` : `effective qty ${node.multiplier}`;
  const skuText = node.sku ? ` | ${node.sku}` : "";
  const noteText = node.note ? ` | ${node.note}` : "";

  console.log(
    `${linePrefix}${node.name} [${formatType(node.productType)} | ${formatUnit(node.stockUnit)} | ${quantityText}]${skuText}${noteText}`
  );

  node.children.forEach((child) => printTree(child, `${indent}  `));
};

const main = async () => {
  const selector = process.argv.slice(2).join(" ").trim();

  if (!selector) {
    console.error("Usage: node server/scripts/inspectCompositeRequirements.js <product-name|sku|id>");
    process.exitCode = 1;
    return;
  }

  await connectDB();

  try {
    const products = await getAllProducts();
    const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));
    const targetProduct = findTargetProduct(products, selector);

    if (!targetProduct) {
      console.error(`No product found for selector: ${selector}`);
      process.exitCode = 1;
      return;
    }

    const targetType = inferProductType(targetProduct);
    console.log("Product");
    console.log("-------");
    console.log(`Name       : ${targetProduct.name}`);
    console.log(`SKU        : ${targetProduct.sku || "-"}`);
    console.log(`ID         : ${targetProduct.id || targetProduct._id}`);
    console.log(`Type       : ${formatType(targetType)}`);
    console.log(`Unit       : ${formatUnit(targetProduct.stockUnit)}`);
    console.log(`Stock      : ${Number(targetProduct.stock || 0)}`);
    console.log("");

    console.log("Direct Composition");
    console.log("------------------");
    if (!targetProduct.comboItems?.length) {
      console.log("This product has no combo_items stored.");
    } else {
      targetProduct.comboItems.forEach((comboItem, index) => {
        const child = productMap.get(resolveProductId(comboItem.product));
        console.log(
          `${index + 1}. ${child?.name || "Missing linked product"} | qty ${Number(comboItem.quantity || 0)} | ${
            child ? formatType(inferProductType(child)) : "Missing"
          } | ${child ? formatUnit(child.stockUnit) : "-"}`
        );
      });
    }
    console.log("");

    console.log("Expansion Tree");
    console.log("--------------");
    printTree(buildExpansionTree(targetProduct, productMap));
    console.log("");

    console.log("Flattened Base Requirements");
    console.log("---------------------------");
    const requirements = buildCompositeRequirements(targetProduct, productMap);

    if (!requirements?.size) {
      console.log("No flattened requirements could be calculated.");
      return;
    }

    [...requirements.entries()]
      .map(([requiredProductId, requiredQuantity]) => {
        const baseProduct = productMap.get(String(requiredProductId));
        return {
          name: baseProduct?.name || "Missing linked product",
          sku: baseProduct?.sku || "",
          productType: inferProductType(baseProduct || {}),
          stockUnit: baseProduct?.stockUnit || "pieces",
          requiredQuantity: Number(requiredQuantity || 0),
          currentStock: Number(baseProduct?.stock || 0)
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((row, index) => {
        console.log(
          `${index + 1}. ${row.name} | ${row.requiredQuantity} ${formatUnit(row.stockUnit)} | current stock ${row.currentStock} | ${formatType(row.productType)}${row.sku ? ` | ${row.sku}` : ""}`
        );
      });
  } finally {
    await disconnectDB();
  }
};

main().catch(async (error) => {
  console.error(error);
  await disconnectDB();
  process.exitCode = 1;
});
