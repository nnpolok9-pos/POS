const generateSku = (name, category) => {
  const namePart = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "PRD";
  const categoryPart = category.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "CAT";
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${categoryPart}-${namePart}-${randomPart}`;
};

module.exports = generateSku;
