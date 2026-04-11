const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const apiBaseUrl = process.env.VERIFY_API_URL || "http://localhost:5000/api";
const clientUrl = process.env.VERIFY_CLIENT_URL || "http://localhost:5173";
const verifyEmail = process.env.VERIFY_EMAIL || "admin@fastbites.com";
const verifyPassword = process.env.VERIFY_PASSWORD || "admin123";

const requiredFiles = [
  ".gitignore",
  "DEPLOYMENT-NOTES.md",
  "server/.env.example",
  "client/.env.example",
  "server/src/server.js",
  "server/src/config/db.js",
  "client/src/services/api.js"
];

const requiredIgnoreEntries = [
  ".env",
  ".env.*",
  "node_modules/",
  "server/src/uploads/",
  "*.log",
  "dist/",
  "build/",
  ".mysql-test/",
  "server/.mongo-data/"
];

const ensureFileExists = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
};

const ensureGitignoreEntries = () => {
  const gitignore = fs.readFileSync(path.join(rootDir, ".gitignore"), "utf8");

  for (const entry of requiredIgnoreEntries) {
    if (!gitignore.includes(entry)) {
      throw new Error(`Missing .gitignore entry: ${entry}`);
    }
  }
};

const runClientBuild = () => {
  console.log("Building client for verification...");
  execSync("npm run build --prefix client", {
    cwd: rootDir,
    stdio: "inherit"
  });
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${url} -> ${response.status} ${response.statusText} ${JSON.stringify(data)}`);
  }

  return data;
};

const requestStatus = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${url} -> ${response.status} ${response.statusText}`);
  }

  return response.status;
};

const toServerAssetUrl = (assetPath) => {
  if (!assetPath) {
    return null;
  }

  const serverBase = apiBaseUrl.replace(/\/api\/?$/, "");
  return `${serverBase}${assetPath}`;
};

const runHttpSmokeChecks = async () => {
  console.log("Checking client URL...");
  await requestStatus(clientUrl);

  console.log("Checking API health...");
  const health = await requestJson(`${apiBaseUrl}/health`);

  if (health?.status !== "ok") {
    throw new Error(`Unexpected API health response: ${JSON.stringify(health)}`);
  }

  console.log("Checking public shop settings...");
  const shopSettings = await requestJson(`${apiBaseUrl}/shop-settings/public`);
  const logoUrl = toServerAssetUrl(shopSettings?.logo);
  if (logoUrl) {
    await requestStatus(logoUrl);
  }

  console.log("Checking public menu...");
  const publicMenu = await requestJson(`${apiBaseUrl}/products/public/menu`);
  if (!Array.isArray(publicMenu)) {
    throw new Error("Public menu response is not an array");
  }
  if (publicMenu.length > 0) {
    const firstImageUrl = toServerAssetUrl(publicMenu[0]?.image);
    if (firstImageUrl) {
      await requestStatus(firstImageUrl);
    }
  }

  console.log("Logging in with verification user...");
  const login = await requestJson(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: verifyEmail,
      password: verifyPassword
    })
  });

  if (!login?.token) {
    throw new Error("Login succeeded but no token was returned");
  }

  const authHeaders = {
    Authorization: `Bearer ${login.token}`
  };

  console.log("Checking authenticated profile...");
  await requestJson(`${apiBaseUrl}/auth/me`, {
    headers: authHeaders
  });

  console.log("Checking admin product list...");
  await requestJson(`${apiBaseUrl}/products/admin/all`, {
    headers: authHeaders
  });

  console.log("Checking order history endpoint...");
  await requestJson(`${apiBaseUrl}/orders`, {
    headers: authHeaders
  });

  console.log("Checking dashboard report endpoint...");
  await requestJson(`${apiBaseUrl}/reports/dashboard`, {
    headers: authHeaders
  });
};

const main = async () => {
  console.log("Verifying repository safety files...");
  requiredFiles.forEach(ensureFileExists);
  ensureGitignoreEntries();

  runClientBuild();
  await runHttpSmokeChecks();

  console.log("");
  console.log("Local verification passed.");
  console.log(`Client: ${clientUrl}`);
  console.log(`API: ${apiBaseUrl}`);
};

main().catch((error) => {
  console.error("");
  console.error("Local verification failed.");
  console.error(error.message);
  process.exit(1);
});
