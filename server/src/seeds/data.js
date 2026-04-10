const users = [
  {
    name: "Master Admin",
    email: "master@fastbites.com",
    password: "master123",
    role: "master_admin"
  },
  {
    name: "Admin User",
    email: "admin@fastbites.com",
    password: "admin123",
    role: "admin"
  },
  {
    name: "Checker User",
    email: "checker@fastbites.com",
    password: "checker123",
    role: "checker"
  },
  {
    name: "Staff User",
    email: "staff@fastbites.com",
    password: "staff123",
    role: "staff"
  }
];

const products = [
  { name: "Classic Burger", regularPrice: 8000, promotionalPrice: 7000, price: 7000, category: "Burger", categoryKh: "ប៊ឺហ្គឺ", stock: 50, sku: "BUR-CLA-1001", image: "/uploads/products/1775143735862-classic-burger.jpeg", productType: "raw", forSale: true, stockUnit: "pieces" },
  { name: "Cheese Burger", regularPrice: 10000, promotionalPrice: 9000, price: 9000, category: "Burger", categoryKh: "ប៊ឺហ្គឺ", stock: 40, sku: "BUR-CHE-1002", image: "/uploads/products/1775143761839-cheezy-burger.jpeg", productType: "raw", forSale: true, stockUnit: "pieces" },
  { name: "Chicken Burger", regularPrice: 9000, promotionalPrice: 8000, price: 8000, category: "Burger", categoryKh: "ប៊ឺហ្គឺ", stock: 35, sku: "BUR-CHK-1003", image: "/uploads/products/1775144602171-colonel-burger.jpeg", productType: "raw", forSale: true, stockUnit: "pieces" },
  { name: "Nugget", regularPrice: 6000, promotionalPrice: 5000, price: 5000, category: "Side Dish", categoryKh: "ម្ហូបបន្ថែម", stock: 80, sku: "SID-NUG-5122", image: "/uploads/products/1775148867408-nugget.jpeg", productType: "raw", forSale: true, stockUnit: "pieces" },
  { name: "Tinders", regularPrice: 6500, promotionalPrice: 5500, price: 5500, category: "Side Dish", categoryKh: "ម្ហូបបន្ថែម", stock: 70, sku: "SID-TIN-3257", image: "/uploads/products/1775148896863-tinders.jpeg", productType: "raw", forSale: true, stockUnit: "pieces" },
  { name: "Pepsi Can", regularPrice: 4500, promotionalPrice: 4000, price: 4000, category: "Drinks", categoryKh: "ភេសជ្ជៈ", stock: 120, sku: "DRI-PEP-2301", image: "/uploads/products/1775406205341-pepsi-reg-33-can-sleek-beauty-shot-drops-closed-(2).png", productType: "raw", forSale: true, stockUnit: "pieces" }
];

module.exports = { users, products };
