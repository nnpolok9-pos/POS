const { connectDB, disconnectDB, query } = require("../src/config/db");

const NON_COMPOSITE_TYPES = ["raw", "raw_material", "sauce", "seasoning"];

const run = async () => {
  try {
    await connectDB();

    const beforeRows = await query(
      `SELECT id, name, product_type, combo_items
       FROM products
       WHERE product_type IN ('raw', 'raw_material', 'sauce', 'seasoning')
         AND JSON_LENGTH(combo_items) > 0`
    );

    if (!beforeRows.length) {
      console.log("No non-composite products with leftover combo_items were found.");
      return;
    }

    console.log(`Found ${beforeRows.length} non-composite product(s) with leftover combo_items.`);
    beforeRows.forEach((row) => {
      console.log(`- ${row.name} [${row.product_type}]`);
    });

    await query(
      `UPDATE products
       SET combo_items = JSON_ARRAY()
       WHERE product_type IN ('raw', 'raw_material', 'sauce', 'seasoning')
         AND JSON_LENGTH(combo_items) > 0`
    );

    const afterRows = await query(
      `SELECT COUNT(*) AS remaining
       FROM products
       WHERE product_type IN ('raw', 'raw_material', 'sauce', 'seasoning')
         AND JSON_LENGTH(combo_items) > 0`
    );

    console.log(`Cleanup complete. Remaining mismatched records: ${Number(afterRows[0]?.remaining || 0)}`);
    console.log(`Checked product types: ${NON_COMPOSITE_TYPES.join(", ")}`);
  } catch (error) {
    console.error("Failed to clean up non-composite combo_items:", error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
